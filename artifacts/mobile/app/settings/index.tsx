import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const SETTINGS = [
  {
    icon: "lock-closed",
    label: "Security",
    sub: "Password & account security",
    route: "/settings/security",
  },
  {
    icon: "shield",
    label: "Login Activity",
    sub: "View recent logins & suspicious access",
    route: "/settings/security-log",
  },
  {
    icon: "notifications",
    label: "Notifications",
    sub: "Manage your alerts",
    route: "/settings/notifications",
  },
  {
    icon: "help-circle",
    label: "Help & Support",
    sub: "FAQs, contact & feedback",
    route: "/settings/help",
  },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#0B6FAD" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.menuCard, { backgroundColor: "#FFFFFF", borderColor: "#D6E9F2" }]}>
          {SETTINGS.map((item, idx) => (
            <React.Fragment key={item.label}>
              <Pressable
                style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.iconBox, { backgroundColor: "#DCF7F4" }]}>
                  <Ionicons name={item.icon as any} size={18} color="#0B6FAD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0B6FAD" />
              </Pressable>
              {idx < SETTINGS.length - 1 && (
                <View style={[styles.divider, { backgroundColor: "#D6E9F2" }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>MAKERSFLOW v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  menuCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden", marginBottom: 20 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15, fontFamily: "Fredoka_600SemiBold" },
  menuSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: 1, marginLeft: 70 },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular" },
});
