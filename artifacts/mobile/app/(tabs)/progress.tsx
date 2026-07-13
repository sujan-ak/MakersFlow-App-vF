import { Ionicons } from "@expo/vector-icons";
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
  if (minutes < 60) return `${minutes} min`;
  const hours = totalSeconds / 3600;
  return `${hours.toFixed(1)} hrs`;
}

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Aarav Sharma", points: 2840, isSelf: false },
  { rank: 2, name: "Ishaan Patel", points: 2610, isSelf: false },
  { rank: 3, name: "Sneha Reddy", points: 2450, isSelf: false },
  { rank: 12, name: "You (Student)", points: 1280, isSelf: true },
];

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { courseProgress, watchlist } = useProgress();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<"courses" | "stats" | "leaderboard">("stats");
  const [selectedDay, setSelectedDay] = useState<{
    day: string;
    minutes: number;
    lessonsCompleted: number;
    index: number;
  } | null>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [enrolledCoursesProgress, setEnrolledCoursesProgress] = useState<any[]>([]);
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

      const enrollments = await fetchEnrolledCourses(user.id);
      const totalCoursesEnrolled = enrollments.length;
      setEnrolledCount(totalCoursesEnrolled);

      const { data: progressData, error: progressError } = await supabase
        .from('lesson_progress')
        .select('course_id, lesson_id, time_spent_secs, is_completed, last_watched_at')
        .eq('user_id', user.id);

      if (progressError) throw progressError;
      const progressList = progressData ?? [];

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

      let progressSum = 0;
      const enrolledProgressList = [];
      for (const enr of enrollments) {
        const courseId = String(enr.course_id);
        const courseDetails = mapped.find((c: any) => c.id === courseId);
        if (!courseDetails) continue;

        let courseProgPct = 0;
        if (enr.completed_at) {
          courseProgPct = 100;
        } else {
          const courseModules = await getCachedModules(courseId) || [];
          const lessonIds = courseModules.flatMap((m: any) => (m.lessons ?? []).map((l: any) => l.id));
          if (lessonIds.length > 0) {
            const courseProg = courseProgressListMap.get(courseId) ?? [];
            const completedLessons = courseProg.filter((p) => p.is_completed && lessonIds.includes(p.lesson_id)).length;
            courseProgPct = Math.round((completedLessons / lessonIds.length) * 100);
          }
        }

        progressSum += courseProgPct;

        enrolledProgressList.push({
          courseId,
          courseTitle: courseDetails.title,
          thumbnail: courseDetails.thumbnail,
          progress: courseProgPct,
        });
      }
      setEnrolledCoursesProgress(enrolledProgressList);

      const averageProgress = totalCoursesEnrolled > 0 ? Math.round(progressSum / totalCoursesEnrolled) : 0;
      const totalTimeSpent = progressList.reduce((sum, p) => sum + (p.time_spent_secs || 0), 0);
      const learningStreak = ProgressCalculator.calculateStreak(progressList);

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

  const coursesWithProgress = useMemo(() => {
    return enrolledCoursesProgress;
  }, [enrolledCoursesProgress]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoadingCourses) {
    return <HomeSkeleton />;
  }

  // Guest / signed-out state — mirrors the pre-login browsing experience
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ paddingTop: topPad + 16, paddingHorizontal: 20 }}>
          <Text style={[styles.pageTitle, { color: '#0F2A3D' }]}>Your Progress</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Track your learning journey</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#DCF7F4', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="stats-chart" size={40} color="#0B6FAD" />
          </View>
          <Text style={{ fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#0F2A3D', textAlign: 'center' }}>
            Track Your Progress
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.mutedForeground, textAlign: 'center', lineHeight: 22 }}>
            Sign in to see your enrolled courses, learning streaks, weekly activity, and completion stats.
          </Text>
          <Pressable
            style={{ marginTop: 8, backgroundColor: '#0B6FAD', borderRadius: 28, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', width: '100%' }}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' }}>Sign In</Text>
          </Pressable>
          <Pressable
            style={{ borderRadius: 28, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', width: '100%', borderWidth: 1.5, borderColor: '#D6E9F2' }}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0B6FAD' }}>Create Account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0B6FAD']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: "#0F2A3D" }]}>Your Progress</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Track your learning journey
          </Text>
        </View>
        <Pressable
          style={styles.cartBtn}
          onPress={() => router.push("/(tabs)/store")}
        >
          <Ionicons name="cart" size={20} color="#0B6FAD" />
        </Pressable>
      </View>

      {/* Segmented Tab Switcher */}
      <View style={styles.segmentedContainer}>
        {[
          { id: "courses", label: "Courses", icon: "book" },
          { id: "stats", label: "Progress", icon: "stats-chart" },
          { id: "leaderboard", label: "Leaderboard", icon: "trophy" }
        ].map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[
                styles.segmentBtn,
                isActive && { backgroundColor: "#0B6FAD" }
              ]}
              onPress={() => setCurrentTab(tab.id as any)}
            >
              <Ionicons name={tab.icon as any} size={14} color={isActive ? "#FFF" : "#5A7A8C"} />
              <Text style={[styles.segmentLabel, { color: isActive ? "#FFF" : "#5A7A8C", fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {stats.totalCoursesEnrolled === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: "#DCF7F4" }]}>
            <Ionicons name="stats-chart" size={48} color="#17E5D3" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your Learning Journey Starts Here!
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Enroll in courses to track your progress and achieve your learning goals
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: "#0B6FAD" }]}
            onPress={() => router.push("/(tabs)/courses")}
          >
            <Text style={styles.emptyBtnText}>Browse Courses</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <>
          {currentTab === "courses" && (
            <View style={{ gap: 12 }}>
              {coursesWithProgress.length === 0 ? (
                <Text style={styles.emptyActivityText}>No courses with progress in this tab.</Text>
              ) : (
                coursesWithProgress.map((c) => (
                  <View key={c.courseId} style={styles.courseProgressRowCard}>
                    <Image source={c.thumbnail} style={styles.courseProgressThumbnail} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.courseProgressTitle}>{c.courseTitle}</Text>
                      <View style={styles.courseProgressRow}>
                        <View style={styles.courseProgressTrack}>
                          <View style={[styles.courseProgressFill, { width: `${c.progress}%` }]} />
                        </View>
                        <Text style={styles.courseProgressPct}>{c.progress}%</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {currentTab === "stats" && (
            <>
              {/* Progress Statistics Grid */}
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

              {/* Time Spent & Learning Streak Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.statIconWrapper, { backgroundColor: "#DCF7F4" }]}>
                    <Ionicons name="time" size={20} color="#0B6FAD" />
                  </View>
                  <Text style={[styles.statCardValue, { color: colors.foreground }]}>
                    {formatTotalTime(stats.totalTimeSpent)}
                  </Text>
                  <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Total Time Spent</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.statIconWrapper, { backgroundColor: "#DCF7F4" }]}>
                    <Ionicons name="flash" size={20} color="#0B6FAD" />
                  </View>
                  <Text style={[styles.statCardValue, { color: colors.foreground }]}>
                    {stats.learningStreak} Days
                  </Text>
                  <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Learning Streak</Text>
                </View>
              </View>

              {/* Weekly Activity Chart */}
              <View style={styles.section}>
                <View style={styles.activityHeader}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 4, paddingHorizontal: 0 }]}>
                      Weekly Activity
                    </Text>
                    <Text style={[styles.activitySubtitle, { color: colors.mutedForeground }]}>
                      Tap on a day to see details
                    </Text>
                  </View>
                  <View style={[styles.activityBadge, { backgroundColor: "#DCF7F4" }]}>
                    <Ionicons name="trending-up" size={14} color="#0B6FAD" />
                    <Text style={[styles.activityBadgeText, { color: "#0B6FAD" }]}>
                      {stats.weeklyActivity.reduce((sum: number, d: any) => sum + d.minutes, 0)} min
                    </Text>
                  </View>
                </View>

                <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                        >
                          <View style={styles.activityBarWrapper}>
                            <View
                              style={[
                                styles.activityBar,
                                {
                                  height: `${Math.max(height, 5)}%`,
                                  backgroundColor: hasActivity 
                                    ? isSelected 
                                      ? "#0B6FAD" 
                                      : "#17E5D3"
                                    : colors.muted,
                                  transform: [{ scale: isSelected ? 1.1 : 1 }],
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.activityDay,
                              {
                                color: isSelected ? "#0B6FAD" : colors.mutedForeground,
                                fontWeight: isSelected ? "700" : "600",
                              },
                            ]}
                          >
                            {day.day}
                          </Text>
                          {hasActivity && (
                            <View style={[styles.activityDot, { backgroundColor: "#0B6FAD" }]} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedDay && (
                    <View style={[styles.tooltipCard, { backgroundColor: "#DCF7F4" }]}>
                      <View style={styles.tooltipHeader}>
                        <Ionicons name="calendar" size={16} color="#0B6FAD" />
                        <Text style={[styles.tooltipDay, { color: colors.foreground }]}>
                          {selectedDay.day}
                        </Text>
                      </View>
                      <View style={styles.tooltipStats}>
                        <View style={styles.tooltipStat}>
                          <Ionicons name="time" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.tooltipStatText, { color: colors.foreground }]}>
                            {selectedDay.minutes} minutes
                          </Text>
                        </View>
                        <View style={styles.tooltipStat}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.tooltipStatText, { color: colors.foreground }]}>
                            {selectedDay.lessonsCompleted} lesson{selectedDay.lessonsCompleted !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* shortcut */}
              <View style={styles.section}>
                <Pressable
                  style={[styles.coursesShortcut, { backgroundColor: "#DCF7F4", borderColor: "#17E5D3" }]}
                  onPress={() => router.push("/(tabs)/courses")}
                >
                  <Ionicons name="book" size={20} color="#0B6FAD" />
                  <View style={styles.coursesShortcutText}>
                    <Text style={[styles.coursesShortcutTitle, { color: "#0B6FAD" }]}>
                      My Enrolled Courses
                    </Text>
                    <Text style={[styles.coursesShortcutSubtitle, { color: colors.mutedForeground }]}>
                      {stats.totalCoursesEnrolled} course{stats.totalCoursesEnrolled !== 1 ? "s" : ""} enrolled
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#0B6FAD" />
                </Pressable>
              </View>
            </>
          )}

          {currentTab === "leaderboard" && (
            <View style={styles.leaderboardSection}>
              <View style={styles.leaderboardHeader}>
                <Ionicons name="trophy" size={32} color="#F59E0B" />
                <Text style={styles.leaderboardTitle}>Weekly Leaderboard</Text>
              </View>
              {MOCK_LEADERBOARD.map((item) => (
                <View
                  key={item.rank}
                  style={[
                    styles.leaderboardRow,
                    item.isSelf && { backgroundColor: "#DCF7F4", borderColor: "#17E5D3" },
                  ]}
                >
                  <Text style={styles.leaderboardRank}>#{item.rank}</Text>
                  <Text style={[styles.leaderboardName, item.isSelf && { color: "#0B6FAD" }]}>{item.name}</Text>
                  <Text style={styles.leaderboardPoints}>{item.points} pts</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
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
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#D6E9F2",
  },
  pageTitle: { fontSize: 26, fontFamily: "Fredoka_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold", marginBottom: 12, paddingHorizontal: 20 },
  carouselContent: { paddingLeft: 20, paddingRight: 4 },

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Fredoka_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24, // pill
    minHeight: 48,
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: "Fredoka_600SemiBold",
    color: "#FFF",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 8,
    gap: 12,
    marginBottom: 24,
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
    fontFamily: "Fredoka_700Bold",
  },
  statCardLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  activitySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Fredoka_700Bold",
  },

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
    fontFamily: "Inter_600SemiBold",
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: -2,
  },

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
    fontFamily: "Fredoka_700Bold",
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
    fontFamily: "Inter_600SemiBold",
  },

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
    fontFamily: "Fredoka_600SemiBold",
    marginBottom: 2,
  },
  coursesShortcutSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  // Segmented control selector styling
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#D6E9F2",
    marginHorizontal: 20,
    padding: 3,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: 20,
  },
  segmentLabel: {
    fontSize: 13,
  },

  // Per-course progress rows: white cards
  courseProgressRowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E9F2",
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  courseProgressThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  courseProgressTitle: {
    fontSize: 14,
    fontFamily: "Fredoka_600SemiBold",
    color: "#0F2A3D",
    marginBottom: 8,
  },
  courseProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  courseProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E8F4F9",
    position: "relative",
    overflow: "hidden",
  },
  courseProgressFill: {
    height: "100%",
    backgroundColor: "#0B6FAD",
    borderRadius: 3,
  },
  courseProgressPct: {
    fontSize: 12,
    fontFamily: "Fredoka_700Bold",
    color: "#0B6FAD",
  },

  // Leaderboard Section styling
  leaderboardSection: {
    marginHorizontal: 20,
    gap: 12,
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontFamily: "Fredoka_700Bold",
    color: "#0F2A3D",
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D6E9F2",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  leaderboardRank: {
    fontSize: 14,
    fontFamily: "Fredoka_700Bold",
    color: "#0B6FAD",
    width: 36,
  },
  leaderboardName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F2A3D",
    flex: 1,
  },
  leaderboardPoints: {
    fontSize: 13,
    fontFamily: "Fredoka_600SemiBold",
    color: "#5A7A8C",
  },
  emptyActivityText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    color: "#5A7A8C",
    marginTop: 20,
  },
});
