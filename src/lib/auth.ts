import { supabase } from './supabase';

/**
 * Ensures the user is authenticated (anonymous auth)
 * Returns the user if authenticated, throws error if not.
 * Uses getSession() first to avoid creating a second anonymous user when
 * we already have a session in storage (e.g. right after creating a session).
 */
export async function ensureAuthenticated() {
  // Prefer existing session from storage so we don't create a new anon user
  // when navigating right after create (getUser() can be briefly out of sync)
  const { data: { session } } = await supabase.auth.getSession();
  let user = session?.user ?? null;

  if (!user) {
    const { data: { user: serverUser } } = await supabase.auth.getUser();
    user = serverUser ?? null;
  }

  if (!user) {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    user = authData.user;
  }

  if (!user) {
    throw new Error('Failed to authenticate user');
  }

  return user;
}
