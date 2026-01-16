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

  const { data: activeTables, isLoading, refetch } = useQuery<ActiveTable[]>({
    queryKey: ["/api/admin/active-tables"],
    refetchInterval: 5000,
  });

  const sendNudgeMutation = useMutation({
    mutationFn: async ({ tableId, message }: { tableId: number; message: string }) => {
      const res = await apiRequest("POST", "/api/nudges", {
        tableId,
        type: "admin",
        message,
        priority: "urgent",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNudgeModal(false);
      setNudgeMessage("");
      setSelectedTable(null);
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
              {activeTables?.length || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Active Tables
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h2" style={{ color: theme.success }}>
              {activeTables?.filter((t) => getActivityLevel(t.lastActivityAt) === "high").length || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              High Activity
            </ThemedText>
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
        {activeTables && activeTables.length > 0 ? (
          <View style={styles.tableGrid}>
            {activeTables.map((table) => {
              const activityLevel = getActivityLevel(table.lastActivityAt);
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

                  <View style={styles.tableFooter}>
                    <View style={styles.timeInfo}>
                      <Feather name="clock" size={12} color={theme.textMuted} />
                      <ThemedText type="caption" style={{ color: theme.textMuted }}>
                        {getTimeSince(table.lastActivityAt)}
                      </ThemedText>
                    </View>
                    <Feather name="bell" size={16} color={theme.warning} />
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
        onRequestClose={() => setShowNudgeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNudgeModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">
                Nudge Table {selectedTable?.tableNumber}
              </ThemedText>
              <Pressable onPress={() => setShowNudgeModal(false)}>
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

              <Pressable
                onPress={() => {
                  if (selectedTable) {
                    sendNudgeMutation.mutate({ tableId: selectedTable.id, message: nudgeMessage });
                  }
                }}
                disabled={!nudgeMessage.trim() || sendNudgeMutation.isPending}
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.warning, opacity: !nudgeMessage.trim() || pressed ? 0.7 : 1 },
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
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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
  tableInfo: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
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
