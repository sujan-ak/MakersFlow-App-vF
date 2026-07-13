import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, Alert, Platform, Dimensions } from "react-native";
import { Product } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useRequireAuth } from "@/context/AuthRequireContext";

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
  const { isProductInWishlist, toggleWishlistProduct } = useFavorites();
  const { requireAuth } = useRequireAuth();
  const [isAdding, setIsAdding] = useState(false);
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const isWishlisted = isProductInWishlist(product.id);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating || 4.5);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= fullStars ? "star" : "star-outline"}
          size={11}
          color="#F59E0B"
        />
      );
    }
    return stars;
  };

  const handleToggleWishlist = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    requireAuth(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleWishlistProduct(product.id);
    });
  };

  const handleAddToCart = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isAdding) return;
    
    requireAuth(async () => {
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
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        gridMode && styles.gridCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
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
        
        {/* Wishlist heart top-right of image */}
        <Pressable
          style={styles.imageHeartBtn}
          onPress={handleToggleWishlist}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={16}
            color={isWishlisted ? "#EF4444" : "#9CA3AF"}
          />
        </Pressable>

        {/* Out of Stock overlay */}
        {!product.inStock && (
          <View style={styles.outOfStockOverlay}>
            <View style={styles.outOfStockPill}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={[styles.subcategory, { color: colors.mutedForeground }]}>{product.subcategory}</Text>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.ratingRow}>
          <View style={styles.starsContainer}>
            {renderStars(product.rating || 0)}
          </View>
          <Text style={[styles.reviews, { color: colors.mutedForeground }]}>
            {product.reviews > 0 ? `(${product.reviews})` : "(0)"}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceGroup}>
            <Text style={[styles.price, { color: "#0B6FAD" }]} numberOfLines={1}>
              ₹{product.price}
            </Text>
            {discount > 0 && (
              <Text style={[styles.originalPrice, { color: colors.mutedForeground }]} numberOfLines={1}>
                ₹{product.originalPrice}
              </Text>
            )}
          </View>
          
          {/* Add to Cart Pill button */}
          <Pressable
            style={[styles.addCartPillBtn, { opacity: product.inStock ? 1 : 0.5 }]}
            onPress={handleAddToCart}
            disabled={!product.inStock}
          >
            <Ionicons name="cart" size={12} color="#FFF" />
            <Text style={styles.addCartPillText}>Add</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E9F2",
    overflow: "hidden",
  },
  gridCard: {
    marginRight: 0,
    width: "100%",
  },
  imageContainer: {
    position: "relative",
    height: 120,
    width: "100%",
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
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
    fontFamily: "Fredoka_700Bold",
    color: "#FFFFFF",
  },
  imageHeartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockPill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    fontSize: 10,
    fontFamily: "Fredoka_700Bold",
    color: "#FFF",
  },
  content: {
    padding: 12,
    gap: 4,
  },
  subcategory: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontFamily: "Fredoka_600SemiBold",
    lineHeight: 18,
    height: 36,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  reviews: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Fredoka_700Bold",
  },
  originalPrice: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "line-through",
  },
  addCartPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#0B6FAD",
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  addCartPillText: {
    fontSize: 11,
    fontFamily: "Fredoka_600SemiBold",
    color: "#FFF",
  },
});
