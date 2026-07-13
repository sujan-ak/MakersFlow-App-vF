import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ANNOUNCEMENTS_LAST_SEEN_KEY = "announcements_last_seen";

type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  isAnnouncement?: boolean;
};

const TYPE_ICON: Record<string, string> = {
  course: "book",
  order: "cart",
  offer: "pricetag",
  system: "information-circle",
  announcement: "megaphone",
  info: "information-circle",
  warning: "warning",
  success: "checkmark-circle",
};

const TYPE_BG: Record<string, string> = {
  course: "#E8F4F9",
  order: "#FFFBEB",
  offer: "#FDF2F8",
  system: "#F0FDF4",
  announcement: "#DCF7F4",
  info: "#F0FDF4",
  warning: "#FEF2F2",
  success: "#F0FDF4",
};

const TYPE_COLOR: Record<string, string> = {
  course: "#0B6FAD",
  order: "#F59E0B",
  offer: "#EC4899",
  system: "#10B981",
  announcement: "#0B6FAD",
  info: "#10B981",
  warning: "#EF4444",
  success: "#10B981",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const lastSeen = await AsyncStorage.getItem(ANNOUNCEMENTS_LAST_SEEN_KEY);

      const [personal, broadcast] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, title, body, type, link, is_read, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("announcements")
          .select("id, title, message, type, link_url, created_at")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const personalItems: AppNotification[] = (personal.data ?? []) as AppNotification[];
      const broadcastItems: AppNotification[] = (broadcast.data ?? []).map((a: any) => ({
        id: `ann-${a.id}`,
        title: a.title,
        body: a.message,
        type: a.type ?? "announcement",
        link: a.link_url,
        created_at: a.created_at,
        isAnnouncement: true,
        is_read: lastSeen ? new Date(a.created_at) <= new Date(lastSeen) : false,
      }));

      const merged = [...personalItems, ...broadcastItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setItems(merged);

      await AsyncStorage.setItem(ANNOUNCEMENTS_LAST_SEEN_KEY, new Date().toISOString());
    } catch (e) {
      if (__DEV__) console.error("[Notifications] load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function markRead(n: AppNotification) {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    if (!n.isAnnouncement) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
  }

  async function markAllRead() {
    if (!user?.id) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
  }

  async function handlePress(n: AppNotification) {
    if (!n.is_read) await markRead(n);
    if (n.link) {
      try {
        router.push(n.link as any);
      } catch {
        // invalid link
      }
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={[styles.iconBtn, { backgroundColor: "#FFFFFF", borderColor: "#D6E9F2" }]}
        >
          <Ionicons name="arrow-back" size={20} color="#0B6FAD" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={[styles.markAll, { color: "#0B6FAD" }]}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0B6FAD" size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: "#DCF7F4" }]}>
            <Ionicons name="notifications-off" size={40} color="#0B6FAD" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Course updates, offers and order updates will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              colors={['#0B6FAD']}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              style={[
                styles.card,
                {
                  backgroundColor: item.is_read ? colors.card : "#DCF7F4",
                  borderColor: "#D6E9F2",
                },
              ]}
            >
              <View style={[
                styles.typeIcon,
                {
                  backgroundColor: TYPE_BG[item.type ?? "system"] ?? "#E8F4F9",
                }
              ]}>
                <Ionicons
                  name={(TYPE_ICON[item.type ?? "system"] ?? "notifications") as any}
                  size={16}
                  color={TYPE_COLOR[item.type ?? "system"] ?? "#0B6FAD"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTopRow}>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: colors.foreground,
                        fontFamily: item.is_read ? "Inter_400Regular" : "Fredoka_600SemiBold",
                        fontWeight: item.is_read ? "500" : "700",
                      }
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: "#0B6FAD" }]} />}
                </View>
                {!!item.body && (
                  <Text style={[styles.cardBody, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {item.body}
                  </Text>
                )}
                <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>{timeAgo(item.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  headerTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  markAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Fredoka_700Bold", marginBottom: 6 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  card: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 3 },
  cardTime: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 6 },
});
