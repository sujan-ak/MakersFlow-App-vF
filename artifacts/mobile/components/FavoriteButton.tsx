import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useEffect } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onPress: (e?: any) => void;
  size?: number;
}

export function FavoriteButton({
  isFavorite,
  onPress,
  size = 22,
}: FavoriteButtonProps) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    scaleAnim.setValue(0.8);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isFavorite]);

  const handlePress = async (event: any) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(event);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <MaterialIcons
          name={isFavorite ? "favorite" : "favorite-border"}
          size={size}
          color={isFavorite ? "#EF4444" : colors.mutedForeground}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 20,
  },
});
