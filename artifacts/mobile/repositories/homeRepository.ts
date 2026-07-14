/**
 * homeRepository.ts
 *
 * Provides all data for the Home screen.
 * The screen calls only homeRepository.get() — it never knows if data came from
 * Supabase or the local cache.
 *
 * Cache strategy
 * ─────────────────────────────────────────────────────────────────────────────
 * Public datasets  (promotions, courses, products)
 *   - TTL: 30 min   (CACHE_POLICY.HOME_*)
 *   - Cleared on:   schema version bump only
 *
 * Private datasets (progress, notifications)
 *   - TTL:  5 min   (CACHE_POLICY.HOME_*)
 *   - Cleared on:   logout (clearUserCache)
 *
 * Refresh strategy
 * ─────────────────────────────────────────────────────────────────────────────
 * Online:  fetch → write cache → return live data
 * Offline: read cache → return stale data (or EMPTY_HOME_DATA if cold)
 *
 * Invalidation
 * ─────────────────────────────────────────────────────────────────────────────
 * Version mismatch → cacheManager evicts the entry automatically on read.
 * TTL expiry       → cacheManager returns null; next online load overwrites.
 */

import { supabase } from '@/lib/supabase';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { CACHE_POLICY } from '@/constants/cachePolicy';
import { cacheManager, networkResult, cacheResult, RepositoryResult } from '@/services/cacheManager';
import { isNetworkError } from '@/lib/networkUtils';
import { fetchAllCourses } from '@/services/courseDataProvider';
import { fetchEnrolledCourses } from '@/services/enrollmentService';
import { fetchCourseProgress } from '@/lib/progressStorage';
import { ProgressCalculator } from '@/lib/progressCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ────────────────────────────────────────────────────────────────────
export interface EnrolledCourse {
  courseId: string;
  progress: number;
  completedAt: string | null;
}

export interface HomeProgress {
  enrolledCourses: EnrolledCourse[];
  learningStreak: number;
  longestStreak: number;
  totalLessonsCompleted: number;
  totalHoursLearned: number;
}

export interface HomeData {
  // Public
  promotions: any[];
  courses: any[];
  popularCourses: any[];
  popularKits: any[];
  // Private
  progress: HomeProgress;
  unreadNotifCount: number;
}

export const EMPTY_PROGRESS: HomeProgress = {
  enrolledCourses: [],
  learningStreak: 0,
  longestStreak: 0,
  totalLessonsCompleted: 0,
  totalHoursLearned: 0,
};

export const EMPTY_HOME_DATA: HomeData = {
  promotions: [],
  courses: [],
  popularCourses: [],
  popularKits: [],
  progress: EMPTY_PROGRESS,
  unreadNotifCount: 0,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstThumbnailUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) && arr[0] ? String(arr[0]) : null;
    } catch { /* fall through */ }
  }
  return trimmed.split(',')[0].trim() || null;
}

// ── Remote fetchers ──────────────────────────────────────────────────────────

async function fetchPromotions(): Promise<any[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).filter(
    (p: any) => !p.expires_at || new Date(p.expires_at).getTime() > now
  );
}

async function fetchCourses(): Promise<{ courses: any[]; popularCourses: any[] }> {
  let reviewStats: Record<string, { ratingSum: number; count: number }> = {};
  try {
    const { data, error } = await supabase.from('reviews').select('course_id, rating');
    if (!error && data) {
      data.forEach((rev: any) => {
        const id = String(rev.course_id);
        if (!reviewStats[id]) reviewStats[id] = { ratingSum: 0, count: 0 };
        reviewStats[id].ratingSum += Number(rev.rating) || 0;
        reviewStats[id].count += 1;
      });
    }
  } catch { /* non-critical */ }

  const all = await fetchAllCourses();
  const mapped = all.map((c: any) => {
    const stats  = reviewStats[String(c.id)];
    const rating  = stats ? Number((stats.ratingSum / stats.count).toFixed(1)) : 0;
    const reviews = stats ? stats.count : 0;
    return {
      id: String(c.id),
      title: c.title,
      category: c.category || 'General',
      level: c.level
        ? c.level.charAt(0).toUpperCase() + c.level.slice(1)
        : 'Beginner',
      price: c.price || 0,
      isFree: c.is_free,
      thumbnail: firstThumbnailUrl(c.thumbnail_url)
        ? { uri: firstThumbnailUrl(c.thumbnail_url)! }
        : require('@/assets/images/course_robotics.png'),
      instructor: c.profiles?.full_name || '',
      rating,
      reviews,
      description: c.description || '',
      modules: [],
    };
  });
  return { courses: mapped, popularCourses: mapped.slice(0, 8) };
}

async function fetchProducts(): Promise<any[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, description, price, original_price, category, subcategory, thumbnail_url, in_stock')
    .or('status.eq.available,status.eq.active')
    .neq('category', 'digital')
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  const fallbacks = [
    require('@/assets/images/product_kit_1.png'),
    require('@/assets/images/product_kit_2.png'),
    require('@/assets/images/product_kit_3.png'),
  ];
  return (data ?? []).map((row: any, idx: number) => ({
    id: String(row.id),
    title: row.title || 'Untitled Product',
    category: 'physical',
    subcategory: row.subcategory || 'Physical Kits',
    price: Number(row.price) || 0,
    originalPrice: Number(row.original_price) || Number(row.price) || 0,
    thumbnail: firstThumbnailUrl(row.thumbnail_url)
      ? { uri: firstThumbnailUrl(row.thumbnail_url)! }
      : fallbacks[idx % 3],
    description: row.description || 'No description available.',
    rating: 0,
    reviews: 0,
    inStock: row.in_stock === undefined ? true : Boolean(row.in_stock),
    features: [],
  }));
}

async function fetchProgress(userId: string): Promise<HomeProgress> {
  const enrollments = await fetchEnrolledCourses(userId);
  const enrolledCourses = await Promise.all(
    enrollments
      .filter((enr: any) => enr.courses)
      .map(async (enr: any) => {
        const prog = await fetchCourseProgress(userId, String(enr.courses.id));
        return {
          courseId: String(enr.courses.id),
          progress: prog.percentage,
          completedAt: enr.completed_at || null,
        };
      })
  );

  const { data: lpData } = await supabase
    .from('lesson_progress')
    .select('course_id, lesson_id, time_spent_secs, is_completed, last_watched_at')
    .eq('user_id', userId);

  const streakResult = lpData ? ProgressCalculator.calculateStreak(lpData) : { current: 0, longest: 0 };
  const learningStreak        = streakResult.current;
  const longestStreak         = streakResult.longest;
  const totalLessonsCompleted = lpData ? lpData.filter((p) => p.is_completed).length : 0;
  const totalHoursLearned     = lpData
    ? Number((lpData.reduce((s, p) => s + (p.time_spent_secs || 0), 0) / 3600).toFixed(1))
    : 0;

  return { enrolledCourses, learningStreak, longestStreak, totalLessonsCompleted, totalHoursLearned };
}

async function fetchNotificationCount(userId: string): Promise<number> {
  try {
    const lastSeen = await AsyncStorage.getItem('announcements_last_seen');
    const [personal, broadcast] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false),
      supabase
        .from('announcements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .gt('created_at', lastSeen ?? '1970-01-01'),
    ]);
    return (personal.count ?? 0) + (broadcast.count ?? 0);
  } catch {
    return 0;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export const homeRepository = {
  /**
   * get() — the only method the screen calls.
   *
   * Online:  fetchRemote → write caches → return live data
   * Offline: readCache   → return stale data (or empty if cold)
   */
  async get(userId: string | undefined, isOffline: boolean): Promise<RepositoryResult<HomeData>> {
    if (isOffline) {
      return homeRepository.loadFromCache(userId);
    }

    try {
      const [promotions, courseResult, popularKits] = await Promise.all([
        fetchPromotions().catch(() => []),
        fetchCourses().catch(() => ({ courses: [], popularCourses: [] })),
        fetchProducts().catch(() => []),
      ]);

      // Write public caches (fire-and-forget)
      cacheManager.write(STORAGE_KEYS.CACHED_HOME_PROMOTIONS, promotions);
      cacheManager.write(STORAGE_KEYS.CACHED_HOME_COURSES, {
        courses: courseResult.courses,
        popularCourses: courseResult.popularCourses,
      });
      cacheManager.write(STORAGE_KEYS.CACHED_HOME_PRODUCTS, popularKits);

      let progress        = EMPTY_PROGRESS;
      let unreadNotifCount = 0;

      if (userId) {
        [progress, unreadNotifCount] = await Promise.all([
          fetchProgress(userId).catch(() => EMPTY_PROGRESS),
          fetchNotificationCount(userId).catch(() => 0),
        ]);
        cacheManager.write(STORAGE_KEYS.CACHED_HOME_PROGRESS,      progress);
        cacheManager.write(STORAGE_KEYS.CACHED_HOME_NOTIFICATIONS, unreadNotifCount);
      }

      return networkResult({
        promotions,
        courses: courseResult.courses,
        popularCourses: courseResult.popularCourses,
        popularKits,
        progress,
        unreadNotifCount,
      });
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn('[homeRepo] Network error — falling back to cache');
      } else {
        console.error('[homeRepo] Unexpected fetch error:', err);
      }
      return homeRepository.loadFromCache(userId);
    }
  },

  /** Assemble HomeData entirely from local caches. */
  async loadFromCache(userId: string | undefined): Promise<RepositoryResult<HomeData>> {
    // Read all cache datasets in parallel, collecting metadata from the primary
    // (courses) entry to represent the overall cache timestamp.
    const [cachedCourseResult, promotions, popularKits, progress, unreadNotifCount] =
      await Promise.all([
        cacheManager.readWithMeta<{ courses: any[]; popularCourses: any[] }>(
          STORAGE_KEYS.CACHED_HOME_COURSES,
          CACHE_POLICY.HOME_COURSES_TTL_MS
        ),
        cacheManager.read<any[]>(
          STORAGE_KEYS.CACHED_HOME_PROMOTIONS,
          CACHE_POLICY.HOME_PROMOTIONS_TTL_MS
        ),
        cacheManager.read<any[]>(
          STORAGE_KEYS.CACHED_HOME_PRODUCTS,
          CACHE_POLICY.HOME_PRODUCTS_TTL_MS
        ),
        userId
          ? cacheManager.read<HomeProgress>(
              STORAGE_KEYS.CACHED_HOME_PROGRESS,
              CACHE_POLICY.HOME_PROGRESS_TTL_MS
            )
          : Promise.resolve(null),
        userId
          ? cacheManager.read<number>(
              STORAGE_KEYS.CACHED_HOME_NOTIFICATIONS,
              CACHE_POLICY.HOME_NOTIFICATIONS_TTL_MS
            )
          : Promise.resolve(null),
      ]);

    const data: HomeData = {
      promotions:       promotions                       ?? [],
      courses:          cachedCourseResult?.data.courses         ?? [],
      popularCourses:   cachedCourseResult?.data.popularCourses  ?? [],
      popularKits:      popularKits                      ?? [],
      progress:         progress                         ?? EMPTY_PROGRESS,
      unreadNotifCount: unreadNotifCount                 ?? 0,
    };

    if (!cachedCourseResult) {
      // Cold cache — return empty but mark as cache source
      return cacheResult(data, new Date().toISOString(), CACHE_POLICY.HOME_COURSES_TTL_MS);
    }
    return cacheResult(data, cachedCourseResult.updatedAt, CACHE_POLICY.HOME_COURSES_TTL_MS);
  },

  /** Clear only user-specific caches. Called on logout. */
  async clearUserCache(): Promise<void> {
    await cacheManager.clear([
      STORAGE_KEYS.CACHED_HOME_PROGRESS,
      STORAGE_KEYS.CACHED_HOME_NOTIFICATIONS,
    ]);
  },
};
