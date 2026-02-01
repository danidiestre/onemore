import { supabase } from '@/lib/supabase';
import { ensureAuthenticated } from '@/lib/auth';

export async function claimParticipant(participantId: string): Promise<void> {
  const user = await ensureAuthenticated();

  // Atomic claim: only update if claimed_by_user_id is null
  const { data, error } = await supabase
    .from('participants')
    .update({ claimed_by_user_id: user.id })
    .eq('id', participantId)
    .is('claimed_by_user_id', null)
    .select();

  if (error) throw error;

  // If no rows were updated, it means someone else claimed it
  if (!data || data.length === 0) {
    throw new Error('This participant was already claimed by someone else');
  }
}
