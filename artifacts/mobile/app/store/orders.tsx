import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContextSupabase";
import { supabase } from "@/lib/supabase";
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Refund Modal States
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['paid', 'completed', 'failed', 'refunded', 'refund_requested'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Orders] Error fetching orders:', error);
          return;
        }

        if (data) {
          const mapped = data.map((order: any) => {
            let itemsList: any[] = [];
            try {
              itemsList = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            } catch (e) {
              itemsList = Array.isArray(order.items) ? order.items : [];
            }
            const dateObj = new Date(order.created_at);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            return {
              id: String(order.id),
              date: dateStr,
              status: order.status === 'refund_requested' ? 'Refund Requested' :
                      order.status ? (order.status.charAt(0).toUpperCase() + order.status.slice(1)) : 'Processing',
              rawStatus: order.status,
              items: itemsList.map((i: any) => i.title || "Untitled Product"),
              total: Number(order.total_amount) || 0,
              tax: Number(order.tax_amount) || 0,
              shipping: order.shipping_address ?? null,
              created_at: order.created_at,
              total_amount: Number(order.total_amount) || 0,
            };
          });
          setOrders(mapped);
        }
      } catch (err) {
        console.error('[Orders] Load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, [user?.id]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const submitRefundRequest = async () => {
    if (!refundReason.trim()) {
      Alert.alert('Validation Error', 'Reason cannot be blank.');
      return;
    }
    if (!user?.id || !refundOrderId) return;

    setIsSubmittingRefund(true);
    try {
      // 1. Insert into refund_requests
      const { error: refundError } = await supabase
        .from('refund_requests')
        .insert({
          user_id: user.id,
          order_id: Number(refundOrderId),
          reason: refundReason.trim(),
          status: 'pending'
        });

      if (refundError) throw refundError;

      // 2. Update order status to 'refund_requested'
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'refund_requested' })
        .eq('id', Number(refundOrderId));

      if (orderError) throw orderError;

      Alert.alert('Submitted', 'Your refund request has been submitted. Our team will review it shortly.');
      
      // Update local state to reflect status change
      setOrders(prev => prev.map(o => o.id === refundOrderId ? { ...o, status: 'Refund Requested', rawStatus: 'refund_requested' } : o));
      
      setShowRefundModal(false);
      setRefundReason("");
      setRefundOrderId(null);
    } catch (e: any) {
      console.error('[Refund] Error:', e);
      Alert.alert('Error', e.message || 'Failed to submit refund request. Please try again.');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  const generateInvoice = async (order: any) => {
    setSharingId(order.id);
    try {
      const html = `
        <h1>MakersFlow Invoice</h1>
        <p>Order ID: ${order.id}</p>
        <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
        <p>Amount: ₹${order.total_amount}</p>
        <p>Status: ${order.status}</p>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      console.error('[Invoice] Error generating invoice:', e);
      Alert.alert('Error', 'Failed to generate or share invoice.');
    } finally {
      setSharingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.mutedForeground, fontWeight: "500" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Orders</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {orders.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="package" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No orders yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: (order.status === "Delivered" || order.status === "Completed" || order.status === "Paid") ? "#DCFCE7" : "#FEF3C7" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: (order.status === "Delivered" || order.status === "Completed" || order.status === "Paid") ? "#16A34A" : "#D97706" },
                    ]}
                  >
                    {order.status}
                  </Text>
                </View>
                <Text style={[styles.date, { color: colors.mutedForeground }]}>{order.date}</Text>
              </View>
              <Text style={[styles.orderId, { color: colors.mutedForeground }]}>Order #{order.id.toUpperCase()}</Text>
              {order.items.map((item: string, i: number) => (
                <Text key={i} style={[styles.item, { color: colors.foreground }]}>
                  · {item}
                </Text>
              ))}
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total Paid</Text>
                <Text style={[styles.totalAmount, { color: colors.primary }]}>₹{order.total}</Text>
              </View>
              {order.tax > 0 && (
                <Text style={[styles.date, { color: colors.mutedForeground }]}>
                  Includes GST: ₹{order.tax}
                </Text>
              )}
              {order.shipping?.address && (
                <View style={{ marginTop: 6 }}>
                  <Text style={[styles.date, { color: colors.mutedForeground, fontWeight: "600" }]}>
                    Ship to: {order.shipping.name}
                  </Text>
                  <Text style={[styles.date, { color: colors.mutedForeground }]}>
                    {order.shipping.address}{order.shipping.city ? `, ${order.shipping.city}` : ""}
                  </Text>
                  {order.shipping.phone && (
                    <Text style={[styles.date, { color: colors.mutedForeground }]}>
                      {order.shipping.phone}
                    </Text>
                  )}
                </View>
              )}
              <Pressable
                style={[styles.invoiceBtn, { borderColor: colors.border }]}
                onPress={() => generateInvoice(order)}
                disabled={sharingId === order.id}
              >
                <Feather name="download" size={14} color={colors.primary} />
                <Text style={[styles.invoiceBtnText, { color: colors.primary }]}>
                  {sharingId === order.id ? 'Generating...' : 'Download Invoice'}
                </Text>
              </Pressable>
              {(order.rawStatus === 'completed' || order.rawStatus === 'failed') && (
                <Pressable
                  style={[styles.refundBtn, { borderColor: '#FCA5A5' }]}
                  onPress={() => {
                    setRefundOrderId(order.id);
                    setRefundReason("");
                    setShowRefundModal(true);
                  }}
                >
                  <Feather name="rotate-ccw" size={14} color="#DC2626" />
                  <Text style={[styles.refundBtnText]}>Request Refund</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Refund Request Modal */}
      <Modal
        visible={showRefundModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmittingRefund) {
            setShowRefundModal(false);
            setRefundReason("");
            setRefundOrderId(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Refund</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Please describe your reason for requesting a refund (max 200 characters).
            </Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              multiline
              numberOfLines={4}
              value={refundReason}
              onChangeText={(text) => {
                if (text.length <= 200) {
                  setRefundReason(text);
                }
              }}
              placeholder="Enter reason here..."
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {refundReason.trim().length}/200
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={submitRefundRequest}
                disabled={isSubmittingRefund}
              >
                {isSubmittingRefund ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalBtnText}>Submit</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
                onPress={() => {
                  setShowRefundModal(false);
                  setRefundReason("");
                  setRefundOrderId(null);
                }}
                disabled={isSubmittingRefund}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  orderCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, gap: 8 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontSize: 13, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },
  date: { fontSize: 12 },
  item: { fontSize: 14 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, marginTop: 4 },
  totalLabel: { fontSize: 13 },
  totalAmount: { fontSize: 16, fontWeight: "700" },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  invoiceBtnText: { fontSize: 13, fontWeight: '600' },
  refundBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start', backgroundColor: '#FEF2F2' },
  refundBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    height: 100,
    textAlignVertical: "top",
    fontSize: 14,
  },
  charCount: {
    alignSelf: "flex-end",
    fontSize: 11,
    marginTop: -8,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
