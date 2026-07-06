import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { getCourseModules } from "@/services/courseDataProvider";

interface CompletedCourse {
  courseId: string;
  courseTitle: string;
  completedAt: string;
}

export default function AchievementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function loadCompletedCourses() {
        if (!user?.id) {
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        try {
          // Get all enrollments
          const { data: enrollments } = await supabase
            .from("enrollments")
            .select("course_id, completed_at, enrolled_at, courses(title)")
            .eq("user_id", user.id);

          if (!enrollments) {
            setIsLoading(false);
            return;
          }

          // Get all lesson progress
          const { data: progressData } = await supabase
            .from("lesson_progress")
            .select("course_id, lesson_id, is_completed")
            .eq("user_id", user.id);

          const progressList = progressData ?? [];
          const results: CompletedCourse[] = [];

          for (const enr of enrollments) {
            const courseId = String(enr.course_id);
            const courseTitle = (enr.courses as any)?.title ?? "Unknown Course";

            // If already marked completed in enrollments table
            if (enr.completed_at) {
              results.push({
                courseId,
                courseTitle,
                completedAt: enr.completed_at,
              });
              continue;
            }

            // Otherwise check if all lessons are done
            const modules = await getCourseModules(courseId);
            const allLessonIds = modules.flatMap((m: any) =>
              (m.lessons ?? []).map((l: any) => l.id)
            );

            if (allLessonIds.length === 0) continue;

            const completedIds = progressList
              .filter((p) => p.is_completed && String(p.course_id) === courseId)
              .map((p) => String(p.lesson_id));

            const allDone = allLessonIds.every((id: string) =>
              completedIds.includes(String(id))
            );

            if (allDone) {
              const lastCompleted = progressList
                .filter((p) => String(p.course_id) === courseId && p.is_completed)
                .sort((a: any, b: any) => 0)[0];
              results.push({
                courseId,
                courseTitle,
                completedAt: enr.enrolled_at ?? new Date().toISOString(),
              });
            }
          }

          setCompletedCourses(results);
        } catch (err) {
          console.error("[Achievements] error:", err);
        } finally {
          setIsLoading(false);
        }
      }
      loadCompletedCourses();
    }, [user?.id])
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/profile");
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Achievements
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
        </View>
      ) : completedCourses.length === 0 ? (
        <View style={styles.center}>
          <Feather name="award" size={64} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No certificates yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Complete a course to earn your first certificate!
          </Text>
          <Pressable
            style={[styles.exploreBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/courses")}
          >
            <Text style={styles.exploreBtnText}>Browse Courses</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            gap: 16,
            paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {completedCourses.length} CERTIFICATE{completedCourses.length !== 1 ? "S" : ""} EARNED
          </Text>

          {completedCourses.map((course) => (
            <View
              key={course.courseId}
              style={[styles.card, { backgroundColor: colors.card, borderColor: "#10B981" }]}
            >
              {/* Certificate icon */}
              <View style={styles.iconWrapper}>
                <View style={styles.iconBg}>
                  <Feather name="award" size={28} color="#F59E0B" />
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {course.courseTitle}
                </Text>
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                  Completed · {formatDate(course.completedAt)}
                </Text>

                <Pressable
                  style={[styles.viewCertBtn, { backgroundColor: "#10B981" }]}
                  onPress={() =>
                    router.push({
                      pathname: "/certificate",
                      params: {
                        courseName: course.courseTitle,
                        studentName: user?.name ?? "",
                        completionDate: course.completedAt,
                      },
                    })
                  }
                >
                  <Feather name="download" size={14} color="#FFF" />
                  <Text style={styles.viewCertText}>View & Download</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  exploreBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  iconWrapper: {
    paddingTop: 2,
  },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  viewCertBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  viewCertText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
});
