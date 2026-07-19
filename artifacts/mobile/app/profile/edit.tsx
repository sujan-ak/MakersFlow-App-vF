import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import { TEXT_STYLES } from "@/constants/typography";
import { validateImageFile, uploadAvatarFile } from "@/lib/fileValidation";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [grade, setGrade] = useState(user?.grade ?? "");
  const [school, setSchool] = useState(user?.school ?? "");
  const [avatarUri, setAvatarUri] = useState(user?.avatar ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPromise, setUploadPromise] = useState<Promise<{ success: boolean; publicUrl?: string; error?: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleSave() {
    if (!user?.id) return;

    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let finalAvatarUrl = avatarUri;
    const isLocalUri =
      avatarUri.startsWith("file://") ||
      avatarUri.startsWith("ph://") ||
      avatarUri.startsWith("content://");

    if (isLocalUri) {
      let uploadRes = null;
      if (uploadPromise) {
        uploadRes = await uploadPromise;
      } else {
        uploadRes = await uploadAvatarFile(user.id, avatarUri);
      }

      if (!uploadRes || !uploadRes.success || !uploadRes.publicUrl) {
        setLoading(false);
        Alert.alert(
          "Upload Failed",
          uploadRes?.error || "Profile picture upload failed. Please try again before saving.",
          [{ text: "OK" }]
        );
        return;
      }

      finalAvatarUrl = uploadRes.publicUrl;
    }

    const result = await updateUser({
      name,
      phone: phone.trim() || undefined,
      grade,
      school,
      avatar: finalAvatarUrl,
    });
    setLoading(false);

    if (result.success) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/profile");
      }
    } else {
      Alert.alert("Save Failed", result.error || "Failed to update profile.");
    }
  }

  async function pickImage() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant permission to access your photo library to change your profile picture.",
        [{ text: "OK" }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const pickedUri = asset.uri;

      // 1. Validate size / type using the metadata the picker already gives us
      const validation = await validateImageFile(
        pickedUri,
        (asset as any).mimeType,
        (asset as any).fileSize
      );
      if (!validation.valid) {
        Alert.alert("Invalid File", validation.error || "Please select a valid image.");
        return;
      }

      // 4. Instant optimistic UI feedback
      setAvatarUri(pickedUri);

      // 2. Upload to Supabase Storage in background
      if (user?.id) {
        setIsUploading(true);
        const promise = uploadAvatarFile(user.id, pickedUri);
        setUploadPromise(promise);

        promise.then((res) => {
          setIsUploading(false);
          if (!res.success) {
            Alert.alert(
              "Upload Failed",
              res.error || "Could not upload profile picture. Please try another image."
            );
          }
        });
      }
    }
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/profile");
            }
          }}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, TEXT_STYLES.pageTitle, { color: colors.foreground, fontSize: 18 }]}>Edit Profile</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={pickImage} style={styles.avatarPressable} disabled={isUploading}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.initials, TEXT_STYLES.pageTitle, { color: "#FFF", fontSize: 36 }]}>{initials || "S"}</Text>
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="camera" size={16} color="#FFF" />
                )}
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 20 }}>
              <Pressable onPress={pickImage} disabled={isUploading}>
                <Text style={[styles.changePhotoText, TEXT_STYLES.label, { color: colors.primary }]}>
                  {isUploading ? "Uploading..." : "Change Photo"}
                </Text>
              </Pressable>
              {avatarUri ? (
                <Pressable
                  disabled={isUploading}
                  onPress={async () => {
                    try {
                      // Remove the stored avatar file from Supabase storage
                      if (avatarUri.includes("supabase.co") && avatarUri.includes("avatars")) {
                        const filename = avatarUri.split("?")[0].split("/").pop();
                        if (filename) {
                          await supabase.storage.from("avatars").remove([filename]);
                        }
                      }
                    } catch {
                      // Storage cleanup failure shouldn't block removing the photo
                    }
                    setAvatarUri("");
                    setUploadPromise(null);
                  }}
                >
                  <Text style={[styles.changePhotoText, TEXT_STYLES.label, { color: "#DC2626" }]}>Remove Photo</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Email (Read-only) */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, TEXT_STYLES.label, { color: colors.foreground }]}>Email</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="mail" size={16} color={colors.mutedForeground} />
              <Text style={[styles.disabledText, TEXT_STYLES.description, { color: colors.mutedForeground }]}>{user?.email}</Text>
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, TEXT_STYLES.label, { color: colors.foreground }]}>Phone Number</Text>
            <View style={[styles.inputWrapper, {
              backgroundColor: colors.card,
              borderColor: focusedField === "phone" ? colors.primary : colors.border,
              borderWidth: focusedField === "phone" ? 1.5 : 1
            }]}>
              <Ionicons name="call" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, TEXT_STYLES.description, { color: colors.foreground }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {[
            { label: "Full Name", key: "name", value: name, setter: setName, placeholder: "Your full name", keyboard: "default" as const, icon: "person" },
            { label: "Grade / Class", key: "grade", value: grade, setter: setGrade, placeholder: "e.g. Class 10", keyboard: "default" as const, icon: "book" },
            { label: "School / Institution", key: "school", value: school, setter: setSchool, placeholder: "Your school name", keyboard: "default" as const, icon: "home" },
          ].map((field) => (
            <View key={field.label} style={styles.fieldGroup}>
              <Text style={[styles.label, TEXT_STYLES.label, { color: colors.foreground }]}>{field.label}</Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: colors.card,
                borderColor: focusedField === field.key ? colors.primary : colors.border,
                borderWidth: focusedField === field.key ? 1.5 : 1
              }]}>
                <Ionicons name={field.icon as any} size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, TEXT_STYLES.description, { color: colors.foreground }]}
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={field.keyboard}
                  onFocus={() => setFocusedField(field.key)}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
          ))}

          {/* Save Changes gradient CTA */}
          <LinearGradient
            colors={[colors.gradientStart || "#0B6FAD", colors.gradientEnd || "#17E5D3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGradient}
          >
            <Pressable
              style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.9 : 1 }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.saveBtnText, TEXT_STYLES.button, { color: "#FFF" }]}>Save Changes</Text>
              )}
            </Pressable>
          </LinearGradient>

          {/* Cancel ghost button */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { borderColor: colors.primary, opacity: pressed ? 0.9 : 1 }
            ]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/profile");
              }
            }}
          >
            <Text style={[styles.cancelBtnText, TEXT_STYLES.button, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  saveText: { fontSize: 16, fontWeight: "700" },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 24 },
  avatarPressable: { position: "relative" },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  initials: { fontSize: 36, fontWeight: "800", color: "#FFF" },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  changePhotoText: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  disabledText: { flex: 1, fontSize: 15 },
  email: { fontSize: 14 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  inputWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  saveBtnGradient: { height: 48, borderRadius: 24, overflow: "hidden", marginTop: 16 },
  saveBtn: { height: 48, alignItems: "center", justifyContent: "center", width: "100%" },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  cancelBtn: { height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 12, backgroundColor: "#FFFFFF" },
  cancelBtnText: { fontSize: 15, fontWeight: "700" },
});
