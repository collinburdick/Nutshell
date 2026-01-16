import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  RefreshControl,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SessionDetail">;
type SessionDetailRouteProp = RouteProp<RootStackParamList, "SessionDetail">;

interface Session {
  id: number;
  name: string;
  topic: string | null;
  status: string;
  discussionGuide: string[] | null;
}

interface Table {
  id: number;
  tableNumber: number;
  topic: string | null;
  joinCode: string;
  status: string;
  lastActivityAt: string | null;
}

export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SessionDetailRouteProp>();
  const queryClient = useQueryClient();
  const { sessionId } = route.params;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tableTopic, setTableTopic] = useState("");
  const [nudgeMessage, setNudgeMessage] = useState("");

  const { data: session } = useQuery<Session>({
    queryKey: ["/api/sessions", sessionId],
  });

  const { data: tables, isLoading, refetch } = useQuery<Table[]>({
    queryKey: ["/api/sessions", sessionId, "tables"],
    refetchInterval: 10000,
  });

  const createTableMutation = useMutation({
    mutationFn: async () => {
      const nextTableNumber = (tables?.length || 0) + 1;
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/tables`, {
        tableNumber: nextTableNumber,
        topic: tableTopic || null,
        status: "inactive",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "tables"] });
      setShowCreateModal(false);
      setTableTopic("");
    },
  });

  const sendNudgeMutation = useMutation({
    mutationFn: async ({ tableId, message }: { tableId: number; message: string }) => {
      const res = await apiRequest("POST", "/api/nudges", {
        tableId,
        sessionId,
        type: "admin",
        message,
        priority: "normal",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNudgeModal(false);
      setNudgeMessage("");
      setSelectedTableId(null);
    },
  });

  const broadcastNudgeMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/broadcast-nudge`, {
        type: "admin",
        message,
        priority: "normal",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNudgeModal(false);
      setNudgeMessage("");
    },
  });

  const copyJoinCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const shareJoinCode = async (code: string, tableNumber: number) => {
    try {
      await Share.share({
        message: `Join Table ${tableNumber} with code: ${code}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return theme.success;
      case "inactive":
        return theme.textMuted;
      case "completed":
        return theme.link;
      default:
        return theme.textSecondary;
    }
  };

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
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
        <View style={[styles.sessionInfo, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3">{session?.name}</ThemedText>
          {session?.topic ? (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {session.topic}
            </ThemedText>
          ) : null}
          {session?.discussionGuide && session.discussionGuide.length > 0 ? (
            <View style={styles.guidePreview}>
              <Feather name="list" size={14} color={theme.textMuted} />
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                {session.discussionGuide.length} discussion prompts
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => navigation.navigate("SessionSummary", { sessionId })}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="bar-chart-2" size={18} color={theme.buttonText} />
            <ThemedText type="caption" style={{ color: theme.buttonText, fontWeight: "600" }}>
              Summary
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              setSelectedTableId(null);
              setShowNudgeModal(true);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.warning, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="bell" size={18} color={theme.buttonText} />
            <ThemedText type="caption" style={{ color: theme.buttonText, fontWeight: "600" }}>
              Broadcast
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Tables</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            {tables?.filter((t) => t.status === "active").length || 0} active
          </ThemedText>
        </View>

        {tables && tables.length > 0 ? (
          tables.map((table) => (
            <View
              key={table.id}
              style={[styles.tableCard, { backgroundColor: theme.backgroundDefault }]}
            >
              <View style={styles.tableHeader}>
                <View style={styles.tableTitle}>
                  <View style={[styles.tableNumber, { backgroundColor: theme.link }]}>
                    <ThemedText type="caption" style={{ color: theme.buttonText, fontWeight: "700" }}>
                      {table.tableNumber}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      Table {table.tableNumber}
                    </ThemedText>
                    {table.topic ? (
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {table.topic}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(table.status) + "20" }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(table.status) }]} />
                  <ThemedText type="caption" style={{ color: getStatusColor(table.status) }}>
                    {table.status}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.joinCodeSection}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  JOIN CODE
                </ThemedText>
                <View style={styles.joinCodeRow}>
                  <View style={[styles.joinCodeBox, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="h3" style={{ letterSpacing: 4 }}>
                      {table.joinCode}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => copyJoinCode(table.joinCode)}
                    style={[styles.codeButton, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name="copy" size={18} color={theme.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => shareJoinCode(table.joinCode, table.tableNumber)}
                    style={[styles.codeButton, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name="share" size={18} color={theme.text} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.tableFooter}>
                {table.lastActivityAt ? (
                  <View style={styles.activityInfo}>
                    <Feather name="clock" size={12} color={theme.textMuted} />
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {getTimeSince(table.lastActivityAt)}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText type="caption" style={{ color: theme.textMuted }}>
                    No activity yet
                  </ThemedText>
                )}
                <Pressable
                  onPress={() => {
                    setSelectedTableId(table.id);
                    setShowNudgeModal(true);
                  }}
                  style={[styles.nudgeButton, { backgroundColor: theme.warning + "20" }]}
                >
                  <Feather name="bell" size={14} color={theme.warning} />
                  <ThemedText type="caption" style={{ color: theme.warning, fontWeight: "600" }}>
                    Nudge
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="grid" size={40} color={theme.textMuted} />
            <ThemedText type="body" style={{ color: theme.textMuted, textAlign: "center" }}>
              No tables yet.{"\n"}Add tables for facilitators to join.
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
            Add Table
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
              <ThemedText type="h4">Add Table</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  TABLE TOPIC (OPTIONAL)
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="e.g., AI in Healthcare"
                  placeholderTextColor={theme.textMuted}
                  value={tableTopic}
                  onChangeText={setTableTopic}
                />
              </View>

              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                A unique join code will be generated automatically.
              </ThemedText>

              <Pressable
                onPress={() => createTableMutation.mutate()}
                disabled={createTableMutation.isPending}
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.link, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                  {createTableMutation.isPending ? "Creating..." : "Create Table"}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showNudgeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNudgeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNudgeModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">
                {selectedTableId ? "Send Nudge" : "Broadcast to All Tables"}
              </ThemedText>
              <Pressable onPress={() => setShowNudgeModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  MESSAGE
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="e.g., 5 minutes remaining!"
                  placeholderTextColor={theme.textMuted}
                  value={nudgeMessage}
                  onChangeText={setNudgeMessage}
                  multiline
                />
              </View>

              <View style={styles.quickNudges}>
                {["5 minutes remaining", "Please wrap up", "Time's up!"].map((msg) => (
                  <Pressable
                    key={msg}
                    onPress={() => setNudgeMessage(msg)}
                    style={[styles.quickNudge, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <ThemedText type="caption">{msg}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  if (selectedTableId) {
                    sendNudgeMutation.mutate({ tableId: selectedTableId, message: nudgeMessage });
                  } else {
                    broadcastNudgeMutation.mutate(nudgeMessage);
                  }
                }}
                disabled={!nudgeMessage.trim() || sendNudgeMutation.isPending || broadcastNudgeMutation.isPending}
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.warning, opacity: !nudgeMessage.trim() || pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="send" size={18} color={theme.buttonText} />
                <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                  {sendNudgeMutation.isPending || broadcastNudgeMutation.isPending ? "Sending..." : "Send Nudge"}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sessionInfo: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  guidePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  tableCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tableTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  tableNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  joinCodeSection: {
    gap: Spacing.xs,
  },
  joinCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  joinCodeBox: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  codeButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tableFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nudgeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
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
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalForm: {
    gap: Spacing.lg,
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
  quickNudges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  quickNudge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  modalButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
});
