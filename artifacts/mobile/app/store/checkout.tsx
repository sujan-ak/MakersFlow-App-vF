import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContextSupabase";
import { supabase } from "@/lib/supabase";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { setInvoicePath } from "@/lib/invoiceStorage";
import { RazorpayWebView, type RazorpayPaymentParams } from "@/components/RazorpayWebView";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "@/services/razorpayService";

// ─── Slide-to-Pay Button ─────────────────────────────────────────────────────

function SlideToPayButton({
  amount,
  onSlideComplete,
  loading,
}: {
  amount: number;
  onSlideComplete: () => void;
  loading: boolean;
}) {
  const TRACK_WIDTH = 340; // approximate; thumb travel = TRACK_WIDTH - 48 - 8
  const THUMB_SIZE = 48;
  const PADDING = 4;
  const MAX_SLIDE = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

  const translateX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [completed, setCompleted] = useState(false);

  const onSlideCompleteRef = useRef(onSlideComplete);
  onSlideCompleteRef.current = onSlideComplete;

  // Pulse animation on the chevrons to hint sliding
  useEffect(() => {
    if (loading || completed) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [loading, completed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(0, Math.min(gs.dx, MAX_SLIDE));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx >= MAX_SLIDE * 0.85) {
          Animated.timing(translateX, {
            toValue: MAX_SLIDE,
            duration: 120,
            useNativeDriver: true,
          }).start(() => {
            setCompleted(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSlideCompleteRef.current();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Reset when loading finishes (payment failed / dismissed)
  useEffect(() => {
    if (!loading && completed) {
      // Payment may have failed — reset after a delay
      setTimeout(() => {
        setCompleted(false);
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }, 800);
    } else if (!loading && !completed) {
      translateX.setValue(0);
    }
  }, [loading, completed]);

  return (
    <View style={styles.slideTrack}>
      <LinearGradient
        colors={["#0B6FAD", "#FF6B00"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <>
          {/* Hint chevrons */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, opacity: pulseAnim },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.slideLabel}>Slide to Pay ₹{amount}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
          </Animated.View>

          {/* Draggable thumb */}
          <Animated.View
            style={[styles.slideThumb, { transform: [{ translateX }] }]}
            {...panResponder.panHandlers}
          >
            {completed ? (
              <Ionicons name="checkmark" size={22} color="#0B6FAD" />
            ) : (
              <Ionicons name="chevron-forward" size={22} color="#0B6FAD" />
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, total, clearCart, addToCart, decrementQuantity } = useCart();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [shippingConfig, setShippingConfig] = useState({ fee: 49, remoteFee: 149, threshold: 999 });
  const [gstRates, setGstRates] = useState<Map<string, number>>(new Map());
  
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["shipping_fee", "shipping_fee_remote", "free_shipping_threshold"])
      .then(({ data }) => {
        if (!data) return;
        const map = Object.fromEntries(data.map((r: any) => [r.key, Number(r.value)]));
        setShippingConfig({
          fee: map.shipping_fee ?? 49,
          remoteFee: map.shipping_fee_remote ?? 149,
          threshold: map.free_shipping_threshold ?? 999,
        });
      });
  }, []);
  
  useEffect(() => {
    if (items.length === 0) return;
    supabase
      .from("products")
      .select("id, gst_rate")
      .in("id", items.map((i) => i.product.id))
      .then(({ data }) => {
        setGstRates(new Map((data ?? []).map((r: any) => [String(r.id), r.gst_rate ?? 18])));
      });
  }, [items]);

  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    label: string;
    id: string;
  } | null>(null);

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [formFullName, setFormFullName] = useState("");
  const [formAddressLine1, setFormAddressLine1] = useState("");
  const [formAddressLine2, setFormAddressLine2] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formPhone, setFormPhone] = useState("+91");

  const [showPayment, setShowPayment] = useState(false);
  const [razorpayParams, setRazorpayParams] = useState<RazorpayPaymentParams | null>(null);
  const [pendingAddress, setPendingAddress] = useState<any>(null);

  const discount = appliedPromo ? Math.min(appliedPromo.discount, total) : 0;
  const hasPhysical = items.some((i) => i.product.category === "physical");

  const REMOTE_STATES = new Set([
    "Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Sikkim", "Tripura",
    "Andaman and Nicobar Islands", "Lakshadweep",
    "Jammu and Kashmir", "Ladakh",
  ]);
  const taxable = Math.max(0, total - discount);
  const taxAmount = Math.round(
    items.reduce((sum, item) => {
      const itemSubtotal = item.product.price * item.quantity;
      const discountShare = total > 0 ? (itemSubtotal / total) * discount : 0;
      const itemTaxable = Math.max(0, itemSubtotal - discountShare);
      const rate = gstRates.get(String(item.product.id)) ?? 18;
      return sum + itemTaxable * (rate / 100);
    }, 0),
  );
  const activeAddress = addresses.find((a) => String(a.id) === selectedAddressId);
  const isRemoteState = !!(activeAddress?.state && REMOTE_STATES.has(activeAddress.state));
  const shippingFee =
    hasPhysical && taxable < shippingConfig.threshold
      ? (isRemoteState ? shippingConfig.remoteFee : shippingConfig.fee)
      : 0;
  const finalTotal = taxable + taxAmount + shippingFee;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (items.length === 0) router.back();
  }, [items.length]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setName(data.full_name);
      });
  }, [user?.id]);

  async function loadAddresses(keepSelectedId?: string) {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    if (error || !data) return;
    setAddresses(data);
    
    const idToSelect = keepSelectedId || selectedAddressId;
    if (idToSelect && data.some((a) => String(a.id) === idToSelect)) {
      setSelectedAddressId(idToSelect);
    } else {
      const def = data.find((a) => a.is_default) ?? data[0];
      if (def) {
        setSelectedAddressId(String(def.id));
        setName(def.full_name);
        setPhone(def.phone);
      } else {
        setSelectedAddressId(null);
      }
    }
  }

  useEffect(() => { loadAddresses(undefined); }, [user?.id]);

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setFormFullName(""); setFormAddressLine1(""); setFormAddressLine2("");
    setFormCity(""); setFormState(""); setFormPostalCode(""); setFormPhone("+91");
  };

  const handleEditAddress = (addr: any) => {
    setEditingAddressId(String(addr.id));
    setFormFullName(addr.full_name);
    setFormAddressLine1(addr.address_line1);
    setFormAddressLine2(addr.address_line2 ?? "");
    setFormCity(addr.city);
    setFormState(addr.state);
    setFormPostalCode(addr.postal_code);
    const ph = addr.phone ?? "";
    setFormPhone(ph.startsWith("+91") ? ph : `+91${ph}`);
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!formFullName.trim() || !formAddressLine1.trim() || !formCity.trim() || !formState.trim() || !formPostalCode.trim() || !formPhone.trim()) {
      Alert.alert("Validation Error", "All fields except Address Line 2 are required."); return;
    }
    const rawPhone = formPhone.trim().replace(/^\+91/, "");
    if (!/^\d{10}$/.test(rawPhone)) {
      Alert.alert("Validation Error", "Phone must be a 10-digit number after +91."); return;
    }
    if (!/^\d{6}$/.test(formPostalCode.trim())) {
      Alert.alert("Validation Error", "Pincode must be exactly 6 digits."); return;
    }
    if (!user?.id) return;

    const addressData = {
      user_id: user.id,
      full_name: formFullName.trim(),
      address_line1: formAddressLine1.trim(),
      address_line2: formAddressLine2.trim() || null,
      city: formCity.trim(),
      state: formState.trim(),
      postal_code: formPostalCode.trim(),
      phone: formPhone.trim().replace(/^\+91/, ""),
    };

    if (editingAddressId) {
      const { error } = await supabase.from("shipping_addresses").update(addressData).eq("id", Number(editingAddressId));
      if (error) { Alert.alert("Error", error.message); return; }
      setShowAddressForm(false);
      resetAddressForm();
      await loadAddresses(selectedAddressId ?? undefined);
    } else {
      const isFirst = addresses.length === 0;
      const { data: inserted, error } = await supabase
        .from("shipping_addresses")
        .insert({ ...addressData, is_default: isFirst })
        .select()
        .single();
      if (error) { Alert.alert("Error", error.message); return; }
      setShowAddressForm(false);
      resetAddressForm();
      const newId = inserted?.id ? String(inserted.id) : null;
      await loadAddresses(newId ?? undefined);
    }
  };

  const handleDeleteAddress = (addr: any) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to remove this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("shipping_addresses").delete().eq("id", addr.id);
            if (error) { Alert.alert("Error", error.message); return; }
            if (selectedAddressId === String(addr.id)) {
              setSelectedAddressId(null);
            }
            await loadAddresses();
          },
        },
      ]
    );
  };

  async function handleApplyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoError("");
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: {
          code,
          subtotal: total,
          item_ids: items.map((i) => String(i.product.id)),
          user_id: user?.id ?? null,
        },
      });

      if (error)         { setPromoError("Could not validate coupon. Try again."); return; }
      if (!data?.valid)  { setPromoError(data?.message || "Invalid coupon code."); return; }

      setAppliedPromo({
        code,
        discount: Number(data.discount ?? 0),
        label: data.label ?? "",
        id: data.coupon_id,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPromoError("Failed to validate coupon.");
    } finally {
      setPromoLoading(false);
    }
  }

  async function handlePay() {
    const activeAddress = addresses.find((a) => String(a.id) === selectedAddressId);

    if (hasPhysical && !activeAddress) {
      Alert.alert("Incomplete", "Please add and select a shipping address.");
      setLoading(false);
      return;
    }
    if (!hasPhysical && (!name.trim() || !phone.trim())) {
      Alert.alert("Incomplete", "Please fill in your name and phone number.");
      setLoading(false);
      return;
    }
    if (!user?.id) {
      Alert.alert("Login Required", "Please log in to place an order.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const cartItems = items.map((item) => ({
        id:        item.product.id,
        price:     item.product.price,
        qty:       item.quantity,
        is_course: (item.product as any).is_course ?? false,
        course_id: (item.product as any).course_id ?? null,
      }));

      let rzpOrder;
      try {
        rzpOrder = await createRazorpayOrder(cartItems, finalTotal);
      } catch (orderErr: any) {
        throw new Error(orderErr.message ?? "Failed to create Razorpay order.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();

      setPendingAddress(activeAddress);

      setRazorpayParams({
        orderId:     rzpOrder.id,
        amount:      rzpOrder.amount,
        currency:    rzpOrder.currency,
        keyId:       rzpOrder.key_id,
        name:        activeAddress?.full_name ?? name,
        email:       (profile as any)?.email ?? (user as any)?.email ?? "",
        phone:       activeAddress?.phone ?? phone,
        description: `${items.length} item${items.length > 1 ? "s" : ""} from MakersFlow`,
      });
      setShowPayment(true);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not start payment. Please try again.");
      setLoading(false);
    }
  }

  async function handlePaymentSuccess(
    paymentId: string,
    orderId: string,
    signature: string,
  ) {
    setShowPayment(false);
    setLoading(true);
    try {
      const verification = await verifyRazorpayPayment({
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature:  signature,
        amount:              finalTotal,
        user_id:             user!.id,
        coupon_code:         appliedPromo?.code ?? null,
        coupon_id:           appliedPromo?.id ?? null,
        discount_amount:     discount,
        tax_amount:          taxAmount,
      });

      if (!verification.success) {
        Alert.alert(
          "Verification Failed",
          "We could not verify your payment. If money was deducted, contact support with ID: " + paymentId,
        );
        return;
      }

      const { data: prodFlags } = await supabase
        .from("products")
        .select("id, is_course, course_id")
        .in("id", items.map((i) => i.product.id));
      const flagMap = new Map((prodFlags ?? []).map((p: any) => [String(p.id), p]));

      const orderItems = items.map((item) => {
        const f = flagMap.get(String(item.product.id));
        return {
          id:        String(item.product.id),
          title:     item.product.title,
          price:     item.product.price,
          qty:       item.quantity,
          is_course: !!(f?.is_course || f?.course_id),
          course_id: f?.course_id ? String(f.course_id) : (f?.is_course ? String(item.product.id) : null),
        };
      });

      const orderPayload = {
        user_id:             user!.id,
        total_amount:        finalTotal,
        status:              "paid",
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
        promo_code:          appliedPromo?.code ?? null,
        discount_amount:     discount,
        tax_amount:          taxAmount,
        shipping_address:    hasPhysical && pendingAddress
          ? {
              name:    pendingAddress.full_name,
              address: `${pendingAddress.address_line1}${pendingAddress.address_line2 ? `, ${pendingAddress.address_line2}` : ""}`,
              city:    `${pendingAddress.city}, ${pendingAddress.state} - ${pendingAddress.postal_code}`,
              phone:   pendingAddress.phone,
            }
          : { name, phone },
        items: orderItems,
      };

      console.log("[Checkout] Preparing database order insertion. finalTotal:", finalTotal, "orderPayload:", JSON.stringify(orderPayload, null, 2));

      const { error: rpcError } = await supabase.rpc("complete_paid_order", {
        p_order: orderPayload,
        p_product_ids: items.map((i) => String(i.product.id)),
        p_promo_id: appliedPromo?.id ?? null,
      });

      if (rpcError) {
        console.error("[Checkout] complete_paid_order RPC failed, using legacy path:", rpcError.message);

        let payload: Record<string, any> = { ...orderPayload };
        let orderError: any = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          console.log(`[Checkout] Attempting legacy orders insert. attempt: ${attempt}, payload:`, JSON.stringify(payload, null, 2));
          const { error: insErr } = await supabase.from("orders").insert(payload);
          orderError = insErr;
          if (!insErr) break;
          const match = insErr.code === "PGRST204"
            ? insErr.message?.match(/'([^']+)' column/)
            : null;
          if (match && match[1] in payload) {
            console.warn(`[Checkout] orders table missing '${match[1]}' — retrying without it`);
            delete payload[match[1]];
          } else {
            break;
          }
        }

        if (orderError) throw orderError;

        for (const oi of orderItems) {
          if (oi.is_course && oi.course_id) {
            const enrolledAt = new Date();
            const expiresAt = new Date(enrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);
            await supabase.from("enrollments").upsert(
              {
                user_id:        user!.id,
                course_id:      oi.course_id,
                payment_status: "completed",
                status:         "active",
                enrolled_at:    enrolledAt.toISOString(),
                expires_at:     expiresAt.toISOString(),
              },
              { onConflict: "user_id,course_id" },
            );
          }
        }
      }

      try {
        const ordId = Date.now().toString();
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 12px; }
  .page { max-width: 750px; margin: 0 auto; }
  .title { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; letter-spacing: 2px; }
  .top-grid { display: flex; gap: 0; border: 1px solid #333; margin-bottom: 0; }
  .seller-box { flex: 1; padding: 12px; border-right: 1px solid #333; }
  .inv-box { flex: 0 0 200px; padding: 12px; }
  .inv-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .inv-label { font-weight: bold; font-size: 11px; }
  .buyer-box { border: 1px solid #333; border-top: none; padding: 12px; margin-bottom: 0; }
  .buyer-label { font-size: 11px; color: #555; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #333; border-top: none; }
  th { background: #f5f5f5; padding: 8px; text-align: center; border: 1px solid #333; font-size: 11px; font-weight: bold; }
  td { padding: 8px; border: 1px solid #333; font-size: 11px; vertical-align: top; }
  .total-row td { font-weight: bold; }
  .bottom-section { display: flex; gap: 20px; margin-top: 16px; }
  .words-section { flex: 1; border: 1px solid #333; padding: 12px; }
  .bank-section { flex: 1; border: 1px solid #333; padding: 12px; }
  .sig-section { text-align: right; margin-top: 16px; border: 1px solid #333; padding: 12px; }
  .footer-note { text-align: center; font-size: 10px; color: #888; margin-top: 12px; }
  .company-name { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
  .section-label { font-weight: bold; font-size: 11px; margin-bottom: 6px; color: #333; }
</style>
</head><body>
<div class="page">
  <div class="title">TAX INVOICE</div>
  <div class="top-grid">
    <div class="seller-box">
      <div class="company-name">MAKERSFLOW / EDODWAJA PRIVATE LIMITED</div>
      <div>10-91, Vaddila Street, Near Post Office, Srungavru</div>
      <div>West Godavari, Andhra Pradesh, Code: 37</div>
      <div style="margin-top:8px;">State Name: Andhra Pradesh, Code: 37</div>
    </div>
    <div class="inv-box">
      <div class="inv-row"><span class="inv-label">Invoice No.</span><span>${paymentId.slice(-6).toUpperCase()}</span></div>
      <div class="inv-row"><span class="inv-label">Dated</span><span>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span></div>
      <div class="inv-row"><span class="inv-label">Payment ID</span><span style="font-size:9px;">${paymentId}</span></div>
    </div>
  </div>
  <div class="buyer-box">
    <div class="buyer-label">Buyer (Bill to)</div>
    <div class="company-name">${name}</div>
    ${pendingAddress ? `<div>${pendingAddress.address_line1 || ''} ${pendingAddress.address_line2 || ''}</div><div>${pendingAddress.city || ''}, ${pendingAddress.state || ''}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40%;">Particulars</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>GST Rate</th>
        <th>CGST</th>
        <th>SGST</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((i) => {
        const gstRate = 18;
        const baseAmt = i.product.price * i.quantity;
        const cgst = Math.round(baseAmt * (gstRate / 2) / 100);
        const sgst = Math.round(baseAmt * (gstRate / 2) / 100);
        return `<tr>
          <td>${i.product.title}</td>
          <td style="text-align:center;">${i.quantity}</td>
          <td style="text-align:right;">₹${i.product.price}</td>
          <td style="text-align:center;">${gstRate}%</td>
          <td style="text-align:right;">₹${cgst}</td>
          <td style="text-align:right;">₹${sgst}</td>
          <td style="text-align:right;">₹${baseAmt}</td>
        </tr>`;
      }).join('')}
      ${shippingFee > 0 ? `<tr><td>Shipping &amp; Handling</td><td style="text-align:center;">1</td><td style="text-align:right;">₹${shippingFee}</td><td style="text-align:center;">0%</td><td style="text-align:right;">₹0</td><td style="text-align:right;">₹0</td><td style="text-align:right;">₹${shippingFee}</td></tr>` : ''}
      ${appliedPromo ? `<tr><td colspan="6">Discount (${appliedPromo.code})</td><td style="text-align:right;color:#059669;">-₹${discount}</td></tr>` : ''}
      <tr class="total-row">
        <td colspan="6" style="text-align:right;">Total</td>
        <td style="text-align:right;">₹${finalTotal}</td>
      </tr>
    </tbody>
  </table>
  <div class="bottom-section">
    <div class="words-section">
      <div class="section-label">Amount Chargeable (in words)</div>
      <div style="font-style:italic;">INR ${finalTotal} Only</div>
      <div style="margin-top:12px;font-size:10px;">E &amp; O.E</div>
      <div style="margin-top:8px;"><span class="section-label">Remarks:</span> MakersFlow Order</div>
    </div>
    <div class="bank-section">
      <div class="section-label">Payment Details</div>
      <div>Account Number: 070405003241</div>
      <div>Account Holder: EDODWAJA PRIVATE LIMITED</div>
      <div>IFSC Code: ICIC0000704</div>
      <div style="margin-top:8px;">for EDODWAJA PRIVATE LIMITED</div>
    </div>
  </div>
  <div class="sig-section">
    <div style="margin-bottom:40px;"></div>
    <div>Authorised Signatory</div>
  </div>
  <div class="footer-note">This is a Computer Generated Invoice</div>
</div>
</body></html>`;

        if (Platform.OS === "web") {
          await setInvoicePath(ordId, `html:${html}`);
        } else {
          const { uri } = await Print.printToFileAsync({ html, base64: false });
          const dir = `${FileSystem.documentDirectory}invoices/`;
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const dest = `${dir}invoice_${ordId}.pdf`;
          await FileSystem.moveAsync({ from: uri, to: dest });
          await setInvoicePath(ordId, dest);
        }
      } catch (e) {
        console.error("[Checkout] Invoice error:", e);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();

      Alert.alert(
        "🎉 Payment Successful!",
        `₹${finalTotal} paid.\nPayment ID: ${paymentId.slice(-8)}${appliedPromo ? `\nYou saved ₹${discount}!` : ""}`,
        [
          { text: "View Orders", onPress: () => router.replace("/store/orders") },
          { text: "OK", onPress: () => router.replace("/(tabs)") },
        ],
      );
    } catch (err: any) {
      console.error("[Checkout] Post-payment error:", err);
      Alert.alert(
        "Order Error",
        `Payment was successful (ID: ${paymentId}) but order saving failed. Please contact support.`,
      );
    } finally {
      setLoading(false);
      setPendingAddress(null);
      setRazorpayParams(null);
    }
  }

  function handlePaymentFailure(reason: string) {
    setShowPayment(false);
    setRazorpayParams(null);
    Alert.alert(
      "Payment Failed",
      reason || "Your payment could not be completed. No amount has been deducted.",
      [
        { text: "Try Again", onPress: () => setLoading(false) },
        { text: "Cancel", style: "cancel", onPress: () => setLoading(false) }
      ],
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background, paddingTop: topPad + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0B6FAD" />
        </Pressable>
        <Ionicons name="cart" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
        <Pressable style={[styles.shopBtn, { backgroundColor: "#0B6FAD" }]} onPress={() => router.push("/(tabs)/store")}>
          <Text style={styles.shopBtnText}>Browse Store</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#0B6FAD" />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Checkout</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Step Indicator */}
        <View style={[styles.stepIndicatorContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {[
            { id: 1, label: "Cart", status: "done" },
            { id: 2, label: "Checkout", status: "current" },
            { id: 3, label: "Payment", status: "upcoming" }
          ].map((step, idx) => (
            <React.Fragment key={step.id}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  {
                    backgroundColor: step.status === "done" || step.status === "current" ? "#0B6FAD" : "#E8F4F9",
                  }
                ]}>
                  {step.status === "done" ? (
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  ) : (
                    <Text style={[styles.stepNum, { color: step.status === "current" ? "#FFF" : "#5A7A8C" }]}>{step.id}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  {
                    color: step.status === "current" || step.status === "done" ? "#0B6FAD" : "#5A7A8C",
                    fontFamily: step.status === "current" ? "Inter_600SemiBold" : "Inter_400Regular"
                  }
                ]}>
                  {step.label}
                </Text>
              </View>
              {idx < 2 && (
                <View style={[
                  styles.stepLine,
                  {
                    backgroundColor: step.status === "done" ? "#0B6FAD" : "#D6E9F2"
                  }
                ]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Order Summary</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {items.map((item) => (
              <View key={item.product.id} style={styles.orderItem}>
                <Image
                  source={
                    item.product.thumbnail
                      ? typeof item.product.thumbnail === "string"
                        ? { uri: item.product.thumbnail }
                        : item.product.thumbnail
                      : require('@/assets/images/course_robotics.png')
                  }
                  style={styles.itemThumbnail}
                />
                <View style={styles.itemInfo}>
                  <Text style={[styles.orderItemName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.product.title}
                  </Text>
                  <Text style={[styles.orderItemPrice, { color: "#0B6FAD" }]}>
                    ₹{item.product.price}
                  </Text>
                </View>
                <View style={[styles.controlsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Pressable onPress={() => decrementQuantity(String(item.product.id))} style={styles.controlBtn} hitSlop={8}>
                    <Ionicons name={item.quantity <= 1 ? "trash" : "remove"} size={14} color={item.quantity <= 1 ? "#ef4444" : colors.foreground} />
                  </Pressable>
                  <Text style={[styles.qtyText, { color: colors.foreground }]}>{item.quantity}</Text>
                  <Pressable onPress={() => addToCart(item.product)} style={styles.controlBtn} hitSlop={8}>
                    <Ionicons name="add" size={14} color={colors.foreground} />
                  </Pressable>
                </View>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: "#D6E9F2" }]}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Subtotal</Text>
              <Text style={[styles.totalAmount, { color: colors.foreground }]}>₹{total}</Text>
            </View>
            {appliedPromo && (
              <View style={styles.discountRow}>
                <Text style={styles.discountLabel}>Coupon ({appliedPromo.code}) — {appliedPromo.label}</Text>
                <Text style={styles.discountAmount}>-₹{discount}</Text>
              </View>
            )}
            <View style={styles.discountRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>GST</Text>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>+₹{taxAmount}</Text>
            </View>
            {hasPhysical && (
              <View style={styles.discountRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                  Shipping{shippingFee === 0 ? " (free)" : isRemoteState ? " (remote area)" : ""}
                </Text>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                  {shippingFee === 0 ? "₹0" : `+₹${shippingFee}`}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, { borderTopColor: "#D6E9F2" }]}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.totalAmount, { color: "#0B6FAD" }]}>₹{finalTotal}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Promo Code</Text>
          {appliedPromo ? (
            <View style={[styles.promoApplied, { backgroundColor: "#DCF7F4", borderColor: "#17E5D3" }]}>
              <Ionicons name="checkmark-circle" size={16} color="#0B6FAD" />
              <Text style={styles.promoAppliedText}>{appliedPromo.code} — {appliedPromo.label} applied!</Text>
              <Pressable onPress={() => { setAppliedPromo(null); setPromoCode(""); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#0B6FAD" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.promoRow}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: promoError ? "#DC2626" : colors.border, flex: 1 }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={promoCode}
                  onChangeText={(t) => { setPromoCode(t.toUpperCase()); setPromoError(""); }}
                  placeholder="Enter promo code"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                />
              </View>
              <Pressable style={[styles.promoBtn, { backgroundColor: "#0B6FAD", opacity: promoLoading ? 0.7 : 1 }]} onPress={handleApplyPromo} disabled={promoLoading}>
                {promoLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.promoBtnText}>Apply</Text>}
              </Pressable>
            </View>
          )}
          {promoError ? <Text style={styles.promoError}>{promoError}</Text> : null}

          {hasPhysical ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Shipping Address</Text>
                <Pressable onPress={() => { resetAddressForm(); setShowAddressForm(true); }} style={styles.addAddrBtn}>
                  <Ionicons name="add" size={14} color="#0B6FAD" />
                  <Text style={[styles.addAddrBtnText, { color: "#0B6FAD" }]}>Add New</Text>
                </Pressable>
              </View>
              {addresses.map((addr) => {
                const isSelected = String(addr.id) === selectedAddressId;
                const textStyle = {
                  color: isSelected ? "#FFFFFF" : colors.foreground,
                };
                const subTextStyle = {
                  color: isSelected ? "rgba(255, 255, 255, 0.85)" : colors.mutedForeground,
                };
                return (
                  <Pressable
                    key={addr.id}
                    onPress={() => {
                      setSelectedAddressId(String(addr.id));
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    style={[
                      styles.addressCard,
                      {
                        backgroundColor: isSelected ? "#0B6FAD" : colors.card,
                        borderColor: isSelected ? "#0B6FAD" : colors.border,
                        borderWidth: isSelected ? 2.5 : 1.2,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        padding: 16,
                      }
                    ]}
                  >
                    {/* Left Icon Selection Indicator */}
                    <View style={{ justifyContent: "center", alignItems: "center" }}>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={isSelected ? "#FFFFFF" : colors.mutedForeground}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.addressCardHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[styles.addressName, textStyle, { fontFamily: "Fredoka_700Bold" }]}>
                            {addr.full_name}
                          </Text>
                          {addr.is_default && (
                            <View style={[styles.defaultBadge, { backgroundColor: isSelected ? "#FFFFFF" : "#0B6FAD" }]}>
                              <Text style={[styles.defaultBadgeText, { color: isSelected ? "#0B6FAD" : "#FFF" }]}>Default</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Pressable onPress={() => handleEditAddress(addr)} hitSlop={8}>
                            <Ionicons name="create" size={18} color={isSelected ? "#FFFFFF" : "#0B6FAD"} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteAddress(addr)}
                            hitSlop={12}
                            style={{ padding: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color={isSelected ? "#FFEBEB" : "#EF4444"} />
                          </Pressable>
                        </View>
                      </View>
                      
                      <Text style={[styles.addressText, subTextStyle, { marginTop: 4, fontFamily: "Inter_500Medium" }]}>
                        {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}
                      </Text>
                      <Text style={[styles.addressText, subTextStyle, { fontFamily: "Inter_500Medium" }]}>
                        {addr.city}, {addr.state} - {addr.postal_code}
                      </Text>
                      <Text style={[styles.addressText, textStyle, { fontFamily: "Inter_600SemiBold", marginTop: 4 }]}>
                        Ph: {addr.phone}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {addresses.length === 0 && (
                <View style={[styles.emptyAddressesCard, { borderColor: colors.border }]}>
                  <Ionicons name="location" size={24} color={colors.mutedForeground} style={{ marginBottom: 4 }} />
                  <Text style={[styles.emptyAddressesText, { color: colors.mutedForeground }]}>No saved addresses. Please add a shipping address.</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contact Details</Text>
              {[
                { label: "Full Name", value: name, setter: setName, placeholder: "Your full name", keyboard: "default" as const },
                { label: "Phone", value: phone, setter: setPhone, placeholder: "10-digit mobile number", keyboard: "phone-pad" as const },
              ].map((field) => (
                <View key={field.label} style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>{field.label}</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={field.value}
                      onChangeText={field.setter}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType={field.keyboard}
                    />
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment</Text>
          <View style={[styles.paymentCard, { backgroundColor: "#DCF7F4", borderColor: "#0B6FAD" }]}>
            <Ionicons name="card" size={20} color="#0B6FAD" />
            <Text style={[styles.paymentText, { color: "#0B6FAD" }]}>UPI / Debit / Credit Card (Razorpay)</Text>
            <Ionicons name="lock-closed" size={16} color="#0B6FAD" />
          </View>
        </ScrollView>

        <View style={[styles.cta, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8 }]}>
          <SlideToPayButton amount={finalTotal} onSlideComplete={handlePay} loading={loading} />
          <Text style={[styles.secureNote, { color: colors.mutedForeground }]}>
            <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} /> Secured by Razorpay · 100% Safe
          </Text>
        </View>
      </View>

      <RazorpayWebView
        visible={showPayment}
        params={razorpayParams}
        onSuccess={handlePaymentSuccess}
        onFailure={handlePaymentFailure}
        onDismiss={() => {
          setShowPayment(false);
          setRazorpayParams(null);
        }}
      />

      <Modal visible={showAddressForm} transparent animationType="slide" onRequestClose={() => setShowAddressForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingAddressId ? "Edit Address" : "Add New Address"}</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {[
                  { label: "Full Name", value: formFullName, setter: setFormFullName, placeholder: "e.g. John Doe" },
                  { label: "Address Line 1", value: formAddressLine1, setter: setFormAddressLine1, placeholder: "Flat / House No / Street" },
                  { label: "Address Line 2 (Optional)", value: formAddressLine2, setter: setFormAddressLine2, placeholder: "Area / Landmark" },
                  { label: "City", value: formCity, setter: setFormCity, placeholder: "e.g. Mumbai" },
                  { label: "State", value: formState, setter: setFormState, placeholder: "e.g. Maharashtra" },
                ].map((field) => (
                  <View key={field.label} style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: colors.foreground }]}>{field.label}</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TextInput style={[styles.input, { color: colors.foreground }]} value={field.value} onChangeText={field.setter} placeholder={field.placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={(field as any).keyboard ?? "default"} />
                    </View>
                  </View>
                ))}

                {/* Pincode — max 6 digits */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Pincode</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={formPostalCode}
                      onChangeText={(t) => setFormPostalCode(t.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit pincode"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                  </View>
                </View>

                {/* Phone — prefixed with +91 */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Phone</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center" }]}>
                    <Text style={[styles.input, { color: colors.foreground, marginRight: 4 }]}>+91</Text>
                    <TextInput
                      style={[styles.input, { flex: 1, color: colors.foreground }]}
                      value={formPhone.replace(/^\+91/, "")}
                      onChangeText={(t) => setFormPhone("+91" + t.replace(/\D/g, "").slice(0, 10))}
                      placeholder="10-digit number"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>
              </ScrollView>
              <View style={styles.modalBtnRow}>
                <Pressable style={[styles.modalBtn, { backgroundColor: "#0B6FAD" }]} onPress={handleSaveAddress}>
                  <Text style={styles.modalBtnText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => { setShowAddressForm(false); resetAddressForm(); }}>
                  <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, alignItems: "center", paddingHorizontal: 24, gap: 16 },
  backBtn: { alignSelf: "flex-start", marginBottom: 32 },
  emptyTitle: { fontSize: 20, fontFamily: "Fredoka_700Bold" },
  shopBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
  shopBtnText: { fontSize: 15, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  sectionTitle: { fontSize: 17, fontFamily: "Fredoka_700Bold", marginTop: 8, marginBottom: 10 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 10, marginBottom: 4 },
  orderItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemThumbnail: { width: 48, height: 48, borderRadius: 8 },
  itemInfo: { flex: 1, gap: 2 },
  controlsContainer: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "#FFFFFF" },
  controlBtn: { padding: 4 },
  qtyText: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 16, textAlign: "center" },
  removeBtn: { padding: 4 },
  orderItemName: { fontSize: 14, fontFamily: "Fredoka_600SemiBold", flex: 1 },
  orderItemPrice: { fontSize: 14, fontFamily: "Fredoka_700Bold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1.5, marginTop: 4 },
  totalLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  totalAmount: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  fieldGroup: { gap: 6, marginBottom: 12 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inputWrapper: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12 },
  input: { fontSize: 15, fontFamily: "Inter_400Regular" },
  paymentCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, borderWidth: 2 },
  paymentText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cta: { padding: 16, borderTopWidth: 1 },
  secureNote: { textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  promoRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 4 },
  promoBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0B6FAD",
    alignItems: "center",
    justifyContent: "center",
  },
  promoBtnText: { fontSize: 14, fontFamily: "Fredoka_600SemiBold", color: "#fff" },
  promoApplied: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, marginBottom: 4 },
  promoAppliedText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0B6FAD" },
  promoError: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626", marginTop: 4, marginBottom: 8 },
  discountRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  discountLabel: { fontSize: 13, color: "#10B981", fontFamily: "Inter_600SemiBold" },
  discountAmount: { fontSize: 13, color: "#10B981", fontFamily: "Fredoka_700Bold" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 10 },
  addAddrBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  addAddrBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  addressCard: { borderRadius: 14, padding: 14, marginBottom: 10, gap: 4 },
  addressCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  addressName: { fontSize: 15, fontFamily: "Fredoka_600SemiBold" },
  defaultBadge: { backgroundColor: "#DCF7F4", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  defaultBadgeText: { color: "#0B6FAD", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  addressText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  emptyAddressesCard: { borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", padding: 24, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyAddressesText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 400, maxHeight: "85%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Fredoka_700Bold" },
  modalBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 20, height: 40, alignItems: "center", justifyContent: "center" },
  modalBtnText: { color: "#FFF", fontFamily: "Fredoka_600SemiBold", fontSize: 14 },
  stepIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D6E9F2",
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontSize: 11,
    fontFamily: "Fredoka_700Bold",
  },
  stepLabel: {
    fontSize: 12,
  },
  stepLine: {
    width: 32,
    height: 2,
    marginHorizontal: 8,
  },
  slideTrack: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    justifyContent: "center",
  },
  slideThumb: {
    position: "absolute",
    left: 4,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  slideLabel: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Fredoka_600SemiBold",
    color: "#FFF",
    letterSpacing: 0.5,
  },
});