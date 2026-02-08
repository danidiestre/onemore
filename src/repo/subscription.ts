import { supabase } from '@/lib/supabase';
import { ensureAuthenticated } from '@/lib/auth';

/** First session is free; from the second session user needs Pro (4€/month). */
export interface ProCheck {
  canCreate: boolean;
  sessionCount: number;
  isPro: boolean;
}

export async function getProCheck(): Promise<ProCheck> {
  const user = await ensureAuthenticated();

  const [sessionsRes, subRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', user.id),
    supabase
      .from('user_subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const sessionCount = sessionsRes.count ?? 0;
  const status = subRes.data?.status ?? 'inactive';
  const isPro = status === 'active';
  const canCreate = sessionCount === 0 || isPro;

  return { canCreate, sessionCount, isPro };
}
