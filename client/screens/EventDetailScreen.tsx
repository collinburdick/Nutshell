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

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
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

      const res = await apiRequest("POST", `/api/events/${eventId}/sessions`, {
        name: newSessionName,
        topic: newSessionTopic,
        discussionGuide: guideItems,
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
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)}>
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
    backgroundColor: "rgba(0,0,0,0.5)",
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
