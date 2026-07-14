import { ModuleProgress, VideoProgress } from "./progressStorage";

export const ProgressCalculator = {
  /**
   * Calculate consecutive daily learning streak.
   * Returns { current, longest }.
   */
  calculateStreak(progressList: any[]): { current: number; longest: number } {
    // Build unique YYYY-MM-DD keys from last_watched_at (local time)
    const daySet = new Set<string>();
    progressList.forEach((p) => {
      if (!p.last_watched_at) return;
      const d = new Date(p.last_watched_at);
      daySet.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    });

    if (daySet.size === 0) return { current: 0, longest: 0 };

    // Helper: YYYY-MM-DD for any Date
    const toKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Helper: subtract N days from a YYYY-MM-DD key
    const subtractDay = (key: string): string => {
      const d = new Date(key + 'T12:00:00'); // noon avoids DST edge cases
      d.setDate(d.getDate() - 1);
      return toKey(d);
    };

    const addDay = (key: string): string => {
      const d = new Date(key + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      return toKey(d);
    };

    const todayKey     = toKey(new Date());
    const yesterdayKey = subtractDay(todayKey);

    // ── Current streak ────────────────────────────────────────────────────────
    // Walk backwards from today; streak is 0 if neither today nor yesterday
    // has activity (broken streak).
    let current = 0;
    const startKey = daySet.has(todayKey)
      ? todayKey
      : daySet.has(yesterdayKey)
      ? yesterdayKey
      : null;

    if (startKey) {
      let cursor = startKey;
      while (daySet.has(cursor)) {
        current++;
        cursor = subtractDay(cursor);
      }
    }

    // ── Longest streak ────────────────────────────────────────────────────────
    // Sort days ascending and find the longest consecutive run.
    const asc = Array.from(daySet).sort();
    let longest = 1;
    let run = 1;
    for (let i = 1; i < asc.length; i++) {
      if (asc[i] === addDay(asc[i - 1])) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 1;
      }
    }

    // longest must never be less than current
    longest = Math.max(longest, current);

    return { current, longest };
  },

  /**
   * Calculate overall course progress based on module completion
   * Returns percentage (0-100)
   */
  calculateCourseProgress(modules: Record<string, ModuleProgress>): number {
    const moduleArray = Object.values(modules);
    if (moduleArray.length === 0) return 0;

    const hasLessonCounts = moduleArray.every(m => (m as any).totalLessons !== undefined);
    if (hasLessonCounts) {
      const total = moduleArray.reduce((sum, m) => sum + ((m as any).totalLessons || 0), 0);
      const completed = moduleArray.reduce((sum, m) => sum + ((m as any).completedLessons || 0), 0);
      return total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    }

    const completedCount = moduleArray.filter((m) => m.isCompleted).length;
    return Math.round((completedCount / moduleArray.length) * 100);
  },

  /**
   * Check if video is considered completed (>= 90% watched)
   */
  isVideoCompleted(watchedPercentage: number): boolean {
    return watchedPercentage >= 90;
  },

  /**
   * Calculate video watched percentage
   */
  calculateWatchedPercentage(currentTime: number, duration: number): number {
    if (duration <= 0) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  },

  /**
   * Check if module is completed based on video progress
   */
  isModuleCompleted(videoProgress: VideoProgress): boolean {
    return this.isVideoCompleted(videoProgress.watchedPercentage);
  },

  /**
   * Check if course should appear in continue watching
   * (started but not completed)
   */
  shouldShowInContinueWatching(
    progress: number,
    hasStartedAnyModule: boolean
  ): boolean {
    return hasStartedAnyModule && progress > 0 && progress < 100;
  },

  /**
   * Format time in MM:SS format
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  },

  /**
   * Get the last accessed module ID from course progress
   */
  getLastAccessedModuleId(
    modules: Record<string, ModuleProgress>
  ): string | null {
    const moduleArray = Object.values(modules);
    if (moduleArray.length === 0) return null;

    const sorted = moduleArray.sort(
      (a, b) =>
        new Date(b.lastAccessedAt).getTime() -
        new Date(a.lastAccessedAt).getTime()
    );
    return sorted[0]?.moduleId || null;
  },

  /**
   * Calculate remaining lessons count
   */
  getRemainingLessonsCount(modules: Record<string, ModuleProgress>): number {
    const moduleArray = Object.values(modules);
    return moduleArray.filter((m) => !m.isCompleted).length;
  },
};
