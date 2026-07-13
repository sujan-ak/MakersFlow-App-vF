import React, { useState, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { markOnboardingSeen } from "@/lib/onboardingStorage";
import { LinearGradient } from "expo-linear-gradient";

const SCREEN_WIDTH = Dimensions.get("window").width;

const SLIDES = [
  {
    id: "1",
    title: "Learn STEM Skills",
    subtitle: "From Robotics to AI and everything in between",
    icon: "hardware-chip" as const,
    glowColor: "rgba(11, 111, 173, 0.15)",
    iconColor: "#0B6FAD",
  },
  {
    id: "2",
    title: "Take Video Courses",
    subtitle: "Expert-led lessons on Arduino, IoT, Drones and more",
    icon: "play-circle" as const,
    glowColor: "rgba(23, 229, 211, 0.15)",
    iconColor: "#17E5D3",
  },
  {
    id: "3",
    title: "Earn Certificates",
    subtitle: "Complete courses and showcase your skills",
    icon: "ribbon" as const,
    glowColor: "rgba(16, 185, 129, 0.15)",
    iconColor: "#10B981",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button top-right */}
      <View style={[styles.topHeader, { top: insets.top + 16 }]}>
        <Pressable onPress={handleBrowse}>
          <Text style={styles.skipLinkText}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.illustrationContainer, { backgroundColor: item.glowColor }]}>
              <Ionicons name={item.icon} size={80} color={item.iconColor} />
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
                  backgroundColor: idx === activeIndex ? "#0B6FAD" : "#444",
                  width: idx === activeIndex ? 18 : 6,
                  height: idx === activeIndex ? 6 : 6,
                  borderRadius: 3,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Pressable onPress={handleSignIn} style={styles.signInLinkBtn}>
          <Text style={styles.signInLinkText}>Sign In</Text>
        </Pressable>

        {activeIndex === SLIDES.length - 1 ? (
          <Pressable onPress={handleBrowse}>
            <LinearGradient
              colors={["#0B6FAD", "#17E5D3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.gradientBtnText}>Get Started</Text>
              <Ionicons name="rocket" size={16} color="#FFF" />
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            style={styles.nextPillBtn}
            onPress={() => {
              const nextIndex = activeIndex + 1;
              flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
              setActiveIndex(nextIndex);
            }}
          >
            <Text style={styles.nextPillText}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFF" />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  topHeader: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  skipLinkText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#888",
  },
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
  title: { fontSize: 24, fontFamily: "Fredoka_700Bold", color: "#FFFFFF", textAlign: "center" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#A3A3A3", textAlign: "center", lineHeight: 22, paddingHorizontal: 20 },
  footerContainer: { height: 48, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  dotsContainer: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: {},
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
  signInLinkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  signInLinkText: {
    color: "#0B6FAD",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  nextPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0B6FAD",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 24,
  },
  nextPillText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Fredoka_600SemiBold",
  },
  gradientBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 24,
  },
  gradientBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Fredoka_600SemiBold",
  },
});
