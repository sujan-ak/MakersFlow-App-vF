import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface LearningStreakProps {
  streak: number;
  bestStreak?: number;
}

export function LearningStreak({ streak, bestStreak = 7 }: LearningStreakProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: "#FEF3C7" }]}>
                <Text style={styles.fireEmoji}>🔥</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Learning Streak</Text>
          {streak >= 3 && (
            <View style={[styles.badge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={styles.badgeText}>Keep it up!</Text>
            </View>
          )}
        </View>
        
        <View style={styles.streakRow}>
          <Text style={[styles.streakNumber, { color: colors.foreground }]}>{streak}</Text>
          <Text style={[styles.streakUnit, { color: colors.mutedForeground }]}>days</Text>
        </View>
        
        <Text style={[styles.bestStreak, { color: colors.mutedForeground }]}>
          Best: {bestStreak} days
        </Text>
      </View>

      <View style={styles.decorativeLines}>
        {[...Array(3)].map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.decorativeLine, 
              { 
                backgroundColor: colors.border,
                height: 20 + i * 8,
                opacity: 0.3 - i * 0.1
              }
            ]} 
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    overflow: "hidden",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fireEmoji: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#16A34A",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  streakUnit: {
    fontSize: 14,
    fontWeight: "600",
  },
  bestStreak: {
    fontSize: 12,
  },
  decorativeLines: {
    flexDirection: "row",
    gap: 4,
    alignItems: "flex-end",
  },
  decorativeLine: {
    width: 3,
    borderRadius: 2,
  },
});
