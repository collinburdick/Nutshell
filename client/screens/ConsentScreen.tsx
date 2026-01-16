import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <ThemedText type="h2">Consent & Transparency</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
          Nutshell captures audio to generate de-identified summaries in real time. This page explains what is captured,
          how it is scrubbed, and how long it is retained.
        </ThemedText>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">What We Capture</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Audio is captured for transcription. Summaries, themes, action items, and open questions are stored for
            organizers.
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">How We Scrub Data</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Names, emails, phone numbers, and other personal identifiers are removed by default. Quotes are disabled in
            strict privacy mode.
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Retention & Access</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Raw audio is retained only if enabled by organizers. Access is role-based, and share links can expire.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
