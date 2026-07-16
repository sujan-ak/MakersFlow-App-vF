import React, { useRef, useState, useCallback } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewsCard } from "@/components/NewsCard";
import { SearchBar } from "@/components/SearchBar";
import { fetchAllNews, type NewsArticle } from "@/services/newsService";
import { useColors } from "@/hooks/useColors";

import { TEXT_STYLES } from "@/constants/typography";

export default function NewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = useCallback(async () => {
    try {
      const data = await fetchAllNews();
      // Always mirror the server so admin-deleted articles disappear too.
      setNews(data);
    } catch (err) {
      console.error('[NewsScreen] Error loading news:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  // BUG FIX: news was fetched once per app launch (useEffect []), so articles
  // added or deleted in the admin panel never appeared/disappeared until the
  // app restarted. Refetch every time the tab gains focus + pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      loadNews();
    }, [loadNews])
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = news.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, TEXT_STYLES.pageTitle, { color: colors.foreground }]}>News</Text>
          <Pressable
            style={[styles.cartBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/store")}
          >
            <Ionicons name="cart" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search news..." />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNews();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results found</Text>
            </View>
          ) : (
            filtered.map((item) => <NewsCard key={item.id} item={item} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingBottom: 12 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  pageTitle: { fontSize: 26, fontWeight: "800" },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  list: { paddingHorizontal: 20, paddingTop: 16 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
