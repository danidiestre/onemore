import { supabase } from '@/lib/supabase';
import { ensureAuthenticated } from '@/lib/auth';
import type { Session, Participant, DrinkType, DrinkEvent } from '@/types/database';
import { generateInviteCode } from '@/utils/invite';

export interface SessionData {
  participants: Participant[];
  drinkTypes: DrinkType[];
  events: DrinkEvent[];
  inviteCode: string;
  isOwner: boolean;
  sessionName: string;
}

export async function createSession(
  name: string,
  participantNames: string[]
): Promise<Session> {
  const user = await ensureAuthenticated();

  const inviteCode = generateInviteCode();

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      owner_user_id: user.id,
      name,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (sessionError) throw sessionError;
  if (!session) throw new Error('Failed to create session');

  // Create participants
  const participantsData = participantNames.map((name, index) => ({
    session_id: session.id,
    display_name: name,
    claimed_by_user_id: null,
    color_index: index, // Assign color based on creation order
  }));

  const { error: participantsError } = await supabase
    .from('participants')
    .insert(participantsData);

  if (participantsError) throw participantsError;

  // Create default drink types
  const defaultDrinkTypes = [
    { session_id: session.id, name: 'Cerveza', category: 'beer', price_cents: 300, emoji: '🍺', sort_order: 0 },
    { session_id: session.id, name: 'Refresco', category: 'soft', price_cents: 250, emoji: '🥤', sort_order: 1 },
    { session_id: session.id, name: 'Copa', category: 'cocktail', price_cents: 800, emoji: '🍸', sort_order: 2 },
  ];

  const { error: drinkTypesError } = await supabase
    .from('drink_types')
    .insert(defaultDrinkTypes);

  if (drinkTypesError) throw drinkTypesError;

  return session;
}

export async function loadSessionData(sessionId: string): Promise<SessionData> {
  const user = await ensureAuthenticated();

  // Load session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;
  if (!session) throw new Error('Session not found');

  // Load participants
  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at');

  if (participantsError) throw participantsError;

  // Load drink types
  const { data: drinkTypes, error: drinkTypesError } = await supabase
    .from('drink_types')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order');

  if (drinkTypesError) throw drinkTypesError;

  // Load events
  const { data: events, error: eventsError } = await supabase
    .from('drink_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (eventsError) throw eventsError;

  return {
    participants: participants || [],
    drinkTypes: drinkTypes || [],
    events: events || [],
    inviteCode: session.invite_code,
    isOwner: session.owner_user_id === user.id,
    sessionName: session.name,
  };
}

export async function addDrinkEvent(
  sessionId: string,
  participantId: string,
  drinkTypeId: string,
  delta: 1 | -1
): Promise<void> {
  const user = await ensureAuthenticated();

  const { error } = await supabase
    .from('drink_events')
    .insert({
      session_id: sessionId,
      actor_user_id: user.id,
      target_participant_id: participantId,
      drink_type_id: drinkTypeId,
      delta,
    });

  if (error) throw error;
}

export async function updateDrinkType(
  sessionId: string,
  drinkTypeId: string,
  updates: Partial<Pick<DrinkType, 'name' | 'emoji' | 'price_cents' | 'category'>>
): Promise<void> {
  const { error } = await supabase
    .from('drink_types')
    .update(updates)
    .eq('id', drinkTypeId)
    .eq('session_id', sessionId);

  if (error) throw error;
}

export async function deleteDrinkType(
  sessionId: string,
  drinkTypeId: string
): Promise<void> {
  const { error } = await supabase
    .from('drink_types')
    .delete()
    .eq('id', drinkTypeId)
    .eq('session_id', sessionId);

  if (error) throw error;
}

export async function reorderDrinkType(
  sessionId: string,
  drinkTypeId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const { data: drinkTypes, error: fetchError } = await supabase
    .from('drink_types')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order');

  if (fetchError) throw fetchError;
  if (!drinkTypes || !drinkTypes.data) return;

  const sorted = drinkTypes.data.sort((a, b) => a.sort_order - b.sort_order);
  const index = sorted.findIndex(dt => dt.id === drinkTypeId);
  if (index === -1) return;

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= sorted.length) return;

  const current = sorted[index];
  const target = sorted[newIndex];

  // Swap sort orders
  const { error: error1 } = await supabase
    .from('drink_types')
    .update({ sort_order: target.sort_order })
    .eq('id', current.id);

  if (error1) throw error1;

  const { error: error2 } = await supabase
    .from('drink_types')
    .update({ sort_order: current.sort_order })
    .eq('id', target.id);

  if (error2) throw error2;
}

export async function addParticipantSlot(
  sessionId: string,
  name: string,
  colorIndex?: number
): Promise<void> {
  const insertData: any = {
    session_id: sessionId,
    display_name: name,
    claimed_by_user_id: null,
  };
  
  // Include color_index if provided
  if (colorIndex !== undefined && colorIndex !== null) {
    insertData.color_index = colorIndex;
  }
  
  const { error } = await supabase
    .from('participants')
    .insert(insertData);

  if (error) throw error;
}

export async function removeParticipantSlot(
  sessionId: string,
  participantId: string
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('session_id', sessionId);

  if (error) throw error;
}

export async function updateParticipant(
  sessionId: string,
  participantId: string,
  updates: Partial<Pick<Participant, 'display_name' | 'color_index'>>
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', participantId)
    .eq('session_id', sessionId);

  if (error) throw error;
}

export async function addDrinkType(
  sessionId: string,
  drinkType: {
    name: string;
    emoji: string;
    category: 'beer' | 'soft' | 'cocktail';
    price_cents: number;
    sort_order: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from('drink_types')
    .insert({
      session_id: sessionId,
      ...drinkType,
    });

  if (error) throw error;
}
