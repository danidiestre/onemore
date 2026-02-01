export interface Session {
  id: string;
  owner_user_id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  display_name: string;
  claimed_by_user_id: string | null;
  color_index: number | null;
  created_at: string;
}

export interface DrinkType {
  id: string;
  session_id: string;
  name: string;
  category: 'beer' | 'soft' | 'cocktail';
  price_cents: number;
  emoji: string;
  sort_order: number;
  created_at: string;
}

export interface DrinkEvent {
  id: string;
  session_id: string;
  actor_user_id: string;
  target_participant_id: string;
  drink_type_id: string;
  delta: -1 | 1;
  created_at: string;
}
