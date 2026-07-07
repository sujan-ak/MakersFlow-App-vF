import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ToastAndroid,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/Badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { StarRating } from "@/components/StarRating";
import { DetailSkeleton } from "@/components/SkeletonLoader";
import { QUIZZES } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContextSupabase";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { supabase } from "@/lib/supabase";
import { getCourseById, getCourseModules } from "@/services/courseDataProvider";
import { enrollInCourse, isEnrolled as checkEnrollment, getEnrollment, isExpired } from "@/services/enrollmentService";
import { fetchCourseLessonsProgress } from "@/lib/progressStorage";
import { fetchCourseReviews, fetchMyReview, upsertReview } from "@/services/reviewService";

export default function CourseDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { isFavoriteCourse, toggleFavoriteCourse } = useFavorites();
  const { addToCart, items: cartItems } = useCart();

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]); // flat lessons
  const [lessonsProgress, setLessonsProgress] = useState<any[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isFavorite = course ? isFavoriteCourse(course.id) : false;

  // Review state
  const [myReview, setMyReview] = useState<{ rating: number; comment: string } | null>(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${course?.title || "Course"} on Edodwaja! https://edodwaja.com/course/${id}`,
      });
    } catch (error) {
      console.error("Error sharing course:", error);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  const loadCourseData = useCallback(async (isRefreshing = false) => {
    if (!id) return;
    if (!isRefreshing) {
      setIsLoading(true);
    }
    try {
      const courseData = await getCourseById(id);
      if (courseData) {
        const mappedCourse = {
          id: String(courseData.id),
          title: courseData.title,
          category: courseData.category || "General",
          level: courseData.level ? (courseData.level.charAt(0).toUpperCase() + courseData.level.slice(1)) : "Beginner",
          price: courseData.price || 0,
          isFree: courseData.is_free,
          thumbnail: courseData.thumbnail_url ? { uri: courseData.thumbnail_url } : require('@/assets/images/course_robotics.png'),
          instructor: "MakersFlow Instructor",
          rating: 4.8,
          reviews: 120,
          description: courseData.description || "",
          tags: [courseData.category || "Robotics"],
        };
        setCourse(mappedCourse);

        const modulesData = await getCourseModules(id);
        const flatLessons = modulesData.flatMap((m: any) =>
          m.lessons.map((l: any) => ({
            id: l.id,
            title: l.title,
            duration: l.duration_minutes ? `${l.duration_minutes} mins` : "0 mins",
            duration_minutes: l.duration_minutes,
          }))
        );
        setModules(flatLessons);
      }

      if (user?.id) {
        const enrolledStatus = await checkEnrollment(user.id, id);
        setIsEnrolled(enrolledStatus);
        if (enrolledStatus) {
          const progressData = await fetchCourseLessonsProgress(user.id, id);
          setLessonsProgress(progressData);
          const enrollData = await getEnrollment(user.id, id);
          setEnrollment(enrollData);
        } else {
          setEnrollment(null);
        }
      }

      // Load reviews
      let reviews: any[] = [];
      try {
        reviews = await fetchCourseReviews(id);
      } catch (reviewErr) {
        console.error("[CourseDetail] fetchCourseReviews error:", reviewErr);
      }
      setAllReviews(reviews);
      if (reviews.length > 0) {
        const avg = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
        setAvgRating(Math.round(avg * 10) / 10);
      } else {
        setAvgRating(null);
      }

      // Load user's review
      if (user?.id) {
        const mine = await fetchMyReview(user.id, id);
        if (mine) {
          setMyReview({ rating: mine.rating, comment: mine.comment ?? "" });
          setDraftRating(mine.rating);
          setDraftComment(mine.comment ?? "");
        }
      }
    } catch (error) {
      console.error("[CourseDetail] load error", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    loadCourseData(false);
  }, [loadCourseData]);

  useFocusEffect(
    useCallback(() => {
      loadCourseData(true);
    }, [loadCourseData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCourseData(true);
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!course) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Pressable onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/courses");
          }
        }} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.errorText, { color: colors.foreground }]}>Course not found.</Text>
      </View>
    );
  }

  const quiz = QUIZZES.find((q) => q.courseId === course.id);
  const isCourseCompleted = !!enrollment?.completed_at;
  const accessExpired = isExpired(enrollment);
  const completedModules = lessonsProgress.filter((p) => p.is_completed).length;
  const progress = isCourseCompleted
    ? 100
    : (modules.length > 0 ? Math.min(100, Math.round((completedModules / modules.length) * 100)) : 0);
  const remainingModules = isCourseCompleted ? 0 : Math.max(0, modules.length - completedModules);
  
  const lastModuleId = lessonsProgress.length > 0 
    ? lessonsProgress.sort((a, b) => new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime())[0]?.lesson_id 
    : null;

  const totalDurationMin = modules.reduce((sum, m) => sum + (m.duration_minutes || 0), 0);
  const displayDuration = totalDurationMin > 0 ? `${totalDurationMin} mins` : "Self-paced";
  const hasStarted = progress > 0;

  const handleFavoriteToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasAdded = !isFavorite;
    toggleFavoriteCourse({
      id: course.id,
      title: course.title,
      thumbnail: course.thumbnail,
      category: course.category,
      price: course.price,
      isFree: course.isFree,
    });
    showToast(wasAdded ? 'Added to Favorites' : 'Removed from Favorites');
  };

  const handleEnrollNow = async () => {
    if (!course || !user?.id) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsEnrolling(true);

    try {
      // ── BUG FIX (paid enrollment never visible) ────────────────────────────
      // Previously paid courses were "enrolled" instantly with
      // payment_status: 'pending' and the UI flipped to enrolled with a
      // success alert — no payment ever happened, the enrollment stayed
      // 'pending' forever, and (correctly) never unlocked / never showed as a
      // real enrollment. Paid courses must go through checkout: find the
      // linked store product and send the user to payment. Fulfilment then
      // creates the real enrollment (complete_paid_order RPC / webhook).
      if (!course.isFree) {
        const { data: linkedProduct } = await supabase
          .from("products")
          .select("id, title, description, price, original_price, category, subcategory, thumbnail_url, in_stock")
          .eq("course_id", Number(course.id))
          .maybeSingle();

        if (!linkedProduct) {
          Alert.alert(
            "Purchase unavailable",
            "This course can't be purchased right now. Please try again later or contact support.",
          );
          return;
        }

        const productForCart: any = {
          id: String(linkedProduct.id),
          title: linkedProduct.title || course.title,
          category: "digital",
          subcategory: linkedProduct.subcategory || "Courses",
          price: Number(linkedProduct.price) || course.price,
          originalPrice: Number(linkedProduct.original_price) || Number(linkedProduct.price) || course.price,
          thumbnail: linkedProduct.thumbnail_url ? { uri: linkedProduct.thumbnail_url } : course.thumbnail,
          description: linkedProduct.description || course.description,
          rating: 4.8,
          reviews: 0,
          inStock: true,
          features: [],
          is_course: true,
          course_id: String(course.id),
        };

        if (!cartItems.some((i) => i.product.id === productForCart.id)) {
          addToCart(productForCart);
        }
        router.push("/store/checkout");
        return;
      }

      // Free course — enroll directly, exactly as before.
      await enrollInCourse(user.id, course.id, course.isFree);
      setIsEnrolled(true);

      const progressData = await fetchCourseLessonsProgress(user.id, course.id);
      setLessonsProgress(progressData);
      
      Alert.alert(
        "Enrollment Successful!",
        `You've successfully enrolled in "${course.title}". Ready to start learning?`,
        [
          {
            text: "View Course",
            style: "cancel",
            onPress: () => {
              setIsEnrolling(false);
            },
          },
          {
            text: "Start Learning",
            onPress: () => {
              setIsEnrolling(false);
              router.push({ 
                pathname: "/course/learn", 
                params: { courseId: course.id, moduleId: modules[0]?.id || "" } 
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('[CourseDetail] Enrollment error:', error);
      Alert.alert(
        "Enrollment Failed",
        "Something went wrong. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user?.id || !course || draftRating === 0) return;
    setReviewSubmitting(true);
    try {
      await upsertReview(user.id, course.id, draftRating, draftComment);
      setMyReview({ rating: draftRating, comment: draftComment });
      setReviewSubmitted(true);
      // Reviews are moderated: it stays visible only to this user until an
      // admin approves it (RLS returns approved reviews + the user's own).
      Alert.alert(
        "Review submitted",
        "Thanks! Your review is pending approval and will be visible to everyone once approved.",
      );
      // Refresh reviews list & avg in real-time
      const reviews = await fetchCourseReviews(course.id);
      setAllReviews(reviews);
      if (reviews.length > 0) {
        const avg = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
      // Auto-hide thanks message after 3s
      setTimeout(() => setReviewSubmitted(false), 3000);
    } catch (err) {
      console.error("[CourseDetail] review submit error:", err);
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  };

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
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <Image source={course.thumbnail} style={styles.thumbnail} />
          <View style={styles.overlay} />
          <Pressable
            style={[styles.backCircle, { top: (Platform.OS === "web" ? 67 : insets.top) + 8 }]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/courses");
              }
            }}
          >
            <Feather name="arrow-left" size={20} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.shareCircle, { top: (Platform.OS === "web" ? 67 : insets.top) + 8 }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={20} color="#FFF" />
          </Pressable>
          <View style={[styles.thumbnailBadge, { bottom: 16, left: 16 }]}>
            <Badge label={course.level} variant="primary" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>{course.category}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground, flex: 1 }]}>{course.title}</Text>
            <FavoriteButton
              isFavorite={isFavorite}
              onPress={handleFavoriteToggle}
              size={20}
            />
          </View>
          <Text style={[styles.instructor, { color: colors.mutedForeground }]}>By {course.instructor}</Text>

          {/* Stats row — live data */}
          <View style={[styles.statsRow, { backgroundColor: colors.muted, borderRadius: 14 }]}>
            {[
              { icon: "star", value: avgRating != null ? avgRating.toFixed(1) : "—", label: "Rating" },
              { icon: "book", value: modules.length > 0 ? `${modules.length}` : "—", label: "Lessons" },
              { icon: "clock", value: displayDuration, label: "Duration" },
              { icon: "message-circle", value: `${allReviews.length}`, label: "Reviews" },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Feather name={s.icon as any} size={16} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About this course</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{course.description}</Text>

          {/* Tags */}
          <View style={styles.tags}>
            {course.tags.map((tag: any) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* Progress (if enrolled) */}
          {isEnrolled && (
            <View style={[styles.progressCard, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={[styles.progressLabel, { color: colors.primary }]}>Your Progress</Text>
                  <Text style={[styles.progressPct, { color: colors.primary }]}>{progress}%</Text>
                </View>
                {isCourseCompleted && (
                  <View style={[styles.completeBadge, { backgroundColor: "#10B981" }]}>
                    <Feather name="award" size={16} color="#FFF" />
                    <Text style={styles.completeBadgeText}>Completed</Text>
                  </View>
                )}
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: colors.primary }]}
                />
              </View>
              <View style={styles.progressStats}>
                <Text style={[styles.progressSub, { color: colors.foreground }]}>
                  {completedModules} of {modules.length} lessons completed
                </Text>
                {remainingModules > 0 && (
                  <Text style={[styles.progressRemaining, { color: colors.mutedForeground }]}>
                    {remainingModules} remaining
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Curriculum */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Curriculum</Text>
          <Text style={[styles.curriculumSubtitle, { color: colors.mutedForeground }]}>
            {modules.length} lessons · {displayDuration}
          </Text>
          {modules.map((mod, idx) => {
            const modProgress = lessonsProgress.find((p) => String(p.lesson_id) === String(mod.id));
            const isCompleted = modProgress?.is_completed === true;
            const watchedPercentage = modProgress?.watch_percentage || 0;

            return (
              <Pressable
                key={mod.id}
                style={[
                  styles.moduleItem,
                  { 
                    backgroundColor: colors.card, 
                    borderColor: isCompleted ? "#10B981" : colors.border,
                    borderWidth: isCompleted ? 2 : 1
                  },
                ]}
                onPress={() => {
                  if (isEnrolled) {
                    router.push({ pathname: "/course/learn", params: { courseId: course.id, moduleId: mod.id } });
                  }
                }}
              >
                <View
                  style={[
                    styles.moduleNum,
                    { backgroundColor: isCompleted ? "#DCFCE7" : colors.muted },
                  ]}
                >
                  {isCompleted ? (
                    <Feather name="check" size={14} color="#10B981" />
                  ) : (
                    <Text style={[styles.moduleNumText, { color: colors.mutedForeground }]}>{idx + 1}</Text>
                  )}
                </View>
                <View style={styles.moduleInfo}>
                  <Text style={[styles.moduleTitle, { color: isCompleted ? "#10B981" : colors.foreground }]}>
                    {mod.title}
                  </Text>
                  <View style={styles.moduleMetaRow}>
                    <Feather name="clock" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.moduleDuration, { color: colors.mutedForeground }]}>{mod.duration}</Text>
                    {watchedPercentage > 0 && watchedPercentage < 100 && (
                      <Text style={[styles.watchedPercentage, { color: colors.primary }]}>
                        · {Math.round(watchedPercentage)}% watched
                      </Text>
                    )}
                  </View>
                  {watchedPercentage > 0 && watchedPercentage < 100 && (
                    <View style={[styles.lessonProgressTrack, { backgroundColor: colors.muted, marginTop: 6 }]}>
                      <View style={[styles.lessonProgressFill, { width: `${watchedPercentage}%` as any, backgroundColor: colors.primary }]} />
                    </View>
                  )}
                </View>
                {isEnrolled ? (
                  <Feather 
                    name={isCompleted ? "check-circle" : "play-circle"} 
                    size={20} 
                    color={isCompleted ? "#10B981" : colors.primary} 
                  />
                ) : (
                  <Feather name="lock" size={16} color={colors.mutedForeground} />
                )}
              </Pressable>
            );
          })}

          {/* View Certificate when completed */}
          {isEnrolled && isCourseCompleted && (
            <Pressable
              style={[styles.certBtn, { backgroundColor: '#10B981' }]}
              onPress={() => router.push({
                pathname: '/certificate',
                params: {
                  courseName: course.title,
                  studentName: user?.name ?? '',
                  completionDate: new Date().toISOString(),
                },
              })}
            >
              <Feather name="award" size={18} color="#fff" />
              <Text style={styles.certBtnText}>View Certificate</Text>
            </Pressable>
          )}

          {/* Quiz */}
          {quiz && isEnrolled && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quiz</Text>
              <Pressable
                style={[styles.quizCard, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/quiz/[id]", params: { id: quiz.id } });
                }}
              >
                <View>
                  <Text style={styles.quizTitle}>{quiz.title}</Text>
                  <Text style={styles.quizSub}>{quiz.questions.length} questions · {quiz.timeLimit / 60} min</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#FFF" />
              </Pressable>
            </>
          )}

          {/* ── Average Rating Bar ───────────────── */}
          {allReviews.length > 0 && (
            <View style={[styles.avgRatingRow, { backgroundColor: colors.muted, borderRadius: 14 }]}>
              <StarRating rating={Math.round(avgRating ?? 0)} size={20} readonly />
              <Text style={[styles.avgRatingText, { color: colors.foreground }]}>
                {avgRating?.toFixed(1)}{" "}
                <Text style={{ color: colors.mutedForeground, fontWeight: "400" }}>
                  ({allReviews.length} rating{allReviews.length !== 1 ? "s" : ""})
                </Text>
              </Text>
            </View>
          )}

          {/* ── Rate This Course ─────────────────── */}
          {isEnrolled && completedModules > 0 && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={[styles.rateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {reviewSubmitted ? (
                  <View style={styles.thankYouRow}>
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text style={[styles.thankYouText, { color: "#10B981" }]}>
                      Thanks for your review!
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.rateTitle, { color: colors.foreground }]}>
                      {myReview ? "Update your rating" : "Rate this course"}
                    </Text>
                    <StarRating
                      rating={draftRating}
                      onRatingChange={setDraftRating}
                      size={32}
                    />
                    {draftRating > 0 && (
                      <>
                        <TextInput
                          style={[
                            styles.commentInput,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                              color: colors.foreground,
                            },
                          ]}
                          placeholder="Share your thoughts (optional)..."
                          placeholderTextColor={colors.mutedForeground}
                          value={draftComment}
                          onChangeText={setDraftComment}
                          multiline
                          numberOfLines={3}
                          maxLength={500}
                        />
                        <Pressable
                          style={[
                            styles.submitBtn,
                            { backgroundColor: colors.primary, opacity: reviewSubmitting ? 0.6 : 1 },
                          ]}
                          onPress={handleSubmitReview}
                          disabled={reviewSubmitting}
                        >
                          {reviewSubmitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={styles.submitBtnText}>
                              {myReview ? "Update Review" : "Submit Review"}
                            </Text>
                          )}
                        </Pressable>
                      </>
                    )}
                  </>
                )}
              </View>
            </KeyboardAvoidingView>
          )}

          {/* ── Reviews List ─────────────────────── */}
          {allReviews.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reviews</Text>
              {(showAllReviews ? allReviews : allReviews.slice(0, 3)).map((review: any) => (
                <View
                  key={review.id}
                  style={[styles.reviewItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.reviewHeader}>
                    <StarRating rating={review.rating} size={14} readonly />
                    <Text style={[styles.reviewMeta, { color: colors.mutedForeground }]}>
                      Student ·{" "}
                      {new Date(review.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  {!!review.comment && (
                    <Text style={[styles.reviewComment, { color: colors.foreground }]}>
                      "{review.comment}"
                    </Text>
                  )}
                </View>
              ))}
              {allReviews.length > 3 && (
                <Pressable
                  onPress={() => setShowAllReviews((prev) => !prev)}
                  style={styles.showAllBtn}
                >
                  <Text style={[styles.showAllText, { color: colors.primary }]}>
                    {showAllReviews ? "Show less" : `Show all ${allReviews.length} reviews →`}
                  </Text>
                </Pressable>
              )}
            </>
          )}
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
        {isEnrolled && accessExpired ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
              Your 1-year access expired on{" "}
              {enrollment?.expires_at ? new Date(enrollment.expires_at).toLocaleDateString() : ""}
            </Text>
            <Pressable
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  "Renew Access",
                  `Renew "${course.title}" for another year at ₹${course.price}?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Renew Now", onPress: () => router.push("/(tabs)/store") },
                  ],
                );
              }}
            >
              <Feather name="refresh-cw" size={18} color="#FFF" />
              <Text style={styles.ctaBtnText}>Renew Access · ₹{course.price}</Text>
            </Pressable>
          </View>
        ) : isEnrolled ? (
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: progress === 100 ? "#10B981" : colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const targetModuleId = lastModuleId ? String(lastModuleId) : (modules[0]?.id || "");
              router.push({ pathname: "/course/learn", params: { courseId: course.id, moduleId: targetModuleId } });
            }}
          >
            {progress === 100 ? (
              <>
                <Feather name="award" size={18} color="#FFF" />
                <Text style={styles.ctaBtnText}>Review Course</Text>
              </>
            ) : progress > 0 ? (
              <>
                <Feather name="play" size={18} color="#FFF" />
                <Text style={styles.ctaBtnText}>Continue Learning · {progress}%</Text>
              </>
            ) : (
              <>
                <Feather name="play" size={18} color="#FFF" />
                <Text style={styles.ctaBtnText}>Start Learning</Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.ctaRow}>
            <View>
              {course.isFree ? (
                <Text style={[styles.ctaPrice, { color: colors.success }]}>Free</Text>
              ) : (
                <Text style={[styles.ctaPrice, { color: colors.primary }]}>₹{course.price}</Text>
              )}
            </View>
            <Pressable
              style={[styles.ctaBtn, { backgroundColor: colors.secondary, flex: 1, opacity: isEnrolling ? 0.6 : 1 }]}
              onPress={handleEnrollNow}
              disabled={isEnrolling}
            >
              {isEnrolling ? (
                <Text style={styles.ctaBtnText}>Enrolling...</Text>
              ) : (
                <Text style={styles.ctaBtnText}>{course.isFree ? "Enroll for Free" : "Buy Now"}</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { padding: 16 },
  errorText: { fontSize: 16, textAlign: "center", marginTop: 40 },
  thumbnailContainer: { position: "relative", height: 240 },
  thumbnail: { width: "100%", height: "100%", resizeMode: "cover" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
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
  thumbnailBadge: { position: "absolute" },
  content: { padding: 20, gap: 12 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  categoryBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  instructor: { fontSize: 14 },
  statsRow: { flexDirection: "row", paddingVertical: 14 },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  description: { fontSize: 14, lineHeight: 22 },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: "500" },
  progressCard: { 
    borderRadius: 16, 
    padding: 18, 
    gap: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between",
    alignItems: "center"
  },
  progressLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  progressPct: { fontSize: 24, fontWeight: "800" },
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
  },
  progressTrack: { height: 8, borderRadius: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  progressStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressSub: { fontSize: 13, fontWeight: "500" },
  progressRemaining: { fontSize: 12 },
  curriculumSubtitle: {
    fontSize: 13,
    marginBottom: 12,
    marginTop: -8,
  },
  moduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  moduleNum: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  moduleNumText: { fontSize: 13, fontWeight: "700" },
  moduleInfo: { flex: 1, gap: 4 },
  lessonProgressTrack: {
    height: 3,
    borderRadius: 1.5,
    width: "80%",
  },
  lessonProgressFill: {
    height: 3,
    borderRadius: 1.5,
  },
  moduleTitle: { fontSize: 14, fontWeight: "600" },
  moduleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  moduleDuration: { fontSize: 12 },
  watchedPercentage: {
    fontSize: 11,
    fontWeight: "600",
  },
  quizCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  quizTitle: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  quizSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  cta: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  ctaPrice: { fontSize: 22, fontWeight: "800" },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    minHeight: 52,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  certBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  certBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // ── Review styles ──────────────────────────────
  avgRatingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avgRatingText: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  rateCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  rateTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: 44,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#FFF",
  },
  thankYouRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 8,
  },
  thankYouText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  reviewItem: {
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  reviewMeta: {
    fontSize: 11,
    fontWeight: "500" as const,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic" as const,
  },
  showAllBtn: {
    paddingVertical: 8,
    alignItems: "center" as const,
  },
  showAllText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
