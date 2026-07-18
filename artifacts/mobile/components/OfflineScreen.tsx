import React from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface OfflineScreenProps {
  onRetry: () => void;
  isChecking?: boolean;
}

export function OfflineScreen({ onRetry, isChecking = false }: OfflineScreenProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}15` }]}>
        <Feather name="wifi-off" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>No Internet Connection</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your device is currently offline. Please check your internet connection and try again.
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={isChecking}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.primary,
            opacity: pressed || isChecking ? 0.8 : 1,
          },
        ]}
      >
        {isChecking ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>Try Again</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 20,
  },
  button: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
