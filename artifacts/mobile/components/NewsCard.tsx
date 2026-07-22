import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NewsItem } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { getOptimizedImageUrl } from "@/lib/thumbnailUtils";
import { TEXT_STYLES } from "@/constants/typography";

interface NewsCardProps {
  item: NewsItem;
  featured?: boolean;
}

export const NewsCard = React.memo(function NewsCard({ item, featured = false }: NewsCardProps) {
  const colors = useColors();

  const imageSource = typeof item.thumbnail === "string" ? { uri: item.thumbnail } : item.thumbnail;

  if (featured) {
    return (
      <LinearGradient
        colors={[colors.gradientStart || "#0B6FAD", colors.gradientEnd || "#17E5D3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featuredGradient}
      >
        <Pressable
          style={({ pressed }) => [
            styles.featuredCard,
            { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push({ pathname: "/news/[id]", params: { id: item.id } })}
        >
          <Image source={imageSource} style={styles.featuredImage} />
          <View style={styles.featuredOverlay}>
            <View style={[styles.categoryPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.categoryPillText, TEXT_STYLES.label, { color: colors.secondaryForeground }]}>
                {item.category}
              </Text>
            </View>
            <Text style={[styles.featuredTitle, TEXT_STYLES.cardTitle, { color: "#FFFFFF" }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.featuredMeta, TEXT_STYLES.meta]}>
                {item.author} · {item.date}
              </Text>
              <View style={styles.timeRow}>
                <Ionicons name="time" size={12} color="rgba(255,255,255,0.85)" style={{ marginRight: 3 }} />
                <Text style={[styles.featuredMeta, TEXT_STYLES.meta]}>{item.readTime}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </LinearGradient>
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
      <Image source={getOptimizedImageUrl(imageSource, { width: 500, height: 300 })} cachePolicy="memory-disk" contentFit="cover" transition={200} style={styles.thumbnail} />
      <View style={styles.content}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.categoryText, TEXT_STYLES.label, { color: colors.primary }]}>
            {item.category}
          </Text>
        </View>
        <Text style={[styles.title, TEXT_STYLES.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.summary, TEXT_STYLES.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, TEXT_STYLES.meta, { color: colors.mutedForeground }]}>
            {item.author} · {item.date}
          </Text>
          <View style={styles.timeRow}>
            <Ionicons name="time" size={12} color={colors.mutedForeground} style={{ marginRight: 3 }} />
            <Text style={[styles.meta, TEXT_STYLES.meta, { color: colors.mutedForeground }]}>{item.readTime}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  thumbnail: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },
  content: {
    padding: 16,
    gap: 8,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  meta: {
    fontSize: 11,
  },
  // Featured
  featuredGradient: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 16,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: "hidden",
    height: 220,
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  featuredTitle: {
    fontSize: 18,
    lineHeight: 24,
    flexShrink: 1,
  },
  featuredMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
});
