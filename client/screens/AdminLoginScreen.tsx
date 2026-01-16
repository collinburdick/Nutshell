import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AdminLogin">;

export default function AdminLoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await apiRequest("POST", "/api/admin/login", { password: pwd });
      return res.json();
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem("adminToken", data.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("AdminDashboard");
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Invalid password. Please try again.");
    },
  });

  const handleLogin = () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }
    setError(null);
    loginMutation.mutate(password);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.inner, { paddingTop: insets.top + Spacing["3xl"] }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.link }]}>
              <Feather name="shield" size={32} color={theme.buttonText} />
            </View>
            <ThemedText type="h2" style={styles.title}>
              Admin Access
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Enter your admin password to manage events and monitor sessions
            </ThemedText>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                PASSWORD
              </ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: error ? theme.error : theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter admin password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.textMuted}
                  />
                </Pressable>
              </View>
              {error ? (
                <ThemedText type="caption" style={{ color: theme.error, marginTop: Spacing.xs }}>
                  {error}
                </ThemedText>
              ) : null}
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loginMutation.isPending}
              style={({ pressed }) => [
                styles.loginButton,
                { backgroundColor: theme.link, opacity: pressed || loginMutation.isPending ? 0.8 : 1 },
              ]}
            >
              {loginMutation.isPending ? (
                <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                  Signing in...
                </ThemedText>
              ) : (
                <>
                  <Feather name="log-in" size={20} color={theme.buttonText} />
                  <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                    Sign In
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  form: {
    gap: Spacing.xl,
  },
  inputContainer: {},
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
  },
  eyeButton: {
    padding: Spacing.sm,
  },
  loginButton: {
    height: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.md,
  },
});
