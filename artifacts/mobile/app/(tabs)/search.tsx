import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CourseCard } from "@/components/CourseCard";
import { ProductCard } from "@/components/ProductCard";
import { ListSkeleton } from "@/components/SkeletonLoader";
import { fetchAllCourses } from "@/services/courseDataProvider";
import { useCart } from "@/context/CartContext";
import colors from "@/constants/colors";
import { supabase } from "@/lib/supabase";

const POPULAR_TOPICS = ["Robotics", "Arduino", "AI & ML", "IoT", "Python", "Electronics", "Circuits", "3D Printing"];

const CATEGORIES = [
  { emoji: "", name: "Robotics & Automation" },
  { emoji: "", name: "Artificial Intelligence" },
  { emoji: "", name: "Electronics & Circuits" },
  { emoji: "", name: "Programming" },
  { emoji: "", name: "IoT & Wireless" },
  { emoji: "", name: "Science & Innovation" },
  { emoji: "", name: "Engineering Basics" },
  { emoji: "", name: "Hardware & Kits" },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceTimeout = useRef<any>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function loadCourses() {
        try {
          const all = await fetchAllCourses();
          const mapped = all.map((c: any) => ({
            id: String(c.id),
            title: c.title,
            category: c.category || "General",
            level: c.level ? (c.level.charAt(0).toUpperCase() + c.level.slice(1)) : "Beginner",
            price: c.price || 0,
            isFree: c.is_free,
            thumbnail: c.thumbnail_url ? { uri: c.thumbnail_url } : require('@/assets/images/course_robotics.png'),
            instructor: "MakersFlow Instructor",
            rating: 4.8,
            reviews: 120,
            description: c.description || "",
            modules: []
          }));
          setCourses(mapped);

          // Also load real products
          const { data: prodData } = await supabase
            .from('products')
            .select('id, title, category, subcategory, price, original_price, thumbnail_url, in_stock, badge, status')
            .or('status.eq.available,status.eq.active');

          if (prodData) {
            const mappedProds = prodData.map((row: any) => {
              const isDigital = row.category?.toLowerCase() === 'digital' || 
                                row.subcategory?.toLowerCase() === 'notes';
              const category = isDigital ? 'digital' : 'physical';
              return {
                id: String(row.id),
                title: row.title || "Untitled Product",
                category,
                subcategory: row.subcategory || (isDigital ? "Notes" : "Physical Kits"),
                price: Number(row.price) || 0,
                originalPrice: Number(row.original_price) || Number(row.price) || 0,
                thumbnail: row.thumbnail_url 
                  ? { uri: row.thumbnail_url } 
                  : require('@/assets/images/product_kit_1.png'), // generic fallback
                inStock: row.in_stock === undefined ? true : Boolean(row.in_stock),
                badge: row.badge,
              };
            });
            setProducts(mappedProds);
          }
        } catch (err) {
          console.error('[Search] Error loading data:', err);
        } finally {
          setIsLoading(false);
        }
      }
      loadCourses();
    }, [])
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 300);
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [searchQuery]);

  const query = debouncedQuery;

  const filteredCourses = query
    ? courses.filter(
        (c) => 
          c.title.toLowerCase().includes(query) || 
          c.category.toLowerCase().includes(query) ||
          query.includes(c.category.toLowerCase())
      )
    : [];

  const filteredProducts = query
    ? products.filter((p) => {
        const lowerQuery = query.toLowerCase();
        const lowerTitle = p.title.toLowerCase();
        const lowerSubcategory = p.subcategory.toLowerCase();
        const lowerCategory = p.category.toLowerCase();
        
        // Direct matches
        if (lowerTitle.includes(lowerQuery) || 
            lowerSubcategory.includes(lowerQuery) ||
            lowerQuery.includes(lowerSubcategory)) {
          return true;
        }
        
        // Special handling for "Hardware & Kits" - match any kit or physical product
        if (lowerQuery.includes('hardware') || lowerQuery.includes('kits')) {
          if (lowerSubcategory.includes('kit') || lowerCategory === 'physical') {
            return true;
          }
        }
        
        return false;
      })
    : [];

  const hasResults = filteredCourses.length > 0 || filteredProducts.length > 0;

  const handleChipPress = (text: string) => {
    setSearchQuery(text);
    setDebouncedQuery(text.toLowerCase());
    inputRef.current?.blur();
  };

  const handleCategoryPress = (name: string) => {
    setSearchQuery(name);
    setDebouncedQuery(name.toLowerCase());
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    inputRef.current?.blur();
  };

  const handleCartPress = () => {
    router.push("/(tabs)/store");
  };

  const showIdle = !isFocused && !query;
  const showTyping = isFocused && !query;
  const showResults = query;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.light.background }}>
        <ListSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.light.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.light.background }]}>
        {showResults ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.light.foreground} />
          </Pressable>
        ) : null}
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          <Ionicons name="search" size={20} color={colors.light.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.light.foreground }]}
            placeholder="What do you want to learn?"
            placeholderTextColor={colors.light.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClear} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.light.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        {!showResults ? (
          <Pressable
            onPress={handleCartPress}
            hitSlop={8}
            style={{ position: "relative" }}
          >
            <Ionicons name="cart-outline" size={24} color={colors.light.foreground} />
            {count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{count}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {showIdle && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.light.foreground }]}>
                Popular with students
              </Text>
              <View style={styles.chipWrap}>
                {POPULAR_TOPICS.map((topic) => (
                  <Pressable
                    key={topic}
                    style={styles.chip}
                    onPress={() => handleChipPress(topic)}
                  >
                    <Text style={styles.chipText}>{topic}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.light.foreground }]}>
                Explore by subject
              </Text>
              {CATEGORIES.map((cat, idx) => (
                <Pressable
                  key={cat.name}
                  style={[styles.categoryRow, idx < CATEGORIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.light.border }]}
                  onPress={() => handleCategoryPress(cat.name)}
                >
                  <View style={styles.categoryLeft}>
                    <Text style={styles.emoji}>{cat.emoji}</Text>
                    <Text style={[styles.categoryName, { color: colors.light.foreground }]}>{cat.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.light.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {showTyping && (
          <View style={styles.hintContainer}>
            <Text style={[styles.hint, { color: colors.light.mutedForeground }]}>
              Searching in courses and products...
            </Text>
          </View>
        )}

        {showResults && !hasResults && (
          <View style={styles.empty}>
            <Ionicons name="search" size={64} color={colors.light.primary} style={{ opacity: 0.3 }} />
            <Text style={[styles.emptyTitle, { color: colors.light.foreground }]}>
              No results for '{searchQuery}'
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.light.mutedForeground }]}>
              Try Robotics, AI, or Electronics
            </Text>
            <Pressable
              style={[styles.browseBtn, { backgroundColor: colors.light.primary }]}
              onPress={() => router.push("/(tabs)/courses")}
            >
              <Text style={styles.browseBtnText}>Browse all courses</Text>
            </Pressable>
          </View>
        )}

        {showResults && hasResults && (
          <View style={styles.results}>
            {filteredCourses.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={[styles.resultTitle, { color: colors.light.secondary }]}>
                  Courses ({filteredCourses.length})
                </Text>
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} horizontal />
                ))}
              </View>
            )}

            {filteredProducts.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={[styles.resultTitle, { color: colors.light.secondary }]}>
                  Products ({filteredProducts.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.productsScroll}
                >
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchBarFocused: {
    borderColor: colors.light.primary,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  scroll: { flex: 1 },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: `${colors.light.primary}19`,
    borderWidth: 1,
    borderColor: colors.light.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.light.primary,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "700",
  },
  hintContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  hint: {
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  results: {
    paddingTop: 20,
    gap: 24,
  },
  resultSection: {
    gap: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 20,
  },
  productsScroll: {
    paddingHorizontal: 20,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
  },
});
