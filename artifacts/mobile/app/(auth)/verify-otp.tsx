import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
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
import { TEXT_STYLES } from "@/constants/typography";

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
  const inputRef = useRef<TextInput>(null);

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

  const otpArray = otpCode.split("");
  const inputs = Array(6).fill(0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
          <Feather name="smartphone" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, TEXT_STYLES.pageTitle, { color: colors.foreground }]}>Verify your number</Text>
        <Text style={[styles.subtitle, TEXT_STYLES.description, { color: colors.mutedForeground }]}>
          Enter the 6-digit code sent to {phone}
        </Text>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* OTP 6-Box Row */}
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
            {inputs.map((_, idx) => {
              const digit = otpArray[idx] || "";
              const isFocused = idx === otpArray.length;
              const isFilled = idx < otpArray.length;

              return (
                <View
                  key={idx}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: colors.card,
                      borderColor: isFocused ? colors.primary : colors.border,
                      borderWidth: isFocused ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.otpDigit, TEXT_STYLES.pageTitle, { color: colors.foreground, fontSize: 24, textAlign: "center" }]}>
                    {digit}
                  </Text>
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={otpCode}
              onChangeText={(text) => {
                setOtpCode(text.replace(/[^0-9]/g, ""));
                setError("");
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.verifyBtn,
              { 
                backgroundColor: otpCode.length === 6 ? colors.primary : colors.muted,
                opacity: pressed ? 0.85 : 1 
              }
            ]}
            onPress={handleVerify}
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Feather name="check" size={16} color={otpCode.length === 6 ? "#FFF" : colors.mutedForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.verifyBtnText, TEXT_STYLES.button, { color: otpCode.length === 6 ? "#FFF" : colors.mutedForeground }]}>
                  Verify & Continue
                </Text>
                <Feather name="chevron-right" size={16} color={otpCode.length === 6 ? "#FFF" : colors.mutedForeground} style={{ marginLeft: 6 }} />
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={!canResend}
            style={styles.resendBtn}
          >
            <Text style={[styles.resendText, TEXT_STYLES.link, { color: canResend ? colors.primary : colors.mutedForeground }]}>
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
  form: { gap: 24 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    position: "relative",
    height: 60,
  },
  otpBox: {
    width: "14%",
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: "700",
  },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  verifyBtn: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  btnContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  verifyBtnText: { fontSize: 15, fontWeight: "700" },
  resendBtn: { alignItems: "center", paddingVertical: 12 },
  resendText: { fontSize: 15, fontWeight: "600" },
});
