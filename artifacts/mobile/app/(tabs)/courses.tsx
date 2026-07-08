// ═══════════════════════════════════════════════════════════
// MOVED TO: app/(tabs)/search.tsx
// ═══════════════════════════════════════════════════════════
// The following features were moved to the Search tab:
// - SearchBar component for course discovery
// - Category filter chips (Robotics, AI, Electronics, etc.)
// - Full course catalog browsing
// - Search functionality across all courses
// // TODO: Extract reviews aggregation to a shared lib/reviewsService.ts to avoid duplication across screens
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
import { CourseCard } from "@/components/CourseCard";
import { fetchAllCourses } from "@/services/courseDataProvider";
import { supabase } from "@/lib/supabase";

export default function CoursesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isInProgressOpen, setIsInProgressOpen] = useState(true);
  const [isNotStartedOpen, setIsNotStartedOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [browseMoreCourses, setBrowseMoreCourses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) {
      setIsLoading(true);
    }
    try {
      let enrolledMapped: any[] = [];
      
      // 1. Fetch enrolled courses if logged in
      if (user?.id) {
        const enrollments = await fetchEnrolledCourses(user.id);
        enrolledMapped = await Promise.all(
          enrollments.filter((enr: any) => enr.courses).map(async (enr: any) => {
            const c = enr.courses;
            const prog = await fetchCourseProgress(user.id, String(c.id));
            return {
              courseId: String(c.id),
              courseTitle: c.title,
              instructor: c.courses?.profiles?.full_name || "",
              thumbnail: c.thumbnail_url ? { uri: c.thumbnail_url } : require('@/assets/images/course_robotics.png'),
              progress: prog.percentage,
              totalModules: prog.total,
              completedModules: prog.completed,
              lastAccessedAt: enr.enrolled_at || new Date().toISOString(),
              timeSpent: 0,
            };
          })
        );
        setEnrolledCourses(enrolledMapped);
      } else {
        setEnrolledCourses([]);
      }

      // 2. Fetch all published courses
      const allPub = await fetchAllCourses();
      
      // TODO: Extract reviews aggregation to a shared lib/reviewsService.ts to avoid duplication across screens
      let reviewStats: Record<string, { ratingSum: number; count: number }> = {};
      try {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('course_id, rating');
        if (reviewsData) {
          reviewsData.forEach((rev: any) => {
            const cId = String(rev.course_id);
            if (!reviewStats[cId]) {
              reviewStats[cId] = { ratingSum: 0, count: 0 };
            }
            reviewStats[cId].ratingSum += Number(rev.rating) || 0;
            reviewStats[cId].count += 1;
          });
        }
      } catch (err) {
        console.error('[CoursesScreen] Failed to load reviews:', err);
      }

      const enrolledIds = enrolledMapped.map(ec => String(ec.courseId));

      const unenrolledMapped = allPub
        .filter((c: any) => !enrolledIds.includes(String(c.id)))
        .map((c: any) => {
          const stats = reviewStats[String(c.id)];
          const rating = stats ? Number((stats.ratingSum / stats.count).toFixed(1)) : 0;
          const reviews = stats ? stats.count : 0;

          return {
            id: String(c.id),
            title: c.title,
            category: c.category || "General",
            level: c.level ? (c.level.charAt(0).toUpperCase() + c.level.slice(1)) : "Beginner",
            price: c.price || 0,
            isFree: c.is_free,
            thumbnail: c.thumbnail_url ? { uri: c.thumbnail_url } : require('@/assets/images/course_robotics.png'),
            instructor: c.profiles?.full_name || "",
            rating,
            reviews,
            description: c.description || "",
            modules: []
          };
        });

      setBrowseMoreCourses(unenrolledMapped);
    } catch (err) {
      console.error('[CoursesScreen] Error fetching courses:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
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
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>
              {user ? "My Courses" : "Explore Courses"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {user ? `${totalEnrolled} enrolled` : "Explore our technical catalog"}
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
        ) : (
          <>
            {!user ? (
              <View style={[styles.guestBanner, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <View style={styles.guestBannerHeader}>
                  <Feather name="info" size={18} color={colors.primary} />
                  <Text style={[styles.guestBannerTitle, { color: colors.foreground }]}>Sign in to track progress</Text>
                </View>
                <Text style={[styles.guestBannerText, { color: colors.mutedForeground }]}>
                  Log in to see your enrolled courses, certificates, and continue learning where you left off.
                </Text>
                <Pressable
                  style={[styles.guestBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(auth)/login")}
                >
                  <Text style={styles.guestBtnText}>Sign In</Text>
                </Pressable>
              </View>
            ) : totalEnrolled === 0 ? (
              <View style={[styles.emptyEnrolledCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="book-open" size={32} color={colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={[styles.emptyEnrolledText, { color: colors.mutedForeground }]}>
                  No enrolled courses yet. Choose a course from "Browse More" below to start learning!
                </Text>
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

            {/* BROWSE MORE SUBSECTION */}
            {browseMoreCourses.length > 0 && (
              <View style={[styles.browseSection, { marginTop: 24 }]}>
                <Text style={[styles.browseTitle, { color: colors.foreground }]}>
                  {user ? "Browse More Courses" : "Explore Courses"}
                </Text>
                <View style={styles.gridContainer}>
                  {browseMoreCourses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </View>
              </View>
            )}
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
  emptyEnrolledCard: {
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEnrolledText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  browseSection: {
    paddingBottom: 24,
  },
  browseTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 20,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    rowGap: 16,
  },
  guestBanner: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  guestBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  guestBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  guestBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  guestBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  guestBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});
