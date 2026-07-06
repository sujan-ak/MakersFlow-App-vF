import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { Alert } from "react-native";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, loginWithGoogle, sendOtp, sendWhatsappOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpProvider, setOtpProvider] = useState<'sms' | 'whatsapp'>('sms');

  async function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await loginWithGoogle();
    
    if (!result.success) {
      setGoogleLoading(false);
      setError(result.error || "Google sign-in failed. Please try again.");
    }
    // Don't set loading to false on success - the OAuth flow will handle redirect
  }

  async function handleLogin() {
    setEmailError("");
    setPasswordError("");
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

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
    }

    if (hasError) return;

    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await login(email, password);
    setLoading(false);
    
    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setError(result.error || "Invalid credentials. Please try again.");
    }
  }

  async function handlePhoneLogin() {
    setPhoneError("");
    setError("");

    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, "");

    if (!phone) {
      setPhoneError("Enter a valid phone number");
      return;
    }

    if (digitsOnly.length < 10) {
      setPhoneError("Enter a valid phone number");
      return;
    }

    // Format to E.164 (add +91 if not present)
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+91" + digitsOnly;
    }

    setPhoneLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result =
      otpProvider === "whatsapp"
        ? await sendWhatsappOtp(formattedPhone)
        : await sendOtp(formattedPhone);
    setPhoneLoading(false);

    if (result.success) {
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { phone: formattedPhone, provider: otpProvider },
      });
    } else {
      setError(result.error || "Failed to send OTP. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>MAKERSFLOW</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Learn · Explore · Excel</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to continue your learning journey</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: emailError ? "#DC2626" : colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError("");
                }}
                placeholder="Enter your email"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

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
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotRow}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleGoogleLogin}
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

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or continue with phone</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.providerToggle}>
            {(['sms', 'whatsapp'] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.providerBtn, otpProvider === p && { backgroundColor: colors.primary }]}
                onPress={() => setOtpProvider(p)}
              >
                <Feather
                  name={p === 'sms' ? 'message-square' : 'message-circle'}
                  size={14}
                  color={otpProvider === p ? '#fff' : colors.mutedForeground}
                />
                <Text style={[styles.providerBtnText, { color: otpProvider === p ? '#fff' : colors.mutedForeground }]}>
                  {p === 'sms' ? 'SMS' : 'WhatsApp'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.fieldGroup}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: phoneError ? "#DC2626" : colors.border }]}>
              <Feather name="smartphone" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setPhoneError("");
                }}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.phoneBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handlePhoneLogin}
            disabled={phoneLoading}
          >
            {phoneLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Send OTP</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={[styles.registerLink, { color: colors.primary }]}>Sign Up</Text>
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
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  appName: { fontSize: 24, fontWeight: "800", letterSpacing: 2 },
  tagline: { fontSize: 13, marginTop: 4 },
  form: { gap: 16 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: -8 },
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
  forgotRow: { alignSelf: "flex-end", marginTop: -8 },
  forgotText: { fontSize: 13, fontWeight: "600" },
  loginBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  loginBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleBtnText: { fontSize: 15, fontWeight: "600" },
  phoneBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: "700" },
  fieldError: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  providerToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  providerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F3F4F6',
  },
  providerBtnText: { fontSize: 13, fontWeight: '600' },
});
