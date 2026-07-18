import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";

interface AuthPromptModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthPromptModal({ visible, onClose }: AuthPromptModalProps) {
  const colors = useColors();

  const handleSignIn = () => {
    onClose();
    router.push("/(auth)/login");
  };

  const handleCreateAccount = () => {
    onClose();
    router.push("/(auth)/register");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Handle bar for bottom sheet look */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.accent }]}>
              <Feather name="lock" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Sign in to continue</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Create a free account to enroll in courses, track progress, and purchase kits.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleSignIn}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleCreateAccount}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Create Account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  actions: {
    gap: 12,
  },
  button: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  primaryButton: {
    shadowColor: "#000",
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
    fontWeight: "700",
    color: "#FFF",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
