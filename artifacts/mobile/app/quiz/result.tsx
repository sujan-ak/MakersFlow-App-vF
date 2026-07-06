import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QUIZZES } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

export default function QuizResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quizId, score, total } = useLocalSearchParams<{ quizId: string; score: string; total: string }>();
  const quiz = QUIZZES.find((q) => q.id === quizId);

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
        {/* Score circle */}
        <View style={[styles.scoreCircle, { borderColor: gradeColor, backgroundColor: gradeBg }]}>
          <Text style={[styles.scoreNum, { color: gradeColor }]}>{pct}%</Text>
          <Text style={[styles.scoreLabel, { color: gradeColor }]}>Score</Text>
        </View>

        {/* Grade badge */}
        <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
          <Text style={styles.gradeText}>{grade}</Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{quiz?.title ?? "Quiz"}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
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
                <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
              {idx < 2 && <View style={[styles.statDiv, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Tips */}
        {pct < 70 && (
          <View style={[styles.tip, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="alert-circle" size={16} color="#D97706" />
            <Text style={[styles.tipText, { color: "#92400E" }]}>
              Review the course material and try again. You can retake this quiz anytime.
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.push({ pathname: "/quiz/[id]", params: { id: quizId } })}
        >
          <Feather name="refresh-cw" size={16} color="#FFF" />
          <Text style={styles.btnText}>Retake Quiz</Text>
        </Pressable>
        <Pressable
          style={[styles.outlineBtn, { borderColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/courses")}
        >
          <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Back to Courses</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
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
  statDiv: { width: 1 },
  tip: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, alignItems: "flex-start" },
  tipText: { fontSize: 13, lineHeight: 18, flex: 1 },
  actions: { gap: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  btnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  outlineBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 2, alignItems: "center" },
  outlineBtnText: { fontSize: 16, fontWeight: "700" },
});
