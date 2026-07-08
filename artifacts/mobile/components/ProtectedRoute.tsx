import { useSegments, router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContextSupabase';
import { useRequireAuth } from '@/context/AuthRequireContext';
import { useColors } from '@/hooks/useColors';
import { PROTECTED_ROUTES } from '@/lib/protectedRoutes';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { requireAuth } = useRequireAuth();
  const segments = useSegments();
  const colors = useColors();

  const inAuthGroup = segments[0] === '(auth)';
  const currentPath = segments.join('/');
  
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => {
    return (segments as any).includes(route) || currentPath.startsWith(route);
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated && isProtectedRoute && !inAuthGroup) {
      requireAuth(() => {
        router.replace(('/' + currentPath) as any);
      });
    }
  }, [isLoading, isAuthenticated, isProtectedRoute, inAuthGroup, currentPath]);

  // Safe redirect outside the rendering flow to prevent React warning side-effects
  useEffect(() => {
    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, inAuthGroup]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
      </View>
    );
  }

  // Fallback screen for protected tab items
  if (!isAuthenticated && isProtectedRoute && !inAuthGroup) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent }]}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Sign in to continue</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Create a free account to enroll in courses, track progress, and purchase kits.
          </Text>
          
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => router.push("/(auth)/register")}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Create Account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (isAuthenticated && inAuthGroup) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
