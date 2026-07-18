import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ProgressStatsProps {
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  totalLessonsCompleted: number;
  averageProgress: number;
  learningStreak: number;
}

export function ProgressStats({
  totalCoursesEnrolled,
  coursesCompleted,
  coursesInProgress,
  totalLessonsCompleted,
  averageProgress,
  learningStreak,
}: ProgressStatsProps) {
  const colors = useColors();

  const handleLessonsPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(tabs)/courses");
  };

  const allZero = totalCoursesEnrolled === 0 && coursesCompleted === 0 && coursesInProgress === 0 && totalLessonsCompleted === 0;

  if (allZero) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.zeroStateContainer}>
          <View style={[styles.zeroStateIcon, { backgroundColor: "#DCF7F4" }]}>
            <Ionicons name="stats-chart" size={32} color="#0B6FAD" />
          </View>
          <Text style={[styles.zeroStateTitle, { color: colors.foreground }]}>
            Start your first lesson to see your progress here
          </Text>
          <Pressable
            style={[styles.zeroStateCTA, { backgroundColor: "#0B6FAD" }]}
            onPress={handleLessonsPress}
          >
            <Text style={styles.zeroStateCTAText}>Browse Courses</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  const stats = [
    {
      icon: "book",
      label: "Courses Enrolled",
      value: totalCoursesEnrolled.toString(),
      color: "#0B6FAD",
      helperText: null,
      isZero: totalCoursesEnrolled === 0,
    },
    {
      icon: "checkmark-circle",
      label: "Completed",
      value: coursesCompleted.toString(),
      color: "#10B981",
      helperText:
        coursesCompleted === 0 ? "Finish your first course" : null,
      isZero: coursesCompleted === 0,
    },
    {
      icon: "play-circle",
      label: "In Progress",
      value: coursesInProgress.toString(),
      color: "#F59E0B",
      helperText:
        coursesInProgress === 0 ? "Start a lesson" : null,
      isZero: coursesInProgress === 0,
    },
    {
      icon: "trophy",
      label: "Lessons Done",
      value: totalLessonsCompleted.toString(),
      color: "#17E5D3",
      helperText:
        totalLessonsCompleted === 0 ? "Your first lesson awaits" : null,
      onPress: totalLessonsCompleted === 0 ? handleLessonsPress : undefined,
      isZero: totalLessonsCompleted === 0,
    },
  ];

  return (
    <View
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {stats.map((stat, index) => {
        const StatWrapper = stat.onPress ? Pressable : View;
        const wrapperProps = stat.onPress
          ? {
              onPress: stat.onPress,
            }
          : {};

        return (
          <React.Fragment key={stat.label}>
            <StatWrapper style={styles.statItem} {...wrapperProps}>
              <View style={[styles.iconBox, { backgroundColor: "#DCF7F4" }]}>
                <Ionicons name={stat.icon as any} size={20} color="#0B6FAD" />
              </View>
              <Text style={[
                styles.value, 
                { 
                  color: stat.isZero ? colors.mutedForeground : "#0B6FAD",
                }
              ]}>
                {stat.value}
              </Text>
              <Text style={[
                styles.label, 
                { 
                  color: colors.foreground,
                }
              ]}>
                {stat.label}
              </Text>
              {stat.helperText && (
                <Text
                  style={[
                    styles.helperText,
                    {
                      color: stat.onPress ? "#0B6FAD" : colors.mutedForeground,
                      textDecorationLine: stat.onPress ? "underline" : "none",
                    },
                  ]}
                >
                  {stat.helperText}
                </Text>
              )}
            </StatWrapper>
            {index < stats.length - 1 && index % 2 === 0 && (
              <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
            )}
            {index === 1 && (
              <View style={[styles.horizontalDivider, { backgroundColor: colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 20,
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 130,
    justifyContent: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  value: {
    fontSize: 24,
    fontFamily: "Fredoka_700Bold",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 4,
  },
  helperText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  verticalDivider: {
    position: "absolute",
    width: 1,
    height: 100,
    left: "50%",
    top: 20,
  },
  horizontalDivider: {
    width: "100%",
    height: 1,
    marginVertical: 4,
  },
  zeroStateContainer: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  zeroStateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  zeroStateTitle: {
    fontSize: 16,
    fontFamily: "Fredoka_700Bold",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  zeroStateCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20, // pill
    minHeight: 44,
  },
  zeroStateCTAText: {
    fontSize: 15,
    fontFamily: "Fredoka_600SemiBold",
    color: "#FFF",
  },
});
