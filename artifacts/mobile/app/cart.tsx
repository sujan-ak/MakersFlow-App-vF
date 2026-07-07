import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, addToCart, removeFromCart, decrementQuantity, total, count } = useCart();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Shopping Cart</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Cart Items List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="shopping-cart" size={64} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Add physical kits or learning resources to your cart to begin.
            </Text>
            <Pressable
              style={[styles.browseBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/store")}
            >
              <Text style={styles.browseBtnText}>Go to Store</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const discount = Math.round(((item.product.originalPrice - item.product.price) / item.product.originalPrice) * 100);
          return (
            <View style={[styles.cartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Image source={item.product.thumbnail} style={styles.thumbnail} />
              
              <View style={styles.cardInfo}>
                <Text style={[styles.subcategory, { color: colors.mutedForeground }]}>
                  {item.product.subcategory}
                </Text>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
                  {item.product.title}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.primary }]}>
                    ₹{item.product.price}
                  </Text>
                  {discount > 0 && (
                    <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
                      ₹{item.product.originalPrice}
                    </Text>
                  )}
                </View>

                {/* Quantity Controls */}
                <View style={styles.controlsRow}>
                  <View style={[styles.quantityBox, { borderColor: colors.border }]}>
                    <Pressable
                      style={styles.controlBtn}
                      onPress={() => decrementQuantity(item.product.id)}
                    >
                      <Feather name="minus" size={14} color={colors.foreground} />
                    </Pressable>
                    <Text style={[styles.quantityText, { color: colors.foreground }]}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      style={styles.controlBtn}
                      onPress={() => addToCart(item.product)}
                    >
                      <Feather name="plus" size={14} color={colors.foreground} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeFromCart(item.product.id)}
                  >
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Checkout Footer */}
      {items.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.totalRow}>
            <View>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total Amount</Text>
              <Text style={[styles.totalCount, { color: colors.mutedForeground }]}>{count} items</Text>
            </View>
            <Text style={[styles.totalPrice, { color: colors.foreground }]}>₹{total.toLocaleString("en-IN")}</Text>
          </View>

          <Pressable
            style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/store/checkout")}
          >
            <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </Pressable>
        </View>
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
  listContent: { padding: 16, gap: 16 },
  cartCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  thumbnail: {
    width: 90,
    height: 90,
    borderRadius: 12,
    resizeMode: "cover",
  },
  cardInfo: { flex: 1, gap: 4 },
  subcategory: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  price: { fontSize: 15, fontWeight: "800" },
  originalPrice: { fontSize: 12, textDecorationLine: "line-through" },
  controlsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  quantityBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  controlBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  removeBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 120,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  browseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  browseBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: { fontSize: 14, fontWeight: "600" },
  totalCount: { fontSize: 11, marginTop: 2 },
  totalPrice: { fontSize: 22, fontWeight: "800" },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkoutBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
