import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Custom storage adapter using expo-secure-store with AsyncStorage fallback
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      const val = await SecureStore.getItemAsync(key);
      if (val) return val;
      // Fallback read from AsyncStorage
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('SecureStore getItem error, falling back to AsyncStorage:', error);
      try {
        return await AsyncStorage.getItem(key);
      } catch (asyncError) {
        return null;
      }
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
      // Dual-write to AsyncStorage for fallback safety
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('SecureStore setItem error, falling back to AsyncStorage:', error);
      try {
        await AsyncStorage.setItem(key, value);
      } catch (asyncError) {
        // ignore
      }
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('SecureStore removeItem error, falling back to AsyncStorage:', error);
      try {
        await AsyncStorage.removeItem(key);
      } catch (asyncError) {
        // ignore
      }
    }
  },
};

// Create Supabase client with custom storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Re-export types from @/types/auth for backward compatibility
export type { Profile, Database } from '@/types/auth';
