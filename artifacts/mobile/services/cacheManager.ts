/**
 * cacheManager.ts
 *
 * Shared cache abstraction used by all repositories.
 * Handles serialization, versioning, TTL validation, and error isolation.
 *
 * Repositories provide:
 *   - cache key    (from STORAGE_KEYS)
 *   - TTL in ms    (from CACHE_POLICY)
 *
 * cacheManager handles everything else, including returning CacheReadResult
 * metadata (source, stale, updatedAt) that repositories can surface to callers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_VERSION } from '@/constants/cachePolicy';

// ── Public result type ───────────────────────────────────────────────────────

/**
 * RepositoryResult<T>
 *
 * Returned by every repository.get() call.
 * Screens receive this object but should only read `.data`.
 * The metadata fields are available for diagnostics, stale banners, or
 * future background-refresh logic — screens do not depend on them.
 */
export interface RepositoryResult<T> {
  /** The actual data — real remote or real cached. Never fake. */
  data: T;
  /** Where the data came from this call. */
  source: 'network' | 'cache';
  /**
   * True when the data was served from cache AND the TTL has already expired.
   * The data is still useful but a background refresh is desirable.
   */
  stale: boolean;
  /** ISO 8601 timestamp of when the cache was last written. Null for network responses. */
  updatedAt: string | null;
}

/** Helper to build a network result. */
export function networkResult<T>(data: T): RepositoryResult<T> {
  return { data, source: 'network', stale: false, updatedAt: null };
}

/** Helper to build a cache result. */
export function cacheResult<T>(
  data: T,
  updatedAt: string,
  ttlMs: number
): RepositoryResult<T> {
  const stale = isExpired(updatedAt, ttlMs);
  return { data, source: 'cache', stale, updatedAt };
}

// ── Internal payload wrapper ─────────────────────────────────────────────────
interface CachePayload<T> {
  version: number;
  updatedAt: string; // ISO 8601
  data: T;
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read and validate a cached value.
 * Returns null when: key absent, parse failure, version stale, or TTL expired.
 *
 * NOTE: Returns the full CachePayload so callers can build CacheReadResult
 * with the real updatedAt timestamp.
 */
async function readRaw<T>(key: string): Promise<CachePayload<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    let payload: CachePayload<T>;
    try {
      payload = JSON.parse(raw);
    } catch {
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }

    if (!validateVersion(payload.version)) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }

    return payload; // TTL check is left to the caller (needed for `stale` flag)
  } catch (e) {
    console.warn(`[cacheManager] readRaw failed for "${key}":`, e);
    return null;
  }
}

/**
 * Read a cached value.
 * Returns null when the entry is absent, corrupted, or version-stale.
 * Returns the data even if TTL-expired — callers use `isExpired` to decide staleness.
 */
async function read<T>(key: string, ttlMs: number): Promise<T | null> {
  const payload = await readRaw<T>(key);
  if (!payload) return null;
  // Serve stale data (TTL guard is surfaced via RepositoryResult.stale, not here)
  return payload.data;
}

/**
 * Read a cached value and return full metadata.
 * Returns null when the entry is absent, corrupted, or version-stale.
 */
async function readWithMeta<T>(
  key: string,
  ttlMs: number
): Promise<{ data: T; updatedAt: string; stale: boolean } | null> {
  const payload = await readRaw<T>(key);
  if (!payload) return null;
  return {
    data: payload.data,
    updatedAt: payload.updatedAt,
    stale: isExpired(payload.updatedAt, ttlMs),
  };
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Serialize and persist a value.
 * Returns true on success, false on failure.
 * Never throws — storage failures are non-fatal.
 */
async function write<T>(key: string, data: T): Promise<boolean> {
  try {
    const payload: CachePayload<T> = {
      version: CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn(`[cacheManager] write failed for "${key}":`, e);
    return false;
  }
}

// ── Clear ────────────────────────────────────────────────────────────────────

/**
 * Remove one or more cache entries.
 * Returns true if all removals succeeded.
 */
async function clear(keys: string | string[]): Promise<boolean> {
  try {
    const keyList = Array.isArray(keys) ? keys : [keys];
    await AsyncStorage.multiRemove(keyList);
    return true;
  } catch (e) {
    console.warn(`[cacheManager] clear failed:`, e);
    return false;
  }
}

// ── Helpers (exported for unit-testing) ─────────────────────────────────────

/** Returns true if the cache entry is older than ttlMs. */
function isExpired(updatedAt: string, ttlMs: number): boolean {
  return Date.now() - new Date(updatedAt).getTime() > ttlMs;
}

/** Returns true if the stored version matches the current CACHE_VERSION. */
function validateVersion(version: number): boolean {
  return version === CACHE_VERSION;
}

// ── Public API ───────────────────────────────────────────────────────────────
export const cacheManager = {
  read,
  readWithMeta,
  write,
  clear,
  isExpired,
  validateVersion,
};
