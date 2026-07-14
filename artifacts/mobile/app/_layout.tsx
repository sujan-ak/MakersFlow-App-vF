import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContextSupabase";
import { AuthRequireProvider } from "@/context/AuthRequireContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CartProvider } from "@/context/CartContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { useColors } from "@/hooks/useColors";
import { OfflineScreen } from "@/components/OfflineScreen";
import { NetworkProvider, useNetwork } from "@/context/NetworkContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import AsyncStorage from "@react-native-async-storage/async-storage";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  const { isConnected } = useNetwork();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const [hasEverLoaded, setHasEverLoaded] = React.useState<boolean | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);

  const [fontsLoaded, fontError] = useFonts({ 
    Fredoka_500Medium, 
    Fredoka_600SemiBold, 
    Fredoka_700Bold, 
    Inter_400Regular, 
    Inter_500Medium, 
    Inter_600SemiBold 
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    AsyncStorage.getItem("app_has_ever_loaded").then((val) => {
      setHasEverLoaded(val === "true");
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && isConnected && !isAuthLoading && hasEverLoaded === false) {
      AsyncStorage.setItem("app_has_ever_loaded", "true");
      setHasEverLoaded(true);
    }
  }, [fontsLoaded, isConnected, isAuthLoading, hasEverLoaded]);

  const handleRetry = async () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
    }, 1500);
  };

  if (!fontsLoaded || hasEverLoaded === null) {
    return <View style={{ flex: 1, backgroundColor: '#F4FAFD' }} />;
  }

  // Level 1: startup failure condition
  // isConnected === null means "checking" — don't show offline screen yet
  const showStartupOfflineScreen = 
    isConnected === false && // explicit false, not null (null = still checking)
    !isAuthLoading && 
    !user && 
    hasEverLoaded === false;

  if (showStartupOfflineScreen) {
    return <OfflineScreen onRetry={handleRetry} isChecking={isChecking} />;
  }

  return (
    <>
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/reset-password" options={{ headerShown: false }} />
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
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <NetworkProvider>
                <AuthProvider>
                  <AuthRequireProvider>
                    <ProtectedRoute>
                      <CartProvider>
                        <FavoritesProvider>
                          <ProgressProvider>
                            <RootLayoutNav />
                          </ProgressProvider>
                        </FavoritesProvider>
                      </CartProvider>
                    </ProtectedRoute>
                  </AuthRequireProvider>
                </AuthProvider>
              </NetworkProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
