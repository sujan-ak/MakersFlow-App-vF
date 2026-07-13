import { Feather, Ionicons } from "@expo/vector-icons";
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
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";

function getFriendlyErrorMessage(err: string): string {
  const msg = err.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }
  if (msg.includes("user not found")) {
    return "No account found with this email. Please sign up.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many requests. Please try again in a few minutes.";
  }
  if (msg.includes("network")) {
    return "Network error. Please check your connection.";
  }
  return err;
}

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

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  async function handleGoogleLogin() {
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
      setError(result.error || "Google sign-in failed. Please try again.");
    }
  }

  async function handleLogin() {
    if (loading) return;

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
      const profile = (result as any).profile;
      if (profile && profile.grade) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/onboarding");
      }
    } else {
      setError(getFriendlyErrorMessage(result.error || "Invalid credentials. Please try again."));
    }
  }

  async function handlePhoneLogin() {
    setPhoneError("");
    setError("");

    const digitsOnly = phone.replace(/\D/g, "");

    if (!phone) {
      setPhoneError("Enter a valid phone number");
      return;
    }

    if (digitsOnly.length < 10) {
      setPhoneError("Enter a valid phone number");
      return;
    }

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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: "#0F2A3D" }]}>MAKERSFLOW</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Learn · Explore · Excel</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.title, { color: "#0F2A3D" }]}>Welcome back!</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to continue your learning journey</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email input */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: "#0F2A3D" }]}>Email</Text>
            <View style={[
              styles.inputWrapper, 
              { 
                borderColor: emailError ? "#DC2626" : (emailFocused ? "#0B6FAD" : "#D6E9F2"),
              }
            ]}>
              <Ionicons name="mail" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError("");
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="Enter your email"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

          {/* Password input */}
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
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotRow}>
            <Text style={[styles.forgotText, { color: "#0B6FAD" }]}>Forgot password?</Text>
          </Pressable>

          {/* Login Button */}
          <Pressable
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: "#0B6FAD", opacity: pressed ? 0.85 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Ionicons name="log-in" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.loginBtnText}>Sign In</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: "auto" }} />
              </View>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          {/* Google Login button */}
          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              { backgroundColor: "#FFFFFF", borderColor: "#D6E9F2", opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#1F2937" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#1F2937" style={{ marginRight: 8 }} />
                <Text style={[styles.googleBtnText, { color: "#1F2937" }]}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or continue with phone</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          {/* Phone Provider Toggle */}
          <View style={styles.providerToggle}>
            {(['sms', 'whatsapp'] as const).map((p) => {
              const isActive = otpProvider === p;
              return (
                <Pressable
                  key={p}
                  style={[
                    styles.providerBtn,
                    {
                      backgroundColor: isActive ? "#0B6FAD" : "#FFFFFF",
                      borderColor: isActive ? "transparent" : "#D6E9F2",
                    }
                  ]}
                  onPress={() => setOtpProvider(p)}
                >
                  <Ionicons
                    name={p === 'sms' ? 'chatbubble-ellipses' : 'chatbubbles'}
                    size={14}
                    color={isActive ? '#fff' : '#5A7A8C'}
                  />
                  <Text style={[styles.providerBtnText, { color: isActive ? '#fff' : '#5A7A8C' }]}>
                    {p === 'sms' ? 'SMS' : 'WhatsApp'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Phone number field */}
          <View style={styles.fieldGroup}>
            <View style={[
              styles.inputWrapper, 
              { 
                borderColor: phoneError ? "#DC2626" : (phoneFocused ? "#0B6FAD" : "#D6E9F2"),
              }
            ]}>
              <Ionicons name="call" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setPhoneError("");
                }}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.phoneBtn, { backgroundColor: "#0B6FAD", opacity: pressed ? 0.85 : 1 }]}
            onPress={handlePhoneLogin}
            disabled={phoneLoading}
          >
            {phoneLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Ionicons name="mail" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.loginBtnText}>Send OTP</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: "auto" }} />
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={[styles.registerLink, { color: "#0B6FAD" }]}>Sign Up</Text>
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
  appName: { fontSize: 24, fontFamily: "Fredoka_700Bold", letterSpacing: 2 },
  tagline: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  form: { gap: 16 },
  title: { fontSize: 26, fontFamily: "Fredoka_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -8 },
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
  forgotRow: { alignSelf: "flex-end", marginTop: -8 },
  forgotText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loginBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 20,
  },
  loginBtnText: { fontSize: 16, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
  phoneBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 8,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, paddingBottom: 24 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  registerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626", marginTop: 4 },
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
    borderRadius: 20,
    borderWidth: 1.5,
  },
  providerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
