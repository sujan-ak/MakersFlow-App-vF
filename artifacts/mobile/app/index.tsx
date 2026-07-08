import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import { hasSeenOnboarding } from "@/lib/onboardingStorage";

export default function SplashRedirect() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const colors = useColors();
  const hasNavigated = useRef(false);
  const [isOnboardingCheckDone, setIsOnboardingCheckDone] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      const seen = await hasSeenOnboarding();
      setOnboardingSeen(seen);
      setIsOnboardingCheckDone(true);
    }
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (!isAuthLoading && isOnboardingCheckDone) {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (user) {
        if (!user.onboarding_completed) {
          router.replace("/(auth)/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        if (!onboardingSeen) {
          router.replace("/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      }
    }
  }, [isAuthLoading, isOnboardingCheckDone, user, onboardingSeen]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ marginTop: 12, color: colors.foreground, fontWeight: "500" }}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
