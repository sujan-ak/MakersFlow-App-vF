import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
  FlatList,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const SNAP_INTERVAL = CARD_WIDTH + 16;
import { CourseCard } from "@/components/CourseCard";
import { SectionHeader } from "@/components/SectionHeader";
import { WatchlistCard } from "@/components/WatchlistCard";
import { LearningStreak } from "@/components/LearningStreak";
import { ProductCard } from "@/components/ProductCard";
import { HomeSkeleton } from "@/components/SkeletonLoader";
import { useAuth } from "@/context/AuthContextSupabase";
import { supabase } from "@/lib/supabase";
import { Product } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useProgress } from "@/context/ProgressContext";
import { fetchAllCourses } from "@/services/courseDataProvider";
import { fetchEnrolledCourses } from "@/services/enrollmentService";
import { fetchCourseProgress } from "@/lib/progressStorage";
import { ProgressCalculator } from "@/lib/progressCalculator";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { watchlist } = useProgress();

  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [popularKits, setPopularKits] = useState<Product[]>([]);
  const [learningStreak, setLearningStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerFlatListRef = useRef<any>(null);
  const { refreshProgress } = useProgress();

  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          // Sync global progress context
          await refreshProgress().catch(() => {});

          // Fetch promotions
          try {
            const { data: promoData, error: promoError } = await supabase
              .from('promotions')
              .select('*')
              .eq('is_active', true)
              .order('created_at', { ascending: false });
            // BUG FIX (promotions add/delete not reflected):
            // Previously setPromotions was only called when the query succeeded
            // AND returned data, so after an admin deleted/deactivated banners
            // (or the query errored) the OLD banners stayed on screen forever.
            // Now the state always mirrors the latest fetch result.
            if (promoError) {
              console.error("Failed to load promotions:", promoError);
              setPromotions([]);
            } else {
              const now = new Date().getTime();
              const activePromos = (promoData ?? []).filter(p => !p.expires_at || new Date(p.expires_at).getTime() > now);
              setPromotions(activePromos);
            }
          } catch (e) {
            console.error("Failed to load promotions:", e);
            setPromotions([]);
          }

          // Unread notifications badge (per-user rows + new admin broadcasts)
          if (user?.id) {
            try {
              const lastSeen = await AsyncStorage.getItem("announcements_last_seen");
              const [{ count: personalCount }, broadcast] = await Promise.all([
                supabase
                  .from("notifications")
                  .select("id", { count: "exact", head: true })
                  .eq("user_id", user.id)
                  .eq("is_read", false),
                supabase
                  .from("announcements")
                  .select("id", { count: "exact", head: true })
                  .eq("status", "published")
                  .gt("created_at", lastSeen ?? "1970-01-01"),
              ]);
              setUnreadNotifCount((personalCount ?? 0) + (broadcast.count ?? 0));
            } catch {
              // tables may not exist yet — badge just stays hidden
            }
          }

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

          if (user?.id) {
            const enrollments = await fetchEnrolledCourses(user.id);
            const mappedEnrolled = await Promise.all(
              // Defensive: skip enrollments whose course was deleted/unpublished
              // (null join) so one bad row can't blank the whole section.
              enrollments.filter((enr: any) => enr.courses).map(async (enr: any) => {
                const c = enr.courses;
                const prog = await fetchCourseProgress(user.id, String(c.id));
                return {
                  progress: prog.percentage,
                };
              })
            );
            setEnrolledCourses(mappedEnrolled);

            // Fetch lesson progress for calculating real streak
            const { data: lpData } = await supabase
              .from('lesson_progress')
              .select('last_watched_at')
              .eq('user_id', user.id);
            if (lpData) {
              const streak = ProgressCalculator.calculateStreak(lpData);
              setLearningStreak(streak);
            }
          }

          // Fetch real kits from Supabase
          const { data: kitData, error: kitError } = await supabase
            .from('products')
            .select('id, title, description, price, original_price, category, subcategory, thumbnail_url, in_stock, badge')
            .or('status.eq.available,status.eq.active')
            .neq('category', 'digital')
            .limit(5);

          if (!kitError && kitData) {
            const kitFallbacks = [
              require('@/assets/images/product_kit_1.png'),
              require('@/assets/images/product_kit_2.png'),
              require('@/assets/images/product_kit_3.png'),
            ];
            const mappedKits: Product[] = kitData.map((row: any, idx: number) => ({
              id: String(row.id),
              title: row.title || "Untitled Product",
              category: 'physical',
              subcategory: row.subcategory || "Physical Kits",
              price: Number(row.price) || 0,
              originalPrice: Number(row.original_price) || Number(row.price) || 0,
              thumbnail: row.thumbnail_url ? { uri: row.thumbnail_url } : kitFallbacks[idx % 3],
              description: row.description || "No description available.",
              rating: 4.5,
              reviews: 0,
              inStock: row.in_stock === undefined ? true : Boolean(row.in_stock),
              badge: row.badge || undefined,
              features: [],
            }));
            setPopularKits(mappedKits);
          }
        } catch (err) {
          console.error('[Home] Error fetching courses:', err);
        } finally {
          setIsLoading(false);
        }
      }
      loadData();
    }, [user?.id])
  );

  // BUG FIX: when the promotions list shrinks (admin deleted/deactivated a
  // banner), the carousel could be left scrolled past the end of the new list
  // — showing a blank banner — and the active dot index pointed out of range.
  // Reset to the first banner whenever the list changes.
  useEffect(() => {
    setActiveBannerIndex(0);
    if (promotions.length > 0) {
      bannerFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [promotions.length]);

  // Auto-scroll banners every 4 seconds
  useEffect(() => {
    if (promotions.length <= 1) return;

    const timer = setInterval(() => {
      // Clamp against the CURRENT list length so a shrunk list can never
      // produce an out-of-range scrollToIndex.
      const safeCurrent = Math.min(activeBannerIndex, promotions.length - 1);
      const nextIndex = (safeCurrent + 1) % promotions.length;
      setActiveBannerIndex(nextIndex);
      bannerFlatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [activeBannerIndex, promotions.length]);

  const handleBannerScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeBannerIndex) {
      setActiveBannerIndex(index);
    }
  };

  const completedCount = enrolledCourses.filter((p) => p.progress === 100).length;
  const avgProgress =
    enrolledCourses.length > 0
      ? Math.round(
          enrolledCourses.reduce((sum, p) => sum + p.progress, 0) / enrolledCourses.length
        )
      : 0;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return <HomeSkeleton />;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "Good morning";
    } else if (hour >= 12 && hour < 17) {
      return "Good afternoon";
    } else if (hour >= 17 && hour < 21) {
      return "Good evening";
    } else {
      return "Good night";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.fixedHeader, { backgroundColor: colors.background, paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name ?? "Student"}</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/notifications")}
            >
              <Feather name="bell" size={20} color={colors.foreground} />
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/news")}
            >
              <Feather name="file-text" size={20} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/store")}
            >
              <Ionicons name="cart-outline" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >

      {/* Stats Banner */}
      <View style={[styles.statsBanner, { backgroundColor: colors.primary }]}>
        {enrolledCourses.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateIcon}></Text>
            <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>No courses yet</Text>
            <Text style={styles.emptyStateSubtitle}>Explore courses and begin your learning journey</Text>
          </View>
        ) : (
          <>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{enrolledCourses.length}</Text>
              <Text style={styles.statLabel}>Courses Enrolled</Text>
            </View>
            <View style={[styles.statDivider]} />
            <View style={styles.statItem}>
              {completedCount === 0 ? (
                <>
                  <Text style={styles.statNumber}>0</Text>
                  <Text style={styles.statLabel}>Complete Your First</Text>
                </>
              ) : (
                <>
                  <Text style={styles.statNumber}>{completedCount}</Text>
                  <Text style={styles.statLabel}>Courses Completed</Text>
                </>
              )}
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              {avgProgress === 0 ? (
                <>
                  <Text style={styles.statNumber}>0%</Text>
                  <Text style={styles.statLabel}>Begin Progress</Text>
                </>
              ) : (
                <>
                  <Text style={styles.statNumber}>{avgProgress}%</Text>
                  <Text style={styles.statLabel}>Average Progress</Text>
                </>
              )}
            </View>
          </>
        )}
      </View>

      {/* Learning Streak */}
      {enrolledCourses.length > 0 && (
        <View style={styles.streakSection}>
          <LearningStreak streak={learningStreak} bestStreak={7} />
        </View>
      )}

      {/* Banner Carousel */}
      {promotions.length > 0 && (
        <View style={styles.promoSection}>
          <FlatList
            ref={bannerFlatListRef}
            data={promotions}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleBannerScroll}
            keyExtractor={(item) => String(item.id)}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH - 40,
              offset: (SCREEN_WIDTH - 40) * index,
              index,
            })}
            onScrollToIndexFailed={() => {
              // List changed under us (banner deleted) — snap back to start.
              bannerFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
              setActiveBannerIndex(0);
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  // BUG FIX: the promotions table column is `link` (see
                  // docs/migrations/2026-07_premium_features.sql) — the code
                  // read `action_url`, so tapping a banner never navigated.
                  const target = item.link ?? item.action_url;
                  if (target) {
                    router.push(target);
                  }
                }}
                style={styles.promoCardWrapper}
              >
                <ImageBackground
                  source={{ uri: item.image_url }}
                  style={styles.promoCard}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <View style={styles.promoOverlay}>
                    <Text style={styles.promoTitle}>{item.title}</Text>
                    {item.subtitle && <Text style={styles.promoSubtitle}>{item.subtitle}</Text>}
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoBadgeText}>Learn More</Text>
                      <Feather name="arrow-right" size={14} color="#FFF" />
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
            )}
          />
          {/* Dot Indicators */}
          <View style={styles.dotsContainer}>
            {promotions.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: idx === activeBannerIndex ? colors.primary : colors.border,
                    width: idx === activeBannerIndex ? 16 : 8,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Continue Learning */}
      {watchlist.length > 0 && (
        <View style={styles.section}>
          <SectionHeader 
            title="Continue Watching" 
            subtitle={`${watchlist.length} lesson${watchlist.length > 1 ? 's' : ''} in progress`}
            onSeeAll={() => router.push("/(tabs)/courses")} 
          />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {watchlist.map((item: any) => (
              <WatchlistCard key={`${item.courseId}-${item.moduleId}`} item={item} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Popular Robotics Courses */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular Robotics Courses</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
        >
          {courses.filter(course => course.category === "Robotics").slice(0, 5).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
          <Pressable 
            style={[styles.seeAllCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({
              pathname: "/(tabs)/courses",
              params: { category: "Robotics" }
            })}
          >
            <Feather name="grid" size={32} color={colors.primary} />
            <Text style={[styles.seeAllText, { color: colors.foreground }]}>See All Courses</Text>
            <Feather name="arrow-right" size={20} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>

      {/* Popular Electronics Courses */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular Electronics Courses</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
        >
          {courses.filter(course => course.category === "Electronics").slice(0, 5).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
          <Pressable 
            style={[styles.seeAllCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({
              pathname: "/(tabs)/courses",
              params: { category: "Electronics" }
            })}
          >
            <Feather name="grid" size={32} color={colors.primary} />
            <Text style={[styles.seeAllText, { color: colors.foreground }]}>See All Courses</Text>
            <Feather name="arrow-right" size={20} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <SectionHeader title="Browse by Category" onSeeAll={() => router.push("/(tabs)/courses")} />
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          <View style={styles.categoriesContainer}>
            <View style={styles.categoriesRow}>
              {[
                { name: "Robotics", icon: "cpu" },
                { name: "Electronics", icon: "zap" },
                { name: "IoT", icon: "wifi" },
                { name: "Embedded Systems", icon: "box" },
              ].map((category) => (
                <Pressable
                  key={category.name}
                  style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push({
                    pathname: "/(tabs)/courses",
                    params: { category: category.name }
                  })}
                >
                  <Feather name={category.icon as any} size={18} color={colors.primary} />
                  <Text style={[styles.categoryText, { color: colors.foreground }]}>
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.categoriesRow}>
              {[
                { name: "Arduino & Projects", icon: "tool" },
                { name: "AI + Robotics", icon: "activity" },
                { name: "Drone Technology", icon: "navigation" },
                { name: "Industry 4.0", icon: "settings" },
              ].map((category) => (
                <Pressable
                  key={category.name}
                  style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push({
                    pathname: "/(tabs)/courses",
                    params: { category: category.name }
                  })}
                >
                  <Feather name={category.icon as any} size={18} color={colors.primary} />
                  <Text style={[styles.categoryText, { color: colors.foreground }]}>
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Popular IoT Courses */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular IoT Courses</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
        >
          {courses.filter(course => course.category === "IoT").slice(0, 5).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
          <Pressable 
            style={[styles.seeAllCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({
              pathname: "/(tabs)/courses",
              params: { category: "IoT" }
            })}
          >
            <Feather name="grid" size={32} color={colors.primary} />
            <Text style={[styles.seeAllText, { color: colors.foreground }]}>See All Courses</Text>
            <Feather name="arrow-right" size={20} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>

      {/* Ecosystem of MakersFlow */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ecosystem of MakersFlow</Text>
        </View>
        <View style={[styles.ecosystemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ecosystemHeader}>
            <Feather name="package" size={28} color={colors.primary} />
            <Text style={[styles.ecosystemTitle, { color: colors.foreground }]}>Our Partners & Brands</Text>
          </View>
          <Text style={[styles.ecosystemDescription, { color: colors.mutedForeground }]}>
            Discover the brands and partners that make up the MakersFlow ecosystem
          </Text>
          <View style={styles.brandsContainer}>
            {/* Brand logos will be added here */}
            <View style={[styles.brandPlaceholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="image" size={24} color={colors.mutedForeground} />
            </View>
            <View style={[styles.brandPlaceholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="image" size={24} color={colors.mutedForeground} />
            </View>
          </View>
        </View>
      </View>

      {/* Trending Courses */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trending Courses</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
        >
          {[
            courses.find(c => c.category === "Robotics"),
            courses.find(c => c.category === "Electronics"),
            courses.find(c => c.category === "IoT"),
            courses.find(c => c.category === "Embedded Systems"),
            courses.find(c => c.category === "Arduino & Projects"),
          ].filter(Boolean).map((course) => (
            <CourseCard key={course!.id} course={course!} />
          ))}
          <Pressable 
            style={[styles.seeAllCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/courses")}
          >
            <Feather name="grid" size={32} color={colors.primary} />
            <Text style={[styles.seeAllText, { color: colors.foreground }]}>See All Courses</Text>
            <Feather name="arrow-right" size={20} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>

      {/* Popular Kits */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular Kits</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
        >
          {popularKits.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          <Pressable 
            style={[styles.seeAllKitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/store")}
          >
            <Ionicons name="cart-outline" size={32} color={colors.primary} />
            <Text style={[styles.seeAllText, { color: colors.foreground }]}>See All Kits</Text>
            <Feather name="arrow-right" size={20} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: {
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  scrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  greeting: { fontSize: 14 },
  userName: { fontSize: 22, fontWeight: "800" },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    top: 8,
    right: 8,
    borderWidth: 1,
    borderColor: "#FFF",
  },
  statsBanner: {
    marginHorizontal: 20,
    borderRadius: 16,
    flexDirection: "row",
    paddingVertical: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statNumber: { fontSize: 26, fontWeight: "800", color: "#FFF", marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.85)", marginTop: 4, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  emptyStateContainer: { flex: 1, alignItems: "center", paddingHorizontal: 20, paddingVertical: 8 },
  emptyStateIcon: { fontSize: 32, marginBottom: 8 },
  emptyStateTitle: { fontSize: 17, fontWeight: "800", color: "#FFF", textAlign: "center", marginBottom: 4 },
  emptyStateSubtitle: { fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.85)", textAlign: "center" },
  streakSection: { marginHorizontal: 20, marginBottom: 28 },
  promoSection: {
    marginBottom: 28,
  },
  promoCardWrapper: {
    width: SCREEN_WIDTH - 40,
    marginHorizontal: 20,
    height: 160,
  },
  promoCard: {
    flex: 1,
    height: 160,
    justifyContent: "flex-end",
  },
  promoOverlay: {
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16,
    flex: 1,
    justifyContent: "flex-end",
    gap: 4,
  },
  promoTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
  },
  promoSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
  promoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  section: { marginBottom: 32 },
  sectionTitleContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  carouselWrapper: { position: "relative" },
  carouselContent: { paddingLeft: 20, paddingRight: 20 },
  featuredCoursesContent: { paddingLeft: 20, paddingRight: 100 },
  fadeGradient: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    pointerEvents: "none",
  },
  seeAllCard: {
    width: 260,
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  seeAllText: {
    fontSize: 16,
    fontWeight: "700",
  },
  categoriesScrollContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  categoriesContainer: {
    gap: 10,
  },
  categoriesRow: {
    flexDirection: "row",
    gap: 10,
  },
  categoryCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ecosystemCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  ecosystemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  ecosystemTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  ecosystemDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  brandsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  brandPlaceholder: {
    width: 100,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  seeAllKitsCard: {
    width: 180,
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
