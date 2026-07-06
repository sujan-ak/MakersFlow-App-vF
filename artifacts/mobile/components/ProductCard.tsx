import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, Alert, Platform, Dimensions } from "react-native";
import { Product } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface ProductCardProps {
  product: Product;
  onAddedToCart?: () => void;
  gridMode?: boolean;
}

export function ProductCard({ product, onAddedToCart, gridMode = false }: ProductCardProps) {
  const colors = useColors();
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

  const handleAddToCart = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isAdding) return;
    
    setIsAdding(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart(product);
    
    if (onAddedToCart) {
      onAddedToCart();
    }
    
    if (Platform.OS !== "web") {
      Alert.alert("Added to cart", `${product.title} has been added to your cart`);
    }
    
    setTimeout(() => setIsAdding(false), 500);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        gridMode && styles.gridCard,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={() => router.push({ pathname: "/store/[id]", params: { id: product.id } })}
    >
      <View style={styles.imageContainer}>
        <Image source={product.thumbnail} style={styles.thumbnail} />
        {product.badge && (
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        )}
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: product.category === "physical" ? colors.accent : colors.muted },
          ]}
        >
          <Feather
            name={product.category === "physical" ? "package" : "file-text"}
            size={12}
            color={product.category === "physical" ? colors.primary : colors.mutedForeground}
          />
        </View>
      </View>
      <View style={styles.content}>
        <Text style={[styles.subcategory, { color: colors.mutedForeground }]}>{product.subcategory}</Text>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.ratingRow}>
          <Feather name="star" size={11} color="#F59E0B" />
          <Text style={[styles.rating, { color: colors.mutedForeground }]}> {product.rating}</Text>
          <Text style={[styles.reviews, { color: colors.mutedForeground }]}> ({product.reviews})</Text>
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceGroup}>
            <Text style={[styles.price, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              ₹{product.price}
            </Text>
            <Text style={[styles.originalPrice, { color: colors.mutedForeground }]} numberOfLines={1}>
              ₹{product.originalPrice}
            </Text>
          </View>
          <Pressable
            style={[styles.addToCartBtn, { backgroundColor: colors.secondary }]}
            onPress={handleAddToCart}
          >
            <Feather name="shopping-cart" size={16} color="#FFF" />
          </Pressable>
        </View>
        {discount > 0 && (
          <View style={[styles.discountBadge, { backgroundColor: "#DCFCE7" }]}>
            <Text style={[styles.discountText, { color: "#16A34A" }]}>{discount}% off</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 16,
  },
  gridCard: {
    marginRight: 0,
    width: "100%",
  },
  imageContainer: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  categoryIcon: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 12,
    gap: 4,
  },
  subcategory: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    minHeight: 38,
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    fontSize: 11,
  },
  reviews: {
    fontSize: 11,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  priceGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 0,
    maxWidth: 80,
  },
  originalPrice: {
    fontSize: 11,
    textDecorationLine: "line-through",
    flexShrink: 1,
  },
  discountBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  discountText: {
    fontSize: 9,
    fontWeight: "600",
  },
  addToCartBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
