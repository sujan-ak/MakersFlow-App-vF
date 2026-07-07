// ═══════════════════════════════════════════════════════════
// MOVED TO: app/(tabs)/search.tsx
// ═══════════════════════════════════════════════════════════
// The following features were moved to the Search tab:
// - SearchBar component for course discovery
// - Category filter chips (Robotics, AI, Electronics, etc.)
// - Full course catalog browsing
// - Search functionality across all courses
// ═══════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import { fetchEnrolledCourses } from "@/services/enrollmentService";
import { fetchCourseProgress } from "@/lib/progressStorage";
import { TEXT_STYLES } from "@/constants/typography";
import { CourseProgressCard } from "@/components/CourseProgressCard";
import { CourseCardSkeleton, ListSkeleton } from "@/components/SkeletonLoader";

export default function CoursesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isInProgressOpen, setIsInProgressOpen] = useState(true);
  const [isNotStartedOpen, setIsNotStartedOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadEnrolledCourses = useCallback(async (isRefreshing = false) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    if (!isRefreshing) {
      setIsLoading(true);
    }
    try {
      const enrollments = await fetchEnrolledCourses(user.id);
      const mappedList = await Promise.all(
        // Defensive: skip enrollments whose course was deleted/unpublished
        // (null join) so one bad row can't blank the whole list.
        enrollments.filter((enr: any) => enr.courses).map(async (enr: any) => {
          const c = enr.courses;
          const prog = await fetchCourseProgress(user.id, String(c.id));
          return {
            courseId: String(c.id),
            courseTitle: c.title,
            instructor: "MakersFlow Instructor",
            thumbnail: c.thumbnail_url ? { uri: c.thumbnail_url } : require('@/assets/images/course_robotics.png'),
            progress: prog.percentage,
            totalModules: prog.total,
            completedModules: prog.completed,
            lastAccessedAt: enr.enrolled_at || new Date().toISOString(),
            timeSpent: 0,
          };
        })
      );
      setEnrolledCourses(mappedList);
    } catch (err) {
      console.error('[CoursesScreen] Error fetching enrolled courses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadEnrolledCourses(false);
    }, [loadEnrolledCourses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEnrolledCourses(true);
    setRefreshing(false);
  };

  const inProgressCourses = useMemo(() => {
    return enrolledCourses.filter((c) => c.progress > 0 && c.progress < 100);
  }, [enrolledCourses]);

  const notStartedCourses = useMemo(() => {
    return enrolledCourses.filter((c) => c.progress === 0);
  }, [enrolledCourses]);

  const completedCourses = useMemo(() => {
    return enrolledCourses.filter((c) => c.progress === 100);
  }, [enrolledCourses]);

  const totalEnrolled = enrolledCourses.length;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>My Courses</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {totalEnrolled} enrolled
            </Text>
          </View>
          <Pressable
            style={[styles.cartBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/store")}
          >
            <Ionicons name="cart-outline" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
      >
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </View>
        ) : totalEnrolled === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}19` }]}>
              <Feather name="book-open" size={64} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No courses yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Discover courses built for curious minds
            </Text>
            <Pressable
              style={[styles.browseBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/search")}
            >
              <Text style={styles.browseBtnText}>Browse Courses →</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* IN PROGRESS SECTION */}
            <View style={styles.section}>
              <Pressable
                style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
                onPress={() => setIsInProgressOpen(!isInProgressOpen)}
              >
                <View style={styles.sectionLeft}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    In Progress
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: "#FF6B3526" }]}>
                    <Text style={[styles.countText, { color: "#FF6B35" }]}>
                      {inProgressCourses.length}
                    </Text>
                  </View>
                </View>
                <Feather
                  name={isInProgressOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {isInProgressOpen && (
                <View style={styles.sectionContent}>
                  {inProgressCourses.length === 0 ? (
                    <Text style={[styles.emptySection, { color: colors.mutedForeground }]}>
                      Start a lesson to see progress here
                    </Text>
                  ) : (
                    inProgressCourses.map((course) => (
                      <CourseProgressCard key={course.courseId} course={course} />
                    ))
                  )}
                </View>
              )}
            </View>

            {/* NOT STARTED SECTION */}
            {notStartedCourses.length > 0 && (
              <View style={styles.section}>
                <Pressable
                  style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
                  onPress={() => setIsNotStartedOpen(!isNotStartedOpen)}
                >
                  <View style={styles.sectionLeft}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Not Started
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: "#4F46E526" }]}>
                      <Text style={[styles.countText, { color: "#4F46E5" }]}>
                        {notStartedCourses.length}
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name={isNotStartedOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {isNotStartedOpen && (
                  <View style={styles.sectionContent}>
                    {notStartedCourses.map((course) => (
                      <CourseProgressCard key={course.courseId} course={course} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* COMPLETED SECTION */}
            <View style={styles.section}>
              <Pressable
                style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
                onPress={() => setIsCompletedOpen(!isCompletedOpen)}
              >
                <View style={styles.sectionLeft}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Completed
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: "#10B98126" }]}>
                    <Text style={[styles.countText, { color: "#10B981" }]}>
                      {completedCourses.length}
                    </Text>
                  </View>
                </View>
                <Feather
                  name={isCompletedOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {isCompletedOpen && (
                <View style={styles.sectionContent}>
                  {completedCourses.length === 0 ? (
                    <Text style={[styles.emptySection, { color: colors.mutedForeground }]}>
                      Complete a course to see it here
                    </Text>
                  ) : (
                    completedCourses.map((course) => (
                      <CourseProgressCard key={course.courseId} course={course} />
                    ))
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  scroll: {
    paddingTop: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
  },
  browseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  browseBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  section: {
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionContent: {
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptySection: {
    fontSize: 14,
    paddingLeft: 16,
    paddingVertical: 12,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 8,
  },
});
