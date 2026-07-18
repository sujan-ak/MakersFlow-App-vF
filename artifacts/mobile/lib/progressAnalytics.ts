import { UserCourseProgress, ModuleProgress } from "./progressStorage";

export interface LearningStats {
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  totalLessonsCompleted: number;
  totalLessonsInProgress: number;
  averageProgress: number;
  totalTimeSpent: number;
  learningStreak: number;
  weeklyActivity: WeeklyActivity[];
  recentlyCompleted: RecentlyCompletedLesson[];
}

export interface WeeklyActivity {
  day: string;
  minutes: number;
  lessonsCompleted: number;
}

export interface RecentlyCompletedLesson {
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  completedAt: string;
  courseThumbnail: any;
}

export interface CourseWithProgress {
  courseId: string;
  courseTitle: string;
  instructor: string;
  thumbnail: any;
  progress: number;
  totalModules: number;
  completedModules: number;
  lastAccessedAt: string;
  timeSpent: number;
}

export class ProgressAnalytics {
  /**
   * Calculate comprehensive learning statistics from course progress
   */
  static calculateLearningStats(
    courseProgress: Map<string, UserCourseProgress>,
    coursesData: any[]
  ): LearningStats {
    const progressArray = Array.from(courseProgress.values());

    const totalCoursesEnrolled = progressArray.length;
    const coursesCompleted = progressArray.filter((p) => p.progress === 100).length;
    const coursesInProgress = progressArray.filter(
      (p) => p.progress > 0 && p.progress < 100
    ).length;

    let totalLessonsCompleted = 0;
    let totalLessonsInProgress = 0;
    let totalTimeSpent = 0;
    const recentlyCompleted: RecentlyCompletedLesson[] = [];

    progressArray.forEach((courseProgress) => {
      const course = coursesData.find((c) => c.id === courseProgress.courseId);
      if (!course) return;

      totalTimeSpent += courseProgress.totalTimeSpent || 0;

      Object.values(courseProgress.modules).forEach((module: ModuleProgress) => {
        if (module.isCompleted) {
          totalLessonsCompleted++;
          if (module.completedAt) {
            const courseModule = course.modules.find((m: any) => m.id === module.moduleId);
            if (courseModule) {
              recentlyCompleted.push({
                courseId: course.id,
                courseTitle: course.title,
                moduleId: module.moduleId,
                moduleTitle: courseModule.title,
                completedAt: module.completedAt,
                courseThumbnail: course.thumbnail,
              });
            }
          }
        } else if (module.isStarted) {
          totalLessonsInProgress++;
        }
      });
    });

    // Sort recently completed by date and take top 10
    recentlyCompleted.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    const topRecentlyCompleted = recentlyCompleted.slice(0, 10);

    const averageProgress =
      totalCoursesEnrolled > 0
        ? Math.round(
            progressArray.reduce((sum, p) => sum + p.progress, 0) / totalCoursesEnrolled
          )
        : 0;

    // Mock learning streak (in production, calculate from actual activity data)
    const learningStreak = this.calculateLearningStreak(progressArray);

    // Mock weekly activity (in production, use real time-tracking data)
    const weeklyActivity = this.generateWeeklyActivity(progressArray);

    return {
      totalCoursesEnrolled,
      coursesCompleted,
      coursesInProgress,
      totalLessonsCompleted,
      totalLessonsInProgress,
      averageProgress,
      totalTimeSpent,
      learningStreak,
      weeklyActivity,
      recentlyCompleted: topRecentlyCompleted,
    };
  }

  /**
   * Calculate learning streak based on last access dates
   */
  static calculateLearningStreak(progressArray: UserCourseProgress[]): number {
    if (progressArray.length === 0) return 0;

    // Get all access dates and sort them
    const accessDates = progressArray
      .map((p) => new Date(p.lastAccessedAt).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (accessDates.length === 0) return 0;

    // Check if today or yesterday is included (active streak)
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (accessDates[0] !== today && accessDates[0] !== yesterday) {
      return 0; // Streak broken
    }

    // Count consecutive days
    let streak = 1;
    let currentDate = new Date(accessDates[0]);

    for (let i = 1; i < accessDates.length; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);

      if (accessDates[i] === prevDate.toDateString()) {
        streak++;
        currentDate = new Date(accessDates[i]);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Generate weekly activity data for the last 7 days
   */
  static generateWeeklyActivity(progressArray: UserCourseProgress[]): WeeklyActivity[] {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyActivity: WeeklyActivity[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      const dateString = date.toDateString();

      // Count lessons accessed on this day
      let lessonsCompleted = 0;
      let estimatedMinutes = 0;

      progressArray.forEach((course) => {
        Object.values(course.modules).forEach((module: ModuleProgress) => {
          if (
            module.completedAt &&
            new Date(module.completedAt).toDateString() === dateString
          ) {
            lessonsCompleted++;
            estimatedMinutes += 45; // Estimate 45 minutes per lesson
          }
        });
      });

      weeklyActivity.push({
        day: dayName,
        minutes: estimatedMinutes,
        lessonsCompleted,
      });
    }

    return weeklyActivity;
  }

  /**
   * Get courses with their progress details
   */
  static getCoursesWithProgress(
    courseProgress: Map<string, UserCourseProgress>,
    coursesData: any[]
  ): CourseWithProgress[] {
    const coursesWithProgress: CourseWithProgress[] = [];

    courseProgress.forEach((progress, courseId) => {
      const course = coursesData.find((c) => c.id === courseId);
      if (!course) return;

      const totalModules = Object.keys(progress.modules).length;
      const completedModules = Object.values(progress.modules).filter(
        (m: ModuleProgress) => m.isCompleted
      ).length;

      coursesWithProgress.push({
        courseId: course.id,
        courseTitle: course.title,
        instructor: course.instructor,
        thumbnail: course.thumbnail,
        progress: progress.progress,
        totalModules,
        completedModules,
        lastAccessedAt: progress.lastAccessedAt,
        timeSpent: progress.totalTimeSpent || 0,
      });
    });

    // Sort by last accessed (most recent first)
    coursesWithProgress.sort(
      (a, b) =>
        new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    );

    return coursesWithProgress;
  }

  /**
   * Format time in minutes to human-readable string
   */
  static formatTimeSpent(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Get lesson state for a specific module
   */
  static getLessonState(
    courseProgress: UserCourseProgress | null,
    moduleId: string,
    moduleIndex: number,
    allModules: any[]
  ): "completed" | "current" | "locked" | "available" {
    if (!courseProgress) return "locked";

    const moduleProgress = courseProgress.modules[moduleId];

    // Completed
    if (moduleProgress?.isCompleted) return "completed";

    // Current (started but not completed)
    if (moduleProgress?.isStarted) return "current";

    // Check if previous lessons are completed (sequential unlocking)
    if (moduleIndex === 0) return "available";

    const previousModule = allModules[moduleIndex - 1];
    const previousProgress = courseProgress.modules[previousModule.id];

    if (previousProgress?.isCompleted) return "available";

    return "locked";
  }
}
