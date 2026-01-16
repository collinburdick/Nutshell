import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useRoute, RouteProp } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SessionSummaryRouteProp = RouteProp<RootStackParamList, "SessionSummary">;

interface TableSummary {
  tableId: number;
  tableNumber: number;
  summary: string;
  themes: string[];
  actionItems: string[];
  openQuestions: string[];
}

interface AggregatedSummary {
  sessionId: number;
  sessionName: string;
  sessionTopic: string | null;
  overallSummary: string;
  themes: { theme: string; tableIds: number[] }[];
  actionItems: string[];
  openQuestions: string[];
  tableSummaries: TableSummary[];
}

type ViewMode = "present" | "explore";

export default function SessionSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const route = useRoute<SessionSummaryRouteProp>();
  const { sessionId } = route.params;

  const [viewMode, setViewMode] = useState<ViewMode>("present");
  const [darkPresentation, setDarkPresentation] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { data: summary, isLoading, refetch, isError } = useQuery<AggregatedSummary>({
    queryKey: ["/api/sessions", sessionId, "aggregated-summary"],
  });

  const toggleTable = (tableId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const toggleTheme = (themeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeName)) {
        next.delete(themeName);
      } else {
        next.add(themeName);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copyAllActionItems = async () => {
    if (summary?.actionItems) {
      const text = summary.actionItems.map((item, i) => `${i + 1}. ${item}`).join("\n");
      await copyToClipboard(text);
    }
  };

  const filteredThemes = summary?.themes.filter((t) =>
    t.theme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentBg = darkPresentation ? "#0A0A0A" : theme.backgroundRoot;
  const presentText = darkPresentation ? "#FFFFFF" : theme.text;
  const presentMuted = darkPresentation ? "#888888" : theme.textMuted;
  const amber = "#D97706";

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={amber} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textMuted }}>
            Loading summary...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (isError || !summary) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Failed to load summary
          </ThemedText>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: amber }]}
          >
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, viewMode === "present" ? { backgroundColor: presentBg } : { backgroundColor: theme.backgroundRoot }]}>
      <StatusBar barStyle={viewMode === "present" && darkPresentation ? "light-content" : isDark ? "light-content" : "dark-content"} />
      
      <View style={[styles.modeToggleContainer, { paddingTop: headerHeight + Spacing.sm }]}>
        <View style={[styles.segmentedControl, { backgroundColor: viewMode === "present" ? (darkPresentation ? "#1A1A1A" : theme.backgroundSecondary) : theme.backgroundSecondary }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode("present");
            }}
            style={[
              styles.segmentButton,
              viewMode === "present" && { backgroundColor: amber },
            ]}
          >
            <Feather name="monitor" size={16} color={viewMode === "present" ? "#FFFFFF" : theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{ color: viewMode === "present" ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}
            >
              Present
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode("explore");
            }}
            style={[
              styles.segmentButton,
              viewMode === "explore" && { backgroundColor: amber },
            ]}
          >
            <Feather name="search" size={16} color={viewMode === "explore" ? "#FFFFFF" : theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{ color: viewMode === "explore" ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}
            >
              Explore
            </ThemedText>
          </Pressable>
        </View>

        {viewMode === "present" ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDarkPresentation(!darkPresentation);
            }}
            style={[styles.darkModeButton, { backgroundColor: darkPresentation ? "#333" : theme.backgroundSecondary }]}
          >
            <Feather name={darkPresentation ? "sun" : "moon"} size={18} color={darkPresentation ? "#FFF" : theme.text} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={amber} />
        }
      >
        {viewMode === "present" ? (
          <View style={styles.presentContent}>
            <ThemedText
              type="h1"
              style={[styles.presentTitle, { color: presentText }]}
            >
              {summary.sessionName}
            </ThemedText>
            {summary.sessionTopic ? (
              <ThemedText type="body" style={[styles.presentSubtitle, { color: presentMuted }]}>
                {summary.sessionTopic}
              </ThemedText>
            ) : null}

            <View style={styles.presentSection}>
              <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                Summary
              </ThemedText>
              <ThemedText type="body" style={[styles.presentSummaryText, { color: presentText }]}>
                {summary.overallSummary || "No summary available yet."}
              </ThemedText>
            </View>

            {summary.themes.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Key Themes
                </ThemedText>
                <View style={styles.presentThemes}>
                  {summary.themes.slice(0, 6).map((t) => (
                    <View key={t.theme} style={[styles.presentThemeBadge, { backgroundColor: amber + "20", borderColor: amber }]}>
                      <ThemedText type="body" style={{ color: amber, fontWeight: "600" }}>
                        {t.theme}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {summary.actionItems.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Action Items
                </ThemedText>
                {summary.actionItems.map((item, index) => (
                  <View key={index} style={styles.presentActionItem}>
                    <ThemedText type="h3" style={{ color: amber, width: 40 }}>
                      {index + 1}.
                    </ThemedText>
                    <ThemedText type="body" style={[styles.presentActionText, { color: presentText }]}>
                      {item}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.exploreContent}>
            <View style={[styles.searchContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="search" size={18} color={theme.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search themes..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={18} color={theme.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="h4" style={{ color: amber }}>Overall Summary</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {summary.overallSummary || "No summary available yet."}
              </ThemedText>
            </View>

            {(filteredThemes?.length ?? 0) > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                  Themes ({filteredThemes?.length})
                </ThemedText>
                {filteredThemes?.map((t) => (
                  <Pressable
                    key={t.theme}
                    onPress={() => toggleTheme(t.theme)}
                    style={styles.themeItem}
                  >
                    <View style={styles.themeHeader}>
                      <View style={[styles.themeBadge, { backgroundColor: amber + "20" }]}>
                        <ThemedText type="caption" style={{ color: amber, fontWeight: "600" }}>
                          {t.theme}
                        </ThemedText>
                      </View>
                      <View style={styles.themeCount}>
                        <ThemedText type="caption" style={{ color: theme.textMuted }}>
                          {t.tableIds.length} table{t.tableIds.length !== 1 ? "s" : ""}
                        </ThemedText>
                        <Feather
                          name={expandedThemes.has(t.theme) ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={theme.textMuted}
                        />
                      </View>
                    </View>
                    {expandedThemes.has(t.theme) ? (
                      <View style={styles.themeDetails}>
                        <ThemedText type="caption" style={{ color: theme.textMuted }}>
                          Mentioned at: {t.tableIds.map((id) => {
                            const table = summary.tableSummaries.find((ts) => ts.tableId === id);
                            return table ? `Table ${table.tableNumber}` : `Table ${id}`;
                          }).join(", ")}
                        </ThemedText>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {summary.actionItems.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.cardHeader}>
                  <ThemedText type="h4">Action Items</ThemedText>
                  <Pressable onPress={copyAllActionItems} style={styles.copyButton}>
                    <Feather name="copy" size={16} color={amber} />
                    <ThemedText type="caption" style={{ color: amber }}>Copy All</ThemedText>
                  </Pressable>
                </View>
                {summary.actionItems.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => copyToClipboard(item)}
                    style={styles.actionItem}
                  >
                    <ThemedText type="body" style={{ color: amber, fontWeight: "600", marginRight: Spacing.sm }}>
                      {index + 1}.
                    </ThemedText>
                    <ThemedText type="body" style={{ flex: 1, color: theme.text }}>
                      {item}
                    </ThemedText>
                    <Feather name="copy" size={14} color={theme.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {summary.openQuestions.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Open Questions</ThemedText>
                {summary.openQuestions.map((question, index) => (
                  <View key={index} style={styles.questionItem}>
                    <Feather name="help-circle" size={16} color={theme.textMuted} />
                    <ThemedText type="body" style={{ flex: 1, color: theme.text }}>
                      {question}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {summary.tableSummaries.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                  Table Summaries ({summary.tableSummaries.length})
                </ThemedText>
                {summary.tableSummaries.map((table) => (
                  <Pressable
                    key={table.tableId}
                    onPress={() => toggleTable(table.tableId)}
                    style={[styles.tableSection, { borderColor: theme.border }]}
                  >
                    <View style={styles.tableSectionHeader}>
                      <View style={[styles.tableNumber, { backgroundColor: amber }]}>
                        <ThemedText type="caption" style={{ color: "#FFF", fontWeight: "700" }}>
                          {table.tableNumber}
                        </ThemedText>
                      </View>
                      <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>
                        Table {table.tableNumber}
                      </ThemedText>
                      <Feather
                        name={expandedTables.has(table.tableId) ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.textMuted}
                      />
                    </View>
                    {expandedTables.has(table.tableId) ? (
                      <View style={styles.tableSectionContent}>
                        <ThemedText type="body" style={{ color: theme.textSecondary }}>
                          {table.summary || "No summary available."}
                        </ThemedText>
                        {table.themes.length > 0 ? (
                          <View style={styles.tableThemes}>
                            {table.themes.map((t) => (
                              <View key={t} style={[styles.smallBadge, { backgroundColor: amber + "15" }]}>
                                <ThemedText type="caption" style={{ color: amber }}>
                                  {t}
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modeToggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
  },
  segmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  darkModeButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  presentContent: {
    gap: Spacing.xl,
  },
  presentTitle: {
    ...Typography.h1,
    fontSize: 42,
    lineHeight: 50,
    textAlign: "center",
  },
  presentSubtitle: {
    textAlign: "center",
    fontSize: 20,
  },
  presentSection: {
    marginTop: Spacing.lg,
  },
  presentSectionTitle: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  presentSummaryText: {
    fontSize: 22,
    lineHeight: 34,
  },
  presentThemes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  presentThemeBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  presentActionItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  presentActionText: {
    flex: 1,
    fontSize: 20,
    lineHeight: 30,
  },
  exploreContent: {
    gap: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  exploreCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  themeItem: {
    marginBottom: Spacing.md,
  },
  themeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  themeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  themeCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  themeDetails: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  questionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tableSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  tableSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tableNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  tableSectionContent: {
    marginTop: Spacing.md,
    paddingLeft: Spacing.xl + Spacing.sm,
    gap: Spacing.sm,
  },
  tableThemes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  smallBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
});
