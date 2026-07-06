import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";

export default function VerifyOtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, provider } = useLocalSearchParams<{ phone: string; provider?: string }>();
  const { verifyOtp, sendOtp, verifyWhatsappOtp, sendWhatsappOtp } = useAuth();
  const isWhatsapp = provider === "whatsapp";
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  async function handleVerify() {
    if (otpCode.length !== 6) return;

    setError("");
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = isWhatsapp
      ? await verifyWhatsappOtp(phone!, otpCode)
      : await verifyOtp(phone!, otpCode);
    setLoading(false);

    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setError("Invalid code. Please try again.");
    }
  }

  async function handleResend() {
    if (!canResend) return;

    setError("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = isWhatsapp ? await sendWhatsappOtp(phone!) : await sendOtp(phone!);

    if (result.success) {
      setResendCountdown(30);
      setCanResend(false);
    } else {
      setError(result.error || "Failed to resend OTP. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
          <Feather name="smartphone" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Verify your number</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter the 6-digit code sent to {phone}
        </Text>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={[styles.otpInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.otpInput, { color: colors.foreground }]}
              value={otpCode}
              onChangeText={(text) => {
                setOtpCode(text.replace(/[^0-9]/g, ""));
                setError("");
              }}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.verifyBtn,
              { 
                backgroundColor: otpCode.length === 6 ? colors.primary : colors.mutedForeground,
                opacity: pressed ? 0.85 : 1 
              }
            ]}
            onPress={handleVerify}
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify & Continue</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={!canResend}
            style={styles.resendBtn}
          >
            <Text style={[styles.resendText, { color: canResend ? colors.primary : colors.mutedForeground }]}>
              {canResend ? "Resend code" : `Resend in ${resendCountdown}s`}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 32, width: 40 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  form: { gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },
  otpInputWrapper: {
    paddingHorizontal: 14,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  otpInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 12,
    textAlign: "center",
    width: "100%",
  },
  verifyBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  verifyBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  resendBtn: { alignItems: "center", paddingVertical: 12 },
  resendText: { fontSize: 15, fontWeight: "600" },
});
