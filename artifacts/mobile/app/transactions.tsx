import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContextSupabase";
import { supabase } from "@/lib/supabase";

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async (isRefreshing = false) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    if (!isRefreshing) {
      setIsLoading(true);
    }
    try {
      // Fetch only completed or paid orders
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["paid", "completed"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Transactions] Error fetching transactions:", error);
        return;
      }

      if (data) {
        const mapped = data.map((order: any) => {
          let itemsList: any[] = [];
          try {
            itemsList = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
          } catch (e) {
            itemsList = Array.isArray(order.items) ? order.items : [];
          }

          const dateObj = new Date(order.created_at);
          const dateStr = dateObj.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return {
            id: String(order.id),
            date: dateStr,
            items: itemsList.map((i: any) => i.title || "Untitled Product").join(", "),
            total: Number(order.total_amount) || 0,
            status: order.status,
            created_at: order.created_at,
          };
        });
        setTransactions(mapped);
      }
    } catch (err) {
      console.error("[Transactions] Load error:", err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions(true);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const totalSpent = transactions.reduce((sum, t) => sum + t.total, 0);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Loading transactions...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryLeft}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>₹{totalSpent.toLocaleString("en-IN")}</Text>
          </View>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent }]}>
            <Ionicons name="receipt-outline" size={24} color={colors.primary} />
          </View>
        </View>
      </View>

      {/* Transactions List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="credit-card" size={48} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No completed payments</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Transactions will appear here once you complete a purchase.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.transactionId, { color: colors.mutedForeground }]}>
                  TXN ID: #{item.id}
                </Text>
                <Text style={[styles.transactionDate, { color: colors.mutedForeground }]}>
                  {item.date}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: "#DCFCE7" }]}>
                <Text style={[styles.statusText, { color: "#16A34A" }]}>
                  {item.status ? item.status.toUpperCase() : "PAID"}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.cardBody}>
              <Text style={[styles.itemsLabel, { color: colors.mutedForeground }]}>Purchased Items</Text>
              <Text style={[styles.itemsValue, { color: colors.foreground }]} numberOfLines={2}>
                {item.items || "MakersFlow Kit/Resource"}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.cardFooter}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>Amount Paid</Text>
              <Text style={[styles.amountValue, { color: colors.primary }]}>
                ₹{item.total.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "500" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  summaryContainer: { paddingHorizontal: 16, paddingTop: 16 },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryLeft: { gap: 4 },
  summaryLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 16, gap: 16 },
  transactionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  transactionId: { fontSize: 11, fontWeight: "600" },
  transactionDate: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  divider: { height: 1 },
  cardBody: { gap: 4 },
  itemsLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  itemsValue: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amountLabel: { fontSize: 13, fontWeight: "600" },
  amountValue: { fontSize: 18, fontWeight: "800" },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
