import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface ResumeModalProps {
  visible: boolean;
  resumeTime: number;
  onResume: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

export function ResumeModal({ visible, resumeTime, onResume, onStartOver, onClose }: ResumeModalProps) {
  const colors = useColors();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleResume = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onResume();
  };

  const handleStartOver = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartOver();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
              <Feather name="play-circle" size={24} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Resume Learning</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Continue from where you left off
            </Text>
          </View>

          {/* Resume Time */}
          <View style={[styles.timeContainer, { backgroundColor: colors.accent }]}>
            <Text style={[styles.resumeText, { color: colors.primary }]}>
              Resume from {formatTime(resumeTime)}?
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleStartOver}
            >
              <Feather name="rotate-ccw" size={18} color={colors.mutedForeground} />
              <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>Start Over</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleResume}
            >
              <Feather name="play" size={18} color="#FFF" />
              <Text style={[styles.buttonText, { color: "#FFF" }]}>Resume</Text>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  },
  timeContainer: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  resumeText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 50,
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
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});