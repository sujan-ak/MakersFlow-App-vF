import { Ionicons } from "@expo/vector-icons";
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

function getPasswordStrength(pass: string) {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
}

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

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [gradeFocused, setGradeFocused] = useState(false);
  const [schoolFocused, setSchoolFocused] = useState(false);

  const strength = getPasswordStrength(password);
  const getStrengthColor = () => {
    if (strength <= 1) return "#EF4444";
    if (strength === 2) return "#F59E0B";
    return "#17E5D3";
  };

  async function handleGoogleSignup() {
    if (googleLoading) return;
    setError("");
    setGoogleLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await loginWithGoogle();
    
    if (result.success) {
      const profile = (result as any).profile;
      setGoogleLoading(false);
      if (profile && profile.grade) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/onboarding");
      }
    } else {
      setGoogleLoading(false);
      setError(result.error || "Google sign-up failed. Please try again.");
    }
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
      router.replace("/(auth)/onboarding");
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
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(auth)/login");
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: "#0F2A3D" }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join thousands of students on MAKERSFLOW</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {[
            { label: "Full Name", value: name, setter: setName, icon: "person", placeholder: "Your full name", keyboard: "default" as const, secure: false, error: nameError, setError: setNameError, focused: nameFocused, setFocused: setNameFocused },
            { label: "Email", value: email, setter: setEmail, icon: "mail", placeholder: "your@email.com", keyboard: "email-address" as const, secure: false, error: emailError, setError: setEmailError, focused: emailFocused, setFocused: setEmailFocused },
          ].map((field) => (
            <View style={styles.fieldGroup} key={field.label}>
              <Text style={[styles.label, { color: "#0F2A3D" }]}>{field.label}</Text>
              <View style={[
                styles.inputWrapper, 
                { 
                  borderColor: field.error ? "#DC2626" : (field.focused ? "#0B6FAD" : "#D6E9F2"),
                }
              ]}>
                <Ionicons name={field.icon as any} size={16} color="#0B6FAD" />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={field.value}
                  onChangeText={(text) => {
                    field.setter(text);
                    field.setError("");
                  }}
                  onFocus={() => field.setFocused(true)}
                  onBlur={() => field.setFocused(false)}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={field.keyboard}
                  autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
                />
              </View>
              {field.error ? <Text style={styles.fieldError}>{field.error}</Text> : null}
            </View>
          ))}

          {/* Password field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: "#0F2A3D" }]}>Password</Text>
            <View style={[
              styles.inputWrapper, 
              { 
                borderColor: passwordError ? "#DC2626" : (passwordFocused ? "#0B6FAD" : "#D6E9F2"),
              }
            ]}>
              <Ionicons name="lock-closed" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError("");
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Min 8 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {passwordError ? (
              <Text style={styles.fieldError}>{passwordError}</Text>
            ) : (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Must be at least 8 characters</Text>
            )}
            {password && (
              <View style={styles.strengthBarContainer}>
                {[1, 2, 3, 4].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.strengthSegment,
                      {
                        backgroundColor: step <= strength ? getStrengthColor() : "#D6E9F2",
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Confirm password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: "#0F2A3D" }]}>Confirm Password</Text>
            <View style={[
              styles.inputWrapper, 
              { 
                borderColor: confirmError ? "#DC2626" : (confirmFocused ? "#0B6FAD" : "#D6E9F2"),
              }
            ]}>
              <Ionicons name="lock-closed" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirm}
                onChangeText={(text) => {
                  setConfirm(text);
                  setConfirmError("");
                }}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                placeholder="Repeat password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
            </View>
            {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
          </View>

          {/* Grade field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: "#0F2A3D" }]}>Grade</Text>
            <View style={[
              styles.inputWrapper, 
              { 
                borderColor: gradeError ? "#DC2626" : (gradeFocused ? "#0B6FAD" : "#D6E9F2"),
              }
            ]}>
              <Ionicons name="book" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={grade}
                onChangeText={(text) => {
                  setGrade(text);
                  setGradeError("");
                }}
                onFocus={() => setGradeFocused(true)}
                onBlur={() => setGradeFocused(false)}
                placeholder="e.g., 10th Grade"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {gradeError ? <Text style={styles.fieldError}>{gradeError}</Text> : null}
          </View>

          {/* School field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: "#0F2A3D" }]}>School</Text>
            <View style={[
              styles.inputWrapper, 
              { 
                borderColor: schoolError ? "#DC2626" : (schoolFocused ? "#0B6FAD" : "#D6E9F2"),
              }
            ]}>
              <Ionicons name="school" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={school}
                onChangeText={(text) => {
                  setSchool(text);
                  setSchoolError("");
                }}
                onFocus={() => setSchoolFocused(true)}
                onBlur={() => setSchoolFocused(false)}
                placeholder="Your school name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {schoolError ? <Text style={styles.fieldError}>{schoolError}</Text> : null}
          </View>

          {/* Create Account button */}
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: "#0B6FAD", opacity: pressed ? 0.85 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Ionicons name="person-add" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.btnText}>Create Account</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: "auto" }} />
              </View>
            )}
          </Pressable>

          <View style={styles.termsRow}>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}>By signing up, you agree to our </Text>
            <Pressable onPress={() => router.push("/settings/terms-of-service")}>
              <Text style={[styles.termsLink, { color: "#0B6FAD" }]}>Terms of Service</Text>
            </Pressable>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}> and </Text>
            <Pressable onPress={() => router.push("/settings/privacy-policy")}>
              <Text style={[styles.termsLink, { color: "#0B6FAD" }]}>Privacy Policy</Text>
            </Pressable>
          </View>

          {/* Google signup button */}
          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              { backgroundColor: "#FFFFFF", borderColor: "#D6E9F2", opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleGoogleSignup}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#1F2937" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Ionicons name="logo-google" size={18} color="#1F2937" style={{ marginRight: 8 }} />
                <Text style={[styles.googleBtnText, { color: "#1F2937" }]}>Continue with Google</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.link, { color: "#0B6FAD" }]}>Sign In</Text>
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
  title: { fontSize: 26, fontFamily: "Fredoka_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  form: { gap: 16 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626", flex: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 20,
  },
  btnText: { fontSize: 16, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 8,
  },
  termsRow: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    justifyContent: "center", 
    alignItems: "center",
    paddingHorizontal: 20,
  },
  termsText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  termsLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, paddingBottom: 24 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626", marginTop: 4 },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  strengthBarContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
    height: 4,
    width: "100%",
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
