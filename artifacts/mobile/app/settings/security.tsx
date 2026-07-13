import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function SecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [biometric, setBiometric] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#0B6FAD" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Security</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: "#D6E9F2" }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: "#DCF7F4" }]}>
              <Ionicons name="phone-portrait" size={18} color="#0B6FAD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Biometric Login</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Use fingerprint or Face ID</Text>
            </View>
            <Switch
              value={biometric}
              onValueChange={setBiometric}
              trackColor={{ true: "#0B6FAD", false: "#D6E9F2" }}
              thumbColor="#FFF"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: "#D6E9F2" }]} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: "#DCF7F4" }]}>
              <Ionicons name="shield" size={18} color="#0B6FAD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Two-Factor Auth</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Extra layer of security</Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={setTwoFactor}
              trackColor={{ true: "#0B6FAD", false: "#D6E9F2" }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        <Pressable
          style={[styles.changePasswordBtn, { backgroundColor: colors.card, borderColor: "#D6E9F2" }]}
        >
          <Ionicons name="lock-closed" size={18} color="#0B6FAD" />
          <Text style={[styles.changePasswordText, { color: colors.foreground }]}>Change Password</Text>
          <Ionicons name="chevron-forward" size={18} color="#0B6FAD" />
        </Pressable>
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
  card: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontFamily: "Fredoka_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: 1, marginLeft: 70 },
  changePasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  changePasswordText: { flex: 1, fontSize: 15, fontFamily: "Fredoka_600SemiBold" },
});
