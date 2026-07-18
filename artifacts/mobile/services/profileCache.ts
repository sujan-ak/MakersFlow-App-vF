import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '@/types/auth';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const CACHE_VERSION = 1;

interface CachedProfilePayload {
  version: number;
  updatedAt: string;
  profile: Profile;
}

export const profileCache = {
  loadProfile: async (): Promise<Profile | null> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_USER_PROFILE);
      if (!data) return null;
      
      const payload: CachedProfilePayload = JSON.parse(data);
      if (payload.version !== CACHE_VERSION) {
        console.warn('[ProfileCache] Cache version mismatch, invalidating cache.');
        await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_USER_PROFILE);
        return null;
      }
      return payload.profile;
    } catch (e) {
      console.warn('[ProfileCache] Load failed:', e);
      return null;
    }
  },

  saveProfile: async (profile: Profile): Promise<boolean> => {
    try {
      const payload: CachedProfilePayload = {
        version: CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        profile,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_USER_PROFILE, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('[ProfileCache] Save failed:', e);
      return false;
    }
  },

  clearProfile: async (): Promise<boolean> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_USER_PROFILE);
      return true;
    } catch (e) {
      console.warn('[ProfileCache] Clear failed:', e);
      return false;
    }
  }
};
