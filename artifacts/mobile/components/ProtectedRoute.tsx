import { Redirect, useSegments } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/context/AuthContextSupabase';
import { useColors } from '@/hooks/useColors';

// Routes accessible without authentication
const PUBLIC_ROUTES = [
  'settings/privacy-policy',
  'settings/terms-of-service',
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
      </View>
    );
  }

  const inAuthGroup = segments[0] === '(auth)';
  // e.g. segments = ['settings', 'privacy-policy'] → 'settings/privacy-policy'
  const currentPath = segments.join('/');
  const isPublicRoute = PUBLIC_ROUTES.some((route) => currentPath === route || currentPath.startsWith(route));

  // If not authenticated, not in auth group, and not a public route → redirect to login
  if (!isAuthenticated && !inAuthGroup && !isPublicRoute) {
    return <Redirect href="/(auth)/login" />;
  }

  // If authenticated and in auth group, redirect to home
  if (isAuthenticated && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
