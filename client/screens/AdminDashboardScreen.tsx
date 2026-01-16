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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AdminDashboard">;

interface Event {
  id: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");

  const { data: events, isLoading, refetch } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events", {
        name: newEventName,
        description: newEventDescription,
        status: "draft",
      });
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowCreateModal(false);
      setNewEventName("");
      setNewEventDescription("");
    },
  });

  const handleLogout = async () => {
    const token = await AsyncStorage.getItem("adminToken");
    if (token) {
      await apiRequest("POST", "/api/admin/logout", { token });
    }
    await AsyncStorage.removeItem("adminToken");
    navigation.replace("Join");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return theme.success;
      case "draft":
        return theme.textMuted;
      case "completed":
        return theme.link;
      default:
        return theme.textSecondary;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              ADMIN CONSOLE
            </ThemedText>
            <ThemedText type="h3">Events</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate("LiveMonitoring")}
              style={[styles.iconButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="activity" size={20} color={theme.link} />
            </Pressable>
            <Pressable
              onPress={handleLogout}
              style={[styles.iconButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="log-out" size={20} color={theme.error} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
      >
        {events && events.length > 0 ? (
          events.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => navigation.navigate("EventDetail", { eventId: event.id })}
              style={({ pressed }) => [
                styles.eventCard,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.eventHeader}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(event.status) }]} />
                <ThemedText type="caption" style={{ color: getStatusColor(event.status), textTransform: "uppercase" }}>
                  {event.status}
                </ThemedText>
              </View>
              <ThemedText type="h4" numberOfLines={1}>
                {event.name}
              </ThemedText>
              {event.description ? (
                <ThemedText type="body" style={{ color: theme.textSecondary }} numberOfLines={2}>
                  {event.description}
                </ThemedText>
              ) : null}
              <View style={styles.eventFooter}>
                <Feather name="calendar" size={14} color={theme.textMuted} />
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  {new Date(event.createdAt).toLocaleDateString()}
                </ThemedText>
                <Feather name="chevron-right" size={18} color={theme.textMuted} style={{ marginLeft: "auto" }} />
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={48} color={theme.textMuted} />
            <ThemedText type="body" style={{ color: theme.textMuted, textAlign: "center" }}>
              No events yet.{"\n"}Create your first event to get started.
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
            New Event
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
              <ThemedText type="h4">Create Event</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  EVENT NAME
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="e.g., Tech Conference 2026"
                  placeholderTextColor={theme.textMuted}
                  value={newEventName}
                  onChangeText={setNewEventName}
                />
              </View>

              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  DESCRIPTION (OPTIONAL)
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="Add a description..."
                  placeholderTextColor={theme.textMuted}
                  value={newEventDescription}
                  onChangeText={setNewEventDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <Pressable
                onPress={() => createEventMutation.mutate()}
                disabled={!newEventName.trim() || createEventMutation.isPending}
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.link, opacity: !newEventName.trim() || pressed ? 0.7 : 1 },
                ]}
              >
                <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                  {createEventMutation.isPending ? "Creating..." : "Create Event"}
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  eventCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.lg,
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
    height: 100,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  modalButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
});
