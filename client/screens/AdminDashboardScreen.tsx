import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
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
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { TopBar } from "@/components/TopBar";

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
  const { tokens } = useTheme();
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
        return tokens.colors.success;
      case "draft":
        return tokens.colors.textMuted;
      case "completed":
        return tokens.colors.primary;
      default:
        return tokens.colors.textMuted;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <ThemedText type="caption" style={{ color: tokens.colors.textMuted }}>
          ADMIN CONSOLE
        </ThemedText>
        <TopBar
          title="Events"
          rightAction={{
            icon: "log-out",
            onPress: handleLogout,
          }}
        />
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate("LiveMonitoring")}
            style={[styles.iconButton, { backgroundColor: tokens.colors.surfaceAlt }]}
          >
            <Feather name="activity" size={20} color={tokens.colors.primary} />
          </Pressable>
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
                { backgroundColor: tokens.colors.surface, opacity: pressed ? 0.8 : 1, borderColor: tokens.colors.borderSubtle },
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
                <ThemedText type="body" style={{ color: tokens.colors.textMuted }} numberOfLines={2}>
                  {event.description}
                </ThemedText>
              ) : null}
              <View style={styles.eventFooter}>
                <Feather name="calendar" size={14} color={tokens.colors.textMuted} />
                <ThemedText type="caption" style={{ color: tokens.colors.textMuted }}>
                  {new Date(event.createdAt).toLocaleDateString()}
                </ThemedText>
                <Feather name="chevron-right" size={18} color={tokens.colors.textMuted} style={{ marginLeft: "auto" }} />
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={48} color={tokens.colors.textMuted} />
            <ThemedText type="body" style={{ color: tokens.colors.textMuted, textAlign: "center" }}>
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
            { backgroundColor: tokens.colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="plus" size={24} color={tokens.colors.primaryText} />
          <ThemedText type="body" style={{ color: tokens.colors.primaryText, fontWeight: "600" }}>
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
        <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.colors.overlay }]} onPress={() => setShowCreateModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: tokens.colors.surface }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Create Event</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={tokens.colors.text} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View>
                <ThemedText type="small" style={{ color: tokens.colors.textMuted, marginBottom: Spacing.xs }}>
                  EVENT NAME
                </ThemedText>
                <Input
                  placeholder="e.g., Tech Conference 2026"
                  value={newEventName}
                  onChangeText={setNewEventName}
                />
              </View>

              <View>
                <ThemedText type="small" style={{ color: tokens.colors.textMuted, marginBottom: Spacing.xs }}>
                  DESCRIPTION (OPTIONAL)
                </ThemedText>
                <Input
                  placeholder="Add a description..."
                  value={newEventDescription}
                  onChangeText={setNewEventDescription}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />
              </View>

              <Button
                onPress={() => createEventMutation.mutate()}
                disabled={!newEventName.trim() || createEventMutation.isPending}
              >
                {createEventMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
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
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
    borderWidth: 1,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
});
