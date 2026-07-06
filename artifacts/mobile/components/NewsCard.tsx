import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NewsItem } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

interface NewsCardProps {
  item: NewsItem;
  featured?: boolean;
}

export function NewsCard({ item, featured = false }: NewsCardProps) {
  const colors = useColors();

  if (featured) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.featuredCard,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push({ pathname: "/news/[id]", params: { id: item.id } })}
      >
        <Image source={item.thumbnail} style={styles.featuredImage} />
        <View style={styles.featuredOverlay}>
          <View style={[styles.categoryPill, { backgroundColor: colors.secondary }]}>
            <Text style={styles.categoryPillText}>{item.category}</Text>
          </View>
          <Text style={styles.featuredTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.featuredMeta}>
            {item.author} · {item.readTime}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => router.push({ pathname: "/news/[id]", params: { id: item.id } })}
    >
      <Image source={item.thumbnail} style={styles.thumbnail} />
      <View style={styles.content}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.categoryText, { color: colors.primary }]}>{item.category}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.summary}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {item.author} · {item.date} · {item.readTime}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  thumbnail: {
    width: 100,
    height: 100,
    resizeMode: "cover",
  },
  content: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "600",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    flexShrink: 1,
  },
  summary: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  meta: {
    fontSize: 11,
    marginTop: 2,
  },
  // Featured
  featuredCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 16,
    width: 316,
    height: 200,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    position: "absolute",
  },
  featuredOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 8,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 20,
    flexShrink: 1,
  },
  featuredMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
  },
});
