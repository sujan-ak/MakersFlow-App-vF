import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { useAuth } from "@/context/AuthContextSupabase";
import { registerForPushNotifications } from "@/lib/pushNotifications";

// ── Lazy loaders (these native modules crash Expo Go if imported at top level) ──
function getNotifications(): typeof import("expo-notifications") | null {
  if (Application.applicationId === "host.exp.Exponent" || Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications");
  } catch {
    return null;
  }
}

function getLocalAuth(): typeof import("expo-local-authentication") | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-local-authentication");
  } catch {
    return null;
  }
}

const BIOMETRIC_KEY = "makersflow_biometric_enabled";
// Re-lock only after the app has been away this long, so a quick app-switch
// or the biometric sheet itself doesn't immediately re-trigger a lock.
const LOCK_AFTER_MS = 30_000;

/**
 * AppGate
 * ───────
 * Fixes three gaps the rest of the codebase misses:
 *
 *  1. PUSH REGISTRATION FOR RETURNING USERS
 *     AuthContext only registers a push token on the `SIGNED_IN` event. A
 *     returning user's restored session fires `INITIAL_SESSION` instead, so the
 *     token was never saved and the Android channels were never created. The
 *     upsert is idempotent, so running it on every launch is safe.
 *
 *  2. NOTIFICATION TAP HANDLING
 *     Nothing listened for a tapped notification, so pushes couldn't deep-link.
 *
 *  3. BIOMETRIC APP LOCK
 *     Biometric only ran on the login screen, so an already-signed-in user
 *     never saw a prompt — which is why the toggle looked enabled but did
 *     nothing.
 *
 * IMPORTANT: the lock is a Modal layered *over* children, never a replacement
 * for them. Children must stay mounted or RootLayoutNav never runs, fonts never
 * load, and SplashScreen.hideAsync() is never called — leaving the app stuck on
 * the splash screen behind the lock.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { user, authInitialized } = useAuth();

  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const registeredFor = useRef<string | null>(null);
  const didInitialLockCheck = useRef(false);
  const promptOpen = useRef(false);

  // ── 1. Register push token for ANY signed-in user ────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    if (registeredFor.current === user.id) return; // once per session
    registeredFor.current = user.id;
    registerForPushNotifications(user.id).catch(() => {});
  }, [user?.id]);

  // ── 2. Handle notification taps (deep link) ──────────────────────────────
  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data: any = response?.notification?.request?.content?.data ?? {};
        if (data.screen === "orders") {
          router.push("/store/orders");
        } else if (data.screen === "course" && data.courseId) {
          router.push(`/course/${data.courseId}` as any);
        } else if (data.screen === "news" && data.newsId) {
          router.push(`/news/${data.newsId}` as any);
        } else {
          router.push("/notifications");
        }
      } catch {
        // ignore malformed payloads
      }
    });

    return () => sub.remove();
  }, []);

  // ── 3. Biometric app lock ────────────────────────────────────────────────
  const runUnlock = useCallback(async () => {
    if (promptOpen.current) return; // never stack prompts
    const LocalAuth = getLocalAuth();
    if (!LocalAuth) {
      setLocked(false);
      return;
    }
    promptOpen.current = true;
    setChecking(true);
    backgroundedAt.current = null; // the OS sheet backgrounds us; don't count it
    try {
      const result = await LocalAuth.authenticateAsync({
        promptMessage: "Unlock MakersFlow",
        fallbackLabel: "Use device passcode",
        disableDeviceFallback: false,
      });
      if (result.success) setLocked(false);
    } catch {
      // stay locked; the user can tap Unlock to retry
    } finally {
      promptOpen.current = false;
      backgroundedAt.current = null;
      setChecking(false);
    }
  }, []);

  const shouldLock = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false; // nothing to protect when signed out
    if (Platform.OS === "web") return false;
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (enabled !== "true") return false;
      const LocalAuth = getLocalAuth();
      if (!LocalAuth) return false;
      const hasHardware = await LocalAuth.hasHardwareAsync();
      const enrolled = await LocalAuth.isEnrolledAsync();
      return hasHardware && enrolled;
    } catch {
      return false;
    }
  }, [user?.id]);

  // Lock once on first launch, after auth has settled.
  useEffect(() => {
    if (!authInitialized || didInitialLockCheck.current) return;
    didInitialLockCheck.current = true;
    (async () => {
      if (await shouldLock()) {
        setLocked(true);
        runUnlock();
      }
    })();
  }, [authInitialized, shouldLock, runUnlock]);

  // Lock again after a long spell in the background.
  useEffect(() => {
    const onChange = async (next: AppStateStatus) => {
      if (promptOpen.current) return; // the biometric sheet itself — ignore
      if (next === "background" || next === "inactive") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next === "active" && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= LOCK_AFTER_MS && (await shouldLock())) {
          setLocked(true);
          runUnlock();
        }
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [shouldLock, runUnlock]);

  // Children ALWAYS render. The lock sits on top as a modal.
  return (
    <>
      {children}
      <Modal visible={locked} animationType="fade" statusBarTranslucent>
        <View style={styles.lockScreen}>
          <View style={styles.lockIcon}>
            <Ionicons name="finger-print" size={44} color="#0B6FAD" />
          </View>
          <Text style={styles.lockTitle}>MakersFlow is locked</Text>
          <Text style={styles.lockSub}>Verify your identity to continue</Text>

          <Pressable
            style={[styles.unlockBtn, { opacity: checking ? 0.7 : 1 }]}
            onPress={runUnlock}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.unlockBtnText}>Unlock</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

// System fonts on purpose — this can render before the custom fonts finish
// loading, and an unloaded family renders inconsistently on Android.
const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
    backgroundColor: "#F4FAFD",
  },
  lockIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#DCF7F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lockTitle: { fontSize: 20, fontWeight: "700", color: "#1a2a3a", textAlign: "center" },
  lockSub: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 20 },
  unlockBtn: {
    height: 48,
    minWidth: 180,
    borderRadius: 24,
    backgroundColor: "#0B6FAD",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  unlockBtnText: { fontSize: 16, fontWeight: "600", color: "#FFF" },
});
