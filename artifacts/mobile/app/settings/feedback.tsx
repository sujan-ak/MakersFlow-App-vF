import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export default function FeedbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleSubmit() {
    setError("");
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    if (!message.trim()) {
      setError("Please describe your experience in the message field.");
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to submit feedback.");
      return;
    }

    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { error: dbError } = await supabase.from("feedback").insert({
      user_id: user.id,
      rating,
      message: message.trim() || null,
    });

    setLoading(false);

    if (dbError) {
      setError("Failed to submit feedback. Please try again.");
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Feedback</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.successContainer}>
          <View style={[styles.successIconWrap, { backgroundColor: "#DCFCE7" }]}>
            <Feather name="check-circle" size={48} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Thank you!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Your feedback helps us improve EDODWAJA for everyone.
          </Text>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Feedback</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>How would you rate your experience?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={async () => {
                    setRating(star);
                    setError("");
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.starBtn}
                >
                  <Feather
                    name="star"
                    size={36}
                    color={star <= rating ? "#F59E0B" : colors.border}
                  />
                </Pressable>
              ))}
            </View>

            {rating > 0 && (
              <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>
                {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Tell us more
            </Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={message}
              onChangeText={setMessage}
              placeholder="What did you like or what can we improve?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {message.length}/500
            </Text>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Feedback</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 20, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  sectionLabel: { fontSize: 15, fontWeight: "700" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { textAlign: "center", fontSize: 14, fontWeight: "600", marginTop: -4 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: { fontSize: 11, textAlign: "right", marginTop: -8 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  successIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 26, fontWeight: "800" },
  successSub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  doneBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
