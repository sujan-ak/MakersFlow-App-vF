import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const FAQS = [
  { q: "How do I enroll in a course?", a: "Tap on any course, then tap 'Enroll Now' or 'Enroll for Free'. Free courses are instantly accessible." },
  { q: "Can I download course resources?", a: "Yes! Once enrolled, go to the learning screen and tap on the Resources tab to download PDFs and study material." },
  { q: "How do I track my progress?", a: "Your progress is tracked automatically as you complete modules. View it on the course detail page or your Profile." },
  { q: "What is the return policy for physical kits?", a: "Physical kits can be returned within 7 days of delivery if they are unused and in original packaging." },
  { q: "How do I access digital products after purchase?", a: "Digital products are available immediately in your Profile under 'My Orders'. You'll also receive an email with download links." },
];

export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Help & Support</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact options */}
        <View style={[styles.contactCard, { backgroundColor: colors.primary }]}>
          <View style={styles.contactRow}>
            <Feather name="mail" size={20} color="#FFF" />
            <View>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>support@makersflow.com</Text>
            </View>
          </View>
          <View style={[styles.contactDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
          <View style={styles.contactRow}>
            <Feather name="phone" size={20} color="#FFF" />
            <View>
              <Text style={styles.contactLabel}>Phone Support</Text>
              <Text style={styles.contactValue}>+91 98765 43210</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.faqTitle, { color: colors.foreground }]}>Frequently Asked Questions</Text>

        {FAQS.map((faq, idx) => (
          <Pressable
            key={idx}
            style={[styles.faqItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setExpanded(expanded === idx ? null : idx)}
          >
            <View style={styles.faqHeader}>
              <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{faq.q}</Text>
              <Feather
                name={expanded === idx ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.mutedForeground}
              />
            </View>
            {expanded === idx && (
              <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{faq.a}</Text>
            )}
          </Pressable>
        ))}
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
  headerTitle: { fontSize: 18, fontWeight: "700" },
  contactCard: { borderRadius: 16, padding: 20, gap: 12 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  contactLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  contactValue: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  contactDivider: { height: 1 },
  faqTitle: { fontSize: 18, fontWeight: "700" },
  faqItem: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  faqHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  faqQ: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  faqA: { fontSize: 14, lineHeight: 20 },
});
