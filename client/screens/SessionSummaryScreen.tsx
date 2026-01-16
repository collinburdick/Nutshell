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

interface TableSummaryContent {
  content: string;
  themes: string[];
  actionItems: string[];
  openQuestions: string[];
}

interface TableSummary {
  tableId: number;
  tableNumber: number;
  topic: string | null;
  summary: TableSummaryContent | null;
}

interface ThemeWithFrequency {
  theme: string;
  frequency: number;
  prevalence: "High" | "Medium" | "Low";
}

interface DetailedTheme {
  theme: string;
  description: string;
  keyPoints: string[];
}

interface DeeperInsight {
  insight: string;
  analysis: string;
  recommendation?: string;
}

interface AggregatedSummary {
  sessionName: string;
  topic: string | null;
  tableSummaries: TableSummary[];
  totalTables: number;
  themesWithFrequency: ThemeWithFrequency[];
  keyQuestions: string[];
  keyInsights: string[];
  overallSummary: string;
  detailedThemes: DetailedTheme[];
  notableQuotes: string[];
  deeperInsights: DeeperInsight[];
}

type ViewMode = "present" | "explore";

type CollapsibleSection = 
  | "aiSummary" 
  | "discussionThemes" 
  | "keyInsights" 
  | "keyQuestions" 
  | "detailedThemes" 
  | "notableQuotes" 
  | "aiAnalysis" 
  | "tableSummaries";

interface PrevalenceBadgeProps {
  prevalence: "High" | "Medium" | "Low";
}

function PrevalenceBadge({ prevalence }: PrevalenceBadgeProps) {
  const getColors = () => {
    switch (prevalence) {
      case "High":
        return { bg: "#D97706", text: "#FFFFFF" };
      case "Medium":
        return { bg: "#F97316", text: "#FFFFFF" };
      case "Low":
        return { bg: "#6B7280", text: "#FFFFFF" };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.prevalenceBadge, { backgroundColor: colors.bg }]}>
      <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600", fontSize: 10 }}>
        {prevalence}
      </ThemedText>
    </View>
  );
}

export default function SessionSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const route = useRoute<SessionSummaryRouteProp>();
  const { sessionId } = route.params;

  const [viewMode, setViewMode] = useState<ViewMode>("present");
  const [darkPresentation, setDarkPresentation] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const [expandedDetailedThemes, setExpandedDetailedThemes] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<CollapsibleSection>>(
    new Set(["aiSummary", "discussionThemes", "keyInsights", "keyQuestions"])
  );
  const [searchQuery, setSearchQuery] = useState("");

  const { data: summary, isLoading, refetch, isError } = useQuery<AggregatedSummary>({
    queryKey: ["/api/sessions", sessionId, "aggregated-summary"],
  });

  const toggleSection = (section: CollapsibleSection) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

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

  const toggleDetailedTheme = (themeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedDetailedThemes((prev) => {
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

  const copyAllInsights = async () => {
    if (summary?.keyInsights) {
      const text = summary.keyInsights.map((item, i) => `${i + 1}. ${item}`).join("\n");
      await copyToClipboard(text);
    }
  };

  const filteredThemes = summary?.themesWithFrequency?.filter((t) =>
    t.theme.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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

  const renderCollapsibleHeader = (
    title: string, 
    section: CollapsibleSection, 
    icon: keyof typeof Feather.glyphMap,
    count?: number
  ) => (
    <Pressable
      onPress={() => toggleSection(section)}
      style={styles.collapsibleHeader}
    >
      <View style={styles.collapsibleHeaderLeft}>
        <Feather name={icon} size={18} color={amber} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
          {title}
        </ThemedText>
        {count !== undefined && count > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: amber + "20" }]}>
            <ThemedText type="caption" style={{ color: amber, fontWeight: "600" }}>
              {count}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <Feather
        name={expandedSections.has(section) ? "chevron-up" : "chevron-down"}
        size={20}
        color={theme.textMuted}
      />
    </Pressable>
  );

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
            {summary.topic ? (
              <ThemedText type="body" style={[styles.presentSubtitle, { color: presentMuted }]}>
                {summary.topic}
              </ThemedText>
            ) : null}

            <View style={styles.presentSection}>
              <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                AI Summary
              </ThemedText>
              <ThemedText type="body" style={[styles.presentSummaryText, { color: presentText }]}>
                {summary.overallSummary || "No summary available yet."}
              </ThemedText>
            </View>

            {summary.themesWithFrequency && summary.themesWithFrequency.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Key Themes
                </ThemedText>
                <View style={styles.presentThemes}>
                  {summary.themesWithFrequency.slice(0, 6).map((themeItem, idx) => (
                    <View key={idx} style={[styles.presentThemeBadge, { backgroundColor: amber + "20", borderColor: amber }]}>
                      <View style={styles.themeWithPrevalence}>
                        <ThemedText type="body" style={{ color: amber, fontWeight: "600" }}>
                          {themeItem.theme}
                        </ThemedText>
                        <PrevalenceBadge prevalence={themeItem.prevalence} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {summary.keyInsights && summary.keyInsights.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Key Insights
                </ThemedText>
                {summary.keyInsights.map((item, index) => (
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

            {summary.keyQuestions && summary.keyQuestions.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Key Questions
                </ThemedText>
                {summary.keyQuestions.map((question, index) => (
                  <View key={index} style={styles.presentQuestionItem}>
                    <Feather name="help-circle" size={20} color={presentMuted} style={{ marginRight: Spacing.sm }} />
                    <ThemedText type="body" style={[styles.presentActionText, { color: presentText }]}>
                      {question}
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
              {renderCollapsibleHeader("AI Summary", "aiSummary", "cpu")}
              {expandedSections.has("aiSummary") ? (
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                  {summary.overallSummary || "No summary available yet."}
                </ThemedText>
              ) : null}
            </View>

            {(filteredThemes.length > 0 || summary.themesWithFrequency?.length > 0) ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Discussion Themes", "discussionThemes", "hash", filteredThemes.length || summary.themesWithFrequency?.length)}
                {expandedSections.has("discussionThemes") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    {(searchQuery ? filteredThemes : summary.themesWithFrequency)?.map((themeItem, idx) => (
                      <View key={idx} style={styles.themeItem}>
                        <View style={styles.themeHeader}>
                          <View style={[styles.themeBadge, { backgroundColor: amber + "20" }]}>
                            <ThemedText type="caption" style={{ color: amber, fontWeight: "600" }}>
                              {themeItem.theme}
                            </ThemedText>
                          </View>
                          <View style={styles.themeMetaContainer}>
                            <View style={styles.frequencyBadge}>
                              <Feather name="repeat" size={12} color={theme.textMuted} />
                              <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: 4 }}>
                                {themeItem.frequency}
                              </ThemedText>
                            </View>
                            <PrevalenceBadge prevalence={themeItem.prevalence} />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {summary.keyInsights && summary.keyInsights.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Key Insights", "keyInsights", "zap", summary.keyInsights.length)}
                {expandedSections.has("keyInsights") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <View style={styles.cardHeader}>
                      <View />
                      <Pressable onPress={copyAllInsights} style={styles.copyButton}>
                        <Feather name="copy" size={16} color={amber} />
                        <ThemedText type="caption" style={{ color: amber }}>Copy All</ThemedText>
                      </Pressable>
                    </View>
                    {summary.keyInsights.map((item, index) => (
                      <Pressable
                        key={index}
                        onPress={() => copyToClipboard(item)}
                        style={styles.insightItem}
                      >
                        <Feather name="zap" size={16} color={amber} style={{ marginRight: Spacing.sm }} />
                        <ThemedText type="body" style={{ flex: 1, color: theme.text }}>
                          {item}
                        </ThemedText>
                        <Feather name="copy" size={14} color={theme.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {summary.keyQuestions && summary.keyQuestions.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Key Questions", "keyQuestions", "help-circle", summary.keyQuestions.length)}
                {expandedSections.has("keyQuestions") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    {summary.keyQuestions.map((question, index) => (
                      <View key={index} style={styles.questionItem}>
                        <Feather name="help-circle" size={16} color={theme.textMuted} />
                        <ThemedText type="body" style={{ flex: 1, color: theme.text }}>
                          {question}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {summary.detailedThemes && summary.detailedThemes.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Key Themes & Discussion Points", "detailedThemes", "layers", summary.detailedThemes.length)}
                {expandedSections.has("detailedThemes") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    {summary.detailedThemes.map((detailedTheme, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => toggleDetailedTheme(detailedTheme.theme)}
                        style={[styles.detailedThemeItem, { borderColor: theme.border }]}
                      >
                        <View style={styles.detailedThemeHeader}>
                          <View style={[styles.themeBadge, { backgroundColor: amber + "20" }]}>
                            <ThemedText type="caption" style={{ color: amber, fontWeight: "600" }}>
                              {detailedTheme.theme}
                            </ThemedText>
                          </View>
                          <Feather
                            name={expandedDetailedThemes.has(detailedTheme.theme) ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={theme.textMuted}
                          />
                        </View>
                        {expandedDetailedThemes.has(detailedTheme.theme) ? (
                          <View style={styles.detailedThemeContent}>
                            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                              {detailedTheme.description}
                            </ThemedText>
                            {detailedTheme.keyPoints && detailedTheme.keyPoints.length > 0 ? (
                              <View style={styles.keyPointsList}>
                                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs, fontWeight: "600" }}>
                                  Key Points:
                                </ThemedText>
                                {detailedTheme.keyPoints.map((point, pointIdx) => (
                                  <View key={pointIdx} style={styles.keyPointItem}>
                                    <View style={[styles.bulletPoint, { backgroundColor: amber }]} />
                                    <ThemedText type="small" style={{ flex: 1, color: theme.text }}>
                                      {point}
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
            ) : null}

            {summary.notableQuotes && summary.notableQuotes.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Notable Quotes", "notableQuotes", "message-circle", summary.notableQuotes.length)}
                {expandedSections.has("notableQuotes") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    {summary.notableQuotes.map((quote, index) => (
                      <Pressable
                        key={index}
                        onPress={() => copyToClipboard(quote)}
                        style={styles.quoteItem}
                      >
                        <Feather name="message-circle" size={16} color={amber} style={{ marginTop: 2 }} />
                        <ThemedText type="body" style={[styles.quoteText, { color: theme.text }]}>
                          "{quote}"
                        </ThemedText>
                        <Feather name="copy" size={14} color={theme.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {summary.deeperInsights && summary.deeperInsights.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("AI Analysis", "aiAnalysis", "compass", summary.deeperInsights.length)}
                {expandedSections.has("aiAnalysis") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    {summary.deeperInsights.map((deeperInsight, index) => (
                      <View key={index} style={[styles.deeperInsightItem, { borderColor: theme.border }]}>
                        <View style={styles.deeperInsightHeader}>
                          <Feather name="compass" size={18} color={amber} />
                          <ThemedText type="body" style={{ flex: 1, fontWeight: "600", marginLeft: Spacing.sm, color: theme.text }}>
                            {deeperInsight.insight}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                          {deeperInsight.analysis}
                        </ThemedText>
                        {deeperInsight.recommendation ? (
                          <View style={[styles.recommendationBox, { backgroundColor: amber + "15" }]}>
                            <Feather name="check-circle" size={14} color={amber} />
                            <ThemedText type="small" style={{ flex: 1, color: amber, marginLeft: Spacing.xs }}>
                              {deeperInsight.recommendation}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {summary.tableSummaries && summary.tableSummaries.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Table Summaries", "tableSummaries", "grid", summary.tableSummaries.length)}
                {expandedSections.has("tableSummaries") ? (
                  <View style={{ marginTop: Spacing.md }}>
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
                          <View style={{ flex: 1 }}>
                            <ThemedText type="body" style={{ fontWeight: "600" }}>
                              Table {table.tableNumber}
                            </ThemedText>
                            {table.topic ? (
                              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                                {table.topic}
                              </ThemedText>
                            ) : null}
                          </View>
                          <Feather
                            name={expandedTables.has(table.tableId) ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={theme.textMuted}
                          />
                        </View>
                        {expandedTables.has(table.tableId) ? (
                          <View style={styles.tableSectionContent}>
                            <ThemedText type="body" style={{ color: theme.textSecondary }}>
                              {table.summary?.content || "No summary available."}
                            </ThemedText>
                            {table.summary?.themes && table.summary.themes.length > 0 ? (
                              <View style={styles.tableThemes}>
                                {table.summary.themes.map((t, idx) => (
                                  <View key={idx} style={[styles.smallBadge, { backgroundColor: amber + "15" }]}>
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
  themeWithPrevalence: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  prevalenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
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
  presentQuestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
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
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  collapsibleHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  countBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
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
  themeMetaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  frequencyBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightItem: {
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
  detailedThemeItem: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  detailedThemeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailedThemeContent: {
    marginTop: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  keyPointsList: {
    marginTop: Spacing.sm,
  },
  keyPointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  quoteItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  quoteText: {
    flex: 1,
    fontStyle: "italic",
  },
  deeperInsightItem: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  deeperInsightHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  recommendationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
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
