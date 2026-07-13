import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CourseCard } from "@/components/CourseCard";
import { ProductCard } from "@/components/ProductCard";
import { ListSkeleton } from "@/components/SkeletonLoader";
import { fetchAllCourses } from "@/services/courseDataProvider";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import ThemeColors from "@/constants/colors";
import { supabase } from "@/lib/supabase";

const POPULAR_TOPICS = ["Robotics", "Arduino", "AI & ML", "IoT", "Python", "Electronics", "Circuits", "3D Printing"];

const COURSE_FALLBACKS = [
  require('@/assets/images/course_robotics.png'),
  require('@/assets/images/course_ai.png'),
  require('@/assets/images/course_electronics.png'),
];

const PRODUCT_FALLBACKS: Record<string, any[]> = {
  physical: [
    require('@/assets/images/product_kit_1.png'),
    require('@/assets/images/product_kit_2.png'),
    require('@/assets/images/product_kit_3.png'),
  ],
  digital: [
    require('@/assets/images/product_notes_1.png'),
    require('@/assets/images/product_notes_2.png'),
    require('@/assets/images/product_notes_3.png'),
  ],
};

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const params = useLocalSearchParams<{ query?: string; category?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceTimeout = useRef<any>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.query !== undefined) {
      setSearchQuery(params.query);
      setDebouncedQuery(params.query.trim().toLowerCase());
    } else if (params.category !== undefined) {
      setSearchQuery(params.category);
      setDebouncedQuery(params.category.trim().toLowerCase());
    }
  }, [params.query, params.category]);

  useFocusEffect(
    useCallback(() => {
      async function loadCourses() {
        try {
          const all = await fetchAllCourses();
          const mapped = all.map((c: any, idx: number) => ({
            id: String(c.id),
            title: c.title,
            category: c.category || "General",
            instructor: (c.profiles as any)?.full_name ?? "MakersFlow Instructor",
            level: c.level ? (c.level.charAt(0).toUpperCase() + c.level.slice(1)) : "Beginner",
            price: Number(c.price) || 0,
            isFree: Boolean(c.is_free),
            thumbnail: c.thumbnail_url 
              ? { uri: c.thumbnail_url } 
              : COURSE_FALLBACKS[idx % COURSE_FALLBACKS.length],
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
                  : (PRODUCT_FALLBACKS[category] || PRODUCT_FALLBACKS.physical)[Number(row.id) % 3],
                inStock: row.in_stock === undefined ? true : Boolean(row.in_stock),
                badge: row.badge,
                rating: Number(row.rating) || 0,
                reviews: Number(row.total_reviews) || 0,
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ListSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        {showResults ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
        ) : null}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: isFocused ? colors.primary : colors.border }]}>
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="What do you want to learn?"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClear} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        {!showResults ? (
          <Pressable
            onPress={handleCartPress}
            hitSlop={8}
            style={{ position: "relative" }}
          >
            <Ionicons name="cart" size={24} color={colors.foreground} />
            {count > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.primary }]}>
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
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Popular with students
              </Text>
              <View style={styles.chipWrap}>
                {POPULAR_TOPICS.map((topic) => (
                  <Pressable
                    key={topic}
                    style={[styles.chip, { backgroundColor: `${colors.primary}19`, borderColor: colors.primary }]}
                    onPress={() => handleChipPress(topic)}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>{topic}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Explore by subject
              </Text>
              {CATEGORIES.map((cat, idx) => (
                <Pressable
                  key={cat.name}
                  style={[styles.categoryRow, idx < CATEGORIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => handleCategoryPress(cat.name)}
                >
                  <View style={styles.categoryLeft}>
                    <Text style={styles.emoji}>{cat.emoji}</Text>
                    <Text style={[styles.categoryName, { color: colors.foreground }]}>{cat.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {showTyping && (
          <View style={styles.hintContainer}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Searching in courses and products...
            </Text>
          </View>
        )}

        {showResults && !hasResults && (
          <View style={styles.empty}>
            <View style={[styles.emptyIconCircle, { backgroundColor: "#DCF7F4" }]}>
              <Ionicons name="search" size={40} color="#0B6FAD" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No results for '{searchQuery}'
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Try Robotics, AI, or Electronics
            </Text>
            <Pressable
              style={[styles.browseBtn, { backgroundColor: colors.primary }]}
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
                <Text style={[styles.resultTitle, { color: colors.secondary }]}>
                  Courses ({filteredCourses.length})
                </Text>
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} horizontal />
                ))}
              </View>
            )}

            {filteredProducts.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={[styles.resultTitle, { color: colors.secondary }]}>
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
    borderColor: ThemeColors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchBarFocused: {
    borderColor: ThemeColors.light.primary,
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
    backgroundColor: `${ThemeColors.light.primary}19`,
    borderWidth: 1,
    borderColor: ThemeColors.light.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: ThemeColors.light.primary,
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
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCF7F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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
    backgroundColor: ThemeColors.light.primary,
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
