import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
          <Ionicons name="arrow-back" size={22} color="#0B6FAD" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Shopping Cart</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Cart Items List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 140 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cart" size={40} color="#0B6FAD" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Add physical kits or learning resources to your cart to begin.
            </Text>
            <Pressable
              style={styles.browseBtn}
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
                  <Text style={[styles.price, { color: "#0B6FAD" }]}>
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
                  <View style={styles.circleStepperContainer}>
                    <Pressable
                      style={styles.circleStepBtn}
                      onPress={() => decrementQuantity(item.product.id)}
                    >
                      <Ionicons name="remove" size={12} color="#FFF" />
                    </Pressable>
                    <Text style={[styles.quantityText, { color: colors.foreground }]}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      style={styles.circleStepBtn}
                      onPress={() => addToCart(item.product)}
                    >
                      <Ionicons name="add" size={12} color="#FFF" />
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeFromCart(item.product.id)}
                  >
                    <Ionicons name="trash" size={18} color="#EF4444" />
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
            <Text style={[styles.totalPrice, { color: "#0B6FAD" }]}>₹{total.toLocaleString("en-IN")}</Text>
          </View>

          <Pressable
            style={{ width: "100%", height: 56 }}
            onPress={() => router.push("/store/checkout")}
          >
            <LinearGradient
              colors={["#0B6FAD", "#17E5D3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.checkoutGradientBtn}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" style={{ marginLeft: 6 }} />
            </LinearGradient>
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
  headerTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  listContent: { padding: 16, gap: 16 },
  cartCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1.5,
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
  subcategory: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 14, fontFamily: "Fredoka_600SemiBold", lineHeight: 20 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  price: { fontSize: 15, fontFamily: "Fredoka_700Bold" },
  originalPrice: { fontSize: 12, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  controlsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  circleStepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  circleStepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0B6FAD",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  removeBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCF7F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  browseBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0B6FAD",
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  browseBtnText: { fontSize: 14, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
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
  totalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  totalCount: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  totalPrice: { fontSize: 22, fontFamily: "Fredoka_700Bold" },
  checkoutGradientBtn: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtnText: { fontSize: 16, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
});
