import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  Modal,
  Text,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image, ImageSource } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMBNAIL_SIZE = 54;
const THUMBNAIL_GAP = 8;
const THUMBNAIL_ITEM_WIDTH = THUMBNAIL_SIZE + THUMBNAIL_GAP;

export type ImageItem = string | { uri: string } | number;

interface ImageGalleryProps {
  images: ImageItem[];
  height?: number;
  mainImageFit?: "cover" | "contain";
  children?: React.ReactNode;
}

function resolveImageSource(item: ImageItem): ImageSource | number {
  if (typeof item === "string") {
    return { uri: item };
  }
  return item as ImageSource | number;
}

/**
 * Cross-platform Zoomable Image component using RNGH + Reanimated.
 * Works natively on both Android and iOS!
 * Supports double-tap to zoom (1x <-> 2.5x) and pinch-zoom with pan.
 */
function ZoomableImage({
  source,
  isFullscreen = false,
  onSingleTap,
}: {
  source: ImageSource | number;
  isFullscreen?: boolean;
  onSingleTap?: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onSingleTap) {
        onSingleTap();
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Single tap requires double tap to fail so double tap doesn't trigger single tap
  const tapGestures = onSingleTap
    ? Gesture.Exclusive(doubleTapGesture, singleTapGesture)
    : doubleTapGesture;

  const composedGesture = Gesture.Simultaneous(
    tapGestures,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          { width: SCREEN_WIDTH, height: "100%", alignItems: "center", justifyContent: "center" },
          animatedStyle,
        ]}
      >
        <Image
          source={source}
          style={{ width: SCREEN_WIDTH, height: "100%" }}
          contentFit={isFullscreen ? "contain" : "cover"}
          transition={200}
          placeholder={{ blurhash: "L6PZf_0.00~q%M%M_3t700?b_3%M" }}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export function ImageGallery({
  images,
  height = 300,
  mainImageFit = "cover",
  children,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  const mainListRef = useRef<FlatList>(null);
  const fullListRef = useRef<FlatList>(null);
  const thumbnailListRef = useRef<FlatList>(null);

  const hasMultiple = images && images.length > 1;

  // Reset index if images array length changes dynamically
  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(0);
    }
  }, [images.length, activeIndex]);

  const handleThumbnailPress = useCallback((index: number) => {
    setActiveIndex(index);
    mainListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const handleFullscreenThumbnailPress = useCallback((index: number) => {
    setFullscreenIndex(index);
    fullListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  // Momentum scroll end replaces 60fps onScroll handler to eliminate gesture re-renders
  const onMainMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const slide = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (slide >= 0 && slide < images.length && slide !== activeIndex) {
        setActiveIndex(slide);
        thumbnailListRef.current?.scrollToIndex({
          index: slide,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [activeIndex, images.length]
  );

  const onFullscreenMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const slide = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (slide >= 0 && slide < images.length && slide !== fullscreenIndex) {
        setFullscreenIndex(slide);
      }
    },
    [fullscreenIndex, images.length]
  );

  const openFullscreen = (index: number) => {
    setFullscreenIndex(index);
    setFullscreenVisible(true);
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.placeholderContainer, { height }]}>
        <Ionicons name="image-outline" size={48} color="#94A3B8" />
        {children}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── MAIN IMAGE SWIPER (ZOOMABLE + SINGLE TAP FOR FULLSCREEN) ────── */}
      <View style={{ width: SCREEN_WIDTH, height }}>
        <FlatList
          ref={mainListRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMainMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <View style={{ width: SCREEN_WIDTH, height, position: "relative" }}>
              <ZoomableImage
                source={resolveImageSource(item)}
                onSingleTap={() => openFullscreen(index)}
              />
              <Pressable
                onPress={() => openFullscreen(index)}
                style={styles.expandHintBadge}
                hitSlop={8}
              >
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        />
        {/* Render overlay children (Back button, Wishlist button, Share button, etc.) */}
        {children}
      </View>

      {/* ── DOT INDICATORS (ONLY MULTI-IMAGE) ─────────────────────────── */}
      {hasMultiple && (
        <View style={styles.dotsRow}>
          {images.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => handleThumbnailPress(i)}
              hitSlop={8}
            >
              <View
                style={[
                  styles.dot,
                  i === activeIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* ── THUMBNAIL STRIP (ONLY MULTI-IMAGE) ─────────────────────────── */}
      {hasMultiple && (
        <View style={styles.thumbnailStripContainer}>
          <FlatList
            ref={thumbnailListRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailListContent}
            getItemLayout={(_, index) => ({
              length: THUMBNAIL_ITEM_WIDTH,
              offset: THUMBNAIL_ITEM_WIDTH * index,
              index,
            })}
            renderItem={({ item, index }) => {
              const isActive = index === activeIndex;
              return (
                <Pressable
                  onPress={() => handleThumbnailPress(index)}
                  style={[
                    styles.thumbnailCard,
                    isActive && styles.thumbnailCardActive,
                  ]}
                >
                  <Image
                    source={resolveImageSource(item)}
                    style={styles.thumbnailImage}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* ── FULLSCREEN MODAL / LIGHTBOX ────────────────────────────────── */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fullscreenContainer}>
          {/* Top Bar */}
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenCounter}>
              {fullscreenIndex + 1} / {images.length}
            </Text>
            <Pressable
              style={styles.closeButton}
              onPress={() => setFullscreenVisible(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Fullscreen Swipe / Cross-Platform Zoom View */}
          <FlatList
            ref={fullListRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            initialScrollIndex={fullscreenIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onFullscreenMomentumScrollEnd}
            renderItem={({ item }) => (
              <ZoomableImage source={resolveImageSource(item)} isFullscreen />
            )}
          />

          {/* Fullscreen Bottom Thumbnail Strip (if multiple) */}
          {hasMultiple && (
            <View style={styles.fullscreenBottomBar}>
              <FlatList
                data={images}
                keyExtractor={(_, i) => String(i)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailListContent}
                getItemLayout={(_, index) => ({
                  length: THUMBNAIL_ITEM_WIDTH,
                  offset: THUMBNAIL_ITEM_WIDTH * index,
                  index,
                })}
                renderItem={({ item, index }) => {
                  const isActive = index === fullscreenIndex;
                  return (
                    <Pressable
                      onPress={() => handleFullscreenThumbnailPress(index)}
                      style={[
                        styles.thumbnailCard,
                        styles.fullscreenThumbnailCard,
                        isActive && styles.thumbnailCardActive,
                      ]}
                    >
                      <Image
                        source={resolveImageSource(item)}
                        style={styles.thumbnailImage}
                        contentFit="cover"
                      />
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    position: "relative",
  },
  placeholderContainer: {
    width: SCREEN_WIDTH,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  expandHintBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    zIndex: 10,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    width: 20,
    backgroundColor: "#0B6FAD",
  },
  dotInactive: {
    width: 7,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  thumbnailStripContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  thumbnailListContent: {
    paddingHorizontal: 12,
    gap: THUMBNAIL_GAP,
  },
  thumbnailCard: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#1E293B",
  },
  fullscreenThumbnailCard: {
    width: 48,
    height: 48,
  },
  thumbnailCardActive: {
    borderColor: "#0B6FAD",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.96)",
    justifyContent: "space-between",
  },
  fullscreenTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 54 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  fullscreenCounter: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenBottomBar: {
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 12,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
});
