import React, { useMemo, useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "LiveMonitoring">;

interface ActiveTable {
  id: number;
  tableNumber: number;
  topic: string | null;
  joinCode: string;
  status: string;
  lastActivityAt: string | null;
  lastAudioAt?: string | null;
  lastTranscriptAt?: string | null;
  lastSummaryAt?: string | null;
  sessionName: string;
  eventName: string;
}

export default function LiveMonitoringScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<ActiveTable | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | "healthy" | "degraded" | "offline">("all");
  const [isEmergency, setIsEmergency] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  const { data: activeTables, isLoading, refetch } = useQuery<ActiveTable[]>({
    queryKey: ["/api/admin/active-tables"],
    refetchInterval: 5000,
  });

  const closeNudgeModal = () => {
    setShowNudgeModal(false);
    setNudgeMessage("");
    setSelectedTable(null);
    setIsEmergency(false);
    setNudgeError(null);
  };

  const { data: nudgeStats } = useQuery<{ sent: number; acknowledged: number; pending: number; delivered: number; opened: number }>({
    queryKey: ["/api/nudges/stats", selectedTable?.id],
    enabled: !!selectedTable && showNudgeModal,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/nudges/stats?tableId=${selectedTable?.id}`);
      return res.json();
    },
  });

  const sendNudgeMutation = useMutation({
    mutationFn: async ({ tableId, message }: { tableId: number; message: string }) => {
      const res = await apiRequest("POST", "/api/nudges", {
        tableId,
        type: "admin",
        message,
        priority: isEmergency ? "urgent" : "normal",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeNudgeModal();
    },
    onError: (error: Error) => {
      setNudgeError(error.message.includes("429") ? "Nudges are rate-limited. Try again shortly." : "Failed to send nudge.");
    },
  });

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return "0m";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "<1m";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  };

  const getActivityLevel = (dateString: string | null) => {
    if (!dateString) return "inactive";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return "high";
    if (diffMins < 5) return "medium";
    return "low";
  };

  const getHealthState = (dateString: string | null) => {
    if (!dateString) return "offline";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs <= 60000) return "healthy";
    if (diffMs <= 180000) return "degraded";
    return "offline";
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case "high":
        return theme.success;
      case "medium":
        return theme.warning;
      case "low":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  const filteredTables = useMemo(() => {
    if (!activeTables) return [];
    return activeTables.filter((table) => {
      const matchesSearch =
        table.sessionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        table.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        table.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        table.joinCode.toLowerCase().includes(searchQuery.toLowerCase());
      const healthState = getHealthState(table.lastAudioAt ?? table.lastActivityAt);
      const matchesHealth = healthFilter === "all" ? true : healthState === healthFilter;
      return matchesSearch && matchesHealth;
    });
  }, [activeTables, healthFilter, searchQuery]);

  const alertTables = useMemo(() => {
    if (!activeTables) return [];
    return activeTables.filter((table) => getHealthState(table.lastAudioAt ?? table.lastActivityAt) !== "healthy");
  }, [activeTables]);

  const hotTables = useMemo(() => {
    if (!activeTables) return [];
    return activeTables.filter((table) => getActivityLevel(table.lastActivityAt) === "high");
  }, [activeTables]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              LIVE MONITORING
            </ThemedText>
            <ThemedText type="h3">Active Tables</ThemedText>
          </View>
          <View style={[styles.liveIndicator, { backgroundColor: theme.success + "20" }]}>
            <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
            <ThemedText type="caption" style={{ color: theme.success, fontWeight: "600" }}>
              LIVE
            </ThemedText>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h2" style={{ color: theme.link }}>
              {filteredTables.length || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Active Tables
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h2" style={{ color: theme.success }}>
              {hotTables.length || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Hot Tables
            </ThemedText>
          </View>
        </View>

        <View style={styles.filters}>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="search" size={16} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Filter by event, session, topic, or code"
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <View style={styles.filterRow}>
            {[
              { key: "all", label: "All" },
              { key: "healthy", label: "Healthy" },
              { key: "degraded", label: "Degraded" },
              { key: "offline", label: "Offline" },
            ].map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setHealthFilter(item.key as typeof healthFilter)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      healthFilter === item.key ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: healthFilter === item.key ? theme.buttonText : theme.textSecondary,
                  }}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
      >
        {alertTables.length > 0 ? (
          <View style={[styles.alertBanner, { backgroundColor: theme.warning + "20" }]}>
            <Feather name="alert-triangle" size={16} color={theme.warning} />
            <ThemedText type="caption" style={{ color: theme.warning, fontWeight: "600" }}>
              {alertTables.length} table{alertTables.length !== 1 ? "s" : ""} need attention
            </ThemedText>
          </View>
        ) : null}

        {filteredTables.length > 0 ? (
          <View style={styles.tableGrid}>
            {filteredTables.map((table) => {
              const activityLevel = getActivityLevel(table.lastActivityAt);
              const healthState = getHealthState(table.lastAudioAt ?? table.lastActivityAt);
              return (
                <Pressable
                  key={table.id}
                  onPress={() => {
                    setSelectedTable(table);
                    setShowNudgeModal(true);
                  }}
                  style={({ pressed }) => [
                    styles.tableCard,
                    { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={styles.tableHeader}>
                    <View style={[styles.tableNumber, { backgroundColor: theme.link }]}>
                      <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "700" }}>
                        {table.tableNumber}
                      </ThemedText>
                    </View>
                    <View style={[styles.activityIndicator, { backgroundColor: getActivityColor(activityLevel) }]} />
                  </View>

                  <ThemedText type="caption" style={{ color: theme.textMuted }} numberOfLines={1}>
                    {table.eventName}
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                    {table.sessionName}
                  </ThemedText>
                  {table.topic ? (
                    <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
                      {table.topic}
                    </ThemedText>
                  ) : null}

                  <View style={styles.freshnessRow}>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      Audio {getTimeSince(table.lastAudioAt ?? null)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      Transcript {getTimeSince(table.lastTranscriptAt ?? null)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      Summary {getTimeSince(table.lastSummaryAt ?? null)}
                    </ThemedText>
                  </View>

                  <View style={styles.tableFooter}>
                    <View style={styles.timeInfo}>
                      <Feather name="clock" size={12} color={theme.textMuted} />
                      <ThemedText type="caption" style={{ color: theme.textMuted }}>
                        {getTimeSince(table.lastActivityAt)}
                      </ThemedText>
                    </View>
                    <View style={[styles.healthBadge, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {healthState}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="radio" size={48} color={theme.textMuted} />
            <ThemedText type="h4" style={{ color: theme.textMuted }}>
              No Active Tables
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textMuted, textAlign: "center" }}>
              When facilitators join sessions,{"\n"}they will appear here in real-time.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showNudgeModal}
        transparent
        animationType="slide"
        onRequestClose={closeNudgeModal}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={closeNudgeModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">
                Nudge Table {selectedTable?.tableNumber}
              </ThemedText>
              <Pressable onPress={closeNudgeModal}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View style={[styles.tableInfo, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  {selectedTable?.eventName}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {selectedTable?.sessionName}
                </ThemedText>
              </View>

              {nudgeStats ? (
                <View style={styles.statsRow}>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">Sent: {nudgeStats.sent}</ThemedText>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">Ack: {nudgeStats.acknowledged}</ThemedText>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">Pending: {nudgeStats.pending}</ThemedText>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">Delivered: {nudgeStats.delivered}</ThemedText>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">Opened: {nudgeStats.opened}</ThemedText>
                  </View>
                </View>
              ) : null}

              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  MESSAGE
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="Type your message..."
                  placeholderTextColor={theme.textMuted}
                  value={nudgeMessage}
                  onChangeText={setNudgeMessage}
                  multiline
                />
              </View>

              <Pressable
                onPress={() => setIsEmergency((prev) => !prev)}
                style={[
                  styles.emergencyToggle,
                  { backgroundColor: isEmergency ? theme.error + "20" : theme.backgroundSecondary },
                ]}
              >
                <Feather name="alert-octagon" size={16} color={isEmergency ? theme.error : theme.textMuted} />
                <ThemedText type="caption" style={{ color: isEmergency ? theme.error : theme.textSecondary }}>
                  Emergency nudge
                </ThemedText>
              </Pressable>

              <View style={styles.quickNudges}>
                {["5 minutes remaining", "Please wrap up", "Time's up!", "Check in with your table"].map((msg) => (
                  <Pressable
                    key={msg}
                    onPress={() => setNudgeMessage(msg)}
                    style={[styles.quickNudge, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <ThemedText type="caption">{msg}</ThemedText>
                  </Pressable>
                ))}
              </View>

              {nudgeError ? (
                <ThemedText type="caption" style={{ color: theme.error }}>
                  {nudgeError}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={() => {
                  if (selectedTable) {
                    sendNudgeMutation.mutate({ tableId: selectedTable.id, message: nudgeMessage });
                  }
                }}
                disabled={!nudgeMessage.trim() || sendNudgeMutation.isPending}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: isEmergency ? theme.error : theme.warning,
                    opacity: !nudgeMessage.trim() || pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="send" size={18} color={theme.buttonText} />
                <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                  {sendNudgeMutation.isPending ? "Sending..." : "Send Nudge"}
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
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backButton: {
    marginRight: Spacing.xs,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  filters: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  tableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  tableCard: {
    width: "48%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  tableNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tableFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  freshnessRow: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  healthBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
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
  tableInfo: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  modalForm: {
    gap: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  statChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
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
  emergencyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
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
