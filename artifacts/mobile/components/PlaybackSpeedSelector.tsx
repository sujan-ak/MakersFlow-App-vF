import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface PlaybackSpeedSelectorProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
  asIcon?: boolean;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
];

export function PlaybackSpeedSelector({ currentSpeed, onSpeedChange, asIcon }: PlaybackSpeedSelectorProps) {
  const colors = useColors();
  const [showMenu, setShowMenu] = useState(false);
  const [menuStep, setMenuStep] = useState<"home" | "speed">("home");

  const currentSpeedLabel = SPEED_OPTIONS.find(option => option.value === currentSpeed)?.label || "1x";

  const handleSpeedSelect = async (speed: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSpeedChange(speed);
    setShowMenu(false);
  };

  const toggleMenu = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuStep("home");
    setShowMenu(!showMenu);
  };

  return (
    <>
      {/* Settings Gear Button */}
      {asIcon ? (
        <Pressable onPress={toggleMenu} style={styles.iconPressable}>
          <Feather name="settings" size={20} color="#FFF" />
        </Pressable>
      ) : (
        <Pressable style={[styles.speedButton, { borderColor: "rgba(255,255,255,0.3)" }]} onPress={toggleMenu}>
          <Text style={styles.speedButtonText}>{currentSpeedLabel}</Text>
          <Feather 
            name={showMenu ? "chevron-up" : "chevron-down"} 
            size={14} 
            color="#FFF" 
          />
        </Pressable>
      )}

      {/* Settings Bottom Sheet Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.speedMenu, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            
            {menuStep === "home" ? (
              <>
                <View style={styles.menuHeader}>
                  <Text style={[styles.menuTitle, { color: colors.foreground }]}>Settings</Text>
                </View>
                
                <Pressable
                  style={styles.menuOption}
                  onPress={() => setMenuStep("speed")}
                >
                  <View style={styles.menuOptionLeft}>
                    <Feather name="play-circle" size={20} color={colors.foreground} />
                    <Text style={[styles.menuOptionText, { color: colors.foreground }]}>Playback Speed</Text>
                  </View>
                  <View style={styles.menuOptionRight}>
                    <Text style={{ color: colors.mutedForeground, marginRight: 4 }}>{currentSpeedLabel}</Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                <View style={[styles.menuHeader, styles.menuHeaderSpeed]}>
                  <Pressable onPress={() => setMenuStep("home")} style={styles.backButton}>
                    <Feather name="arrow-left" size={20} color={colors.foreground} />
                  </Pressable>
                  <Text style={[styles.menuTitle, { color: colors.foreground, flex: 1, textAlign: "center", marginRight: 24 }]}>Playback Speed</Text>
                </View>

                {SPEED_OPTIONS.map((option) => {
                  const isSelected = option.value === currentSpeed;
                  
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.speedOption,
                        isSelected && { backgroundColor: colors.accent },
                      ]}
                      onPress={() => handleSpeedSelect(option.value)}
                    >
                      <Text
                        style={[
                          styles.speedOptionText,
                          { color: isSelected ? colors.primary : colors.foreground },
                          isSelected && { fontWeight: "600" },
                        ]}
                      >
                        {option.label}
                      </Text>
                      
                      {isSelected && (
                        <Feather name="check" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  speedButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    minWidth: 60,
    justifyContent: "center",
  },
  speedButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  iconPressable: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end", // Align to bottom of the page
  },
  speedMenu: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    width: "100%",
    paddingBottom: 30, // Extra padding for safe area / home indicator
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  menuHeaderSpeed: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 4,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    minHeight: 52,
  },
  menuOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuOptionRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  speedOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },
  speedOptionText: {
    fontSize: 15,
  },
});