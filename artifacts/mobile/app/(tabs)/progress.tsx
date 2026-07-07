import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProgress } from "@/context/ProgressContext";
import { fetchAllCourses, getCourseModules } from "@/services/courseDataProvider";
import { useColors } from "@/hooks/useColors";
import { ProgressAnalytics } from "@/lib/progressAnalytics";
import { ProgressStats } from "@/components/ProgressStats";
import { WatchlistCard } from "@/components/WatchlistCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useAuth } from "@/context/AuthContextSupabase";
import { fetchEnrolledCourses } from "@/services/enrollmentService";
import { supabase } from "@/lib/supabase";
import { ProgressCalculator } from "@/lib/progressCalculator";
import { HomeSkeleton } from "@/components/SkeletonLoader";

function formatTotalTime(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = totalSeconds / 3600;
  return `${hours.toFixed(1)} hrs`;
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { courseProgress, watchlist } = useProgress();
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<{
    day: string;
    minutes: number;
    lessonsCompleted: number;
    index: number;
  } | null>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>({
    totalCoursesEnrolled: 0,
    coursesCompleted: 0,
    coursesInProgress: 0,
    totalLessonsCompleted: 0,
    averageProgress: 0,
    totalTimeSpent: 0,
    learningStreak: 0,
    weeklyActivity: [],
    recentlyCompleted: [],
  });

  const loadStatsAndCourses = useCallback(async (isRefreshing = false) => {
    if (!user?.id) {
      setIsLoadingCourses(false);
      return;
    }
    if (!isRefreshing) {
      setIsLoadingCourses(true);
    }
    try {
      const all = await fetchAllCourses();
      const mapped = all.map((c: any) => ({
        id: String(c.id),
        title: c.title,
        category: c.category || "General",
        level: c.level ? (c.level.charAt(0).toUpperCase() + c.level.slice(1)) : "Beginner",
        price: c.price || 0,
        isFree: c.is_free,
        thumbnail: c.thumbnail_url ? { uri: c.thumbnail_url } : require('@/assets/images/course_robotics.png'),
        instructor: "MakersFlow Instructor",
        rating: 4.8,
        reviews: 120,
        description: c.description || "",
        modules: []
      }));
      setCourses(mapped);

      // Fetch enrollments
      const enrollments = await fetchEnrolledCourses(user.id);

      // BUG 3 fix: Query exact enrolled count from supabase
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      const totalCoursesEnrolled = count ?? 0;
      setEnrolledCount(totalCoursesEnrolled);

      // Fetch lesson progress
      const { data: progressData, error: progressError } = await supabase
        .from('lesson_progress')
        .select('course_id, lesson_id, time_spent_secs, is_completed, last_watched_at')
        .eq('user_id', user.id);

      if (progressError) throw progressError;
      const progressList = progressData ?? [];

      // Calculate completed courses count
      let completedCoursesCount = 0;
      let notStartedCoursesCount = 0;

      const courseProgressListMap = new Map<string, any[]>();
      progressList.forEach((p) => {
        const cId = String(p.course_id);
        if (!courseProgressListMap.has(cId)) {
          courseProgressListMap.set(cId, []);
        }
        courseProgressListMap.get(cId)!.push(p);
      });

      const moduleCache = new Map<string, any[]>();
      const getCachedModules = async (courseId: string) => {
        if (!moduleCache.has(courseId)) {
          moduleCache.set(courseId, await getCourseModules(courseId));
        }
        return moduleCache.get(courseId);
      };

      for (const enr of enrollments) {
        if (enr.completed_at) {
          completedCoursesCount++;
        } else {
          const courseId = String(enr.course_id);
          const courseModules = await getCachedModules(courseId) || [];
          const lessonIds = courseModules.flatMap((m: any) => (m.lessons ?? []).map((l: any) => l.id));
          
          if (lessonIds.length > 0) {
            const courseProg = courseProgressListMap.get(courseId) ?? [];
            const completedLessons = courseProg.filter((p) => p.is_completed && lessonIds.includes(p.lesson_id)).length;
            if (completedLessons === lessonIds.length) {
              completedCoursesCount++;
            } else if (completedLessons === 0 && courseProg.length === 0) {
              notStartedCoursesCount++;
            }
          } else {
            notStartedCoursesCount++;
          }
        }
      }

      const coursesInProgress = Math.max(0, totalCoursesEnrolled - completedCoursesCount - notStartedCoursesCount);
      const totalLessonsCompleted = progressList.filter((p) => p.is_completed).length;

      // Calculate average progress
      let progressSum = 0;
      for (const enr of enrollments) {
        const courseId = String(enr.course_id);
        const courseModules = await getCachedModules(courseId) || [];
        const lessonIds = courseModules.flatMap((m: any) => (m.lessons ?? []).map((l: any) => l.id));
        if (lessonIds.length > 0) {
          const courseProg = courseProgressListMap.get(courseId) ?? [];
          const completedLessons = courseProg.filter((p) => p.is_completed && lessonIds.includes(p.lesson_id)).length;
          progressSum += Math.round((completedLessons / lessonIds.length) * 100);
        }
      }
      const averageProgress = totalCoursesEnrolled > 0 ? Math.round(progressSum / totalCoursesEnrolled) : 0;

      // Calculate total time spent
      const totalTimeSpent = progressList.reduce((sum, p) => sum + (p.time_spent_secs || 0), 0);

      // Calculate learning streak
      const learningStreak = ProgressCalculator.calculateStreak(progressList);

      // Generate weekly activity (7 days ending with today)
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyActivity = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const dayName = days[date.getDay()];
        const dateString = date.toDateString();

        const dayProgress = progressList.filter(p => {
          if (!p.last_watched_at) return false;
          return new Date(p.last_watched_at).toDateString() === dateString;
        });

        const dayMinutes = dayProgress.reduce((sum, p) => sum + (p.time_spent_secs || (p.is_completed ? 300 : 0)), 0) / 60;
        const dayCompleted = dayProgress.filter(p => p.is_completed).length;

        weeklyActivity.push({
          day: dayName,
          minutes: Math.round(dayMinutes),
          lessonsCompleted: dayCompleted,
        });
      }

      // Calculate recently completed lessons (last 10)
      const recentlyCompleted: any[] = [];
      for (const p of progressList) {
        if (p.is_completed && p.last_watched_at) {
          const course = mapped.find((c: any) => c.id === String(p.course_id));
          if (!course) continue;

          const courseModules = await getCachedModules(String(p.course_id)) || [];
          const matchedModule = courseModules.find((m: any) => (m.lessons ?? []).some((l: any) => l.id === p.lesson_id));

          if (matchedModule) {
            recentlyCompleted.push({
              courseId: course.id,
              courseTitle: course.title,
              moduleId: matchedModule.id,
              moduleTitle: matchedModule.title,
              completedAt: p.last_watched_at,
              courseThumbnail: course.thumbnail,
            });
          }
        }
      }
      recentlyCompleted.sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      const topRecentlyCompleted = recentlyCompleted.slice(0, 10);

      setStats({
        totalCoursesEnrolled,
        coursesCompleted: completedCoursesCount,
        coursesInProgress,
        totalLessonsCompleted,
        averageProgress,
        totalTimeSpent,
        learningStreak,
        weeklyActivity,
        recentlyCompleted: topRecentlyCompleted,
      });

    } catch (err) {
      console.error('[Progress] Error loading stats & courses:', err);
    } finally {
      setIsLoadingCourses(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadStatsAndCourses(false);
    }, [loadStatsAndCourses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatsAndCourses(true);
    setRefreshing(false);
  };

  const coursesWithProgress = useMemo(
    () => ProgressAnalytics.getCoursesWithProgress(courseProgress, courses),
    [courseProgress, courses]
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoadingCourses) {
    return <HomeSkeleton />;
  }

  // Get max minutes for weekly activity chart scaling
  const maxMinutes = Math.max(...stats.weeklyActivity.map((d: any) => d.minutes), 1);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 16,
        paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Your Progress</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Track your learning journey
          </Text>
        </View>
        <Pressable
          style={[styles.cartBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/(tabs)/store")}
        >
          <Ionicons name="cart-outline" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Empty State */}
      {stats.totalCoursesEnrolled === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="trending-up" size={48} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your Learning Journey Starts Here!
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Enroll in courses to track your progress and achieve your learning goals
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/courses")}
          >
            <Text style={styles.emptyBtnText}>Browse Courses</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <>
          {/* Progress Statistics */}
          <View style={styles.section}>
            <ProgressStats
              totalCoursesEnrolled={stats.totalCoursesEnrolled}
              coursesCompleted={stats.coursesCompleted}
              coursesInProgress={stats.coursesInProgress}
              totalLessonsCompleted={stats.totalLessonsCompleted}
              averageProgress={stats.averageProgress}
              learningStreak={stats.learningStreak}
            />
          </View>

          {/* Learning Streak & Time Spent Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.accent }]}>
                <Feather name="clock" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.statCardValue, { color: colors.foreground }]}>
                {formatTotalTime(stats.totalTimeSpent)}
              </Text>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Total Time Spent</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconWrapper, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="zap" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.statCardValue, { color: colors.foreground }]}>
                {stats.learningStreak} Days
              </Text>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Learning Streak</Text>
            </View>
          </View>

          {/* Weekly Activity */}
          <View style={styles.section}>
            <View style={styles.activityHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 4 }]}>
                  Weekly Activity
                </Text>
                <Text style={[styles.activitySubtitle, { color: colors.mutedForeground }]}>
                  Tap on a day to see details
                </Text>
              </View>
              <View style={[styles.activityBadge, { backgroundColor: colors.accent }]}>
                <Feather name="trending-up" size={14} color={colors.primary} />
                <Text style={[styles.activityBadgeText, { color: colors.primary }]}>
                  {stats.weeklyActivity.reduce((sum: number, d: any) => sum + d.minutes, 0)} min
                </Text>
              </View>
            </View>
            {stats.totalLessonsCompleted === 0 ? (
              <View
                style={[
                  styles.emptyActivityCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.emptyActivityIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyActivityTitle, { color: colors.foreground }]}>
                  Complete a lesson to begin tracking
                </Text>
                <Text style={[styles.emptyActivityText, { color: colors.mutedForeground }]}>
                  Start your first lesson to see your learning statistics here
                </Text>
                <Pressable
                  style={[styles.emptyActivityBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const firstCourse = coursesWithProgress[0];
                    if (firstCourse) {
                      router.push(`/course/${firstCourse.courseId}`);
                    } else {
                      router.push("/(tabs)/courses");
                    }
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Start Learning"
                  accessibilityHint="Double tap to start learning"
                >
                  <Text style={styles.emptyActivityBtnText}>Start Learning</Text>
                  <Feather name="arrow-right" size={16} color="#FFF" />
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.activityCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.activityChart}>
                  {stats.weeklyActivity.map((day: any, index: number) => {
                    const height = maxMinutes > 0 ? (day.minutes / maxMinutes) * 100 : 0;
                    const hasActivity = day.minutes > 0;
                    const isSelected = selectedDay?.index === index;

                    return (
                      <Pressable
                        key={`week-${index}-${day.day}`}
                        style={styles.activityBarContainer}
                        onPress={() => {
                          if (hasActivity) {
                            setSelectedDay({ ...day, index });
                          }
                        }}
                        accessible={hasActivity}
                        accessibilityRole="button"
                        accessibilityLabel={`${day.day}: ${day.minutes} minutes, ${day.lessonsCompleted} lessons completed`}
                      >
                        <View style={styles.activityBarWrapper}>
                          <View
                            style={[
                              styles.activityBar,
                              {
                                height: `${Math.max(height, 5)}%`,
                                backgroundColor: hasActivity 
                                  ? isSelected 
                                    ? colors.primary 
                                    : `${colors.primary}CC`
                                  : colors.muted,
                                transform: [{ scale: isSelected ? 1.1 : 1 }],
                                shadowColor: isSelected ? colors.primary : "transparent",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: isSelected ? 4 : 0,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.activityDay,
                            {
                              color: isSelected ? colors.primary : colors.mutedForeground,
                              fontWeight: isSelected ? "700" : "600",
                            },
                          ]}
                        >
                          {day.day}
                        </Text>
                        {hasActivity && (
                          <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Tooltip Display */}
                {selectedDay && (
                  <View style={[styles.tooltipCard, { backgroundColor: colors.accent }]}>
                    <View style={styles.tooltipHeader}>
                      <Feather name="calendar" size={16} color={colors.primary} />
                      <Text style={[styles.tooltipDay, { color: colors.foreground }]}>
                        {selectedDay.day}
                      </Text>
                    </View>
                    <View style={styles.tooltipStats}>
                      <View style={styles.tooltipStat}>
                        <Feather name="clock" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.tooltipStatText, { color: colors.foreground }]}>
                          {selectedDay.minutes} minutes
                        </Text>
                      </View>
                      <View style={styles.tooltipStat}>
                        <Feather name="check-circle" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.tooltipStatText, { color: colors.foreground }]}>
                          {selectedDay.lessonsCompleted} lesson{selectedDay.lessonsCompleted !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
                <View style={styles.activitySummary}>
                  <View style={styles.activityStat}>
                    <View style={[styles.activityStatIcon, { backgroundColor: `${colors.primary}14` }]}>
                      <Feather name="clock" size={14} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.activityStatLabel, { color: colors.mutedForeground }]}>
                        Total Time
                      </Text>
                      <Text style={[styles.activityStatValue, { color: colors.foreground }]}>
                        {stats.weeklyActivity.reduce((sum: number, d: any) => sum + d.minutes, 0)} min
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.activityStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.activityStat}>
                    <View style={[styles.activityStatIcon, { backgroundColor: `${colors.primary}14` }]}>
                      <Feather name="check-circle" size={14} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.activityStatLabel, { color: colors.mutedForeground }]}>
                        Lessons Done
                      </Text>
                      <Text style={[styles.activityStatValue, { color: colors.foreground }]}>
                        {stats.weeklyActivity.reduce((sum: number, d: any) => sum + d.lessonsCompleted, 0)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.activityStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.activityStat}>
                    <View style={[styles.activityStatIcon, { backgroundColor: `${colors.primary}14` }]}>
                      <Feather name="zap" size={14} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.activityStatLabel, { color: colors.mutedForeground }]}>
                        Active Days
                      </Text>
                      <Text style={[styles.activityStatValue, { color: colors.foreground }]}>
                        {stats.weeklyActivity.filter((d: any) => d.minutes > 0).length}/7
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* View My Courses Shortcut */}
          <View style={styles.section}>
            <Pressable
              style={[
                styles.coursesShortcut,
                {
                  backgroundColor: `${colors.primary}14`,
                  borderColor: `${colors.primary}4D`,
                },
              ]}
              onPress={() => router.push("/(tabs)/courses")}
            >
              <Feather name="book-open" size={20} color={colors.primary} />
              <View style={styles.coursesShortcutText}>
                <Text style={[styles.coursesShortcutTitle, { color: colors.primary }]}>
                  My Enrolled Courses
                </Text>
                <Text style={[styles.coursesShortcutSubtitle, { color: colors.mutedForeground }]}>
                  {stats.totalCoursesEnrolled} course{stats.totalCoursesEnrolled !== 1 ? "s" : ""} enrolled
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
          </View>

          {/* Continue Learning */}
          {watchlist.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Continue Learning"
                subtitle={`${watchlist.length} lesson${watchlist.length > 1 ? "s" : ""} in progress`}
              />
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
              >
                {watchlist.map((item) => (
                  <WatchlistCard key={`${item.courseId}-${item.moduleId}`} item={item} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Recently Completed Lessons */}
          {stats.recentlyCompleted.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Recently Completed"
                subtitle={`${stats.recentlyCompleted.length} lesson${
                  stats.recentlyCompleted.length > 1 ? "s" : ""
                }`}
              />
              <View style={styles.completedList}>
                {stats.recentlyCompleted.slice(0, 5).map((lesson: any, index: number) => (
                  <Pressable
                    key={`${lesson.courseId}-${lesson.moduleId}-${index}`}
                    style={[
                      styles.completedItem,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => router.push(`/course/${lesson.courseId}`)}
                  >
                    <Image source={lesson.courseThumbnail} style={styles.completedThumbnail} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.completedModuleTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {lesson.moduleTitle}
                      </Text>
                      <Text
                        style={[styles.completedCourseTitle, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {lesson.courseTitle}
                      </Text>
                      <Text style={[styles.completedDate, { color: colors.mutedForeground }]}>
                        {formatCompletedDate(lesson.completedAt)}
                      </Text>
                    </View>
                    <View style={styles.completedCheck}>
                      <Feather name="check-circle" size={20} color="#10B981" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function formatCompletedDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  pageTitle: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 14 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12, paddingHorizontal: 20 },
  carouselContent: { paddingLeft: 20, paddingRight: 4 },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  emptyBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },

  // Streak Card
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 8,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Weekly Activity Empty State
  emptyActivityCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 20,
  },
  emptyActivityIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyActivityTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyActivityText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyActivityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  emptyActivityBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },

  // Weekly Activity Header
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  activitySubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  activityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activityBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Weekly Activity
  activityCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  activityChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 160,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    position: "relative",
  },
  activityBarContainer: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  activityBarWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    position: "relative",
  },
  activityBar: {
    width: "70%",
    borderRadius: 6,
    minHeight: 6,
    position: "relative",
  },
  activityDay: {
    fontSize: 12,
    fontWeight: "600",
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: -2,
  },
  activityDivider: {
    height: 1,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  activitySummary: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  activityStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activityStatLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  activityStatValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  activityStatDivider: {
    width: 1,
    height: "100%",
  },

  // Tooltip
  tooltipCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  tooltipDay: {
    fontSize: 15,
    fontWeight: "700",
  },
  tooltipStats: {
    flexDirection: "row",
    gap: 16,
  },
  tooltipStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tooltipStatText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Recently Completed
  completedList: {
    gap: 10,
    paddingHorizontal: 20,
  },
  completedItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  completedThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  completedModuleTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  completedCourseTitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  completedDate: {
    fontSize: 11,
  },
  completedCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  // Courses Shortcut
  coursesShortcut: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    gap: 12,
  },
  coursesShortcutText: {
    flex: 1,
  },
  coursesShortcutTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  coursesShortcutSubtitle: {
    fontSize: 13,
  },
});
