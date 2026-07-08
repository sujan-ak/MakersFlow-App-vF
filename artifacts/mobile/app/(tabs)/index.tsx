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
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const SNAP_INTERVAL = CARD_WIDTH + 16;
import { CourseCard } from "@/components/CourseCard";
import { SectionHeader } from "@/components/SectionHeader";
import { WatchlistCard } from "@/components/WatchlistCard";
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

const CATEGORY_ICONS: Record<string, string> = {
  "robotics": "cpu",
  "electronics": "zap",
  "iot": "wifi",
  "embedded systems": "box",
  "arduino & projects": "tool",
  "ai + robotics": "activity",
  "drone technology": "navigation",
  "industry 4.0": "settings",
  "automation": "sliders",
  "coding": "code",
  "3d printing": "layers",
};

interface CategoryGridProps {
  categories: string[];
  colors: any;
  onCategoryPress: (category: string) => void;
}

function CategoryGrid({ categories, colors, onCategoryPress }: CategoryGridProps) {
  if (categories.length === 0) return null;
  const half = Math.ceil(categories.length / 2);
  const row1 = categories.slice(0, half);
  const row2 = categories.slice(half);

  return (
    <View style={styles.section}>
      <SectionHeader title="Browse by Category" onSeeAll={() => onCategoryPress("all")} />
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScrollContent}
      >
        <View style={styles.categoriesContainer}>
          <View style={styles.categoriesRow}>
            {row1.map((cat) => {
              const icon = CATEGORY_ICONS[cat.toLowerCase()] || "book-open";
              return (
                <Pressable
                  key={cat}
                  style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => onCategoryPress(cat)}
                >
                  <Feather name={icon as any} size={18} color={colors.primary} />
                  <Text style={[styles.categoryText, { color: colors.foreground }]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {row2.length > 0 && (
            <View style={styles.categoriesRow}>
              {row2.map((cat) => {
                const icon = CATEGORY_ICONS[cat.toLowerCase()] || "book-open";
                return (
                  <Pressable
                    key={cat}
                    style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => onCategoryPress(cat)}
                  >
                    <Feather name={icon as any} size={18} color={colors.primary} />
                    <Text style={[styles.categoryText, { color: colors.foreground }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface GuestWelcomeCardProps {
  colors: any;
  onSignIn: () => void;
  onBrowseCourses: () => void;
}

function GuestWelcomeCard({ colors, onSignIn, onBrowseCourses }: GuestWelcomeCardProps) {
  return (
    <View style={[styles.guestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.guestIconContainer, { backgroundColor: colors.accent }]}>
        <Feather name="award" size={32} color={colors.primary} />
      </View>
      <Text style={[styles.guestTitle, { color: colors.foreground }]}>Welcome to Edodwaja</Text>
      <Text style={[styles.guestSubtitleText, { color: colors.mutedForeground }]}>
        Sign in to track your progress, earn certificates, and continue where you left off.
      </Text>
      <View style={styles.guestActions}>
        <Pressable
          style={[styles.guestPrimaryBtn, { backgroundColor: colors.primary }]}
          onPress={onSignIn}
        >
          <Text style={styles.guestPrimaryBtnText}>Sign In</Text>
        </Pressable>
        <Pressable
          style={[styles.guestSecondaryBtn, { borderColor: colors.border }]}
          onPress={onBrowseCourses}
        >
          <Text style={[styles.guestSecondaryBtnText, { color: colors.foreground }]}>Browse Courses</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { watchlist } = useProgress();
  const scrollViewRef = useRef<ScrollView>(null);
  const [popularCoursesY, setPopularCoursesY] = useState(0);

  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [popularCourses, setPopularCourses] = useState<any[]>([]);
  const [popularKits, setPopularKits] = useState<Product[]>([]);
  const [learningStreak, setLearningStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerFlatListRef = useRef<any>(null);
  const { refreshProgress } = useProgress();
  const [refreshing, setRefreshing] = useState(false);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalLessonsCompleted, setTotalLessonsCompleted] = useState(0);
  const [totalHoursLearned, setTotalHoursLearned] = useState(0);
  const [categories, setCategories] = useState<string[]>([
    "Robotics",
    "Electronics",
    "IoT",
    "Embedded Systems",
    "Arduino & Projects",
    "AI + Robotics",
    "Drone Technology",
    "Industry 4.0",
    "Automation",
    "Coding",
    "3D Printing"
  ]);

  const loadData = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) {
      setIsLoading(true);
    }
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

      // Fetch all course reviews to calculate real statistics
      let reviewStats: Record<string, { ratingSum: number; count: number }> = {};
      try {
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('course_id, rating');

        if (!reviewsError && reviewsData) {
          reviewsData.forEach((rev: any) => {
            const cId = String(rev.course_id);
            if (!reviewStats[cId]) {
              reviewStats[cId] = { ratingSum: 0, count: 0 };
            }
            reviewStats[cId].ratingSum += Number(rev.rating) || 0;
            reviewStats[cId].count += 1;
          });
        }
      } catch (err) {
        console.error('[Home] Failed to load reviews:', err);
      }

      const all = await fetchAllCourses();
      const mapped = all.map((c: any) => {
        const stats = reviewStats[String(c.id)];
        const rating = stats ? Number((stats.ratingSum / stats.count).toFixed(1)) : 0;
        const reviews = stats ? stats.count : 0;

        return {
          id: String(c.id),
          title: c.title,
          category: c.category || "General",
          level: c.level ? (c.level.charAt(0).toUpperCase() + c.level.slice(1)) : "Beginner",
          price: c.price || 0,
          isFree: c.is_free,
          thumbnail: c.thumbnail_url ? { uri: c.thumbnail_url } : require('@/assets/images/course_robotics.png'),
          instructor: c.profiles?.full_name || "",
          rating,
          reviews,
          description: c.description || "",
          modules: []
        };
      });
      setCourses(mapped);
      setPopularCourses(mapped.slice(0, 8));

      if (user?.id) {
        const enrollments = await fetchEnrolledCourses(user.id);
        const mappedEnrolled = await Promise.all(
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
          .select('course_id, lesson_id, time_spent_secs, is_completed, last_watched_at')
          .eq('user_id', user.id);
        if (lpData) {
          const streak = ProgressCalculator.calculateStreak(lpData);
          setLearningStreak(streak);

          const completed = lpData.filter((p) => p.is_completed).length;
          setTotalLessonsCompleted(completed);

          const timeSecs = lpData.reduce((sum, p) => sum + (p.time_spent_secs || 0), 0);
          setTotalHoursLearned(Number((timeSecs / 3600).toFixed(1)));
        }

        // Fetch longest streak from streaks table
        try {
          const { data: streakTableData, error: streakTableError } = await supabase
            .from('streaks')
            .select('longest_streak')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!streakTableError && streakTableData) {
            setLongestStreak(Number(streakTableData.longest_streak) || 0);
          } else {
            setLongestStreak(0);
          }
        } catch {
          setLongestStreak(0);
        }
      } else {
        setEnrolledCourses([]);
      }

      // Fetch distinct categories from courses table
      try {
        const { data: catData, error: catError } = await supabase
          .from('courses')
          .select('category')
          .eq('is_published', true)
          .not('category', 'is', null);

        if (!catError && catData) {
          const uniqueCats = Array.from(new Set(catData.map((c: any) => c.category)))
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
          
          const merged = Array.from(new Set([
            "Robotics",
            "Electronics",
            "IoT",
            "Embedded Systems",
            "Arduino & Projects",
            "AI + Robotics",
            "Drone Technology",
            "Industry 4.0",
            "Automation",
            "Coding",
            "3D Printing",
            ...uniqueCats
          ]));
          setCategories(merged);
        }
      } catch (err) {
        console.error("[Home] Failed to load categories:", err);
      }

      // Fetch real kits from Supabase (top 8 by created_at DESC)
      try {
        const { data: kitData, error: kitError } = await supabase
          .from('products')
          .select('id, title, description, price, original_price, category, subcategory, thumbnail_url, in_stock')
          .or('status.eq.available,status.eq.active')
          .neq('category', 'digital')
          .order('created_at', { ascending: false })
          .limit(8);

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
            rating: 0,
            reviews: 0,
            inStock: row.in_stock === undefined ? true : Boolean(row.in_stock),
            features: [],
          }));
          setPopularKits(mappedKits);
        }
      } catch (err) {
        console.error('[Home] Error fetching popular kits:', err);
      }
    } catch (err) {
      console.error('[Home] Error fetching courses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

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
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
      >

      {/* Guest Welcome Card or User Stats */}
      {!user ? (
        <GuestWelcomeCard
          colors={colors}
          onSignIn={() => router.push("/(auth)/login")}
          onBrowseCourses={() => {
            scrollViewRef.current?.scrollTo({ y: popularCoursesY, animated: true });
          }}
        />
      ) : (
        <>
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
                {completedCount > 0 && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{completedCount}</Text>
                      <Text style={styles.statLabel}>Courses Completed</Text>
                    </View>
                  </>
                )}
                {avgProgress > 0 && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{avgProgress}%</Text>
                      <Text style={styles.statLabel}>Average Progress</Text>
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* Learning Streak Carousel */}
          {enrolledCourses.length > 0 && (
            <StreakCarousel
              learningStreak={learningStreak}
              longestStreak={longestStreak}
              totalLessonsCompleted={totalLessonsCompleted}
              totalHoursLearned={totalHoursLearned}
              colors={colors}
            />
          )}
        </>
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
              bannerFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
              setActiveBannerIndex(0);
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
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
      {user && watchlist.length > 0 && (
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

      {/* Popular Courses Section */}
      {popularCourses.length > 0 && (
        <View 
          style={styles.section}
          onLayout={(e) => setPopularCoursesY(e.nativeEvent.layout.y)}
        >
          <SectionHeader 
            title="Popular Courses" 
            onSeeAll={() => router.push({ pathname: "/(tabs)/store", params: { category: "Courses" } })} 
          />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
          >
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Categories */}
      <CategoryGrid
        categories={categories}
        colors={colors}
        onCategoryPress={(cat) => {
          if (cat === "all") {
            router.push({
              pathname: "/(tabs)/search",
              params: { query: "" }
            });
          } else {
            router.push({
              pathname: "/(tabs)/search",
              params: { category: cat }
            });
          }
        }}
      />

      {/* Popular Kits Section */}
      {popularKits.length > 0 && (
        <View style={styles.section}>
          <SectionHeader 
            title="Popular Kits" 
            onSeeAll={() => router.push({ pathname: "/(tabs)/store", params: { category: "Physical Kits" } })} 
          />
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
          </ScrollView>
        </View>
      )}

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
            <View style={[styles.brandPlaceholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="image" size={24} color={colors.mutedForeground} />
            </View>
            <View style={[styles.brandPlaceholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="image" size={24} color={colors.mutedForeground} />
            </View>
          </View>
        </View>
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
  carouselSection: {
    marginBottom: 24,
    alignItems: "center",
  },
  streakCardWrapper: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 20,
  },
  streakIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  streakContent: {
    flex: 1,
    gap: 4,
  },
  streakTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  streakLabel: {
    fontSize: 12,
  },
  streakDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  streakDot: {
    height: 8,
    borderRadius: 4,
  },
  guestCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  guestIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  guestSubtitleText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  guestActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  guestPrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  guestPrimaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  guestSecondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  guestSecondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

interface StreakCarouselProps {
  learningStreak: number;
  longestStreak: number;
  totalLessonsCompleted: number;
  totalHoursLearned: number;
  colors: any;
}

function StreakCarousel({
  learningStreak,
  longestStreak,
  totalLessonsCompleted,
  totalHoursLearned,
  colors,
}: StreakCarouselProps) {
  const [activeStreakIndex, setActiveStreakIndex] = useState(0);

  const streakData = [
    {
      id: "current_streak",
      title: "Current Streak",
      value: `${learningStreak} days`,
      icon: "zap",
      iconColor: "#F97316",
      bgColor: "#FFF7ED",
      label: "Active Days"
    },
    {
      id: "longest_streak",
      title: "Longest Streak",
      value: `${longestStreak} days`,
      icon: "award",
      iconColor: "#4F46E5",
      bgColor: "#EEF2FF",
      label: "Personal Best"
    },
    {
      id: "lessons_completed",
      title: "Lessons Completed",
      value: `${totalLessonsCompleted} lessons`,
      icon: "book-open",
      iconColor: "#F97316",
      bgColor: "#FFF7ED",
      label: "Lessons Done"
    },
    {
      id: "hours_learned",
      title: "Learning Time",
      value: `${totalHoursLearned} hrs`,
      icon: "clock",
      iconColor: "#4F46E5",
      bgColor: "#EEF2FF",
      label: "Hours Learned"
    }
  ];

  return (
    <View style={styles.carouselSection}>
      <FlatList
        data={streakData}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const slideSize = e.nativeEvent.layoutMeasurement.width;
          const index = Math.round(e.nativeEvent.contentOffset.x / slideSize);
          setActiveStreakIndex(index);
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.streakCardWrapper}>
            <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.streakIconContainer, { backgroundColor: item.bgColor }]}>
                <Feather name={item.icon as any} size={28} color={item.iconColor} />
              </View>
              <View style={styles.streakContent}>
                <Text style={[styles.streakTitle, { color: colors.mutedForeground }]}>{item.title}</Text>
                <Text style={[styles.streakValue, { color: colors.foreground }]}>{item.value}</Text>
                <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              </View>
            </View>
          </View>
        )}
      />
      <View style={styles.streakDotsContainer}>
        {streakData.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.streakDot,
              {
                backgroundColor: idx === activeStreakIndex ? colors.primary : colors.border,
                width: idx === activeStreakIndex ? 16 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}
