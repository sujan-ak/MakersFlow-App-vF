import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: lessonId } = useLocalSearchParams<{ id: string }>();

  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Refs mirror state so the timer interval always sees the latest values
  // without needing to be torn down and recreated on every answer.
  const answersRef = useRef<number[]>([]);
  const selectedRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { selectedRef.current = selectedOption; }, [selectedOption]);

  useEffect(() => {
    async function loadQuiz() {
      if (!lessonId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('quiz_questions')
          .select('id, question_text, options, correct_option_index, position')
          .eq('lesson_id', lessonId)
          .order('position', { ascending: true });

        if (error) {
          console.error('[Quiz] Error loading questions:', error);
          return;
        }

        if (data) {
          const mapped = data.map((q) => {
            let opts = [];
            try {
              opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            } catch (e) {
              opts = Array.isArray(q.options) ? q.options : [];
            }
            return {
              id: q.id,
              question: q.question_text,
              options: opts,
              correctIndex: q.correct_option_index,
              explanation: "Select the correct answer to complete this question.",
            };
          });
          setQuestions(mapped);
          setTimeLeft(mapped.length * 60 || 600);
        }
      } catch (err) {
        console.error('[Quiz] load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuiz();
  }, [lessonId]);

  useEffect(() => {
    if (isLoading || questions.length === 0) return;
    // BUG FIX: the old effect depended on `answers`, so the interval was torn
    // down and recreated after every question — causing timer drift. It also
    // dropped the currently-selected (not yet submitted) answer on timeout.
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Defer navigation out of the state updater; include the answer the
          // user selected but hadn't pressed "Next" on yet.
          setTimeout(() => {
            const final = [...answersRef.current];
            if (final.length < questions.length) final.push(selectedRef.current ?? -1);
            finishQuiz(final);
          }, 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading, questions.length]);

  // NEW FEATURE: confirm before exiting a quiz in progress.
  const confirmExit = useCallback(() => {
    Alert.alert(
      "Exit Quiz?",
      "Do you really want to exit? Your progress in this quiz will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => {
            finishedRef.current = true;
            if (timerRef.current) clearInterval(timerRef.current);
            router.back();
          },
        },
      ],
    );
  }, []);

  // Android hardware back must also go through the confirmation.
  useEffect(() => {
    if (isLoading || questions.length === 0) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmExit();
      return true;
    });
    return () => sub.remove();
  }, [isLoading, questions.length, confirmExit]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 40, alignItems: "center", paddingHorizontal: 32 }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.muted }]}>
          <Feather name="help-circle" size={48} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Quiz Coming Soon
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          There are no quiz questions added for this lesson yet. Check back later!
        </Text>
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const question = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  function selectOption(idx: number) {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    if (idx === question.correctIndex) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }

  function next() {
    const newAnswers = [...answers, selectedOption ?? -1];
    if (currentIndex < questions.length - 1) {
      setAnswers(newAnswers);
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      finishQuiz(newAnswers);
    }
  }

  function finishQuiz(finalAnswers: number[]) {
    if (finishedRef.current) return; // prevent double navigation (timeout + Finish tap)
    finishedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const score = finalAnswers.reduce((s, ans, i) => (ans === questions[i].correctIndex ? s + 1 : s), 0);
    router.replace({
      pathname: "/quiz/result",
      params: { quizId: lessonId, score: score.toString(), total: questions.length.toString() },
    });
  }

  const optionColors = (idx: number) => {
    if (selectedOption === null) {
      return { bg: colors.card, border: colors.border, text: colors.foreground };
    }
    if (idx === question.correctIndex) {
      return { bg: "#DCFCE7", border: "#16A34A", text: "#15803D" };
    }
    if (idx === selectedOption) {
      return { bg: "#FEE2E2", border: "#DC2626", text: "#DC2626" };
    }
    return { bg: colors.card, border: colors.border, text: colors.mutedForeground };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={confirmExit}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {currentIndex + 1} / {questions.length}
        </Text>
        <View style={[styles.timer, { backgroundColor: timeLeft < 60 ? "#FEE2E2" : colors.accent }]}>
          <Feather name="clock" size={12} color={timeLeft < 60 ? "#DC2626" : colors.primary} />
          <Text style={[styles.timerText, { color: timeLeft < 60 ? "#DC2626" : colors.primary }]}>
            {mins}:{secs.toString().padStart(2, "0")}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <Animated.View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: colors.primary }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <Text style={[styles.questionNum, { color: colors.mutedForeground }]}>Question {currentIndex + 1}</Text>
          <Text style={[styles.question, { color: colors.foreground }]}>{question.question}</Text>

          <View style={styles.options}>
            {question.options.map((opt: string, idx: number) => {
              const oc = optionColors(idx);
              return (
                <Pressable
                  key={idx}
                  style={[styles.option, { backgroundColor: oc.bg, borderColor: oc.border }]}
                  onPress={() => selectOption(idx)}
                  disabled={selectedOption !== null}
                >
                  <View style={[styles.optionLetter, { backgroundColor: oc.border }]}>
                    <Text style={[styles.optionLetterText, { color: "#FFF" }]}>
                      {["A", "B", "C", "D"][idx]}
                    </Text>
                  </View>
                  <Text style={[styles.optionText, { color: oc.text, flex: 1 }]}>{opt}</Text>
                  {selectedOption !== null && idx === question.correctIndex && (
                    <Feather name="check-circle" size={18} color="#16A34A" />
                  )}
                  {selectedOption === idx && idx !== question.correctIndex && (
                    <Feather name="x-circle" size={18} color="#DC2626" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {selectedOption !== null && (
            <View style={[styles.explanationBox, { backgroundColor: colors.accent }]}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[styles.explanationText, { color: colors.primary, flex: 1 }]}>
                {question.explanation}
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Next button */}
      {selectedOption !== null && (
        <View
          style={[
            styles.bottomBtn,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8 },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={next}
          >
            <Text style={styles.nextBtnText}>
              {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
            </Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  timer: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  timerText: { fontSize: 13, fontWeight: "600" },
  progressTrack: { height: 4 },
  progressFill: { height: 4 },
  content: { padding: 20 },
  questionNum: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  question: { fontSize: 20, fontWeight: "700", lineHeight: 28, marginBottom: 24 },
  options: { gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  optionLetter: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontSize: 13, fontWeight: "700" },
  optionText: { fontSize: 15, lineHeight: 20 },
  explanationBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: "flex-start",
  },
  explanationText: { fontSize: 13, lineHeight: 18 },
  bottomBtn: { padding: 16, borderTopWidth: 1 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
