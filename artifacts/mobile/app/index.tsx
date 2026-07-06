import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";

export default function SplashRedirect() {
  const { user, isLoading } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Profile still missing onboarding details (e.g. Google sign-ins never
        // pass through the register form) → collect age / grade / school first.
        if (!user.grade && !user.school) {
          router.replace("/(auth)/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, user]);

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <ActivityIndicator color="#ffffff" size="large" />
      <Text style={{ marginTop: 12, color: "#ffffff", fontWeight: "500" }}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
