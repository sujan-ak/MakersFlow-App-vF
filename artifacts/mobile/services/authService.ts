import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/auth';

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string,
  metadata?: { name?: string; grade?: string; school?: string; phone?: string },
) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
}

/**
 * Sign out the current user
 */
export async function signOut() {
  return await supabase.auth.signOut();
}

/**
 * Get the current session
 */
export async function getSession() {
  return await supabase.auth.getSession();
}

/**
 * Get user profile from database
 */
export async function getProfile(userId: string) {
  return await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
}

/**
 * Create or update user profile in database
 */
export async function createProfile(profileData: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  grade?: string | null;
  school?: string | null;
}) {
  return await supabase
    .from('profiles')
    .upsert(profileData, { onConflict: 'id' })
    .select()
    .maybeSingle();
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    grade?: string | null;
    school?: string | null;
    avatar_url?: string | null;
    age?: number | null;
    onboarding_completed?: boolean;
    phone?: string | null;
  }
) {
  return await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(redirectTo: string) {
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo,
      skipBrowserRedirect: true,
    },
  });
}

/**
 * Set session manually (used after OAuth)
 */
export async function setSession(accessToken: string, refreshToken: string) {
  return await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Reset password via email
 */
export async function resetPasswordForEmail(email: string, redirectTo: string) {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

/**
 * Update the user's password
 */
export async function updatePassword(password: string) {
  return await supabase.auth.updateUser({
    password: password,
  });
}

/**
 * Send OTP to phone number
 */
export async function sendOtp(phone: string) {
  return await supabase.auth.signInWithOtp({
    phone,
  });
}

/**
 * Verify OTP for phone number
 */
export async function verifyOtp(phone: string, token: string) {
  return await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
}
