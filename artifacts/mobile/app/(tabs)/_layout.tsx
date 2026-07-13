import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform } from "react-native";

import { useColors } from "@/hooks/useColors";

function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: "hidden",
          height: isWeb ? 84 : 72,
          paddingBottom: Platform.OS === "ios" ? 20 : 12,
          paddingTop: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
          zIndex: 999,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} />,
          tabBarAccessibilityLabel: "Home tab",
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Store",
          tabBarIcon: ({ color }) => <Ionicons name="storefront" size={22} color={color} />,
          tabBarAccessibilityLabel: "Store tab",
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "Courses",
          tabBarIcon: ({ color }) => <Ionicons name="book" size={22} color={color} />,
          tabBarAccessibilityLabel: "Courses tab",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Ionicons name="search" size={22} color={color} />,
          tabBarAccessibilityLabel: "Search tab",
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="news"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} />,
          tabBarAccessibilityLabel: "Profile tab",
        }}
      />
    </Tabs>
  );
}

export default TabLayout;
