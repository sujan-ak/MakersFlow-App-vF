import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFavorites } from "@/context/FavoritesContext";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/context/CartContext";
import { Product } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { DetailSkeleton } from "@/components/SkeletonLoader";

const productFallbacks: Record<string, any[]> = {
  physical: [
    require('@/assets/images/product_kit_1.png'),
    require('@/assets/images/product_kit_2.png'),
    require('@/assets/images/product_kit_3.png'),
  ],
  digital: [
    require('@/assets/images/product_notes_1.png'),
    require('@/assets/images/product_notes_2.png'),
    require('@/assets/images/product_notes_3.png'),
  ]
};

function mapSupabaseProduct(row: any): Product {
  const isDigital = row.category?.toLowerCase() === 'digital' || 
                    row.subcategory?.toLowerCase() === 'notes' ||
                    row.subcategory?.toLowerCase() === 'question banks' ||
                    row.subcategory?.toLowerCase() === 'premium resources';
  const category = isDigital ? 'digital' : 'physical';
  
  let subcategory = row.subcategory;
  if (!subcategory) {
    subcategory = isDigital ? "Notes" : "Physical Kits";
  }

  let hash = 0;
  const idStr = String(row.id);
  for (let i = 0; i < idStr.length; i++) {
    hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);

  const thumbnail = row.thumbnail_url 
    ? { uri: row.thumbnail_url } 
    : (productFallbacks[category] || productFallbacks.physical)[index % 3];

  return {
    id: String(row.id),
    title: row.title || "Untitled Product",
    category,
    subcategory,
    price: Number(row.price) || 0,
    originalPrice: Number(row.original_price) || Number(row.price) || 0,
    thumbnail,
    description: row.description || "No description available.",
    rating: Number(row.rating) || 4.5,
    reviews: Number(row.total_reviews) || 0,
    inStock: row.in_stock === undefined ? true : Boolean(row.in_stock),
    badge: row.badge || undefined,
    features: Array.isArray(row.features) ? row.features : [],
  };
}

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToCart, items } = useCart();
  const { isProductInWishlist, toggleWishlistProduct } = useFavorites();

  const isWishlisted = isProductInWishlist(String(id));

  const handleToggleWishlist = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleWishlistProduct(String(id));
  };

  const handleShare = async () => {
    const link = `https://edodwaja.com/store/${id}`;
    const message = `Check out ${product?.title || "Product"} on Edodwaja! ${link}`;
    try {
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) {
        console.log('[ProductShare] Shared successfully');
      } else if (result.action === Share.dismissedAction) {
        console.log('[ProductShare] Share dismissed');
      }
    } catch (error: any) {
      console.error("[ProductShare] Share failed error:", error);
      Alert.alert(
        "Share Product",
        `Here is the product link to copy:\n${link}\n\n(Sharing is not supported on this device: ${error?.message || error})`
      );
    }
  };

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProduct = useCallback(async (isRefreshing = false) => {
    if (!id) return;
    if (!isRefreshing) {
      setIsLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[ProductDetail] Error loading product:', error);
        return;
      }

      if (data) {
        setProduct(mapSupabaseProduct(data));
      }
    } catch (err) {
      console.error('[ProductDetail] load error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct(false);
  }, [loadProduct]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProduct(true);
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 24 }}>Product not found.</Text>
      </View>
    );
  }

  const isInCart = items.some((i) => i.product.id === product.id);
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleAddToCart() {
    if (!product) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart(product);
    Alert.alert("Added to Cart", `${product.title} has been added to your cart.`, [
      { text: "Continue Shopping", style: "cancel" },
      { text: "Checkout", onPress: () => router.push("/store/checkout") },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.imageContainer}>
          <Image source={product.thumbnail} style={styles.image} />
          <View style={styles.overlay} />
          <Pressable
            style={[styles.backCircle, { top: topPad + 8 }]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/store");
              }
            }}
          >
            <Feather name="arrow-left" size={20} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.shareCircle, { top: topPad + 8 }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={20} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.heartCircle, { top: topPad + 8 }]}
            onPress={handleToggleWishlist}
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={20}
              color={isWishlisted ? "#EF4444" : "#FFF"}
            />
          </Pressable>
          {product.badge && (
            <View style={[styles.badge, { backgroundColor: colors.secondary, bottom: 16, left: 16 }]}>
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={[styles.subcategory, { color: colors.mutedForeground }]}>{product.subcategory}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{product.title}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.primary }]}>₹{product.price}</Text>
            <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>₹{product.originalPrice}</Text>
            <View style={[styles.discountBadge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.discountText, { color: "#16A34A" }]}>{discount}% off</Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Feather
                key={i}
                name="star"
                size={16}
                color={i <= Math.round(product.rating) ? "#F59E0B" : colors.border}
              />
            ))}
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
              {product.rating} ({product.reviews} reviews)
            </Text>
          </View>

          {/* Stock status */}
          <View style={styles.stockRow}>
            <Feather
              name={product.inStock ? "check-circle" : "x-circle"}
              size={14}
              color={product.inStock ? "#16A34A" : "#DC2626"}
            />
            <Text style={[styles.stockText, { color: product.inStock ? "#16A34A" : "#DC2626" }]}>
              {product.inStock ? "In Stock" : "Out of Stock"}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About this product</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{product.description}</Text>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What's included</Text>
          {product.features.map((feat, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.foreground }]}>{feat}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA */}
      <View
        style={[
          styles.cta,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: isInCart ? colors.muted : colors.primary }]}
          onPress={isInCart ? () => router.push("/store/checkout") : handleAddToCart}
          disabled={!product.inStock}
        >
          <Feather name={isInCart ? "shopping-cart" : "shopping-bag"} size={18} color={isInCart ? colors.primary : "#FFF"} />
          <Text style={[styles.ctaBtnText, { color: isInCart ? colors.primary : "#FFF" }]}>
            {isInCart ? "Go to Checkout" : "Add to Cart"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageContainer: { position: "relative", height: 280 },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },
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
  shareCircle: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heartCircle: {
    position: "absolute",
    right: 68,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { position: "absolute", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  content: { padding: 20, gap: 10 },
  subcategory: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  price: { fontSize: 26, fontWeight: "800" },
  originalPrice: { fontSize: 16, textDecorationLine: "line-through" },
  discountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  discountText: { fontSize: 12, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 13, marginLeft: 4 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stockText: { fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  description: { fontSize: 14, lineHeight: 22 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14 },
  cta: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaBtnText: { fontSize: 16, fontWeight: "700" },
});
