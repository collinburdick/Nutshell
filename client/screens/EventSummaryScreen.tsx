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

type EventSummaryRouteProp = RouteProp<RootStackParamList, "EventSummary">;

interface SessionSummary {
  sessionId: number;
  sessionName: string;
  topic: string | null;
  tableCount: number;
  aggregatedThemes: string[];
  aggregatedActionItems: string[];
  aggregatedOpenQuestions: string[];
  overallSummary: string;
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
  sessions?: string[];
}

interface DeeperInsight {
  insight: string;
  analysis: string;
  recommendation?: string;
}

interface AggregatedEventSummary {
  eventName: string;
  description: string | null;
  sessionSummaries: SessionSummary[];
  totalSessions: number;
  totalTables: number;
  themesWithFrequency: ThemeWithFrequency[];
  keyQuestions: string[];
  keyInsights: string[];
  overallSummary: string;
  detailedThemes: DetailedTheme[];
  notableQuotes: string[];
  deeperInsights: DeeperInsight[];
}

interface PulseData {
  averageSentiment: number | null;
  averageConfidence: number | null;
  samples: number;
}

interface ThemeMapData {
  themes: { theme: string; count: number }[];
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
  | "sessionSummaries";

interface PrevalenceBadgeProps {
  prevalence: "High" | "Medium" | "Low";
}

function PrevalenceBadge({ prevalence }: PrevalenceBadgeProps) {
  const { tokens } = useTheme();
  const getColors = () => {
    switch (prevalence) {
      case "High":
        return { bg: tokens.colors.primary, text: tokens.colors.primaryText };
      case "Medium":
        return { bg: tokens.colors.accent, text: tokens.colors.accentText };
      case "Low":
        return { bg: tokens.colors.surfaceAlt, text: tokens.colors.textMuted };
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

export default function EventSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark, tokens } = useTheme();
  const route = useRoute<EventSummaryRouteProp>();
  const { eventId } = route.params;

  const [viewMode, setViewMode] = useState<ViewMode>("present");
  const [darkPresentation, setDarkPresentation] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [expandedDetailedThemes, setExpandedDetailedThemes] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<CollapsibleSection>>(
    new Set(["aiSummary", "discussionThemes", "keyInsights", "keyQuestions"])
  );
  const [searchQuery, setSearchQuery] = useState("");

  const { data: summary, isLoading, refetch, isError } = useQuery<AggregatedEventSummary>({
    queryKey: ["/api/events", eventId, "aggregated-summary"],
  });

  const { data: pulse } = useQuery<PulseData>({
    queryKey: ["/api/events", eventId, "pulse"],
  });

  const { data: themeMap } = useQuery<ThemeMapData>({
    queryKey: ["/api/events", eventId, "theme-map"],
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

  const toggleSession = (sessionId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
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

  const presentBg = darkPresentation ? tokens.colors.ink : tokens.colors.background;
  const presentText = darkPresentation ? tokens.colors.paper : tokens.colors.text;
  const presentMuted = darkPresentation ? tokens.colors.mutedText : tokens.colors.textMuted;
  const amber = tokens.colors.primary;

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={amber} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textMuted }}>
            Loading event summary...
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
            Failed to load event summary
          </ThemedText>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: amber }]}
          >
            <ThemedText type="body" style={{ color: tokens.colors.primaryText, fontWeight: "600" }}>
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
        <View
          style={[
            styles.segmentedControl,
            { backgroundColor: tokens.colors.surfaceAlt },
          ]}
        >
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
            <Feather name="monitor" size={16} color={viewMode === "present" ? tokens.colors.primaryText : theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{ color: viewMode === "present" ? tokens.colors.primaryText : theme.textSecondary, fontWeight: "600" }}
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
            <Feather name="search" size={16} color={viewMode === "explore" ? tokens.colors.primaryText : theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{ color: viewMode === "explore" ? tokens.colors.primaryText : theme.textSecondary, fontWeight: "600" }}
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
            style={[styles.darkModeButton, { backgroundColor: darkPresentation ? tokens.colors.surfaceAlt : theme.backgroundSecondary }]}
          >
            <Feather name={darkPresentation ? "sun" : "moon"} size={18} color={darkPresentation ? tokens.colors.primaryText : theme.text} />
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
              {summary.eventName}
            </ThemedText>
            {summary.description ? (
              <ThemedText type="body" style={[styles.presentSubtitle, { color: presentMuted }]}>
                {summary.description}
              </ThemedText>
            ) : null}

            <View style={styles.statsRow}>
              <View style={[styles.statBadge, { backgroundColor: amber + "20" }]}>
                <Feather name="layers" size={16} color={amber} />
                <ThemedText type="body" style={{ color: amber, fontWeight: "600", marginLeft: Spacing.xs }}>
                  {summary.totalSessions} session{summary.totalSessions !== 1 ? "s" : ""}
                </ThemedText>
              </View>
              <View style={[styles.statBadge, { backgroundColor: amber + "20" }]}>
                <Feather name="grid" size={16} color={amber} />
                <ThemedText type="body" style={{ color: amber, fontWeight: "600", marginLeft: Spacing.xs }}>
                  {summary.totalTables} table{summary.totalTables !== 1 ? "s" : ""}
                </ThemedText>
              </View>
            </View>

            <View style={styles.presentSection}>
              <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                AI Summary
              </ThemedText>
              <ThemedText type="body" style={[styles.presentSummaryText, { color: presentText }]}>
                {summary.overallSummary || "No summary available yet."}
              </ThemedText>
            </View>

            <View style={styles.presentSection}>
              <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                Pulse Sentiment
              </ThemedText>
              <ThemedText type="body" style={[styles.presentSummaryText, { color: presentText }]}>
                {pulse?.averageSentiment !== null
                  ? `Sentiment ${pulse?.averageSentiment} (confidence ${pulse?.averageConfidence})`
                  : "No sentiment data yet."}
              </ThemedText>
            </View>

            {themeMap?.themes && themeMap.themes.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Trending Themes
                </ThemedText>
                <View style={styles.presentThemes}>
                  {themeMap.themes.slice(0, 6).map((themeItem, idx) => (
                    <View key={idx} style={[styles.presentThemeBadge, { backgroundColor: amber + "20", borderColor: amber }]}>
                      <ThemedText type="body" style={{ color: amber, fontWeight: "600" }}>
                        {themeItem.theme}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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
                            {detailedTheme.sessions && detailedTheme.sessions.length > 0 ? (
                              <View style={styles.sessionsSection}>
                                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs, fontWeight: "600" }}>
                                  Mentioned in:
                                </ThemedText>
                                <View style={styles.sessionTags}>
                                  {detailedTheme.sessions.map((session, sessionIdx) => (
                                    <View key={sessionIdx} style={[styles.sessionTag, { backgroundColor: theme.backgroundSecondary }]}>
                                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                                        {session}
                                      </ThemedText>
                                    </View>
                                  ))}
                                </View>
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

            {summary.sessionSummaries && summary.sessionSummaries.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                {renderCollapsibleHeader("Session Summaries", "sessionSummaries", "grid", summary.sessionSummaries.length)}
                {expandedSections.has("sessionSummaries") ? (
                  <View style={{ marginTop: Spacing.md }}>
                    {summary.sessionSummaries.map((session) => (
                      <Pressable
                        key={session.sessionId}
                        onPress={() => toggleSession(session.sessionId)}
                        style={[styles.sessionSection, { borderColor: theme.border }]}
                      >
                        <View style={styles.sessionSectionHeader}>
                          <View style={styles.sessionInfo}>
                            <Feather name="layers" size={18} color={amber} />
                            <View style={{ flex: 1 }}>
                              <ThemedText type="body" style={{ fontWeight: "600" }}>
                                {session.sessionName}
                              </ThemedText>
                              {session.topic ? (
                                <ThemedText type="caption" style={{ color: theme.textMuted }} numberOfLines={1}>
                                  {session.topic}
                                </ThemedText>
                              ) : null}
                            </View>
                          </View>
                          <Feather
                            name={expandedSessions.has(session.sessionId) ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={theme.textMuted}
                          />
                        </View>
                        {expandedSessions.has(session.sessionId) ? (
                          <View style={styles.sessionSectionContent}>
                            <ThemedText type="body" style={{ color: theme.textSecondary }}>
                              {session.overallSummary || "No summary available."}
                            </ThemedText>

                            {session.aggregatedThemes && session.aggregatedThemes.length > 0 ? (
                              <View style={styles.sessionThemesSection}>
                                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                                  Themes
                                </ThemedText>
                                <View style={styles.sessionThemes}>
                                  {session.aggregatedThemes.map((t, idx) => (
                                    <View key={idx} style={[styles.smallBadge, { backgroundColor: amber + "15" }]}>
                                      <ThemedText type="caption" style={{ color: amber }}>
                                        {t}
                                      </ThemedText>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            ) : null}

                            {session.aggregatedActionItems && session.aggregatedActionItems.length > 0 ? (
                              <View style={styles.sessionActionsSection}>
                                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                                  Action Items
                                </ThemedText>
                                {session.aggregatedActionItems.map((item, idx) => (
                                  <View key={idx} style={styles.sessionActionItem}>
                                    <ThemedText type="caption" style={{ color: amber }}>•</ThemedText>
                                    <ThemedText type="small" style={{ flex: 1, color: theme.text }}>
                                      {item}
                                    </ThemedText>
                                  </View>
                                ))}
                              </View>
                            ) : null}

                            {session.aggregatedOpenQuestions && session.aggregatedOpenQuestions.length > 0 ? (
                              <View style={styles.sessionQuestionsSection}>
                                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                                  Open Questions
                                </ThemedText>
                                {session.aggregatedOpenQuestions.map((q, idx) => (
                                  <View key={idx} style={styles.sessionQuestionItem}>
                                    <Feather name="help-circle" size={12} color={theme.textMuted} />
                                    <ThemedText type="small" style={{ flex: 1, color: theme.textSecondary }}>
                                      {q}
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
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
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
  sessionsSection: {
    marginTop: Spacing.md,
  },
  sessionTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  sessionTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
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
  sessionSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  sessionSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  sessionSectionContent: {
    marginTop: Spacing.md,
    paddingLeft: Spacing.xl + Spacing.sm,
    gap: Spacing.md,
  },
  sessionThemesSection: {
    marginTop: Spacing.sm,
  },
  sessionThemes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  smallBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  sessionActionsSection: {
    marginTop: Spacing.sm,
  },
  sessionActionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sessionQuestionsSection: {
    marginTop: Spacing.sm,
  },
  sessionQuestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
