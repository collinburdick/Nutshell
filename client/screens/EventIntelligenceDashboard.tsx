import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Text,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type DashboardRoute = RouteProp<RootStackParamList, "EventIntelligence">;

interface TableHealth {
  id: number;
  sessionId: number;
  tableNumber: number;
  topic: string | null;
  status: string;
  lastAudioAt: string | null;
  sessionName: string;
}

interface EventMeta {
  id: number;
  name: string;
  retainAudio: boolean;
  allowQuotes: boolean;
  privacyMode: string;
}

interface ThemeMapData {
  themes: { theme: string; count: number }[];
}

interface ThemeCluster {
  cluster: string;
  themes: string[];
  count: number;
}

interface PulseData {
  averageSentiment: number | null;
  averageConfidence: number | null;
  samples: number;
}

interface PulseTimelinePoint {
  timestamp: string;
  averageSentiment: number;
  averageConfidence: number;
  label: string | null;
}

interface ConsensusItem {
  theme: string;
  count: number;
  variance: number;
  avg: number;
}

interface ActionItem {
  id: number;
  text: string;
  status: string;
  createdAt?: string;
  evidenceCount?: number;
  evidenceLineId?: number | null;
  evidencePreview?: string | null;
  evidenceSpeaker?: string | null;
  evidenceAt?: string | null;
  tableNumber?: number | null;
  sessionName?: string | null;
  tags?: string[];
  mergeCandidates?: number[];
}

interface OpenQuestion {
  id: number;
  question: string;
  votes: number;
  createdAt?: string;
  evidenceCount?: number;
  evidenceLineId?: number | null;
  evidencePreview?: string | null;
  evidenceSpeaker?: string | null;
  evidenceAt?: string | null;
  tableId?: number | null;
  tableNumber?: number | null;
  sessionName?: string | null;
}

interface NudgeStat {
  tableId: number;
  sent: number;
  delivered: number;
  opened: number;
  acknowledged: number;
}

interface Quote {
  id: number;
  tableId: number;
  governance: string;
  sessionName?: string | null;
  tableNumber?: number | null;
  transcriptLineId?: number | null;
  speakerTag?: string | null;
  content?: string | null;
  lineAt?: string | null;
  startMs?: number | null;
  endMs?: number | null;
}

interface AuditLog {
  id: number;
  action: string;
  createdAt: string;
}

interface TranscriptLine {
  id: number;
  tableId: number;
  speakerTag: string | null;
  content: string;
  redacted?: boolean;
  piiTags?: string[] | null;
  startMs?: number | null;
  endMs?: number | null;
  createdAt: string;
}

interface SentimentHeatmapEntry {
  tableId: number;
  tableNumber: number | null;
  sessionId: number | null;
  sessionName: string | null;
  sentimentScore: number | null;
  sentimentConfidence: number | null;
  updatedAt: string;
}

interface TranscriptCompleteness {
  tableId: number;
  tableNumber: number | null;
  sessionName: string | null;
  scheduledMinutes: number | null;
  capturedMinutes: number;
  gapCount: number;
  lastTranscriptAt: string | null;
}

interface PiiIndicator {
  tableId: number;
  redactedCount: number;
  totalCount: number;
}

interface HotTable {
  tableId: number;
  lineCount: number;
}

export default function EventIntelligenceDashboard() {
  const insets = useSafeAreaInsets();
  const { theme, tokens } = useTheme();
  const route = useRoute<DashboardRoute>();
  const { eventId } = route.params;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [topicFilter, setTopicFilter] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [selectedEvidenceTag, setSelectedEvidenceTag] = useState<string | null>(null);
  const [showTranscriptPane, setShowTranscriptPane] = useState(false);
  const [showContextPane, setShowContextPane] = useState(false);
  const [contextLines, setContextLines] = useState<TranscriptLine[]>([]);
  const [contextTitle, setContextTitle] = useState("Context");
  const [showOpsDrawer, setShowOpsDrawer] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgePriority, setNudgePriority] = useState<"normal" | "urgent">("normal");
  const [transcriptOffset, setTranscriptOffset] = useState(0);
  const transcriptLimit = 200;

  const { data: event } = useQuery<EventMeta>({
    queryKey: ["/api/events", eventId],
  });

  const { data: tables } = useQuery<TableHealth[]>({
    queryKey: ["/api/events", eventId, "table-health"],
  });

  const { data: themeMap } = useQuery<ThemeMapData>({
    queryKey: ["/api/events", eventId, "theme-map"],
  });

  const { data: pulse } = useQuery<PulseData>({
    queryKey: ["/api/events", eventId, "pulse"],
  });

  const { data: pulseTimeline } = useQuery<PulseTimelinePoint[]>({
    queryKey: ["/api/events", eventId, "pulse-timeline"],
  });

  const { data: actionItems } = useQuery<ActionItem[]>({
    queryKey: ["/api/events", eventId, "action-items"],
  });

  const { data: openQuestions } = useQuery<OpenQuestion[]>({
    queryKey: ["/api/events", eventId, "open-questions"],
  });

  const { data: consensus } = useQuery<{ consensus: ConsensusItem[]; controversy: ConsensusItem[] }>({
    queryKey: ["/api/events", eventId, "consensus"],
  });

  const { data: themeClusters } = useQuery<ThemeCluster[]>({
    queryKey: ["/api/events", eventId, "theme-clusters"],
  });

  const { data: goldenNuggets } = useQuery<{ id: number; text: string }[]>({
    queryKey: ["/api/events", eventId, "golden-nuggets"],
  });

  const { data: quotes } = useQuery<Quote[]>({
    queryKey: ["/api/events", eventId, "quotes"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/events", eventId, "audit-logs"],
  });

  const { data: nudgeStats } = useQuery<NudgeStat[]>({
    queryKey: ["/api/events", eventId, "nudge-stats"],
  });

  const { data: piiIndicators } = useQuery<PiiIndicator[]>({
    queryKey: ["/api/events", eventId, "pii-indicators"],
  });

  const { data: completeness } = useQuery<TranscriptCompleteness[]>({
    queryKey: ["/api/events", eventId, "transcript-completeness"],
  });

  const { data: heatmap } = useQuery<SentimentHeatmapEntry[]>({
    queryKey: ["/api/events", eventId, "sentiment-heatmap"],
  });

  const { data: hotTables } = useQuery<HotTable[]>({
    queryKey: ["/api/events", eventId, "hot-tables"],
  });

  const { data: evidenceLines } = useQuery<TranscriptLine[]>({
    queryKey: ["/api/events", eventId, "transcript-lines", selectedTableId, selectedSessionId, evidenceSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTableId) params.append("tableId", String(selectedTableId));
      if (selectedSessionId) params.append("sessionId", String(selectedSessionId));
      if (evidenceSearch) params.append("q", evidenceSearch);
      params.append("limit", "200");
      params.append("audit", "false");
      const url = `/api/events/${eventId}/transcript-lines${params.toString() ? `?${params}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: transcriptLines } = useQuery<TranscriptLine[]>({
    queryKey: ["/api/events", eventId, "transcript-lines", "pane", selectedTableId, selectedSessionId, evidenceSearch, transcriptOffset],
    enabled: showTranscriptPane,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTableId) params.append("tableId", String(selectedTableId));
      if (selectedSessionId) params.append("sessionId", String(selectedSessionId));
      if (evidenceSearch) params.append("q", evidenceSearch);
      params.append("limit", String(transcriptLimit));
      params.append("offset", String(transcriptOffset));
      const url = `/api/events/${eventId}/transcript-lines${params.toString() ? `?${params}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: transcriptCount } = useQuery<{ count: number }>({
    queryKey: ["/api/events", eventId, "transcript-lines", "count", selectedTableId, selectedSessionId, evidenceSearch],
    enabled: showTranscriptPane,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTableId) params.append("tableId", String(selectedTableId));
      if (selectedSessionId) params.append("sessionId", String(selectedSessionId));
      if (evidenceSearch) params.append("q", evidenceSearch);
      const url = `/api/events/${eventId}/transcript-lines/count${params.toString() ? `?${params}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    return tables.filter((table) => {
      const matchesSearch = table.sessionName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTopic = topicFilter
        ? table.topic?.toLowerCase().includes(topicFilter.toLowerCase())
        : true;
      const matchesSession = selectedSessionId ? table.sessionId === selectedSessionId : true;
      return matchesSearch && matchesTopic && matchesSession;
    });
  }, [tables, searchTerm, topicFilter, selectedSessionId]);

  const sessions = useMemo(() => {
    if (!tables) return [];
    const unique = new Map<number, string>();
    tables.forEach((table) => {
      if (!unique.has(table.sessionId)) {
        unique.set(table.sessionId, table.sessionName);
      }
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [tables]);

  const nudgeStatsByTable = useMemo(() => {
    const map = new Map<number, NudgeStat>();
    nudgeStats?.forEach((stat) => map.set(stat.tableId, stat));
    return map;
  }, [nudgeStats]);

  const evidenceLinesFiltered = useMemo(() => {
    if (!evidenceLines) return [];
    if (!selectedEvidenceTag) return evidenceLines;
    return evidenceLines.filter((line) =>
      line.content.toLowerCase().includes(selectedEvidenceTag.toLowerCase())
    );
  }, [evidenceLines, selectedEvidenceTag]);

  const completenessByTable = useMemo(() => {
    const map = new Map<number, TranscriptCompleteness>();
    completeness?.forEach((entry) => map.set(entry.tableId, entry));
    return map;
  }, [completeness]);

  const piiByTable = useMemo(() => {
    const map = new Map<number, PiiIndicator>();
    piiIndicators?.forEach((entry) => map.set(entry.tableId, entry));
    return map;
  }, [piiIndicators]);

  const totalTables = tables?.length || 0;

  const getConfidenceLabel = (evidenceCount?: number) => {
    if (!evidenceCount || evidenceCount === 0) return { label: "low", reason: "no supporting evidence yet" };
    if (evidenceCount > 4) return { label: "high", reason: "consistent evidence" };
    return { label: "medium", reason: "sparse evidence" };
  };

  const openContextPane = async (lineId: number, title: string) => {
    const res = await apiRequest(
      "GET",
      `/api/transcript-lines/${lineId}/context?before=30&after=30&eventId=${eventId}`
    );
    const lines = await res.json();
    setContextLines(lines);
    setContextTitle(title);
    setShowContextPane(true);
  };

  const sendNudge = async (message: string) => {
    if (!message.trim()) return;
    await apiRequest("POST", "/api/nudges", {
      eventId,
      sessionId: selectedSessionId,
      tableId: selectedTableId,
      type: "ops",
      message,
      priority: nudgePriority,
    });
    setNudgeMessage("");
    setShowOpsDrawer(false);
  };

  const renderHighlightedText = (content: string) => {
    if (!evidenceSearch) {
      return <ThemedText type="body" style={{ color: theme.textSecondary }}>{content}</ThemedText>;
    }
    const escaped = evidenceSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = content.split(new RegExp(`(${escaped})`, "gi"));
    return (
      <Text>
        {parts.map((part, index) =>
          part.toLowerCase() === evidenceSearch.toLowerCase() ? (
            <Text key={`${part}-${index}`} style={{ color: tokens.colors.primary, fontWeight: "600" }}>
              {part}
            </Text>
          ) : (
            <Text key={`${part}-${index}`} style={{ color: theme.textSecondary }}>
              {part}
            </Text>
          )
        )}
      </Text>
    );
  };

  const isRecent = (timestamp?: string | null) => {
    if (!timestamp) return false;
    return Date.now() - new Date(timestamp).getTime() < 10 * 60 * 1000;
  };

  useEffect(() => {
    if (showTranscriptPane) {
      setTranscriptOffset(0);
    }
  }, [showTranscriptPane, selectedTableId, selectedSessionId, evidenceSearch]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <ThemedText type="h2">Event Intelligence</ThemedText>
        <View style={[styles.filterBar, { backgroundColor: tokens.colors.surfaceAlt }]}>
          <Feather name="filter" size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.filterInput, { color: theme.text }]}
            placeholder="Filter by session/table/topic..."
            placeholderTextColor={theme.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <View style={styles.filterRow}>
          <TextInput
            style={[styles.filterChip, { color: theme.text, backgroundColor: tokens.colors.surfaceAlt }]}
            placeholder="Topic"
            placeholderTextColor={theme.textMuted}
            value={topicFilter}
            onChangeText={setTopicFilter}
          />
          <TextInput
            style={[styles.filterChip, { color: theme.text, backgroundColor: tokens.colors.surfaceAlt }]}
            placeholder="Time window"
            placeholderTextColor={theme.textMuted}
            value={timeWindow}
            onChangeText={setTimeWindow}
          />
          <View style={[styles.filterChip, { backgroundColor: tokens.colors.surfaceAlt }]}>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Tags (soon)
            </ThemedText>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setShowOpsDrawer(true)}
            style={[styles.actionButton, { backgroundColor: tokens.colors.blueTint }]}
          >
            <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
              Ops Actions
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() =>
              apiRequest("POST", "/api/exports", {
                eventId,
                destination: "slack",
                payload: { includeEvidence: true, includeQuotes: true, provenance: true },
                requestedBy: "admin",
              })
            }
            style={[styles.actionButton, { backgroundColor: tokens.colors.surface }]}
          >
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Export Slack
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() =>
              apiRequest("POST", "/api/exports", {
                eventId,
                destination: "notion",
                payload: { includeEvidence: true, includeQuotes: true, provenance: true },
                requestedBy: "admin",
              })
            }
            style={[styles.actionButton, { backgroundColor: tokens.colors.surface }]}
          >
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Export Notion
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() =>
              apiRequest("POST", "/api/exports", {
                eventId,
                destination: "salesforce",
                payload: { includeEvidence: true, includeQuotes: true, provenance: true },
                requestedBy: "admin",
              })
            }
            style={[styles.actionButton, { backgroundColor: tokens.colors.surface }]}
          >
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Export Salesforce
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.leftRail}>
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            LIVE TABLES
          </ThemedText>
          <View style={styles.sessionList}>
            {sessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() => setSelectedSessionId(session.id)}
                style={[
                  styles.sessionChip,
                  {
                    backgroundColor:
                      selectedSessionId === session.id ? tokens.colors.blueTint : tokens.colors.surface,
                  },
                ]}
              >
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {session.name}
                </ThemedText>
              </Pressable>
            ))}
            {selectedSessionId ? (
              <Pressable onPress={() => setSelectedSessionId(null)} style={styles.sessionClear}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Clear session filter
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          <ScrollView>
            {filteredTables.map((table) => (
              <Pressable
                key={table.id}
                onPress={() => setSelectedTableId(table.id)}
                style={[
                  styles.tableRow,
                  {
                    backgroundColor: selectedTableId === table.id ? tokens.colors.blueTint : tokens.colors.surface,
                  },
                ]}
              >
                <View style={styles.tableRowHeader}>
                  <View style={[styles.healthDot, { backgroundColor: table.status === "active" ? theme.success : table.status === "degraded" ? theme.warning : theme.error }]} />
                  <ThemedText type="body">Table {table.tableNumber}</ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  {table.status.toUpperCase()} • {table.lastAudioAt ? new Date(table.lastAudioAt).toLocaleTimeString() : "No audio"}
                </ThemedText>
                {completenessByTable.get(table.id) ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    Completeness: {completenessByTable.get(table.id)?.capturedMinutes}m / {completenessByTable.get(table.id)?.scheduledMinutes ?? "?"}m • Gaps {completenessByTable.get(table.id)?.gapCount}
                  </ThemedText>
                ) : null}
                {piiByTable.get(table.id) ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    PII risk: {piiByTable.get(table.id)?.redactedCount}/{piiByTable.get(table.id)?.totalCount}
                  </ThemedText>
                ) : null}
                {nudgeStatsByTable.get(table.id) ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    Nudge D/O/A: {nudgeStatsByTable.get(table.id)?.delivered}/{nudgeStatsByTable.get(table.id)?.opened}/{nudgeStatsByTable.get(table.id)?.acknowledged}
                  </ThemedText>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.centerColumn}>
          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Top Themes</ThemedText>
            <View style={styles.tagRow}>
              {themeMap?.themes?.slice(0, 6).map((themeItem) => (
                <Pressable
                  key={themeItem.theme}
                  onPress={() => setSelectedEvidenceTag(themeItem.theme)}
                  style={[styles.tag, { backgroundColor: tokens.colors.blueTint }]}
                >
                  <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
                    {themeItem.theme} • Evidence {themeItem.count} • {totalTables ? Math.round((themeItem.count / totalTables) * 100) : 0}% tables
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Pulse Sentiment</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {pulse?.averageSentiment !== null
                ? `Sentiment ${pulse?.averageSentiment} (confidence ${pulse?.averageConfidence})`
                : "No sentiment data yet."}
            </ThemedText>
            <View style={styles.timelineList}>
              {pulseTimeline?.slice(-4).map((point) => (
                <Pressable
                  key={point.timestamp}
                  onPress={() => {
                    setEvidenceSearch(point.label ? point.label : "sentiment");
                    setSelectedEvidenceTag(null);
                  }}
                >
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    {new Date(point.timestamp).toLocaleTimeString()} • {point.averageSentiment} • {point.label || "steady"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Consensus vs Controversy</ThemedText>
            <View style={styles.consensusRow}>
              <View style={styles.consensusColumn}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Consensus
                </ThemedText>
                {consensus?.consensus?.map((item) => (
                  <Pressable key={item.theme} onPress={() => setSelectedEvidenceTag(item.theme)}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>
                      • {item.theme} ({item.count})
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.consensusColumn}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Controversy
                </ThemedText>
                {consensus?.controversy?.map((item) => (
                  <Pressable key={item.theme} onPress={() => setSelectedEvidenceTag(item.theme)}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>
                      • {item.theme} (Δ{item.variance})
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Theme Clusters</ThemedText>
            <View style={styles.tagRow}>
              {themeClusters?.slice(0, 6).map((cluster) => (
                <Pressable
                  key={cluster.cluster}
                  onPress={() => setSelectedEvidenceTag(cluster.themes[0])}
                  style={[styles.tag, { backgroundColor: theme.backgroundDefault }]}
                >
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {cluster.cluster} • {cluster.themes.length} themes
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Sentiment Heatmap</ThemedText>
            {heatmap?.slice(0, 6).map((entry) => (
              <Pressable key={entry.tableId} onPress={() => setSelectedTableId(entry.tableId)}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Table {entry.tableNumber ?? "?"} • {entry.sessionName || "Session"} • {entry.sentimentScore ?? "?"} / {entry.sentimentConfidence ?? "?"}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Hot Tables</ThemedText>
            {hotTables?.map((entry) => (
              <Pressable key={entry.tableId} onPress={() => setSelectedTableId(entry.tableId)}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  • Table {tables?.find((table) => table.id === entry.tableId)?.tableNumber ?? entry.tableId} • {entry.lineCount} new lines
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Action Items</ThemedText>
            {actionItems?.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.insightRow}>
                <Pressable
                  onPress={() => {
                    setEvidenceSearch(item.text);
                    setSelectedEvidenceTag(null);
                  }}
                >
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    • {item.text}
                  </ThemedText>
                </Pressable>
                {isRecent(item.createdAt) ? (
                  <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
                    New since last check
                  </ThemedText>
                ) : null}
                {item.tags?.length ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    Tags: {item.tags.join(", ")}
                  </ThemedText>
                ) : null}
                {item.mergeCandidates?.length ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    Merge candidates: {item.mergeCandidates.join(", ")}
                  </ThemedText>
                ) : null}
                {item.evidencePreview ? (
                  <Pressable onPress={() => item.evidenceLineId && openContextPane(item.evidenceLineId, "Action item evidence")}>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {item.sessionName || "Session"} • {item.tableNumber ? `Table ${item.tableNumber}` : "Table ?"} • {item.evidenceAt ? new Date(item.evidenceAt).toLocaleTimeString() : "—"} • {item.evidenceSpeaker || "Speaker"}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      “{item.evidencePreview}”
                    </ThemedText>
                  </Pressable>
                ) : null}
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Confidence: {getConfidenceLabel(item.evidenceCount).label} ({getConfidenceLabel(item.evidenceCount).reason}) • Evidence {item.evidenceCount ?? 0}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Open Questions</ThemedText>
            {openQuestions?.slice(0, 5).map((question) => (
              <View key={question.id} style={styles.insightRow}>
                <Pressable
                  onPress={() => {
                    setEvidenceSearch(question.question);
                    setSelectedEvidenceTag(null);
                  }}
                >
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    • {question.question}
                  </ThemedText>
                </Pressable>
                {isRecent(question.createdAt) ? (
                  <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
                    New since last check
                  </ThemedText>
                ) : null}
                {question.evidencePreview ? (
                  <Pressable onPress={() => question.evidenceLineId && openContextPane(question.evidenceLineId, "Question context")}>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {question.evidenceSpeaker || "Speaker"} • {question.sessionName || "Session"} • {question.tableNumber ? `Table ${question.tableNumber}` : "Table ?"} • {question.evidenceAt ? new Date(question.evidenceAt).toLocaleTimeString() : "--"}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      “{question.evidencePreview}”
                    </ThemedText>
                  </Pressable>
                ) : null}
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Confidence: {getConfidenceLabel(question.evidenceCount).label} ({getConfidenceLabel(question.evidenceCount).reason}) • Evidence {question.evidenceCount ?? 0}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Golden Nuggets</ThemedText>
            {goldenNuggets?.slice(0, 5).map((nugget) => (
              <ThemedText key={nugget.id} type="body" style={{ color: theme.textSecondary }}>
                • {nugget.text}
              </ThemedText>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Quote Bank</ThemedText>
            {!event?.allowQuotes ? (
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                Quotes are disabled by event privacy mode.
              </ThemedText>
            ) : null}
            {quotes?.slice(0, 5).map((quote) => (
              <View key={quote.id} style={styles.quoteRow}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Quote {quote.id} • {quote.governance} • {quote.sessionName || "Session"} • Table {quote.tableNumber ?? "?"}
                </ThemedText>
                {quote.content ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    {quote.speakerTag || "Speaker"} • {quote.lineAt ? new Date(quote.lineAt).toLocaleTimeString() : "--"} • “{quote.content}”
                  </ThemedText>
                ) : null}
                <View style={styles.quoteActions}>
                  {["internal", "shareable", "sponsor-safe"].map((governance) => (
                    <Pressable
                      key={governance}
                      onPress={() => event?.allowQuotes && apiRequest("PATCH", `/api/quotes/${quote.id}`, { governance })}
                      disabled={!event?.allowQuotes}
                      style={[
                        styles.quoteChip,
                        { opacity: event?.allowQuotes ? 1 : 0.5, backgroundColor: tokens.colors.surfaceAlt },
                      ]}
                    >
                      <ThemedText type="caption" style={{ color: theme.textMuted }}>
                        {governance}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4">Audit Log</ThemedText>
            {auditLogs?.slice(0, 5).map((log) => (
              <ThemedText key={log.id} type="caption" style={{ color: theme.textMuted }}>
                {log.action} • {new Date(log.createdAt).toLocaleTimeString()}
              </ThemedText>
            ))}
          </View>
        </ScrollView>

        <View style={styles.evidenceColumn}>
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            EVIDENCE STREAM
          </ThemedText>
          <View style={styles.evidenceSearch}>
            <TextInput
              style={[styles.evidenceInput, { color: theme.text, backgroundColor: tokens.colors.surfaceAlt }]}
              placeholder="Search evidence..."
              placeholderTextColor={theme.textMuted}
              value={evidenceSearch}
              onChangeText={setEvidenceSearch}
            />
            {selectedEvidenceTag ? (
              <Pressable onPress={() => setSelectedEvidenceTag(null)}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Clear tag
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setShowTranscriptPane(true)}>
              <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
                Open transcript pane
              </ThemedText>
            </Pressable>
          </View>
          <ScrollView>
            {evidenceLinesFiltered?.slice(0, 30).map((line) => (
              <View key={line.id} style={[styles.evidenceCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  {line.speakerTag || "Speaker"} • {new Date(line.createdAt).toLocaleTimeString()}
                </ThemedText>
                {line.redacted ? (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    PII-scrubbed only
                  </ThemedText>
                ) : null}
                {renderHighlightedText(line.content)}
                {event?.allowQuotes ? (
                  <View style={styles.quoteActions}>
                    {[
                      { label: "Clip 10s", ms: 10000 },
                      { label: "Clip 30s", ms: 30000 },
                      { label: "Clip Line", ms: null },
                    ].map((preset) => (
                      <Pressable
                        key={preset.label}
                        onPress={() => {
                          if (preset.ms && (line.startMs === null || line.startMs === undefined)) {
                            return;
                          }
                          const startMs = line.startMs ?? null;
                          const endMs = preset.ms && startMs !== null ? startMs + preset.ms : line.endMs ?? null;
                          apiRequest("POST", "/api/quotes", {
                            tableId: line.tableId,
                            transcriptLineId: line.id,
                            governance: "internal",
                            startMs,
                            endMs,
                          });
                        }}
                        disabled={!!preset.ms && (line.startMs === null || line.startMs === undefined)}
                        style={[
                          styles.quoteChip,
                          {
                            backgroundColor: tokens.colors.surfaceAlt,
                            opacity: preset.ms && (line.startMs === null || line.startMs === undefined) ? 0.5 : 1,
                          },
                        ]}
                      >
                        <ThemedText type="caption" style={{ color: theme.textMuted }}>
                          {preset.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    Quotes disabled by privacy mode.
                  </ThemedText>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showTranscriptPane}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTranscriptPane(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.colors.overlay }]} onPress={() => setShowTranscriptPane(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Transcript Pane</ThemedText>
              <Pressable onPress={() => setShowTranscriptPane(false)}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Showing {transcriptOffset + 1}-{Math.min(transcriptOffset + transcriptLimit, transcriptCount?.count ?? transcriptOffset)} of {transcriptCount?.count ?? "?"}
            </ThemedText>
            <TextInput
              style={[styles.evidenceInput, { color: theme.text, backgroundColor: tokens.colors.surfaceAlt }]}
              placeholder="Search transcript..."
              placeholderTextColor={theme.textMuted}
              value={evidenceSearch}
              onChangeText={setEvidenceSearch}
            />
            <View style={styles.audioRow}>
              <Feather name="headphones" size={14} color={theme.textMuted} />
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                {event?.retainAudio ? "Audio playback syncing (beta)." : "Audio playback disabled (retain audio off)."}
              </ThemedText>
            </View>
            <ScrollView style={styles.transcriptScroll}>
              {transcriptLines?.map((line) => (
                <View key={line.id} style={styles.transcriptRow}>
                  <View style={styles.transcriptHeader}>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {line.speakerTag || "Speaker"} • {new Date(line.createdAt).toLocaleTimeString()}
                    </ThemedText>
                    {line.startMs !== null && line.startMs !== undefined ? (
                      <Pressable onPress={() => openContextPane(line.id, "Transcript context")}>
                        <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
                          Jump @ {Math.round(line.startMs / 1000)}s
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                  {renderHighlightedText(line.content)}
                </View>
              ))}
            </ScrollView>
            <View style={styles.nudgeActions}>
              <Pressable
                onPress={() => setTranscriptOffset(Math.max(0, transcriptOffset - transcriptLimit))}
                style={[styles.quoteChip, { backgroundColor: tokens.colors.surfaceAlt }]}
              >
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Newer
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setTranscriptOffset(transcriptOffset + transcriptLimit)}
                style={[styles.quoteChip, { backgroundColor: tokens.colors.surfaceAlt }]}
              >
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Older
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showContextPane}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContextPane(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.colors.overlay }]} onPress={() => setShowContextPane(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">{contextTitle}</ThemedText>
              <Pressable onPress={() => setShowContextPane(false)}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
            <ScrollView style={styles.transcriptScroll}>
              {contextLines.map((line) => (
                <View key={line.id} style={styles.transcriptRow}>
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    {line.speakerTag || "Speaker"} • {new Date(line.createdAt).toLocaleTimeString()}
                  </ThemedText>
                  {renderHighlightedText(line.content)}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showOpsDrawer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOpsDrawer(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.colors.overlay }]} onPress={() => setShowOpsDrawer(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Ops Actions</ThemedText>
              <Pressable onPress={() => setShowOpsDrawer(false)}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Target: {selectedTableId ? `Table ${tables?.find((table) => table.id === selectedTableId)?.tableNumber ?? selectedTableId}` : selectedSessionId ? `Session ${selectedSessionId}` : "Event"}
            </ThemedText>
            <View style={styles.tagRow}>
              {["5 minutes left", "Switch prompt", "Wrap up now"].map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => sendNudge(preset)}
                  style={[styles.tag, { backgroundColor: tokens.colors.blueTint }]}
                >
                  <ThemedText type="caption" style={{ color: tokens.colors.primary }}>
                    {preset}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.evidenceInput, { color: theme.text, backgroundColor: tokens.colors.surfaceAlt }]}
              placeholder="Custom nudge message..."
              placeholderTextColor={theme.textMuted}
              value={nudgeMessage}
              onChangeText={setNudgeMessage}
            />
            <View style={styles.nudgeActions}>
              <Pressable
                onPress={() => setNudgePriority(nudgePriority === "normal" ? "urgent" : "normal")}
                style={[styles.quoteChip, { backgroundColor: tokens.colors.surfaceAlt }]}
              >
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Priority: {nudgePriority}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => sendNudge(nudgeMessage)} style={styles.actionButton}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Send Nudge
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterInput: {
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minWidth: 120,
  },
  columns: {
    flex: 1,
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  leftRail: {
    width: 220,
    gap: Spacing.sm,
  },
  sessionList: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sessionChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  sessionClear: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  tableRow: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  tableRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  centerColumn: {
    flex: 1,
  },
  evidenceColumn: {
    width: 280,
    gap: Spacing.sm,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  insightRow: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  timelineList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  consensusRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  consensusColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  quoteRow: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  quoteActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  quoteChip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  evidenceSearch: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  evidenceInput: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  evidenceCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  quoteButton: {
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  transcriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  nudgeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  transcriptScroll: {
    marginTop: Spacing.md,
  },
  transcriptRow: {
    marginBottom: Spacing.sm,
  },
});
