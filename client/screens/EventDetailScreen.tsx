import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "EventDetail">;
type EventDetailRouteProp = RouteProp<RootStackParamList, "EventDetail">;

interface Event {
  id: number;
  name: string;
  description: string | null;
  status: string;
  privacyMode?: string | null;
  retainAudio?: boolean;
  allowQuotes?: boolean;
}

interface Session {
  id: number;
  name: string;
  topic: string | null;
  status: string;
  discussionGuide: string[] | null;
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EventDetailRouteProp>();
  const queryClient = useQueryClient();
  const { eventId } = route.params;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionTopic, setNewSessionTopic] = useState("");
  const [discussionGuide, setDiscussionGuide] = useState("");
  const [agendaPhases, setAgendaPhases] = useState("");
  const [showInsightPack, setShowInsightPack] = useState(false);
  const [insightPackContent, setInsightPackContent] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showRedactionQueue, setShowRedactionQueue] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const updateEventMutation = useMutation({
    mutationFn: async (payload: Partial<Event>) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
    },
  });

  const insightPackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/events/${eventId}/insight-pack`);
      return res.json();
    },
    onSuccess: (data) => {
      setInsightPackContent(data.content || "");
      setShowInsightPack(true);
    },
  });

  const shareLinkMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await apiRequest("POST", "/api/share-links", {
        eventId,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const url = `${process.env.EXPO_PUBLIC_DOMAIN}/share/${data.token}`;
      setShareLink(url);
    },
  });

  const { data: redactionTasks, refetch: refetchRedaction } = useQuery<
    { id: number; inputText: string; status: string }[]
  >({
    queryKey: ["/api/redaction-tasks", eventId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/redaction-tasks?eventId=${eventId}`);
      return res.json();
    },
  });

  const approveRedactionMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("PATCH", `/api/redaction-tasks/${taskId}`, {
        status: "approved",
        redactedText: "Approved",
        reviewedAt: new Date(),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchRedaction();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (destination: string) => {
      const res = await apiRequest("POST", "/api/exports", {
        eventId,
        destination,
        status: "queued",
      });
      return res.json();
    },
    onSuccess: () => {
      setShowExportModal(false);
    },
  });

  const { data: sessions, isLoading, refetch } = useQuery<Session[]>({
    queryKey: ["/api/events", eventId, "sessions"],
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const guideItems = discussionGuide
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      const phases = agendaPhases
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const res = await apiRequest("POST", `/api/events/${eventId}/sessions`, {
        name: newSessionName,
        topic: newSessionTopic,
        discussionGuide: guideItems,
        agendaPhases: phases,
        status: "pending",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "sessions"] });
      setShowCreateModal(false);
      setNewSessionName("");
      setNewSessionTopic("");
      setDiscussionGuide("");
      setAgendaPhases("");
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return theme.success;
      case "pending":
        return theme.warning;
      case "completed":
        return theme.link;
      default:
        return theme.textSecondary;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
      >
        <View style={[styles.eventInfo, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3">{event?.name}</ThemedText>
          {event?.description ? (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {event.description}
            </ThemedText>
          ) : null}
          <View style={styles.eventMeta}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event?.status || "draft") + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(event?.status || "draft") }]} />
              <ThemedText type="caption" style={{ color: getStatusColor(event?.status || "draft"), textTransform: "uppercase" }}>
                {event?.status}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("EventSummary", { eventId })}
            style={({ pressed }) => [
              styles.summaryButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="bar-chart-2" size={18} color={theme.buttonText} />
            <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
              View Event Summary
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("AttendeeDashboard", { eventId })}
            style={({ pressed }) => [
              styles.summaryButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="users" size={18} color={theme.text} />
            <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
              Attendee View
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("EventIntelligence", { eventId })}
            style={({ pressed }) => [
              styles.summaryButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="activity" size={18} color={theme.text} />
            <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
              Intelligence Dashboard
            </ThemedText>
          </Pressable>
          <View style={styles.shareActions}>
            <Pressable
              onPress={() => insightPackMutation.mutate()}
              style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="file-text" size={16} color={theme.text} />
              <ThemedText type="caption" style={{ color: theme.text }}>
                Insight Pack
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => shareLinkMutation.mutate("attendee")}
              style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="share-2" size={16} color={theme.text} />
              <ThemedText type="caption" style={{ color: theme.text }}>
                Share Link
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("ThemeTicker", { eventId })}
              style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="activity" size={16} color={theme.text} />
              <ThemedText type="caption" style={{ color: theme.text }}>
                Theme Ticker
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowRedactionQueue(true)}
              style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="shield" size={16} color={theme.text} />
              <ThemedText type="caption" style={{ color: theme.text }}>
                Redaction Queue
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowExportModal(true)}
              style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="upload" size={16} color={theme.text} />
              <ThemedText type="caption" style={{ color: theme.text }}>
                Export
              </ThemedText>
            </Pressable>
          </View>
          {shareLink ? (
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              {shareLink}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.eventInfo, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Privacy Mode</ThemedText>
          <View style={styles.privacyRow}>
            {["strict", "balanced", "custom"].map((mode) => (
              <Pressable
                key={mode}
                onPress={() => updateEventMutation.mutate({ privacyMode: mode })}
                style={[
                  styles.privacyChip,
                  {
                    backgroundColor:
                      event?.privacyMode === mode ? theme.link : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: event?.privacyMode === mode ? theme.buttonText : theme.textSecondary }}
                >
                  {mode}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.privacyToggles}>
            <Pressable
              onPress={() => updateEventMutation.mutate({ retainAudio: !event?.retainAudio })}
              style={[styles.toggleRow, { backgroundColor: theme.backgroundSecondary }]}
            >
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Retain raw audio
              </ThemedText>
              <Feather name={event?.retainAudio ? "check-circle" : "circle"} size={18} color={theme.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => updateEventMutation.mutate({ allowQuotes: !event?.allowQuotes })}
              style={[styles.toggleRow, { backgroundColor: theme.backgroundSecondary }]}
            >
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Allow quotes in summaries
              </ThemedText>
              <Feather name={event?.allowQuotes ? "check-circle" : "circle"} size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Sessions</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            {sessions?.length || 0} session{sessions?.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        {sessions && sessions.length > 0 ? (
          sessions.map((session) => (
            <Pressable
              key={session.id}
              onPress={() => navigation.navigate("SessionDetail", { sessionId: session.id })}
              style={({ pressed }) => [
                styles.sessionCard,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.sessionHeader}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(session.status) }]} />
                <ThemedText type="caption" style={{ color: getStatusColor(session.status), textTransform: "uppercase" }}>
                  {session.status}
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                {session.name}
              </ThemedText>
              {session.topic ? (
                <ThemedText type="body" style={{ color: theme.textSecondary }} numberOfLines={2}>
                  {session.topic}
                </ThemedText>
              ) : null}
              <View style={styles.sessionFooter}>
                <View style={styles.sessionMeta}>
                  <Feather name="list" size={14} color={theme.textMuted} />
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    {session.discussionGuide?.length || 0} prompts
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="layers" size={40} color={theme.textMuted} />
            <ThemedText type="body" style={{ color: theme.textMuted, textAlign: "center" }}>
              No sessions yet.{"\n"}Add a session to create discussion tables.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={[styles.fab, { bottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={({ pressed }) => [
            styles.fabButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="plus" size={24} color={theme.buttonText} />
          <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
            New Session
          </ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowCreateModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Create Session</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalForm}>
                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    SESSION NAME
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="e.g., Future of AI"
                    placeholderTextColor={theme.textMuted}
                    value={newSessionName}
                    onChangeText={setNewSessionName}
                  />
                </View>

                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    DISCUSSION TOPIC
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="The main question or topic for discussion..."
                    placeholderTextColor={theme.textMuted}
                    value={newSessionTopic}
                    onChangeText={setNewSessionTopic}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    DISCUSSION GUIDE (ONE PROMPT PER LINE)
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, styles.largeTextArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder={"What challenges have you faced?\nWhat solutions have worked?\nWhat do you hope to achieve?"}
                    placeholderTextColor={theme.textMuted}
                    value={discussionGuide}
                    onChangeText={setDiscussionGuide}
                    multiline
                    numberOfLines={5}
                  />
                </View>

                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    AGENDA PHASES (ONE PER LINE)
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, styles.largeTextArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder={"Warm-up\nDeep Dive\nWrap-up"}
                    placeholderTextColor={theme.textMuted}
                    value={agendaPhases}
                    onChangeText={setAgendaPhases}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <Pressable
                  onPress={() => createSessionMutation.mutate()}
                  disabled={!newSessionName.trim() || createSessionMutation.isPending}
                  style={({ pressed }) => [
                    styles.modalButton,
                    { backgroundColor: theme.link, opacity: !newSessionName.trim() || pressed ? 0.7 : 1 },
                  ]}
                >
                  <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                    {createSessionMutation.isPending ? "Creating..." : "Create Session"}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showInsightPack}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInsightPack(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowInsightPack(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Insight Pack</ThemedText>
              <Pressable onPress={() => setShowInsightPack(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {insightPackContent || "Generating insight pack..."}
              </ThemedText>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showRedactionQueue}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRedactionQueue(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowRedactionQueue(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Redaction Queue</ThemedText>
              <Pressable onPress={() => setShowRedactionQueue(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              {redactionTasks && redactionTasks.length > 0 ? (
                redactionTasks.map((task) => (
                  <View key={task.id} style={[styles.redactionCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {task.status}
                    </ThemedText>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>
                      {task.inputText}
                    </ThemedText>
                    <Pressable
                      onPress={() => approveRedactionMutation.mutate(task.id)}
                      style={[styles.redactionButton, { backgroundColor: theme.link }]}
                    >
                      <ThemedText type="caption" style={{ color: theme.buttonText }}>
                        Approve
                      </ThemedText>
                    </Pressable>
                  </View>
                ))
              ) : (
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  No pending redactions.
                </ThemedText>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowExportModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Export Insights</ThemedText>
              <Pressable onPress={() => setShowExportModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.modalForm}>
              {["Slack", "Notion", "Salesforce", "CSV", "PDF"].map((destination) => (
                <Pressable
                  key={destination}
                  onPress={() => exportMutation.mutate(destination.toLowerCase())}
                  style={[styles.exportButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <ThemedText type="body" style={{ color: theme.text }}>
                    {destination}
                  </ThemedText>
                </Pressable>
              ))}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  eventInfo: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  eventMeta: {
    flexDirection: "row",
    marginTop: Spacing.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  shareActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  redactionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  redactionButton: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  exportButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  privacyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  privacyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  privacyToggles: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sessionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sessionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  sessionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  fab: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
  },
  fabButton: {
    height: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.lg,
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
    marginBottom: Spacing.lg,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalForm: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalInput: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  largeTextArea: {
    height: 120,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  modalButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
