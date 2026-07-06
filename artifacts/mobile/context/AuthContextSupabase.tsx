import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Alert, AppState, Platform } from 'react-native';
import { registerForPushNotifications, unregisterPushToken } from '@/lib/pushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { Profile } from '@/types/auth';
import * as authService from '@/services/authService';
import { supabase } from '@/lib/supabase';

// Configure WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

const devLog = (...args: any[]) => {
  if (__DEV__) console.log(...args);
};
const devError = (...args: any[]) => {
  if (__DEV__) console.error(...args);
};

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  grade?: string;
  school?: string;
  age?: number;
  role: string;
  joinedDate: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    grade?: string,
    school?: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ success: boolean; error?: string }>;
  sendWhatsappOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyWhatsappOtp: (phone: string, token: string) => Promise<{ success: boolean; error?: string }>;
}

// ── Single-device session enforcement ─────────────────────────────────────────
const DEVICE_SESSION_KEY = 'device_session_id';
const SESSION_CHECK_INTERVAL_MS = 60_000;

function generateSessionId(): string {
  // RFC4122-ish v4 without extra deps
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // True briefly right after this device claims the session, so the periodic
  // validator doesn't race the claim-write and log the user out on login.
  const justEstablishedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    authService.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange((_event, session) => {
      devLog('[Auth] State changed:', _event);
      setSession(session);

      if (_event === 'PASSWORD_RECOVERY') {
        router.push('/(auth)/reset-password');
      }

      // A fresh sign-in (email / Google / OTP) claims this device as the
      // single active session and registers this device for push.
      if (_event === 'SIGNED_IN' && session?.user) {
        establishDeviceSession(session.user.id).catch(() => {});
        registerForPushNotifications(session.user.id).catch(() => {});
      }

      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Handle deep links for OAuth callback
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      devLog('[Auth] Deep link received:', url);
      
      // Supabase will automatically handle the OAuth callback
      // The onAuthStateChange listener will fire when complete
    };

    // Subscribe to deep link events
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  // ── Single-device session enforcement ────────────────────────────────────
  // On sign-in this device writes a fresh session id to profiles.active_session_id.
  // Any other device holding an older id detects the mismatch (on foreground /
  // every minute) and is logged out with an explanation.

  async function establishDeviceSession(userId: string): Promise<void> {
    try {
      justEstablishedRef.current = true;
      const sessionId = generateSessionId();
      await AsyncStorage.setItem(DEVICE_SESSION_KEY, sessionId);
      const { error } = await supabase
        .from('profiles')
        .update({ active_session_id: sessionId })
        .eq('id', userId);
      if (error) devLog('[Auth] Could not set active_session_id (run the migration?):', error.message);
      // Give the write a moment to be globally readable before we allow checks
      setTimeout(() => { justEstablishedRef.current = false; }, 4000);
    } catch (e: any) {
      justEstablishedRef.current = false;
      devLog('[Auth] establishDeviceSession failed:', e?.message);
    }
  }

  async function validateDeviceSession(userId: string): Promise<void> {
    try {
      // Don't validate while this device is still claiming the session
      if (justEstablishedRef.current) return;

      const localId = await AsyncStorage.getItem(DEVICE_SESSION_KEY);
      if (!localId) return; // legacy session from before enforcement — allow

      const { data, error } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data) return; // network/RLS issue — never punish the user for it

      const remoteId = (data as any).active_session_id;
      // If the server has no session id yet (migration just run, or a legacy
      // account), claim it for this device instead of logging out.
      if (!remoteId) {
        await supabase.from('profiles').update({ active_session_id: localId }).eq('id', userId);
        return;
      }
      if (remoteId !== localId) {
        devLog('[Auth] Session superseded by another device — logging out');
        await AsyncStorage.removeItem(DEVICE_SESSION_KEY);
        await logout();
        Alert.alert(
          'Logged out',
          'Your account was signed in on another device. For security, only one device can be active at a time.',
        );
        router.replace('/(auth)/login');
      }
    } catch {
      // best-effort check
    }
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const check = () => validateDeviceSession(userId);

    // Check when the app returns to the foreground…
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    // …and periodically while it is open (catches mid-lesson takeover).
    const interval = setInterval(check, SESSION_CHECK_INTERVAL_MS);
    check();

    return () => {
      appStateSub.remove();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadUserProfile(supabaseUser: SupabaseUser) {
    devLog('[Auth] Loading profile for user:', supabaseUser.id);
    try {
      const { data: profile, error } = await authService.getProfile(supabaseUser.id);

      if (error) {
        devError('[Auth] Failed to load profile:', error.message, error.code);
        setIsLoading(false);
        return;
      }

      if (!profile) {
        devLog('[Auth] Profile not found, creating new profile...');
        await createUserProfile(supabaseUser);
        return;
      }

      devLog('[Auth] Profile loaded successfully');
      setUser({
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email.split('@')[0],
        avatar: profile.avatar_url || undefined,
        grade: profile.grade || undefined,
        school: profile.school || undefined,
        age: profile.age || undefined,
        role: profile.role,
        joinedDate: new Date(profile.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        }),
      });
    } catch (error: any) {
      devError('[Auth] Error loading profile:', error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function createUserProfile(supabaseUser: SupabaseUser) {
    devLog('[Auth] Creating profile for user:', supabaseUser.id);
    try {
      const profileData = {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        full_name: supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
        grade: supabaseUser.user_metadata?.grade ?? null,
        school: supabaseUser.user_metadata?.school ?? null,
        role: 'student' as const,
      };

      const { data, error } = await authService.createProfile(profileData);

      if (error) {
        devError('[Auth] Profile creation failed:', error.message, error.code);
        setIsLoading(false);
        return;
      }

      if (data) {
        devLog('[Auth] Profile created successfully');
        setUser({
          id: data.id,
          email: data.email,
          name: data.full_name || data.email.split('@')[0],
          avatar: data.avatar_url || undefined,
          grade: data.grade || undefined,
          school: data.school || undefined,
          role: data.role,
          joinedDate: new Date(data.created_at).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          }),
        });
      }
    } catch (error: any) {
      devError('[Auth] Error creating profile:', error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      devLog('[Auth] Starting Google OAuth flow...');
      setIsLoading(true);

      // Create redirect URL for OAuth callback
      const redirectTo = Linking.createURL('/auth/callback');
      devLog('[Auth] OAuth redirect URL:', redirectTo);

      const { data, error } = await authService.signInWithGoogle(redirectTo);

      if (error) {
        devError('[Auth] Google OAuth error:', error.message);
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (!data?.url) {
        devError('[Auth] No OAuth URL returned');
        setIsLoading(false);
        return { success: false, error: 'Failed to initiate Google sign-in' };
      }

      devLog('[Auth] Opening OAuth URL in browser...');
      
      // Open OAuth URL in browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      devLog('[Auth] Browser session result:', result.type);

      if (result.type === 'success') {
        // Extract tokens from URL and create session
        const { url } = result;
        // Supabase returns tokens in the URL fragment (#), not query string (?)
        const params = new URL(url.replace('#', '?')).searchParams;
        
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          // Set the session manually
          const { data: sessionData, error: sessionError } = await authService.setSession(
            access_token,
            refresh_token
          );

          if (sessionError) {
            devError('[Auth] Failed to set session:', sessionError.message);
            setIsLoading(false);
            return { success: false, error: sessionError.message };
          }

          devLog('[Auth] Google OAuth successful');
          // The onAuthStateChange will handle loading the profile
          return { success: true };
        }
      } else if (result.type === 'cancel') {
        devLog('[Auth] User cancelled OAuth');
        setIsLoading(false);
        return { success: false, error: 'Sign-in cancelled' };
      }

      setIsLoading(false);
      return { success: false, error: 'Authentication failed' };
    } catch (error: any) {
      devError('[Auth] Google OAuth exception:', error.message);
      setIsLoading(false);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }

  async function register(
    name: string,
    email: string,
    password: string,
    grade?: string,
    school?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      setIsLoading(true);

      const { data, error } = await authService.signUp(email, password, { name, grade, school });

      if (error) {
        devError('[Auth] Registration error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Profile will be created automatically via loadUserProfile
        return { success: true };
      }

      return { success: false, error: 'Registration failed' };
    } catch (error: any) {
      devError('[Auth] Registration exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  }

  async function login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    // NOTE: server-side rate limiting via Supabase or reverse proxy required for production
    const ATTEMPTS_KEY = 'login_attempts';
    const MAX_ATTEMPTS = 5;
    const WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
    const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

    try {
      const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
      const attempts = raw ? JSON.parse(raw) : { count: 0, firstAttemptAt: Date.now() };
      const now = Date.now();

      // Check lockout
      if (attempts.count >= MAX_ATTEMPTS) {
        const lockedUntil = attempts.firstAttemptAt + LOCKOUT_MS;
        if (now < lockedUntil) {
          const minsLeft = Math.ceil((lockedUntil - now) / 60000);
          return { success: false, error: `Too many failed attempts. Try again in ${minsLeft} minute${minsLeft !== 1 ? 's' : ''}.` };
        }
        // Lockout expired — reset
        await AsyncStorage.removeItem(ATTEMPTS_KEY);
      }
    } catch {
      // AsyncStorage failure — proceed with login
    }

    try {
      setIsLoading(true);

      const { data, error } = await authService.signInWithPassword(email, password);

      if (error) {
        devError('[Auth] Login error:', error);
        // Increment failed attempt counter
        try {
          const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
          const now = Date.now();
          const attempts = raw ? JSON.parse(raw) : { count: 0, firstAttemptAt: now };
          // Reset window if outside 10-minute window
          const inWindow = (now - attempts.firstAttemptAt) < WINDOW_MS;
          const updated = inWindow
            ? { count: attempts.count + 1, firstAttemptAt: attempts.firstAttemptAt }
            : { count: 1, firstAttemptAt: now };
          await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return { success: false, error: error.message };
      }

      if (data.session) {
        // Clear failed attempts on success
        await AsyncStorage.removeItem(ATTEMPTS_KEY).catch(() => {});
        // Record login event and check for suspicious activity
        await recordLoginEvent(data.session.user.id).catch(() => {});
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      devError('[Auth] Login exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  }

  async function recordLoginEvent(userId: string): Promise<void> {
    const deviceInfo = [
      Device.modelName,
      Device.osName,
      Device.osVersion,
      Platform.OS,
    ].filter(Boolean).join(' | ');

    // Check last login within 1 hour from a different device
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('login_events')
      .select('device_info, created_at')
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isFlagged = !!(recent && recent.device_info && recent.device_info !== deviceInfo);

    await supabase.from('login_events').insert({
      user_id: userId,
      device_info: deviceInfo,
      is_flagged: isFlagged,
    });

    if (isFlagged) {
      // Log for now — email alert via Edge Function is a future step
      devLog('[Auth] Suspicious login detected — different device within 1 hour');
    }
  }

  async function logout() {
    try {
      devLog('[Auth] Logging out...');
      setIsLoading(true);

      // Release this device's claim on the account + stop pushes to it
      const currentUserId = session?.user?.id ?? user?.id;
      if (currentUserId) {
        try {
          const localId = await AsyncStorage.getItem(DEVICE_SESSION_KEY);
          if (localId) {
            // Only clear the server value if it is still ours
            await supabase
              .from('profiles')
              .update({ active_session_id: null })
              .eq('id', currentUserId)
              .eq('active_session_id', localId);
          }
          await unregisterPushToken(currentUserId);
        } catch {
          // best-effort cleanup
        }
        await AsyncStorage.removeItem(DEVICE_SESSION_KEY).catch(() => {});
      }

      const { error } = await authService.signOut();

      if (error) {
        devError('[Auth] Logout error:', error);
        throw error;
      }

      devLog('[Auth] Logout successful');
      setUser(null);
      setSession(null);
    } catch (error) {
      devError('[Auth] Logout exception:', error);
      // Clear state even if signOut fails
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateUser(
    updates: Partial<User>
  ): Promise<{ success: boolean; error?: string }> {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      const profileUpdates: any = {};
      
      if (updates.name !== undefined) profileUpdates.full_name = updates.name;
      if (updates.grade !== undefined) profileUpdates.grade = updates.grade;
      if (updates.school !== undefined) profileUpdates.school = updates.school;
      if (updates.avatar !== undefined) profileUpdates.avatar_url = updates.avatar;
      if (updates.age !== undefined) profileUpdates.age = updates.age;

      const { error } = await authService.updateProfile(user.id, profileUpdates);

      if (error) {
        devError('[Auth] Update profile error:', error);
        return { success: false, error: error.message };
      }

      // Update local user state with the changes
      const updatedUser = { ...user };
      if (updates.name !== undefined) updatedUser.name = updates.name;
      if (updates.grade !== undefined) updatedUser.grade = updates.grade;
      if (updates.school !== undefined) updatedUser.school = updates.school;
      if (updates.avatar !== undefined) updatedUser.avatar = updates.avatar;
      if (updates.age !== undefined) updatedUser.age = updates.age;
      
      setUser(updatedUser);
      devLog('[Auth] Profile updated successfully:', updatedUser);
      return { success: true };
    } catch (error: any) {
      devError('[Auth] Update profile exception:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  }

  async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await authService.resetPasswordForEmail(
        email,
        'makersflow://reset-password'
      );

      if (error) {
        devError('[Auth] Password reset error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      devError('[Auth] Password reset exception:', error);
      return { success: false, error: error.message || 'Failed to send reset email' };
    }
  }

  async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await authService.updatePassword(password);
      if (error) {
        devError('[Auth] Password update error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error: any) {
      devError('[Auth] Password update exception:', error);
      return { success: false, error: error.message || 'Failed to update password' };
    }
  }

  async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      devLog('[Auth] Sending OTP to phone:', phone);
      setIsLoading(true);

      const { error } = await authService.sendOtp(phone);

      if (error) {
        devError('[Auth] Send OTP error:', error);
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      devLog('[Auth] OTP sent successfully');
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      devError('[Auth] Send OTP exception:', error);
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to send OTP' };
    }
  }

  async function verifyOtp(phone: string, token: string): Promise<{ success: boolean; error?: string }> {
    try {
      devLog('[Auth] Verifying OTP for phone:', phone);
      setIsLoading(true);

      const { data, error } = await authService.verifyOtp(phone, token);

      if (error) {
        devError('[Auth] Verify OTP error:', error);
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (data?.session) {
        devLog('[Auth] OTP verification successful');
        // The onAuthStateChange will handle loading/creating the profile
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: 'Verification failed' };
    } catch (error: any) {
      devError('[Auth] Verify OTP exception:', error);
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to verify OTP' };
    }
  }

  // ── WhatsApp OTP (via Supabase Edge Functions + WhatsApp provider) ────────
  // Supabase Auth has no native WhatsApp channel, so OTPs are sent through a
  // provider (Twilio WhatsApp / MSG91 / Gupshup) from the `send-whatsapp-otp`
  // edge function and verified server-side by `verify-whatsapp-otp`, which
  // returns a one-time token_hash this client exchanges for a session.

  async function sendWhatsappOtp(phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      devLog('[Auth] Sending WhatsApp OTP to:', phone);
      const { data, error } = await supabase.functions.invoke('send-whatsapp-otp', {
        body: { phone },
      });
      if (error) {
        devError('[Auth] WhatsApp OTP send error:', error);
        return {
          success: false,
          error: 'WhatsApp OTP is not available right now. Please use SMS instead.',
        };
      }
      if (data?.error) return { success: false, error: data.error };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to send WhatsApp OTP' };
    }
  }

  async function verifyWhatsappOtp(
    phone: string,
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      devLog('[Auth] Verifying WhatsApp OTP for:', phone);
      const { data, error } = await supabase.functions.invoke('verify-whatsapp-otp', {
        body: { phone, code: token },
      });
      if (error || data?.error) {
        return { success: false, error: data?.error || 'Invalid or expired code' };
      }
      if (data?.token_hash) {
        const { error: exchangeError } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.token_hash,
        });
        if (exchangeError) return { success: false, error: exchangeError.message };
        return { success: true };
      }
      return { success: false, error: 'Verification failed' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to verify WhatsApp OTP' };
    }
  }

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    login,
    register,
    loginWithGoogle,
    logout,
    updateUser,
    resetPassword,
    updatePassword,
    sendOtp,
    verifyOtp,
    sendWhatsappOtp,
    verifyWhatsappOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
