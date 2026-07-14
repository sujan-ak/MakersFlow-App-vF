import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/useColors";
import { TEXT_STYLES, TYPOGRAPHY } from "@/constants/typography";

export default function QuizResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quizId, score, total, title } = useLocalSearchParams<{ quizId: string; score: string; total: string; title?: string }>();

  const scoreNum = parseInt(score ?? "0");
  const totalNum = parseInt(total ?? "1");
  const pct = Math.round((scoreNum / totalNum) * 100);

  useEffect(() => {
    if (pct >= 70) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good Job" : pct >= 40 ? "Keep Practicing" : "Need Improvement";
  const gradeColor = pct >= 80 ? "#16A34A" : pct >= 60 ? colors.primary : pct >= 40 ? "#D97706" : "#DC2626";
  const gradeBg = pct >= 80 ? "#DCFCE7" : pct >= 60 ? colors.accent : pct >= 40 ? "#FEF3C7" : "#FEE2E2";

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 20, paddingBottom: botPad }]}>
      <View style={styles.content}>
        {/* Confetti stars if passed */}
        {pct >= 70 && (
          <View style={styles.starsRow}>
            <Ionicons name="star" size={24} color="#F59E0B" />
            <Ionicons name="star" size={32} color="#F59E0B" style={{ marginHorizontal: 8, marginTop: -8 }} />
            <Ionicons name="star" size={24} color="#F59E0B" />
          </View>
        )}

        {/* Score circle with LinearGradient */}
        <LinearGradient
          colors={[colors.gradientStart || "#0B6FAD", colors.gradientEnd || "#17E5D3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreCircleGradient}
        >
          <View style={[styles.scoreCircleInner, { backgroundColor: colors.card }]}>
            <Text style={[styles.scoreNum, TEXT_STYLES.pageTitle, { color: colors.primary, fontSize: 40 }]}>{pct}%</Text>
            <Text style={[styles.scoreLabel, TEXT_STYLES.label, { color: colors.mutedForeground }]}>Score</Text>
          </View>
        </LinearGradient>

        {/* Grade badge */}
        <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
          <Text style={[styles.gradeText, TEXT_STYLES.label, { color: "#FFF" }]}>{grade}</Text>
        </View>

        <Text style={[styles.title, TEXT_STYLES.sectionTitle, { color: colors.foreground }]}>{title ?? "Quiz"}</Text>
        <Text style={[styles.subtitle, TEXT_STYLES.description, { color: colors.mutedForeground }]}>
          You answered {scoreNum} out of {totalNum} questions correctly
        </Text>

        {/* Stats row */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Correct", value: scoreNum.toString(), color: "#16A34A" },
            { label: "Wrong", value: (totalNum - scoreNum).toString(), color: "#DC2626" },
            { label: "Score", value: `${pct}%`, color: gradeColor },
          ].map((s, idx) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, TEXT_STYLES.pageTitle, { color: s.color, fontSize: 22 }]}>{s.value}</Text>
                <Text style={[styles.statLabel, TYPOGRAPHY.caption, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
              {idx < 2 && <View style={[styles.statDiv, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Tips */}
        {pct < 70 && (
          <View style={[styles.tip, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="alert-circle" size={16} color="#D97706" />
            <Text style={[styles.tipText, TEXT_STYLES.description, { color: "#92400E", fontSize: 13 }]}>
              Review the course material and try again. You can retake this quiz anytime.
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.push({ pathname: "/quiz/[id]", params: { id: quizId, title } })}
        >
          <Ionicons name="refresh" size={18} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={[styles.btnText, TEXT_STYLES.button, { color: "#FFF" }]}>Retake Quiz</Text>
        </Pressable>
        <Pressable
          style={[styles.outlineBtn, { borderColor: colors.primary, backgroundColor: "#FFFFFF" }]}
          onPress={() => router.push("/(tabs)/courses")}
        >
          <Text style={[styles.outlineBtnText, TEXT_STYLES.button, { color: colors.primary }]}>Back to Courses</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  starsRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  scoreCircleGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  scoreCircleInner: {
    width: "100%",
    height: "100%",
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: 40, fontWeight: "800" },
  scoreLabel: { fontSize: 14, fontWeight: "600", marginTop: -4 },
  gradeBadge: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20 },
  gradeText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  statsRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDiv: { width: 1, height: "100%" },
  tip: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, alignItems: "flex-start" },
  tipText: { fontSize: 13, lineHeight: 18, flex: 1 },
  actions: { gap: 12, width: "100%", paddingBottom: 16 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 24,
    width: "100%",
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  outlineBtn: { height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center", width: "100%" },
  outlineBtnText: { fontSize: 15, fontWeight: "700" },
});
