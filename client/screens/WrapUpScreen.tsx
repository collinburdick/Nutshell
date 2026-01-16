import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "WrapUp">;
type WrapUpRouteProp = RouteProp<RootStackParamList, "WrapUp">;

interface WrapUpData {
  takeaways: string[];
  actionItems: string[];
  openQuestions: string[];
}

interface InsightItem {
  id: string;
  text: string;
  approved: boolean;
}

export default function WrapUpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<WrapUpRouteProp>();
  const { tableId, token } = route.params;

  const [takeaways, setTakeaways] = useState<InsightItem[]>([]);
  const [actionItems, setActionItems] = useState<InsightItem[]>([]);
  const [openQuestions, setOpenQuestions] = useState<InsightItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: wrapUpData, isLoading } = useQuery<WrapUpData>({
    queryKey: ["/api/tables", tableId, "wrapup"],
  });

  React.useEffect(() => {
    if (wrapUpData && !initialized) {
      setTakeaways(
        wrapUpData.takeaways.map((t, i) => ({ id: `t-${i}`, text: t, approved: true }))
      );
      setActionItems(
        wrapUpData.actionItems.map((a, i) => ({ id: `a-${i}`, text: a, approved: true }))
      );
      setOpenQuestions(
        wrapUpData.openQuestions.map((q, i) => ({ id: `q-${i}`, text: q, approved: true }))
      );
      setInitialized(true);
    }
  }, [wrapUpData, initialized]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tables/${tableId}/finalize`, {
        token,
        takeaways: takeaways.filter((t) => t.approved).map((t) => t.text),
        actionItems: actionItems.filter((a) => a.approved).map((a) => a.text),
        openQuestions: openQuestions.filter((q) => q.approved).map((q) => q.text),
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.reset({ index: 0, routes: [{ name: "Join" }] });
    },
  });

  const toggleItem = (
    items: InsightItem[],
    setItems: React.Dispatch<React.SetStateAction<InsightItem[]>>,
    id: string
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(items.map((item) => (item.id === id ? { ...item, approved: !item.approved } : item)));
  };

  const renderInsightSection = (
    title: string,
    icon: keyof typeof Feather.glyphMap,
    items: InsightItem[],
    setItems: React.Dispatch<React.SetStateAction<InsightItem[]>>
  ) => (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <Feather name={icon} size={18} color={theme.link} />
        <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
          {title}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: "auto" }}>
          {items.filter((i) => i.approved).length}/{items.length} selected
        </ThemedText>
      </View>

      {items.length > 0 ? (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggleItem(items, setItems, item.id)}
            style={({ pressed }) => [
              styles.insightItem,
              {
                backgroundColor: item.approved ? theme.backgroundSecondary : theme.backgroundRoot,
                borderColor: item.approved ? theme.link : theme.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: item.approved ? theme.link : "transparent",
                  borderColor: item.approved ? theme.link : theme.border,
                },
              ]}
            >
              {item.approved ? (
                <Feather name="check" size={14} color={theme.buttonText} />
              ) : null}
            </View>
            <ThemedText
              type="body"
              style={[styles.insightText, { opacity: item.approved ? 1 : 0.6 }]}
            >
              {item.text}
            </ThemedText>
          </Pressable>
        ))
      ) : (
        <View style={styles.emptySection}>
          <ThemedText type="small" style={{ color: theme.textMuted }}>
            No items generated
          </ThemedText>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          Generating wrap-up insights...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerInfo}>
          <ThemedText type="h3" style={styles.title}>
            Review Session Highlights
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Tap items to include or exclude from the final summary
          </ThemedText>
        </View>

        {renderInsightSection("Top Takeaways", "star", takeaways, setTakeaways)}
        {renderInsightSection("Action Items", "check-circle", actionItems, setActionItems)}
        {renderInsightSection("Open Questions", "help-circle", openQuestions, setOpenQuestions)}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.success,
              opacity: submitMutation.isPending ? 0.7 : pressed ? 0.9 : 1,
            },
          ]}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <>
              <Feather name="check" size={20} color={theme.buttonText} />
              <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                Complete Session
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerInfo: {
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    lineHeight: 24,
  },
  emptySection: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  submitButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.md,
  },
});
