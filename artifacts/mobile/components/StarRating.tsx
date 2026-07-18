import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({
  rating,
  onRatingChange,
  size = 28,
  readonly = false,
}: StarRatingProps) {
  const isInteractive = !readonly && !!onRatingChange;

  const handlePress = (star: number) => {
    if (!isInteractive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Tap the same star again → deselect
    onRatingChange!(rating === star ? 0 : star);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => handlePress(star)}
          disabled={!isInteractive}
          hitSlop={6}
          style={({ pressed }) => [
            styles.star,
            isInteractive && pressed && { opacity: 0.6 },
          ]}
        >
          <MaterialIcons
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={star <= rating ? "#FF6B35" : "#9CA3AF"}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  star: {
    padding: 2,
  },
});
