import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle, Dimensions } from "react-native";
import { useColors } from "@/hooks/useColors";

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.muted, opacity },
        style,
      ]}
    />
  );
}

export function CourseCardSkeleton({ width = CARD_WIDTH, style }: { width?: number | string; style?: ViewStyle }) {
  return (
    <View style={[styles.card, { width: width as any }, style]}>
      <Skeleton height={110} borderRadius={0} />
      <View style={styles.content}>
        <Skeleton width={70} height={14} />
        <Skeleton height={14} />
        <Skeleton width="70%" height={14} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

export function ProductCardSkeleton({ width = CARD_WIDTH, style }: { width?: number | string; style?: ViewStyle }) {
  return (
    <View style={[styles.productCard, { width: width as any }, style]}>
      <Skeleton height={140} borderRadius={0} />
      <View style={styles.productContent}>
        <Skeleton width="80%" height={14} />
        <Skeleton width={60} height={12} />
      </View>
    </View>
  );
}

export function CertificateSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 }}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={60} height={28} borderRadius={14} />
    </View>
  );
}

export function WishlistSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}>
      <ProductCardSkeleton width={140} />
      <ProductCardSkeleton width={140} />
    </View>
  );
}

export function BadgeSkeleton() {
  return (
    <View style={{ width: "47%", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E6EDF0", gap: 8 }}>
      <Skeleton width={64} height={64} borderRadius={32} />
      <Skeleton width="70%" height={16} />
      <Skeleton width="90%" height={12} style={{ marginTop: 4 }} />
      <Skeleton width="50%" height={12} />
    </View>
  );
}

export function AchievementsSkeleton() {
  return (
    <View style={{ flex: 1, padding: 20, gap: 24, backgroundColor: "#F8FAFC" }}>
      {/* Hero Header Stats Skeleton */}
      <Skeleton width="100%" height={140} borderRadius={16} />
      {/* Title */}
      <Skeleton width={100} height={22} style={{ marginTop: 8 }} />
      {/* Grid of Badges Skeletons */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
        <BadgeSkeleton />
        <BadgeSkeleton />
        <BadgeSkeleton />
        <BadgeSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 12,
    gap: 8,
  },
  content: {
    padding: 12,
    gap: 8,
  },
  productCard: {
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 12,
    gap: 8,
  },
  productContent: {
    padding: 12,
    gap: 8,
  },
});

export function HomeSkeleton() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 60, gap: 24, backgroundColor: "#F8FAFC" }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 8 }}>
          <Skeleton width={120} height={14} />
          <Skeleton width={180} height={24} />
        </View>
        <Skeleton width={48} height={48} borderRadius={24} />
      </View>
      
      {/* Banner */}
      <Skeleton width="100%" height={120} borderRadius={16} />
      
      {/* Horizontal List 1 */}
      <View style={{ gap: 12 }}>
        <Skeleton width={150} height={20} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </View>
      </View>
    </View>
  );
}

export function ListSkeleton() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, padding: 20, gap: 16, backgroundColor: "#F8FAFC" }}>
      <Skeleton width="100%" height={100} borderRadius={12} />
      <Skeleton width="100%" height={100} borderRadius={12} />
      <Skeleton width="100%" height={100} borderRadius={12} />
      <Skeleton width="100%" height={100} borderRadius={12} />
    </View>
  );
}

export function DetailSkeleton() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <Skeleton width="100%" height={250} borderRadius={0} />
      <View style={{ padding: 20, gap: 16 }}>
        <Skeleton width="80%" height={28} />
        <Skeleton width={100} height={20} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Skeleton width={80} height={32} borderRadius={16} />
          <Skeleton width={80} height={32} borderRadius={16} />
        </View>
        <Skeleton width="100%" height={80} borderRadius={12} style={{ marginTop: 24 }} />
        <Skeleton width="100%" height={60} borderRadius={12} />
        <Skeleton width="100%" height={60} borderRadius={12} />
      </View>
    </View>
  );
}

