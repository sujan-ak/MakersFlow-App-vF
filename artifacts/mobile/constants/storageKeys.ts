export const STORAGE_KEYS = {
  // ── Auth & Profile ───────────────────────────────────────────────────────
  CACHED_USER_PROFILE: 'cached_user_profile',
  APP_HAS_EVER_LOADED: 'app_has_ever_loaded',
  DEVICE_SESSION_KEY: 'makersflow_device_session_id',

  // ── Home: Public datasets (shared across sessions, not cleared on logout) ─
  CACHED_HOME_PROMOTIONS: 'cached_home_promotions',
  CACHED_HOME_COURSES: 'cached_home_courses',
  CACHED_HOME_PRODUCTS: 'cached_home_products',

  // ── Home: User-specific datasets (cleared on logout) ─────────────────────
  CACHED_HOME_PROGRESS: 'cached_home_progress',
  CACHED_HOME_NOTIFICATIONS: 'cached_home_notifications',

  // ── Courses tab (Step 8) ─────────────────────────────────────────────────
  CACHED_COURSES_CATALOG: 'cached_courses_catalog',
  CACHED_COURSES_ENROLLMENTS: 'cached_courses_enrollments',

  // ── Store tab (Step 9) ──────────────────────────────────────────────────
  CACHED_PRODUCTS_CATALOG: 'cached_products_catalog',
};

// Keys that must be wiped on logout (user-specific only)
export const USER_CACHE_KEYS: string[] = [
  STORAGE_KEYS.CACHED_USER_PROFILE,
  STORAGE_KEYS.CACHED_HOME_PROGRESS,
  STORAGE_KEYS.CACHED_HOME_NOTIFICATIONS,
  STORAGE_KEYS.CACHED_COURSES_ENROLLMENTS,
];
