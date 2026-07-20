import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContextSupabase";
import { supabase } from "@/lib/supabase";

const BIOMETRIC_KEY = "makersflow_biometric_enabled";

// Lazy-load expo-local-authentication (not available in Expo Go)
function getLocalAuth(): typeof import("expo-local-authentication") | null {
  try {
    return require("expo-local-authentication");
  } catch {
    return null;
  }
}

export default function SecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, resetPassword } = useAuth() as any;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [biometric, setBiometric] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Load saved settings on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Check if biometric hardware is available
      const LocalAuth = getLocalAuth();
      if (LocalAuth) {
        const compatible = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);
      }

      // Load saved biometric preference
      try {
        const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        setBiometric(stored === "true");
      } catch { /* ignore */ }

      // Load 2FA preference
      try {
        const stored = await SecureStore.getItemAsync("makersflow_2fa_enabled");
        setTwoFactor(stored === "true");
      } catch { /* ignore */ }

      setLoading(false);
    })();
  }, []);

  // ── Biometric toggle ──────────────────────────────────────────────────────
  async function handleBiometricToggle(value: boolean) {
    const LocalAuth = getLocalAuth();

    if (!LocalAuth) {
      Alert.alert("Not Supported", "Biometric authentication is not available in Expo Go. It will work in the installed APK.");
      return;
    }

    if (!biometricAvailable) {
      Alert.alert(
        "Not Available",
        "No fingerprint or Face ID is set up on this device. Please set up biometrics in your device settings first."
      );
      return;
    }

    if (value) {
      // Ask user to authenticate before enabling
      const result = await LocalAuth.authenticateAsync({
        promptMessage: "Verify your identity to enable biometric login",
        cancelLabel: "Cancel",
        fallbackLabel: "Use password",
        disableDeviceFallback: false,
      });

      if (result.success) {
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (!sess?.refresh_token) {
          Alert.alert("Could not enable", "Session not found. Please sign out, sign in again, then enable biometric login.");
          return;
        }
        await SecureStore.setItemAsync(BIOMETRIC_KEY, "true");
        await SecureStore.setItemAsync("makersflow_biometric_token", sess.refresh_token);
        if (user?.email) await SecureStore.setItemAsync("makersflow_biometric_email", user.email);
        setBiometric(true);
        Alert.alert("✅ Enabled", "Biometric login is now active. Next time you open the app, use your fingerprint to sign in.");
      } else {
        Alert.alert("Authentication Failed", "Could not verify your identity. Biometric login was not enabled.");
      }
    } else {
      // Confirm before disabling
      Alert.alert(
        "Disable Biometric Login",
        "Are you sure you want to disable fingerprint / Face ID login?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await SecureStore.setItemAsync(BIOMETRIC_KEY, "false");
              await SecureStore.deleteItemAsync("makersflow_biometric_token").catch(() => {});
              await SecureStore.deleteItemAsync("makersflow_biometric_email").catch(() => {});
              setBiometric(false);
            },
          },
        ]
      );
    }
  }

  // ── 2FA toggle ────────────────────────────────────────────────────────────
  async function handleTwoFactorToggle(value: boolean) {
    if (value) {
      // Enabling 2FA — send OTP to their phone to verify
      if (!user?.phone) {
        Alert.alert(
          "Phone Required",
          "Please add a phone number to your profile first to enable Two-Factor Authentication.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Edit Profile", onPress: () => router.push("/profile/edit") },
          ]
        );
        return;
      }

      Alert.alert(
        "Enable Two-Factor Auth",
        `We will send a verification code to ${user.phone} each time you log in. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: async () => {
              await SecureStore.setItemAsync("makersflow_2fa_enabled", "true");
              setTwoFactor(true);
              Alert.alert("✅ Enabled", "Two-Factor Authentication is now active. A verification code will be required at each login.");
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Disable Two-Factor Auth",
        "Disabling 2FA makes your account less secure. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await SecureStore.setItemAsync("makersflow_2fa_enabled", "false");
              setTwoFactor(false);
            },
          },
        ]
      );
    }
  }

  // ── Change Password ───────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (!user?.email) {
      Alert.alert("Error", "Could not find your email address.");
      return;
    }
    Alert.alert(
      "Change Password",
      `We will send a password reset link to:\n\n${user.email}\n\nCheck your inbox after confirming.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Reset Link",
          onPress: async () => {
            try {
              const result = await resetPassword(user.email!);
              if (result.success) {
                Alert.alert(
                  "✅ Email Sent",
                  `Password reset link sent to ${user.email}. Check your inbox (and spam folder).`
                );
              } else {
                Alert.alert("Error", result.error || "Failed to send reset email. Please try again.");
              }
            } catch (e: any) {
              Alert.alert("Error", e.message || "Something went wrong.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#0B6FAD" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Security</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Biometric + 2FA card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Biometric */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: "#DCF7F4" }]}>
              <Ionicons name="finger-print" size={18} color="#0B6FAD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Biometric Login</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {biometricAvailable ? "Use fingerprint or Face ID" : "No biometrics enrolled on device"}
              </Text>
            </View>
            <Switch
              value={biometric}
              onValueChange={handleBiometricToggle}
              trackColor={{ true: "#0B6FAD", false: "#D6E9F2" }}
              thumbColor="#FFF"
              disabled={!biometricAvailable}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: "#D6E9F2" }]} />

          {/* 2FA */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: "#DCF7F4" }]}>
              <Ionicons name="shield-checkmark" size={18} color="#0B6FAD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Two-Factor Auth</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {user?.phone ? "Verify via phone OTP at login" : "Requires a phone number in your profile"}
              </Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={handleTwoFactorToggle}
              trackColor={{ true: "#0B6FAD", false: "#D6E9F2" }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        {/* Change Password */}
        <Pressable
          style={[styles.changePasswordBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleChangePassword}
        >
          <Ionicons name="lock-closed" size={18} color="#0B6FAD" />
          <Text style={[styles.changePasswordText, { color: colors.foreground }]}>Change Password</Text>
          <Ionicons name="chevron-forward" size={18} color="#0B6FAD" />
        </Pressable>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={16} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Biometric login uses your device's fingerprint or Face ID — your biometric data never leaves your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  card: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontFamily: "Fredoka_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: 1, marginLeft: 16 },
  changePasswordBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
  changePasswordText: { flex: 1, fontSize: 15, fontFamily: "Fredoka_600SemiBold" },
  infoBox: {
    flexDirection: "row", gap: 10, padding: 14,
    borderRadius: 12, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
