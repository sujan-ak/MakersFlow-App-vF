import React, { useRef } from "react";
import { PanResponder, Animated, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

/**
 * Returns PanResponder handlers + a SwipeIndicator overlay component that
 * shows a directional arrow while the user is actively swiping between tabs.
 *
 * Tab order (left → right):
 *   Home  →  Store  →  Courses  →  Search  →  Profile
 *
 * Usage:
 *   const { panHandlers, SwipeIndicator } = useTabSwipe("/(tabs)/store");
 *   <View style={{ flex: 1 }} {...panHandlers}>
 *     <SwipeIndicator />
 *     ...rest of screen
 *   </View>
 */

const TAB_ORDER = [
  "/(tabs)",
  "/(tabs)/store",
  "/(tabs)/courses",
  "/(tabs)/search",
  "/(tabs)/profile",
] as const;

type TabRoute = (typeof TAB_ORDER)[number] | "/(tabs)/" | "/";

const SWIPE_THRESHOLD = 50;
const MIN_TRIGGER_DX = 15;

function normalizeRoute(route: string): (typeof TAB_ORDER)[number] {
  if (route === "/(tabs)/" || route === "/") return "/(tabs)";
  return route as (typeof TAB_ORDER)[number];
}

export function useTabSwipe(currentTab: TabRoute) {
  const normTab = normalizeRoute(currentTab);
  const currentTabRef = useRef(normTab);
  currentTabRef.current = normTab;

  // Two independent opacity animations — one per arrow direction
  const leftOpacity  = useRef(new Animated.Value(0)).current;  // ← shown when swiping right (prev tab)
  const rightOpacity = useRef(new Animated.Value(0)).current;  // → shown when swiping left  (next tab)

  const fadeOut = () => {
    Animated.parallel([
      Animated.timing(leftOpacity,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(rightOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gs) => {
        const idx = TAB_ORDER.indexOf(currentTabRef.current);
        if (idx === -1) return false;
        const isHorizontal = Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2 && Math.abs(gs.dx) > MIN_TRIGGER_DX;
        if (!isHorizontal) return false;
        if (gs.dx > 0 && idx <= 0) return false;
        if (gs.dx < 0 && idx >= TAB_ORDER.length - 1) return false;
        return true;
      },

      onMoveShouldSetPanResponderCapture: (_, gs) => {
        const idx = TAB_ORDER.indexOf(currentTabRef.current);
        if (idx === -1) return false;
        const isHorizontal = Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2 && Math.abs(gs.dx) > MIN_TRIGGER_DX;
        if (!isHorizontal) return false;
        if (gs.dx > 0 && idx <= 0) return false;
        if (gs.dx < 0 && idx >= TAB_ORDER.length - 1) return false;
        return true;
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderMove: (_, gs) => {
        const idx = TAB_ORDER.indexOf(currentTabRef.current);
        if (idx === -1) return;
        const progress = Math.min(Math.abs(gs.dx) / SWIPE_THRESHOLD, 1);

        if (gs.dx < 0 && idx < TAB_ORDER.length - 1) {
          // Swiping left → next tab: show right arrow
          leftOpacity.setValue(0);
          rightOpacity.setValue(progress);
        } else if (gs.dx > 0 && idx > 0) {
          // Swiping right → prev tab: show left arrow
          rightOpacity.setValue(0);
          leftOpacity.setValue(progress);
        } else {
          fadeOut();
        }
      },

      onPanResponderRelease: (_, gs) => {
        fadeOut();
        const idx = TAB_ORDER.indexOf(currentTabRef.current);
        if (idx === -1) return;
        if (gs.dx < -SWIPE_THRESHOLD && idx < TAB_ORDER.length - 1) {
          router.navigate(TAB_ORDER[idx + 1]);
        } else if (gs.dx > SWIPE_THRESHOLD && idx > 0) {
          router.navigate(TAB_ORDER[idx - 1]);
        }
      },

      onPanResponderTerminate: () => fadeOut(),
    })
  ).current;

  // Inline component — reads the animated values defined above.
  // Rendered as an absolutely-positioned overlay; pointerEvents="none" so it
  // never blocks taps on the underlying screen content.
  const SwipeIndicator = React.useCallback(() => {
    const idx = TAB_ORDER.indexOf(currentTabRef.current);
    const canGoBack    = idx > 0;
    const canGoForward = idx < TAB_ORDER.length - 1;

    return (
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
      >
        {/* Left arrow — prev tab */}
        {canGoBack && (
          <Animated.View
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: [{ translateY: -24 }],
              opacity: leftOpacity,
              backgroundColor: "rgba(11, 111, 173, 0.85)",
              borderRadius: 28,
              padding: 10,
              borderWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.3)",
              elevation: 10,
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Animated.View>
        )}

        {/* Right arrow — next tab */}
        {canGoForward && (
          <Animated.View
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: [{ translateY: -24 }],
              opacity: rightOpacity,
              backgroundColor: "rgba(11, 111, 173, 0.85)",
              borderRadius: 28,
              padding: 10,
              borderWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.3)",
              elevation: 10,
            }}
          >
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </Animated.View>
        )}
      </View>
    );
  }, [leftOpacity, rightOpacity]);

  return { panHandlers: panResponder.panHandlers, SwipeIndicator };
}

