import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  FlatList,
  Alert,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { SectionHeader } from "@/components/SectionHeader";
import { ProductCardSkeleton } from "@/components/SkeletonLoader";
import { useCart } from "@/context/CartContext";
import { STORE_CATEGORIES, Product } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

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

function mapSupabaseProduct(row: any, index: number): Product {
  const isDigital = row.category?.toLowerCase() === 'digital' || 
                    row.subcategory?.toLowerCase() === 'notes' ||
                    row.subcategory?.toLowerCase() === 'question banks' ||
                    row.subcategory?.toLowerCase() === 'premium resources';
  const category = isDigital ? 'digital' : 'physical';
  
  let subcategory = row.subcategory;
  if (!subcategory) {
    subcategory = isDigital ? "Notes" : "Physical Kits";
  }

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

export default function StoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { count } = useCart();

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out Edodwaja Store on Edodwaja! https://edodwaja.com/store`,
      });
    } catch (error) {
      console.error("Error sharing store:", error);
    }
  };
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function loadProducts() {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, title, slug, description, price, original_price, category, subcategory, thumbnail_url, in_stock, status')
            .or('status.eq.available,status.eq.active');

          if (error) {
            console.error('[Store] Error loading products:', error);
            return;
          }

          if (data) {
            const mapped = data.map((row, idx) => mapSupabaseProduct(row, idx));
            setProducts(mapped);
          }
        } catch (err) {
          console.error('[Store] load error:', err);
        } finally {
          setIsLoading(false);
        }
      }
      loadProducts();
    }, [])
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const physicalProducts = products.filter((p) => p.category === "physical");
  const digitalProducts = products.filter((p) => p.category === "digital");

  const filtered = products.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      activeCategory === "All" ||
      (activeCategory === "Physical Kits" && p.category === "physical") ||
      (["Notes", "Question Banks", "Premium Resources"].includes(activeCategory) && p.subcategory === activeCategory);
    return matchSearch && matchCat;
  });

  const handleAddedToCart = () => {
    if (Platform.OS === "web") {
      Alert.alert("Added to cart", "Item has been added to your cart");
    }
  };

  const handleCartPress = () => {
    router.push("/store/checkout");
  };

  const handleClearSearch = () => {
    setSearch("");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Store</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleShare}
            >
              <Feather name="share-2" size={20} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.cartBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleCartPress}
            >
              <Feather name="shopping-bag" size={20} color={colors.foreground} />
              {count > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.cartBadgeText}>{count}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search products..." />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {STORE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.chip,
                {
                  backgroundColor: activeCategory === cat ? colors.primary : colors.card,
                  borderColor: activeCategory === cat ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.chipText, { color: activeCategory === cat ? "#FFF" : colors.foreground }]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <>
            <View style={styles.section}>
              <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <ProductCardSkeleton />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                <ProductCardSkeleton />
                <ProductCardSkeleton />
                <ProductCardSkeleton />
              </ScrollView>
            </View>
          </>
        ) : products.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No products available</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Check back later for new kits and resources!
            </Text>
          </View>
        ) : search || activeCategory !== "All" ? (
          filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="search" size={40} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No products found</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Try adjusting your search or filters
              </Text>
              {search && (
                <Pressable
                  style={[styles.clearBtn, { backgroundColor: colors.primary }]}
                  onPress={handleClearSearch}
                >
                  <Text style={styles.clearBtnText}>Clear Search</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>{filtered.length} products found</Text>
              <View style={styles.gridContainer}>
                {filtered.map((p) => (
                  <View key={p.id} style={styles.gridItem}>
                    <ProductCard product={p} onAddedToCart={handleAddedToCart} gridMode />
                  </View>
                ))}
              </View>
            </View>
          )
        ) : (
          <>
            {physicalProducts.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Physical Kits" />
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                >
                  {physicalProducts.map((p) => <ProductCard key={p.id} product={p} onAddedToCart={handleAddedToCart} />)}
                </ScrollView>
              </View>
            )}
            {digitalProducts.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Digital Resources" />
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                >
                  {digitalProducts.map((p) => <ProductCard key={p.id} product={p} onAddedToCart={handleAddedToCart} />)}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
  categories: { paddingHorizontal: 20, gap: 8, paddingTop: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  section: { paddingTop: 20, marginBottom: 24 },
  count: { fontSize: 13, marginBottom: 12, paddingHorizontal: 20 },
  carouselContent: { paddingLeft: 20, paddingRight: 20 },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  gridItem: {
    width: "48%",
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  clearBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
});
