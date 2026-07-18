import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface LessonCompleteModalProps {
  visible: boolean;
  lessonTitle: string;
  hasNextLesson: boolean;
  onReplay: () => void;
  onNextLesson: () => void;
  onClose: () => void;
}

export function LessonCompleteModal({ 
  visible, 
  lessonTitle, 
  hasNextLesson, 
  onReplay, 
  onNextLesson, 
  onClose 
}: LessonCompleteModalProps) {
  const colors = useColors();

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible]);

  const handleReplay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReplay();
  };

  const handleNextLesson = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNextLesson();
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
          {/* Success Icon */}
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="check" size={32} color="#FFF" />
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Lesson Completed!
            </Text>
            <Text style={[styles.lessonTitle, { color: colors.primary }]} numberOfLines={2}>
              {lessonTitle}
            </Text>
            <Text style={[styles.message, { color: colors.mutedForeground }]}>
              Great job! You've successfully completed this lesson.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleReplay}
            >
              <Feather name="repeat" size={18} color={colors.mutedForeground} />
              <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>
                Replay Lesson
              </Text>
            </Pressable>

            {hasNextLesson ? (
              <Pressable
                style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleNextLesson}
              >
                <Text style={[styles.buttonText, { color: "#FFF" }]}>Next Lesson</Text>
                <Feather name="arrow-right" size={18} color="#FFF" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.button, styles.primaryButton, { backgroundColor: colors.success }]}
                onPress={onClose}
              >
                <Feather name="check-circle" size={18} color="#FFF" />
                <Text style={[styles.buttonText, { color: "#FFF" }]}>
                  Course Complete
                </Text>
              </Pressable>
            )}
          </View>

          {/* Close Button */}
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingTop: 32,
    minHeight: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 15,
  },
  successContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 22,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    minHeight: 54,
  },
  primaryButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});