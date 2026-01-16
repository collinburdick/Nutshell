import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useAudioRecorder, RecordingPresets, AudioModule } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { MicLevelIndicator } from "@/components/MicLevelIndicator";
import { SessionTimer } from "@/components/SessionTimer";
import { NudgeBanner } from "@/components/NudgeBanner";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Session">;
type SessionRouteProp = RouteProp<RootStackParamList, "Session">;

interface TableData {
  id: number;
  tableNumber: number;
  topic: string;
  sessionName: string;
  discussionGuide: string[];
  status: string;
}

interface SummaryData {
  content: string;
  themes: string[];
  actionItems: string[];
  openQuestions: string[];
  updatedAt: string;
}

interface NudgeData {
  id: number;
  type: string;
  message: string;
  priority: string;
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SessionRouteProp>();
  const queryClient = useQueryClient();
  const { tableId, token } = route.params;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "degraded" | "offline">("connected");
  const [micLevel, setMicLevel] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [activeNudge, setActiveNudge] = useState<NudgeData | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const pulseAnim = useSharedValue(1);

  const { data: tableData, isLoading: tableLoading } = useQuery<TableData>({
    queryKey: ["/api/tables", tableId],
  });

  const { data: summaryData, refetch: refetchSummary } = useQuery<SummaryData>({
    queryKey: ["/api/tables", tableId, "summary"],
    refetchInterval: 15000,
  });

  const { data: nudges } = useQuery<NudgeData[]>({
    queryKey: ["/api/tables", tableId, "nudges"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (nudges && nudges.length > 0) {
      setActiveNudge(nudges[0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [nudges]);

  const acknowledgeNudgeMutation = useMutation({
    mutationFn: async (nudgeId: number) => {
      await apiRequest("POST", `/api/nudges/${nudgeId}/acknowledge`, { token });
    },
    onSuccess: () => {
      setActiveNudge(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tables", tableId, "nudges"] });
    },
  });

  const sendAudioMutation = useMutation({
    mutationFn: async (audioBase64: string) => {
      setTranscriptionStatus("Processing audio...");
      const res = await apiRequest("POST", `/api/tables/${tableId}/audio`, {
        token,
        audio: audioBase64,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.transcription) {
        setTranscriptionStatus("Transcribed successfully");
        setTimeout(() => setTranscriptionStatus(""), 2000);
      } else {
        setTranscriptionStatus("");
      }
      refetchSummary();
    },
    onError: (error) => {
      console.error("Audio upload error:", error);
      setTranscriptionStatus("Transcription error");
      setTimeout(() => setTranscriptionStatus(""), 2000);
    },
  });

  // Function to capture audio and send to backend
  const captureAndSendAudio = useCallback(async () => {
    if (!audioRecorder.isRecording || audioRecorder.uri === null) {
      return;
    }

    try {
      // Stop current recording to get the audio file
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (uri) {
        if (Platform.OS === "web") {
          // On web, fetch the blob and convert to base64
          try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1];
              if (base64 && base64.length > 100) {
                sendAudioMutation.mutate(base64);
              }
            };
            reader.readAsDataURL(blob);
          } catch (webError) {
            console.error("Web audio capture error:", webError);
          }
        } else {
          // On native, use FileSystem to read as base64
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
          if (base64 && base64.length > 100) {
            sendAudioMutation.mutate(base64);
          }
        }
      }

      // Restart recording for next chunk if still in recording mode
      if (isRecordingRef.current) {
        audioRecorder.record();
      }
    } catch (error) {
      console.error("Error capturing audio:", error);
      // Try to restart recording
      if (isRecordingRef.current) {
        try {
          audioRecorder.record();
        } catch (e) {
          console.error("Failed to restart recording:", e);
        }
      }
    }
  }, [audioRecorder, sendAudioMutation]);

  const requestPermission = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    setHasPermission(status.granted);
    return status.granted;
  };

  const startRecording = async () => {
    try {
      setRecordingError(null);
      
      const granted = await requestPermission();
      if (!granted) {
        setRecordingError("Microphone permission is required to record");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Prepare the recorder first (required for native modules)
      try {
        await audioRecorder.prepareToRecordAsync();
      } catch (prepareError) {
        console.log("Prepare to record (may be optional):", prepareError);
        // Some versions don't require this, continue anyway
      }

      audioRecorder.record();
      setIsRecording(true);
      isRecordingRef.current = true;
      setSessionStartTime(new Date());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // Mic level indicator (simulated for now)
      recordingIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current && !isPaused) {
          const level = Math.random() * 0.5 + 0.3;
          setMicLevel(level);
        }
      }, 100);

      // Capture and send audio every 30 seconds for rolling transcription
      audioChunkIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current && !isPaused) {
          captureAndSendAudio();
        }
      }, 30000);

    } catch (error) {
      console.error("Failed to start recording:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("NativeSharedObject")) {
        setRecordingError("Recording not available. Please use the Expo Go app on your device.");
      } else {
        setRecordingError("Could not start recording. Please try again.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const stopRecording = async () => {
    try {
      isRecordingRef.current = false;
      
      // Clear intervals first
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (audioChunkIntervalRef.current) {
        clearInterval(audioChunkIntervalRef.current);
        audioChunkIntervalRef.current = null;
      }

      // Stop recording and capture final audio
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;

        // Send the final audio chunk
        if (uri) {
          try {
            if (Platform.OS === "web") {
              const response = await fetch(uri);
              const blob = await response.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(",")[1];
                if (base64 && base64.length > 100) {
                  sendAudioMutation.mutate(base64);
                }
              };
              reader.readAsDataURL(blob);
            } else {
              const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: "base64",
              });
              if (base64 && base64.length > 100) {
                sendAudioMutation.mutate(base64);
              }
            }
          } catch (readError) {
            console.error("Error reading final audio:", readError);
          }
        }
      }

      setIsRecording(false);
      setMicLevel(0);
      pulseAnim.value = 1;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const togglePause = () => {
    if (isPaused) {
      audioRecorder.record();
    } else {
      audioRecorder.pause();
    }
    setIsPaused(!isPaused);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEndSession = () => {
    stopRecording();
    navigation.navigate("WrapUp", { tableId, token });
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (audioRecorder.isRecording) {
        audioRecorder.stop();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioChunkIntervalRef.current) {
        clearInterval(audioChunkIntervalRef.current);
      }
    };
  }, []);

  if (tableLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText type="body">Loading session...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {activeNudge ? (
        <NudgeBanner
          nudge={activeNudge}
          onDismiss={() => acknowledgeNudgeMutation.mutate(activeNudge.id)}
        />
      ) : null}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={styles.tableInfo}>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              TABLE {tableData?.tableNumber}
            </ThemedText>
            <ThemedText type="h4" numberOfLines={1}>
              {tableData?.sessionName || "Session"}
            </ThemedText>
          </View>
          <ConnectionStatus status={connectionStatus} />
        </View>

        <View style={styles.timerRow}>
          <SessionTimer startTime={sessionStartTime} isActive={isRecording && !isPaused} />
          <MicLevelIndicator level={micLevel} isActive={isRecording && !isPaused} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tableData?.topic ? (
          <View style={[styles.topicCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.topicHeader}>
              <Feather name="message-circle" size={18} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
                DISCUSSION TOPIC
              </ThemedText>
            </View>
            <ThemedText type="h4" style={styles.topicText}>
              {tableData.topic}
            </ThemedText>
          </View>
        ) : null}

        {tableData?.discussionGuide && tableData.discussionGuide.length > 0 ? (
          <View style={[styles.guideCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.guideHeader}>
              <Feather name="list" size={18} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
                DISCUSSION GUIDE
              </ThemedText>
            </View>
            {tableData.discussionGuide.map((prompt, index) => (
              <View key={index} style={styles.guideItem}>
                <View style={[styles.guideNumber, { backgroundColor: theme.link }]}>
                  <ThemedText type="caption" style={{ color: theme.buttonText, fontWeight: "700" }}>
                    {index + 1}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ flex: 1 }}>
                  {prompt}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.summaryHeader}>
            <Feather name="zap" size={18} color={theme.link} />
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
              LIVE SUMMARY
            </ThemedText>
            {isRecording ? (
              <View style={styles.liveIndicator}>
                <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
                <ThemedText type="caption" style={{ color: theme.success }}>
                  LIVE
                </ThemedText>
              </View>
            ) : null}
          </View>

          {summaryData?.content ? (
            <>
              <ThemedText type="body" style={styles.summaryContent}>
                {summaryData.content}
              </ThemedText>

              {summaryData.themes && summaryData.themes.length > 0 ? (
                <View style={styles.themesContainer}>
                  <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                    Key Themes
                  </ThemedText>
                  <View style={styles.themesList}>
                    {summaryData.themes.map((themeItem, index) => (
                      <View key={index} style={[styles.themeTag, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText type="caption">{themeItem}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptySummary}>
              <Feather name="mic" size={32} color={theme.textMuted} />
              <ThemedText type="body" style={{ color: theme.textMuted, textAlign: "center" }}>
                {isRecording
                  ? "Listening... Summary will appear shortly"
                  : "Start recording to generate live summary"}
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {transcriptionStatus ? (
        <View style={[styles.transcriptionStatus, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="activity" size={14} color={theme.textSecondary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
            {transcriptionStatus}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {isRecording ? (
          <View style={styles.recordingControls}>
            <Pressable
              onPress={togglePause}
              style={({ pressed }) => [
                styles.controlButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name={isPaused ? "play" : "pause"} size={24} color={theme.text} />
            </Pressable>

            <Pressable
              onPress={handleEndSession}
              style={({ pressed }) => [
                styles.endButton,
                { backgroundColor: theme.error, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Feather name="square" size={20} color={theme.buttonText} />
              <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                End Session
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.startRecordingContainer}>
            {recordingError ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.error + "20" }]}>
                <Feather name="alert-circle" size={16} color={theme.error} />
                <ThemedText type="caption" style={{ color: theme.error, flex: 1, marginLeft: Spacing.sm }}>
                  {recordingError}
                </ThemedText>
              </View>
            ) : null}
            <Pressable
              onPress={startRecording}
              style={({ pressed }) => [
                styles.startButton,
                { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Animated.View style={[styles.micIconContainer, pulseStyle]}>
                <Feather name="mic" size={28} color={theme.buttonText} />
              </Animated.View>
              <ThemedText type="h4" style={{ color: theme.buttonText }}>
                Start Recording
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  tableInfo: {
    flex: 1,
  },
  timerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  topicCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  topicHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  topicText: {
    lineHeight: 28,
  },
  guideCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  guideItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  guideNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 200,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: "auto",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryContent: {
    lineHeight: 26,
  },
  themesContainer: {
    marginTop: Spacing.lg,
  },
  themesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  themeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  emptySummary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing["3xl"],
  },
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  recordingControls: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  endButton: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  startButton: {
    height: Spacing.buttonHeightLarge,
    borderRadius: BorderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    ...Shadows.lg,
  },
  micIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  transcriptionStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  startRecordingContainer: {
    gap: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
