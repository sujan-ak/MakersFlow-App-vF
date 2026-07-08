import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Dimensions,
  SafeAreaView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { markOnboardingSeen } from "@/lib/onboardingStorage";

const SCREEN_WIDTH = Dimensions.get("window").width;

const SLIDES = [
  {
    id: "1",
    title: "Learn STEM Skills",
    subtitle: "From Robotics to AI and everything in between",
    icon: "cpu" as const,
    glowColor: "rgba(79, 70, 229, 0.15)",
    iconColor: "#4F46E5",
  },
  {
    id: "2",
    title: "Take Video Courses",
    subtitle: "Expert-led lessons on Arduino, IoT, Drones and more",
    icon: "tv" as const,
    glowColor: "rgba(249, 115, 22, 0.15)",
    iconColor: "#F97316",
  },
  {
    id: "3",
    title: "Earn Certificates",
    subtitle: "Complete courses and showcase your skills",
    icon: "award" as const,
    glowColor: "rgba(16, 185, 129, 0.15)",
    iconColor: "#10B981",
  },
];

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleBrowse = async () => {
    await markOnboardingSeen();
    router.replace("/(tabs)");
  };

  const handleSignIn = async () => {
    await markOnboardingSeen();
    router.replace("/(auth)/login");
  };

  const handleMomentumScrollEnd = (event: any) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  const browseLabel = activeIndex === SLIDES.length - 1 ? "Get Started" : "Browse";

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.illustrationContainer, { backgroundColor: item.glowColor }]}>
              <Feather name={item.icon} size={80} color={item.iconColor} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footerContainer}>
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor: idx === activeIndex ? "#4F46E5" : "#444",
                  width: idx === activeIndex ? 16 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Pressable style={styles.browseBtn} onPress={handleBrowse}>
          <Text style={styles.browseBtnText}>{browseLabel}</Text>
        </Pressable>
        <Pressable style={styles.signInBtn} onPress={handleSignIn}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 40,
  },
  illustrationContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  textContainer: { alignItems: "center", gap: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  subtitle: { fontSize: 15, color: "#A3A3A3", textAlign: "center", lineHeight: 22, paddingHorizontal: 20 },
  footerContainer: { height: 64, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  dotsContainer: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: { height: 8, borderRadius: 4 },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 16 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#171717",
  },
  browseBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  browseBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  signInBtn: { backgroundColor: "#4F46E5", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  signInBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
