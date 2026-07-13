import { useSegments, router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { useAuth } from '@/context/AuthContextSupabase';
import { useColors } from '@/hooks/useColors';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const colors = useColors();

  const inAuthGroup = segments[0] === '(auth)';

  // Redirect authenticated users away from auth screens (login/register)
  useEffect(() => {
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, inAuthGroup]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  // Hide children while authenticated user is being redirected away from auth group
  if (isAuthenticated && inAuthGroup) {
    return null;
  }

  // Always render children — protected screens handle their own empty/guest states.
  // The AuthRequireContext will prompt sign-in when the user tries a protected action.
  return <>{children}</>;
}
