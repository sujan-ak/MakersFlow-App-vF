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

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.name ?? "");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [ageError, setAgeError] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [schoolError, setSchoolError] = useState("");

  async function handleSubmit() {
    setFullNameError("");
    setAgeError("");
    setGradeError("");
    setSchoolError("");
    setError("");

    let hasError = false;
    if (!fullName.trim()) {
      setFullNameError("Full name is required");
      hasError = true;
    }
    const parsedAge = parseInt(age.trim(), 10);
    if (!age.trim()) {
      setAgeError("Age is required");
      hasError = true;
    } else if (isNaN(parsedAge) || parsedAge < 10 || parsedAge > 25) {
      setAgeError("Age must be between 10 and 25");
      hasError = true;
    }
    if (!grade.trim()) {
      setGradeError("Grade is required");
      hasError = true;
    }
    if (!school.trim()) {
      setSchoolError("School name is required");
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await updateUser({ name: fullName.trim(), age: parsedAge, grade: grade.trim(), school: school.trim() });
    setLoading(false);

    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setError(result.error || "Failed to save profile. Please try again.");
    }
  }

  function handleSkip() {
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "1A" }]}>
            <Feather name="user-check" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Complete your profile</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Help us personalise your learning experience
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: fullNameError ? "#DC2626" : colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={fullName}
                onChangeText={(t) => { setFullName(t); setFullNameError(""); }}
                placeholder="Your full name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
              />
            </View>
            {fullNameError ? <Text style={styles.fieldError}>{fullNameError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Age</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: ageError ? "#DC2626" : colors.border }]}>
              <Feather name="info" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={age}
                onChangeText={(t) => { setAge(t); setAgeError(""); }}
                placeholder="Your age (10-25)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
            </View>
            {ageError ? <Text style={styles.fieldError}>{ageError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Grade / Class</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: gradeError ? "#DC2626" : colors.border }]}>
              <Feather name="book-open" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={grade}
                onChangeText={(t) => { setGrade(t); setGradeError(""); }}
                placeholder="e.g., 10th Grade"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {gradeError ? <Text style={styles.fieldError}>{gradeError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>School Name</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: schoolError ? "#DC2626" : colors.border }]}>
              <Feather name="home" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={school}
                onChangeText={(t) => { setSchool(t); setSchoolError(""); }}
                placeholder="Your school name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {schoolError ? <Text style={styles.fieldError}>{schoolError}</Text> : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get Started</Text>}
          </Pressable>

          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 36 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, marginTop: 6, textAlign: "center" },
  form: { gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  btn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  btnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  skipBtn: { alignItems: "center", paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: "600" },
  fieldError: { fontSize: 12, color: "#DC2626", marginTop: 4 },
});
