import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type BadgeVariant = "primary" | "success" | "warning" | "error" | "muted";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = "primary" }: BadgeProps) {
  const colors = useColors();

  const bgMap: Record<BadgeVariant, string> = {
    primary: colors.accent,
    success: "#DCFCE7",
    warning: "#FEF3C7",
    error: "#FEE2E2",
    muted: colors.muted,
  };

  const colorMap: Record<BadgeVariant, string> = {
    primary: colors.primary,
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    muted: colors.mutedForeground,
  };

  return (
    <View style={[styles.badge, { backgroundColor: bgMap[variant] }]}>
      <Text style={[styles.label, { color: colorMap[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
