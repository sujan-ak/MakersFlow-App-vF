import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContextSupabase";
import { useColors } from "@/hooks/useColors";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";

function getPasswordStrength(pass: string) {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
}

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  // ── Email verification pending state ──────────────────────────────────────
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  // ─────────────────────────────────────────────────────────────────────────
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [schoolError, setSchoolError] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [gradeFocused, setGradeFocused] = useState(false);
  const [schoolFocused, setSchoolFocused] = useState(false);

  const strength = getPasswordStrength(password);
  const getStrengthColor = () => {
    if (strength <= 1) return "#EF4444";
    if (strength === 2) return "#F59E0B";
    return "#17E5D3";
  };

  const pickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "MakersFlow needs library permission to upload a profile photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
          Alert.alert("Image too large", "Image too large, please choose a smaller photo");
          return;
        }

        const uri = asset.uri.toLowerCase();
        const extension = uri.split('.').pop() || '';
        const validExtensions = ['jpg', 'jpeg', 'png'];

        if (!validExtensions.includes(extension) && !uri.startsWith('data:image/jpeg') && !uri.startsWith('data:image/png')) {
          Alert.alert("Invalid format", "Only image/jpeg and image/png files are allowed.");
          return;
        }

        setAvatarUri(asset.uri);
      }
    } catch (e) {
      console.error('Error picking image:', e);
    }
  };

  const uploadAvatar = async (userId: string) => {
    if (!avatarUri) return null;
    try {
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const filename = `${userId}_avatar.jpg`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        console.error('Error uploading avatar:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      return publicUrl;
    } catch (e) {
      console.error('Exception during avatar upload:', e);
      return null;
    }
  };

  async function handleGoogleSignup() {
    if (googleLoading) return;
    setError("");
    setGoogleLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await loginWithGoogle();

    if (result.success) {
      const profile = (result as any).profile;
      setGoogleLoading(false);
      if (profile && profile.grade) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/onboarding");
      }
    } else {
      setGoogleLoading(false);
      setError(result.error || "Google sign-up failed. Please try again.");
    }
  }

  async function handleRegister() {
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setGradeError("");
    setSchoolError("");
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    if (!name) { setNameError("Name is required"); hasError = true; }
    if (!email) {
      setEmailError("Email is required"); hasError = true;
    } else if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address"); hasError = true;
    }
    if (!password) {
      setPasswordError("Password is required"); hasError = true;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters"); hasError = true;
    }
    if (!confirm) {
      setConfirmError("Please confirm your password"); hasError = true;
    } else if (password !== confirm) {
      setConfirmError("Passwords do not match"); hasError = true;
    }
    if (!grade) { setGradeError("Grade is required"); hasError = true; }
    if (!school) { setSchoolError("School is required"); hasError = true; }
    if (hasError) return;

    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await register(name, email, password, grade, school);
    setLoading(false);

    if (result.success) {
      if (result.needsEmailVerification) {
        // Supabase Confirm Email is ON — signUp returned a user but no session.
        // Do NOT upload the avatar (no authenticated session → storage RLS would
        // reject it) and do NOT navigate into the app. Show the verification
        // prompt instead; the user must verify then sign in normally.
        setRegisteredEmail(email);
        setEmailVerificationSent(true);
        return;
      }

      // Auto-confirm is ON — a session was created immediately. Proceed as before.
      if (avatarUri) {
        try {
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser) {
            await uploadAvatar(supabaseUser.id);
          }
        } catch (uploadErr) {
          console.error("Avatar upload failed:", uploadErr);
        }
      }
      router.replace("/(auth)/onboarding");
    } else {
      setError(result.error || "Registration failed. Please try again.");
    }
  }

  // ── Email verification pending screen — rendered as an early return so the
  // registration form JSX below stays completely unchanged.
  if (emailVerificationSent) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.verifyContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.verifyContainer}>
            <View style={[styles.verifyIconWrap, { backgroundColor: colors.accent }]}>
              <Ionicons name="mail-unread" size={40} color="#0B6FAD" />
            </View>
            <Text style={[styles.verifyTitle, { color: colors.foreground }]}>Check your email</Text>
            <Text style={[styles.verifyBody, { color: colors.mutedForeground }]}>
              {"We've sent a verification link to\n"}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                {registeredEmail}
              </Text>
            </Text>
            <Text style={[styles.verifyHint, { color: colors.mutedForeground }]}>
              Please verify your email before signing in. Check your spam folder if you don't see it.
            </Text>
            <Pressable
              style={[styles.verifyBtn, { backgroundColor: "#0B6FAD" }]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.verifyBtnText}>Go to Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(auth)/login");
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join thousands of students on MAKERSFLOW</Text>
        </View>

        <View style={styles.form}>
          {/* Google Sign-Up button at the top */}
          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              {
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 12,
                height: 52,
                elevation: 2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={handleGoogleSignup}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.foreground} />
                <Text style={[styles.googleBtnText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          {/* Avatar Picker */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={pickAvatar} style={[styles.avatarContainer, { backgroundColor: colors.card }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera-outline" size={24} color="#0B6FAD" />
                  <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                </View>
              )}
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {[
            { label: "Full Name", value: name, setter: setName, icon: "person", placeholder: "Your full name", keyboard: "default" as const, error: nameError, setError: setNameError, focused: nameFocused, setFocused: setNameFocused },
            { label: "Email", value: email, setter: setEmail, icon: "mail", placeholder: "your@email.com", keyboard: "email-address" as const, error: emailError, setError: setEmailError, focused: emailFocused, setFocused: setEmailFocused },
          ].map((field) => (
            <View style={styles.fieldGroup} key={field.label}>
              <Text style={[styles.label, { color: colors.foreground }]}>{field.label}</Text>
              <View style={[
                styles.inputWrapper,
                {
                  borderColor: field.error ? "#DC2626" : (field.focused ? "#0B6FAD" : colors.border),
                  backgroundColor: colors.card,
                }
              ]}>
                <Ionicons name={field.icon as any} size={16} color="#0B6FAD" />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={field.value}
                  onChangeText={(text) => { field.setter(text); field.setError(""); }}
                  onFocus={() => field.setFocused(true)}
                  onBlur={() => field.setFocused(false)}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={field.keyboard}
                  autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
                />
              </View>
              {field.error ? <Text style={styles.fieldError}>{field.error}</Text> : null}
            </View>
          ))}

          {/* Password field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <View style={[
              styles.inputWrapper,
              {
                borderColor: passwordError ? "#DC2626" : (passwordFocused ? "#0B6FAD" : colors.border),
                backgroundColor: colors.card,
              }
            ]}>
              <Ionicons name="lock-closed" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={password}
                onChangeText={(text) => { setPassword(text); setPasswordError(""); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Min 8 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {passwordError ? (
              <Text style={styles.fieldError}>{passwordError}</Text>
            ) : (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Must be at least 8 characters</Text>
            )}
            {password && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: getStrengthColor() }}>
                  Strength: {strength <= 1 ? "Weak" : strength === 2 ? "Fair" : strength === 3 ? "Strong" : "Very Strong"}
                </Text>
              </View>
            )}
            {password && (
              <View style={styles.strengthBarContainer}>
                {[1, 2, 3, 4].map((step) => (
                  <View
                    key={step}
                    style={[styles.strengthSegment, { backgroundColor: step <= strength ? getStrengthColor() : "#D6E9F2" }]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Confirm password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Confirm Password</Text>
            <View style={[
              styles.inputWrapper,
              {
                borderColor: confirmError ? "#DC2626" : (confirmFocused ? "#0B6FAD" : colors.border),
                backgroundColor: colors.card,
              }
            ]}>
              <Ionicons name="lock-closed" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirm}
                onChangeText={(text) => { setConfirm(text); setConfirmError(""); }}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                placeholder="Repeat password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
            </View>
            {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
          </View>

          {/* Grade field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Grade</Text>
            <View style={[
              styles.inputWrapper,
              {
                borderColor: gradeError ? "#DC2626" : (gradeFocused ? "#0B6FAD" : colors.border),
                backgroundColor: colors.card,
              }
            ]}>
              <Ionicons name="book" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={grade}
                onChangeText={(text) => { setGrade(text); setGradeError(""); }}
                onFocus={() => setGradeFocused(true)}
                onBlur={() => setGradeFocused(false)}
                placeholder="e.g., 10th Grade"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {gradeError ? <Text style={styles.fieldError}>{gradeError}</Text> : null}
          </View>

          {/* School field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>School</Text>
            <View style={[
              styles.inputWrapper,
              {
                borderColor: schoolError ? "#DC2626" : (schoolFocused ? "#0B6FAD" : colors.border),
                backgroundColor: colors.card,
              }
            ]}>
              <Ionicons name="school" size={16} color="#0B6FAD" />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={school}
                onChangeText={(text) => { setSchool(text); setSchoolError(""); }}
                onFocus={() => setSchoolFocused(true)}
                onBlur={() => setSchoolFocused(false)}
                placeholder="Your school name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {schoolError ? <Text style={styles.fieldError}>{schoolError}</Text> : null}
          </View>

          {/* Create Account button */}
          <Pressable
            style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.85 : 1, overflow: 'hidden' }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient
              colors={["#0B6FAD", "#FF6B00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Ionicons name="person-add" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.btnText}>Create Account</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: "auto" }} />
              </View>
            )}
          </Pressable>

          <View style={styles.termsRow}>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}>By signing up, you agree to our </Text>
            <Pressable onPress={() => router.push("/settings/terms-of-service")}>
              <Text style={[styles.termsLink, { color: "#0B6FAD" }]}>Terms of Service</Text>
            </Pressable>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}> and </Text>
            <Pressable onPress={() => router.push("/settings/privacy-policy")}>
              <Text style={[styles.termsLink, { color: "#0B6FAD" }]}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.link, { color: "#0B6FAD" }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 24, width: 40 },
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontFamily: "Fredoka_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  form: { gap: 16 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626", flex: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 20,
  },
  btnText: { fontSize: 16, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 8,
  },
  termsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  termsText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  termsLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, paddingBottom: 24 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626", marginTop: 4 },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  strengthBarContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
    height: 4,
    width: "100%",
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: "#D6E9F2",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#0B6FAD",
    marginTop: 4,
  },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  // ── Email verification pending screen ─────────────────────────────────────
  verifyContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  verifyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 8,
  },
  verifyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  verifyTitle: { fontSize: 24, fontFamily: "Fredoka_700Bold", textAlign: "center" },
  verifyBody: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  verifyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  verifyBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    marginTop: 8,
  },
  verifyBtnText: { fontSize: 16, fontFamily: "Fredoka_600SemiBold", color: "#FFF" },
});
