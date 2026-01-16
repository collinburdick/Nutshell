import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Keyboard,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Join">;

export default function JoinScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const joinMutation = useMutation({
    mutationFn: async (joinCode: string) => {
      const res = await apiRequest("POST", "/api/join", { joinCode });
      return res.json();
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("Session", { tableId: data.tableId, token: data.token });
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message.includes("404") ? "Invalid session code" : "Connection failed. Try again.");
    },
  });

  const handleCodeChange = (value: string, index: number) => {
    const newCode = code.split("");
    newCode[index] = value.toUpperCase();
    const updatedCode = newCode.join("").slice(0, 6);
    setCode(updatedCode);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updatedCode.length === 6) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoin = () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    joinMutation.mutate(code);
  };

  const isLoading = joinMutation.isPending;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing["4xl"] }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={styles.title}>
            Nutshell
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            The whole room, in a nutshell
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.cardTitle}>
            Enter Session Code
          </ThemedText>

          <View style={styles.codeInputContainer}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: theme.backgroundRoot,
                    color: theme.text,
                    borderColor: error ? theme.error : theme.border,
                  },
                ]}
                value={code[index] || ""}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                maxLength={1}
                keyboardType="default"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
                selectTextOnFocus
                testID={`code-input-${index}`}
              />
            ))}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color={theme.error} />
              <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            onPress={handleJoin}
            disabled={isLoading || code.length !== 6}
            style={({ pressed }) => [
              styles.joinButton,
              {
                backgroundColor: theme.link,
                opacity: isLoading || code.length !== 6 ? 0.6 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed && !isLoading ? 0.98 : 1 }],
              },
            ]}
            testID="join-button"
          >
            {isLoading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <>
                <Feather name="log-in" size={20} color={theme.buttonText} />
                <ThemedText
                  type="body"
                  style={[styles.joinButtonText, { color: theme.buttonText }]}
                >
                  Join Session
                </ThemedText>
              </>
            )}
          </Pressable>

        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="mic" size={18} color={theme.link} />
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
              Microphone access required for session capture
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="shield" size={18} color={theme.link} />
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
              Conversations are de-identified and privacy-protected
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <ThemedText type="caption" style={{ color: theme.textMuted, textAlign: "center" }}>
          By joining, you consent to session recording and AI-powered summarization
        </ThemedText>
        <Pressable
          onPress={() => navigation.navigate("AdminLogin")}
          style={styles.adminLink}
        >
          <Feather name="settings" size={14} color={theme.textMuted} />
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            Admin Login
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Consent")}
          style={styles.adminLink}
        >
          <Feather name="info" size={14} color={theme.textMuted} />
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            Consent & Transparency
          </ThemedText>
        </Pressable>
      </View>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    ...Shadows.md,
  },
  cardTitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  codeInputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontWeight: "500",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  joinButtonText: {
    fontWeight: "600",
  },
  infoContainer: {
    marginTop: Spacing["3xl"],
    gap: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
  },
  adminLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
});
