import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from './supabase';
import { getCourseModules } from '@/services/courseDataProvider';
import { emitSessionExpired, isAuthError } from './sessionEvents';

export interface UserCourseProgress {
  userId: string;
  courseId: string;
  progress: number;
  enrolledAt: string;
  lastAccessedAt: string;
  completedAt?: string;
  totalTimeSpent: number;
  modules: {
    [moduleId: string]: ModuleProgress;
  };
}

export interface ModuleProgress {
  moduleId: string;
  isCompleted: boolean;
  isStarted: boolean;
  videoProgress: VideoProgress;
  lastAccessedAt: string;
  completedAt?: string;
  timeSpent: number;
  totalLessons?: number;
  completedLessons?: number;
}

export interface VideoProgress {
  videoUrl: string;
  currentTime: number;
  duration: number;
  watchedPercentage: number;
  isCompleted: boolean;
  lastWatchedAt: string;
}

export interface WatchlistItem {
  courseId: string;
  moduleId: string;
  courseTitle: string;
  moduleTitle: string;
  courseThumbnail: any;
  lastWatchedAt: string;
  videoProgress: VideoProgress;
  courseProgress: number;
}

const STORAGE_KEYS = {
  courseProgress: (userId: string, courseId: string) =>
    `@progress:user:${userId}:course:${courseId}`,
  watchlist: (userId: string) => `@progress:user:${userId}:watchlist`,
};

export const ProgressStorage = {
  async saveCourseProgress(
    progress: UserCourseProgress
  ): Promise<void> {
    try {
      const key = STORAGE_KEYS.courseProgress(progress.userId, progress.courseId);
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
      console.error("Failed to save course progress:", error);
    }
  },

  async loadCourseProgress(
    userId: string,
    courseId: string
  ): Promise<UserCourseProgress | null> {
    try {
      const key = STORAGE_KEYS.courseProgress(userId, courseId);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to load course progress:", error);
      return null;
    }
  },

  async loadAllCourseProgress(
    userId: string
  ): Promise<UserCourseProgress[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const progressKeys = keys.filter((key) =>
        key.startsWith(`@progress:user:${userId}:course:`)
      );
      const progressData = await AsyncStorage.multiGet(progressKeys);
      return progressData
        .map(([_, value]) => (value ? JSON.parse(value) : null))
        .filter(Boolean) as UserCourseProgress[];
    } catch (error) {
      console.error("Failed to load all course progress:", error);
      return [];
    }
  },

  async saveWatchlist(
    userId: string,
    watchlist: WatchlistItem[]
  ): Promise<void> {
    try {
      const key = STORAGE_KEYS.watchlist(userId);
      await AsyncStorage.setItem(key, JSON.stringify(watchlist));
    } catch (error) {
      console.error("Failed to save watchlist:", error);
    }
  },

  async loadWatchlist(userId: string): Promise<WatchlistItem[]> {
    try {
      const key = STORAGE_KEYS.watchlist(userId);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load watchlist:", error);
      return [];
    }
  },

  async clearProgress(userId: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter((key) =>
        key.startsWith(`@progress:user:${userId}`)
      );
      await AsyncStorage.multiRemove(userKeys);
    } catch (error) {
      console.error("Failed to clear progress:", error);
    }
  },
};

export async function markLessonComplete(userId: string, courseId: string, lessonId: string) {
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: userId,
      lesson_id: Number(lessonId),
      course_id: courseId,
      is_completed: true,
      watch_percentage: 100,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  );
  if (error) {
    if (isAuthError(error)) emitSessionExpired();
    throw error;
  }
}

export async function upsertLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  currentTimeSecs: number,
  watchPercentage: number,
) {
  const { data: currentProgress } = await supabase
    .from('lesson_progress')
    .select('is_completed, watch_percentage')
    .eq('user_id', userId)
    .eq('lesson_id', Number(lessonId))
    .maybeSingle();

  const wasCompleted = currentProgress?.is_completed === true;
  const isCompleted = wasCompleted || (watchPercentage >= 90);
  const currentPct = currentProgress?.watch_percentage || 0;
  const finalPct = wasCompleted ? 100 : Math.max(currentPct, Math.round(watchPercentage));

  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: userId,
      lesson_id: Number(lessonId),
      course_id: courseId,
      current_time_secs: Math.floor(currentTimeSecs),
      watch_percentage: finalPct,
      time_spent_secs: Math.floor(currentTimeSecs),
      is_completed: isCompleted,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  );
  if (error) {
    console.error('[progress] upsert error', error);
    // Token refresh failed mid-lesson → surface a re-login prompt instead of
    // silently dropping progress saves (see sessionEvents listener in learn.tsx)
    if (isAuthError(error)) emitSessionExpired();
  }
}

export async function fetchCourseProgress(userId: string, courseId: string) {
  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('course_id', Number(courseId));
  const moduleIds = (modules ?? []).map((m) => m.id);
  if (moduleIds.length === 0) return { completed: 0, total: 0, percentage: 0 };

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .in('module_id', moduleIds);
  const lessonIds = (lessons ?? []).map((l) => l.id);
  if (lessonIds.length === 0) return { completed: 0, total: 0, percentage: 0 };

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('lesson_id, is_completed')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds);

  const completed = (progress ?? []).filter((p) => p.is_completed).length;
  const total = lessonIds.length;
  return { completed, total, percentage: total ? Math.round((completed / total) * 100) : 0 };
}

export async function fetchCourseLessonsProgress(userId: string, courseId: string) {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id, current_time_secs, watch_percentage, is_completed')
    .eq('user_id', userId)
    .eq('course_id', Number(courseId));
  if (error) throw error;
  return data ?? [];
}

export async function fetchRemoteProgress(userId: string): Promise<UserCourseProgress[]> {
  try {
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('course_id, enrolled_at, completed_at')
      .eq('user_id', userId);

    if (enrollError || !enrollments) return [];

    const { data: lessonProgress, error: progressError } = await supabase
      .from('lesson_progress')
      .select('lesson_id, course_id, current_time_secs, watch_percentage, time_spent_secs, is_completed, last_watched_at')
      .eq('user_id', userId);

    const progressList = lessonProgress ?? [];
    const results: UserCourseProgress[] = [];

    for (const enrollment of enrollments) {
      const courseId = String(enrollment.course_id);
      const modules = await getCourseModules(courseId);

      const courseProgressObj: UserCourseProgress = {
        userId,
        courseId,
        progress: 0,
        enrolledAt: enrollment.enrolled_at || new Date().toISOString(),
        lastAccessedAt: enrollment.enrolled_at || new Date().toISOString(),
        completedAt: enrollment.completed_at || undefined,
        totalTimeSpent: 0,
        modules: {},
      };

      let totalLessons = 0;
      let completedLessons = 0;

      modules.forEach((mod: any) => {
        const modLessons = mod.lessons ?? [];
        totalLessons += modLessons.length;

        let modTimeSpent = 0;
        let modLastAccessed = enrollment.enrolled_at || new Date().toISOString();
        let modIsCompleted = modLessons.length > 0;
        let modIsStarted = false;

        modLessons.forEach((les: any) => {
          const lp = progressList.find((p) => String(p.lesson_id) === String(les.id));
          if (lp) {
            modTimeSpent += lp.time_spent_secs || 0;
            if (lp.last_watched_at && new Date(lp.last_watched_at) > new Date(modLastAccessed)) {
              modLastAccessed = lp.last_watched_at;
            }
            if (lp.is_completed) {
              completedLessons++;
            } else {
              modIsCompleted = false;
            }
            if (lp.watch_percentage > 0) {
              modIsStarted = true;
            }
          } else {
            modIsCompleted = false;
          }
        });

        if (modLessons.length === 0) {
          modIsCompleted = false;
          modIsStarted = false;
        }

        const firstLesson = modLessons[0];
        const lastWatchedLesson = modLessons.find((les: any) => {
          const lp = progressList.find((p) => String(p.lesson_id) === String(les.id));
          return lp && !lp.is_completed;
        }) || firstLesson;

        const lp = lastWatchedLesson ? progressList.find((p) => String(p.lesson_id) === String(lastWatchedLesson.id)) : null;

        courseProgressObj.modules[mod.id] = {
          moduleId: mod.id,
          isCompleted: modIsCompleted,
          isStarted: modIsStarted,
          videoProgress: {
            videoUrl: lastWatchedLesson?.video_url || "",
            currentTime: lp?.current_time_secs || 0,
            duration: lp?.current_time_secs ? Math.round(lp.current_time_secs / ((lp.watch_percentage || 1) / 100)) : 0,
            watchedPercentage: lp?.watch_percentage || 0,
            isCompleted: lp?.is_completed || false,
            lastWatchedAt: lp?.last_watched_at || modLastAccessed,
          },
          lastAccessedAt: modLastAccessed,
          completedAt: modIsCompleted ? modLastAccessed : undefined,
          timeSpent: modTimeSpent,
          totalLessons: modLessons.length,
          completedLessons: modLessons.filter((les: any) => {
            const p = progressList.find((x) => String(x.lesson_id) === String(les.id));
            return p && p.is_completed;
          }).length,
        };

        courseProgressObj.totalTimeSpent += modTimeSpent;
        if (new Date(modLastAccessed) > new Date(courseProgressObj.lastAccessedAt)) {
          courseProgressObj.lastAccessedAt = modLastAccessed;
        }
      });

      courseProgressObj.progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
      if (courseProgressObj.progress === 100 && !courseProgressObj.completedAt) {
        courseProgressObj.completedAt = courseProgressObj.lastAccessedAt;
      }

      results.push(courseProgressObj);
    }

    return results;
  } catch (err) {
    console.error('[progressStorage] fetchRemoteProgress failed:', err);
    return [];
  }
}

