/**
 * cachePolicy.ts
 *
 * Central registry of all cache TTLs (time-to-live) for the app.
 * Every repository imports TTLs from here — no magic numbers scattered across files.
 *
 * Naming convention: <SCOPE>_<DATASET>_TTL_MS
 */

export const CACHE_POLICY = {
  // ── Home tab ───────────────────────────────────────────────────────────────
  // Public datasets change infrequently; 30 min is safe.
  HOME_PROMOTIONS_TTL_MS:    30 * 60 * 1000,
  HOME_COURSES_TTL_MS:       30 * 60 * 1000,
  HOME_PRODUCTS_TTL_MS:      30 * 60 * 1000,
  // User-specific data (progress, streaks) must feel fresh; 5 min max.
  HOME_PROGRESS_TTL_MS:       5 * 60 * 1000,
  HOME_NOTIFICATIONS_TTL_MS:  5 * 60 * 1000,

  // ── Courses tab ────────────────────────────────────────────────────────────
  // Catalog can share the 30 min TTL.
  COURSES_CATALOG_TTL_MS:    30 * 60 * 1000,
  // Enrollments change when the user purchases; 5 min keeps it fresh.
  COURSES_ENROLLMENTS_TTL_MS: 5 * 60 * 1000,

  // ── Store tab ──────────────────────────────────────────────────────────────
  STORE_PRODUCTS_TTL_MS:     30 * 60 * 1000,
} as const;

/** Shared cache version. Bump this when any CachePayload schema changes. */
export const CACHE_VERSION = 1;
