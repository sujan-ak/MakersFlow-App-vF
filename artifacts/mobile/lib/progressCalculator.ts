import { ModuleProgress, VideoProgress } from "./progressStorage";

export const ProgressCalculator = {
  /**
   * Calculate consecutive daily learning streak
   */
  calculateStreak(progressList: any[]): number {
    const dates = progressList
      .map((p) => p.last_watched_at ? new Date(p.last_watched_at).toDateString() : null)
      .filter(Boolean)
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());

    if (dates.length === 0) return 0;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (dates[0] !== today && dates[0] !== yesterday) {
      return 0; // streak broken
    }

    let streak = 1;
    let currentDate = new Date(dates[0]!);

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);

      if (dates[i] === prevDate.toDateString()) {
        streak++;
        currentDate = new Date(dates[i]!);
      } else {
        break;
      }
    }
    return streak;
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
