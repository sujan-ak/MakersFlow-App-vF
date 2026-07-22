import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View, Animated, Easing } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { getOptimizedImageUrl } from "@/lib/thumbnailUtils";
import { CourseWithProgress } from "@/lib/progressAnalytics";

interface CourseProgressCardProps {
  course: CourseWithProgress;
}

export const CourseProgressCard = React.memo(function CourseProgressCard({ course }: CourseProgressCardProps) {
  const colors = useColors();
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: course.progress,
      duration: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [course.progress]);

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/course/${course.courseId}`);
  };

  const handleContinue = async (e: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/course/${course.courseId}`);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <Image
          source={getOptimizedImageUrl(course.thumbnail, { width: 200, height: 200 })}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={200}
          style={styles.thumbnail}
        />
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {course.courseTitle}
          </Text>
          <Text style={[styles.instructor, { color: colors.mutedForeground }]} numberOfLines={1}>
            {course.instructor}
          </Text>
        </View>
      </View>

      {/* Progress Bar Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressText, { color: "#0B6FAD" }]}>
            {course.progress}%
          </Text>
          <Text style={[styles.lessonsText, { color: colors.mutedForeground }]}>
            {course.completedModules} of {course.totalModules} lessons
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: colors.muted }]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth,
                backgroundColor: "#0B6FAD",
                minWidth: 8,
              },
            ]}
          />
        </View>
      </View>

      {/* Footer: "Continue Learning" Deep Sea pill button for progress courses, "Completed" badge for completed courses */}
      <View style={styles.footer}>
        {course.progress === 100 ? (
          <View style={styles.footerLeft}>
            <View style={[styles.statusBadge, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={[styles.statusText, { color: "#10B981" }]}>Completed</Text>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.continueBtn}
            onPress={handleContinue}
          >
            <Ionicons name="play" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.continueBtnText}>Continue Learning</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFF" style={{ marginLeft: "auto" }} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    marginBottom: 14,
    gap: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontFamily: "Fredoka_600SemiBold",
    lineHeight: 20,
    marginBottom: 4,
  },
  instructor: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  progressSection: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontFamily: "Fredoka_700Bold",
  },
  lessonsText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  footerLeft: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  continueBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B6FAD",
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  continueBtnText: {
    fontSize: 13,
    fontFamily: "Fredoka_600SemiBold",
    color: "#FFF",
  },
});
