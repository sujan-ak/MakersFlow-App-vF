import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchNewsById, type NewsArticle } from "@/services/newsService";
import { useColors } from "@/hooks/useColors";

export default function NewsDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadArticle() {
      if (!id) return;
      try {
        const article = await fetchNewsById(id);
        setItem(article);
      } catch (err) {
        console.error('[NewsDetailScreen] Error loading article:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadArticle();
  }, [id]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 24 }}>Article not found.</Text>
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
      >
        <View style={styles.imageContainer}>
          <Image source={item.thumbnail} style={styles.image} />
          <View style={styles.overlay} />
          <Pressable
            style={[styles.backCircle, { top: topPad + 8 }]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/news");
              }
            }}
          >
            <Feather name="arrow-left" size={20} color="#FFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>{item.category}</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>

          <View style={styles.metaRow}>
            <Feather name="user" size={13} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.author}</Text>
            <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
            <Feather name="calendar" size={13} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.date}</Text>
            <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.readTime}</Text>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: colors.accent, borderLeftColor: colors.primary }]}>
            <Text style={[styles.summaryText, { color: colors.primary }]}>{item.summary}</Text>
          </View>

          <Text style={[styles.body, { color: colors.foreground }]}>{item.content}</Text>

          <View style={styles.tags}>
            {item.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagText, { color: colors.mutedForeground }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageContainer: { position: "relative", height: 260 },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  backCircle: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, gap: 12 },
  categoryBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", lineHeight: 30 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  meta: { fontSize: 12 },
  metaDot: { fontSize: 12 },
  summaryBox: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 10, borderRadius: 4 },
  summaryText: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 26 },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 12 },
});
