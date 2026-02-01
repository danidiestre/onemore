import { supabase } from './supabase';

/**
 * Ensures the user is authenticated (anonymous auth)
 * Returns the user if authenticated, throws error if not
 */
export async function ensureAuthenticated() {
  let { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // Try to sign in anonymously
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
