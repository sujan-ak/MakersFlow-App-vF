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

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [schoolError, setSchoolError] = useState("");

  async function handleGoogleSignup() {
    setError("");
    setGoogleLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await loginWithGoogle();
    
    if (!result.success) {
      setGoogleLoading(false);
      setError(result.error || "Google sign-up failed. Please try again.");
    }
    // Don't set loading to false on success - the OAuth flow will handle redirect
  }

  async function handleRegister() {
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setGradeError("");
    setSchoolError("");
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    if (!name) {
      setNameError("Name is required");
      hasError = true;
    }

    if (!email) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      hasError = true;
    }

    if (!confirm) {
      setConfirmError("Please confirm your password");
      hasError = true;
    } else if (password !== confirm) {
      setConfirmError("Passwords do not match");
      hasError = true;
    }

    if (!grade) {
      setGradeError("Grade is required");
      hasError = true;
    }

    if (!school) {
      setSchoolError("School is required");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await register(name, email, password, grade, school);
    setLoading(false);
    
    if (result.success) {
      setError("Success! Please check your email to confirm your account.");
      setTimeout(() => router.replace("/(auth)/login"), 2000);
    } else {
      setError(result.error || "Registration failed. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(auth)/login");
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join thousands of students on MAKERSFLOW</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {[
            { label: "Full Name", value: name, setter: setName, icon: "user", placeholder: "Your full name", keyboard: "default" as const, secure: false, error: nameError, setError: setNameError },
            { label: "Email", value: email, setter: setEmail, icon: "mail", placeholder: "your@email.com", keyboard: "email-address" as const, secure: false, error: emailError, setError: setEmailError },
          ].map((field) => (
            <View style={styles.fieldGroup} key={field.label}>
              <Text style={[styles.label, { color: colors.foreground }]}>{field.label}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: field.error ? "#DC2626" : colors.border }]}>
                <Feather name={field.icon as any} size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={field.value}
                  onChangeText={(text) => {
                    field.setter(text);
                    field.setError("");
                  }}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={field.keyboard}
                  autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
                />
              </View>
              {field.error ? <Text style={styles.fieldError}>{field.error}</Text> : null}
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: passwordError ? "#DC2626" : colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError("");
                }}
                placeholder="Min 8 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {passwordError ? (
              <Text style={styles.fieldError}>{passwordError}</Text>
            ) : (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Must be at least 8 characters</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Confirm Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: confirmError ? "#DC2626" : colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirm}
                onChangeText={(text) => {
                  setConfirm(text);
                  setConfirmError("");
                }}
                placeholder="Repeat password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
            </View>
            {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Grade</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: gradeError ? "#DC2626" : colors.border }]}>
              <Feather name="book-open" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={grade}
                onChangeText={(text) => {
                  setGrade(text);
                  setGradeError("");
                }}
                placeholder="e.g., 10th Grade"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {gradeError ? <Text style={styles.fieldError}>{gradeError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>School</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: schoolError ? "#DC2626" : colors.border }]}>
              <Feather name="home" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={school}
                onChangeText={(text) => {
                  setSchool(text);
                  setSchoolError("");
                }}
                placeholder="Your school name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {schoolError ? <Text style={styles.fieldError}>{schoolError}</Text> : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </Pressable>

          <View style={styles.termsRow}>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}>By signing up, you agree to our </Text>
            <Pressable onPress={() => router.push("/settings/terms-of-service")}>
              <Text style={[styles.termsLink, { color: colors.primary }]}>Terms of Service</Text>
            </Pressable>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}> and </Text>
            <Pressable onPress={() => router.push("/settings/privacy-policy")}>
              <Text style={[styles.termsLink, { color: colors.primary }]}>Privacy Policy</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleGoogleSignup}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Feather name="chrome" size={18} color={colors.foreground} />
                <Text style={[styles.googleBtnText, { color: colors.foreground }]}>Continue with Google</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.link, { color: colors.primary }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 24, width: 40 },
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
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
  googleBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleBtnText: { fontSize: 15, fontWeight: "600" },
  termsRow: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    justifyContent: "center", 
    alignItems: "center",
    paddingHorizontal: 20,
  },
  termsText: { fontSize: 12, textAlign: "center" },
  termsLink: { fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "700" },
  fieldError: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  fieldHint: { fontSize: 12, marginTop: 4 },
});
