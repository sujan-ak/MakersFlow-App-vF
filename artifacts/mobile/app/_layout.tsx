import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContextSupabase";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CartProvider } from "@/context/CartContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="course/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="course/learn" options={{ headerShown: false }} />
      <Stack.Screen name="quiz/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="quiz/result" options={{ headerShown: false }} />
      <Stack.Screen name="store/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="store/checkout" options={{ headerShown: false }} />
      <Stack.Screen name="store/orders" options={{ headerShown: false }} />
      <Stack.Screen name="news/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="favorites" options={{ headerShown: false }} />
      <Stack.Screen name="settings/index" options={{ headerShown: false }} />
      <Stack.Screen name="settings/security" options={{ headerShown: false }} />
      <Stack.Screen name="settings/notifications" options={{ headerShown: false }} />
      <Stack.Screen name="settings/help" options={{ headerShown: false }} />
      <Stack.Screen name="settings/feedback" options={{ headerShown: false }} />
      <Stack.Screen name="settings/security-log" options={{ headerShown: false }} />
      <Stack.Screen name="settings/privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="settings/terms-of-service" options={{ headerShown: false }} />
      <Stack.Screen name="achievements" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="certificate" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <FavoritesProvider>
                  <ProgressProvider>
                    <ProtectedRoute>
                      <CartProvider>
                        <RootLayoutNav />
                      </CartProvider>
                    </ProtectedRoute>
                  </ProgressProvider>
                </FavoritesProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
