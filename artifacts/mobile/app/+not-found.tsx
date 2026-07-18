import { Link, Stack, router } from "expo-router";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { TEXT_STYLES } from "@/constants/typography";

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found", headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
          <Ionicons name="compass" size={64} color={colors.primary} />
        </View>

        <Text style={[styles.title, TEXT_STYLES.pageTitle, { color: colors.foreground, marginVertical: 12 }]}>
          Oops! Page not found
        </Text>
        <Text style={[styles.subtitle, TEXT_STYLES.description, { color: colors.mutedForeground, textAlign: "center", marginBottom: 32 }]}>
          The page you are looking for might have been removed or is temporarily unavailable.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }
          ]}
          onPress={() => router.replace("/")}
        >
          <Ionicons name="home" size={18} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={[styles.btnText, TEXT_STYLES.button, { color: "#FFF" }]}>Go Home</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 280,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 24,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
