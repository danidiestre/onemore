-- DrinkCounter Supabase Migration
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  claimed_by_user_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, display_name)
);

-- Drink types table
CREATE TABLE IF NOT EXISTS drink_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('beer', 'soft', 'cocktail')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  emoji TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drink events table
CREATE TABLE IF NOT EXISTS drink_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  target_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  drink_type_id UUID NOT NULL REFERENCES drink_types(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON sessions(invite_code);
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_claimed ON participants(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drink_types_session_id ON drink_types(session_id);
CREATE INDEX IF NOT EXISTS idx_drink_events_session_id ON drink_events(session_id);
CREATE INDEX IF NOT EXISTS idx_drink_events_target_participant ON drink_events(target_participant_id);
CREATE INDEX IF NOT EXISTS idx_drink_events_created_at ON drink_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
-- Allow select for authenticated users (anyone with invite code can view)
CREATE POLICY "sessions_select_authenticated" ON sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert for authenticated users
CREATE POLICY "sessions_insert_authenticated" ON sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

-- Allow update only for owner
CREATE POLICY "sessions_update_owner" ON sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Allow delete only for owner (cascade removes participants, drink_types, drink_events)
CREATE POLICY "sessions_delete_owner" ON sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- RLS Policies for participants
-- Allow select for authenticated users if they can access the session
CREATE POLICY "participants_select_authenticated" ON participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participants.session_id
    )
  );

-- Allow insert only for session owner
CREATE POLICY "participants_insert_owner" ON participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participants.session_id
      AND sessions.owner_user_id = auth.uid()
    )
  );

-- Allow update for claim operation (any authenticated user can claim if null)
-- AND for owner to update anything
CREATE POLICY "participants_update_claim_or_owner" ON participants
  FOR UPDATE
  TO authenticated
  USING (
    -- Owner can update anything
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participants.session_id
      AND sessions.owner_user_id = auth.uid()
    )
    OR
    -- Anyone can claim if not already claimed
    (claimed_by_user_id IS NULL AND NEW.claimed_by_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participants.session_id
      AND sessions.owner_user_id = auth.uid()
    )
    OR
    (OLD.claimed_by_user_id IS NULL AND NEW.claimed_by_user_id = auth.uid())
  );

-- Allow delete only for owner
CREATE POLICY "participants_delete_owner" ON participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participants.session_id
      AND sessions.owner_user_id = auth.uid()
    )
  );

-- RLS Policies for drink_types
-- Allow select for authenticated users if they can access the session
CREATE POLICY "drink_types_select_authenticated" ON drink_types
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drink_types.session_id
    )
  );

-- Allow insert/update/delete only for owner
CREATE POLICY "drink_types_modify_owner" ON drink_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drink_types.session_id
      AND sessions.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drink_types.session_id
      AND sessions.owner_user_id = auth.uid()
    )
  );

-- RLS Policies for drink_events
-- Allow select for authenticated users if they can access the session
CREATE POLICY "drink_events_select_authenticated" ON drink_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drink_events.session_id
    )
  );

-- Allow insert for authenticated users if they can access the session
CREATE POLICY "drink_events_insert_authenticated" ON drink_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drink_events.session_id
    )
    AND actor_user_id = auth.uid()
  );

-- Participant balances (amount to pay per participant, persisted when computed)
CREATE TABLE IF NOT EXISTS participant_balances (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_balances_session_id ON participant_balances(session_id);

ALTER TABLE participant_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participant_balances_select" ON participant_balances
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = participant_balances.session_id)
  );

CREATE POLICY "participant_balances_insert_update" ON participant_balances
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participant_balances.session_id
      AND sessions.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = participant_balances.session_id
      AND sessions.owner_user_id = auth.uid()
    )
  );

-- Note: Enable Realtime replication in Supabase Dashboard:
-- Go to Database > Replication
-- Enable replication for: sessions, participants, drink_types, drink_events, participant_balances
