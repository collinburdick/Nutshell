import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
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
  sessionTopic: string | null;
  summary: string;
  themes: string[];
  actionItems: string[];
  openQuestions: string[];
}

interface AggregatedEventSummary {
  eventId: number;
  eventName: string;
  eventDescription: string | null;
  overallSummary: string;
  topThemes: { theme: string; sessionIds: number[] }[];
  keyActionItems: string[];
  sessionSummaries: SessionSummary[];
}

type ViewMode = "present" | "explore";

export default function EventSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const route = useRoute<EventSummaryRouteProp>();
  const { eventId } = route.params;

  const [viewMode, setViewMode] = useState<ViewMode>("present");
  const [darkPresentation, setDarkPresentation] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());

  const { data: summary, isLoading, refetch, isError } = useQuery<AggregatedEventSummary>({
    queryKey: ["/api/events", eventId, "aggregated-summary"],
  });

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

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copyAllActionItems = async () => {
    if (summary?.keyActionItems) {
      const text = summary.keyActionItems.map((item, i) => `${i + 1}. ${item}`).join("\n");
      await copyToClipboard(text);
    }
  };

  const presentBg = darkPresentation ? "#0A0A0A" : theme.backgroundRoot;
  const presentText = darkPresentation ? "#FFFFFF" : theme.text;
  const presentMuted = darkPresentation ? "#888888" : theme.textMuted;
  const amber = "#D97706";

  const getCommonThemes = () => {
    if (!summary?.topThemes) return [];
    return summary.topThemes.filter((t) => t.sessionIds.length > 1);
  };

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
              {summary.eventName}
            </ThemedText>
            {summary.eventDescription ? (
              <ThemedText type="body" style={[styles.presentSubtitle, { color: presentMuted }]}>
                {summary.eventDescription}
              </ThemedText>
            ) : null}

            <View style={styles.presentSection}>
              <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                Event Summary
              </ThemedText>
              <ThemedText type="body" style={[styles.presentSummaryText, { color: presentText }]}>
                {summary.overallSummary || "No summary available yet."}
              </ThemedText>
            </View>

            {summary.topThemes.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Top Themes
                </ThemedText>
                <View style={styles.presentThemes}>
                  {summary.topThemes.slice(0, 6).map((t) => (
                    <View key={t.theme} style={[styles.presentThemeBadge, { backgroundColor: amber + "20", borderColor: amber }]}>
                      <ThemedText type="body" style={{ color: amber, fontWeight: "600" }}>
                        {t.theme}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: presentMuted }}>
                        {t.sessionIds.length} session{t.sessionIds.length !== 1 ? "s" : ""}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {summary.keyActionItems.length > 0 ? (
              <View style={styles.presentSection}>
                <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                  Key Action Items
                </ThemedText>
                {summary.keyActionItems.map((item, index) => (
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

            <View style={styles.presentSection}>
              <ThemedText type="h4" style={[styles.presentSectionTitle, { color: amber }]}>
                Sessions Covered
              </ThemedText>
              <ThemedText type="body" style={{ color: presentMuted, fontSize: 18 }}>
                {summary.sessionSummaries.length} session{summary.sessionSummaries.length !== 1 ? "s" : ""} analyzed
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.exploreContent}>
            <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="h4" style={{ color: amber }}>Event Overview</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {summary.overallSummary || "No summary available yet."}
              </ThemedText>
            </View>

            {getCommonThemes().length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                  Cross-Session Themes
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.md }}>
                  Themes that appeared in multiple sessions
                </ThemedText>
                {getCommonThemes().map((t) => (
                  <View key={t.theme} style={styles.commonThemeItem}>
                    <View style={[styles.themeBadge, { backgroundColor: amber + "20" }]}>
                      <ThemedText type="caption" style={{ color: amber, fontWeight: "600" }}>
                        {t.theme}
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {t.sessionIds.length} sessions
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {summary.keyActionItems.length > 0 ? (
              <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.cardHeader}>
                  <ThemedText type="h4">Key Action Items</ThemedText>
                  <Pressable onPress={copyAllActionItems} style={styles.copyButton}>
                    <Feather name="copy" size={16} color={amber} />
                    <ThemedText type="caption" style={{ color: amber }}>Copy All</ThemedText>
                  </Pressable>
                </View>
                {summary.keyActionItems.map((item, index) => (
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

            <View style={[styles.exploreCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Session Breakdown ({summary.sessionSummaries.length})
              </ThemedText>
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
                        {session.sessionTopic ? (
                          <ThemedText type="caption" style={{ color: theme.textMuted }} numberOfLines={1}>
                            {session.sessionTopic}
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
                        {session.summary || "No summary available."}
                      </ThemedText>

                      {session.themes.length > 0 ? (
                        <View style={styles.sessionThemesSection}>
                          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                            Themes
                          </ThemedText>
                          <View style={styles.sessionThemes}>
                            {session.themes.map((t) => (
                              <View key={t} style={[styles.smallBadge, { backgroundColor: amber + "15" }]}>
                                <ThemedText type="caption" style={{ color: amber }}>
                                  {t}
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {session.actionItems.length > 0 ? (
                        <View style={styles.sessionActionsSection}>
                          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                            Action Items
                          </ThemedText>
                          {session.actionItems.map((item, idx) => (
                            <View key={idx} style={styles.sessionActionItem}>
                              <ThemedText type="caption" style={{ color: amber }}>•</ThemedText>
                              <ThemedText type="small" style={{ flex: 1, color: theme.text }}>
                                {item}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {session.openQuestions.length > 0 ? (
                        <View style={styles.sessionQuestionsSection}>
                          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                            Open Questions
                          </ThemedText>
                          {session.openQuestions.map((q, idx) => (
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
    alignItems: "center",
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
  commonThemeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  themeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
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
