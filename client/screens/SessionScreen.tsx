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
import { Audio } from "expo-av";
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
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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

  const sendAudioBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 100) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64 && base64.length > 100) {
        sendAudioMutation.mutate(base64);
      }
    };
    reader.readAsDataURL(blob);
  }, [sendAudioMutation]);

  const captureAndSendAudioWeb = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      return;
    }

    try {
      mediaRecorderRef.current.stop();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        sendAudioBlob(blob);
      }
      
      if (isRecordingRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
      }
    } catch (error) {
      console.error("Error capturing web audio:", error);
    }
  }, [sendAudioBlob]);

  const captureAndSendAudioNative = useCallback(async () => {
    if (!recordingRef.current) {
      return;
    }

    try {
      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        const response = await fetch(uri);
        const blob = await response.blob();
        sendAudioBlob(blob);
      }
      
      if (isRecordingRef.current) {
        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await newRecording.startAsync();
        recordingRef.current = newRecording;
      }
    } catch (error) {
      console.error("Error capturing native audio:", error);
      if (isRecordingRef.current) {
        try {
          const newRecording = new Audio.Recording();
          await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
          await newRecording.startAsync();
          recordingRef.current = newRecording;
        } catch (e) {
          console.error("Failed to restart native recording:", e);
        }
      }
    }
  }, [sendAudioBlob]);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        return true;
      } catch {
        setHasPermission(false);
        return false;
      }
    } else {
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === "granted";
      setHasPermission(granted);
      return granted;
    }
  };

  const startRecordingWeb = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      
      return true;
    } catch (error) {
      console.error("Failed to start web recording:", error);
      throw error;
    }
  };

  const startRecordingNative = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      recordingRef.current = recording;
      return true;
    } catch (error) {
      console.error("Failed to start native recording:", error);
      throw error;
    }
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

      if (Platform.OS === "web") {
        await startRecordingWeb();
      } else {
        await startRecordingNative();
      }

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

      recordingIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current && !isPaused) {
          const level = Math.random() * 0.5 + 0.3;
          setMicLevel(level);
        }
      }, 100);

      audioChunkIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current && !isPaused) {
          if (Platform.OS === "web") {
            captureAndSendAudioWeb();
          } else {
            captureAndSendAudioNative();
          }
        }
      }, 10000);

    } catch (error) {
      console.error("Failed to start recording:", error);
      setRecordingError("Could not start recording. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const stopRecording = async () => {
    isRecordingRef.current = false;
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (audioChunkIntervalRef.current) {
      clearInterval(audioChunkIntervalRef.current);
      audioChunkIntervalRef.current = null;
    }

    try {
      if (Platform.OS === "web") {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            audioChunksRef.current = [];
            sendAudioBlob(blob);
          }
          
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          mediaRecorderRef.current = null;
        }
      } else {
        if (recordingRef.current) {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording) {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            
            if (uri) {
              const response = await fetch(uri);
              const blob = await response.blob();
              sendAudioBlob(blob);
            }
          }
          recordingRef.current = null;
        }
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
    } finally {
      setIsRecording(false);
      setMicLevel(0);
      pulseAnim.value = 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const togglePause = async () => {
    if (Platform.OS === "web") {
      if (isPaused) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
          mediaRecorderRef.current.resume();
        }
      } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.pause();
        }
      }
    } else {
      if (recordingRef.current) {
        if (isPaused) {
          await recordingRef.current.startAsync();
        } else {
          await recordingRef.current.pauseAsync();
        }
      }
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
      
      if (Platform.OS === "web") {
        if (mediaRecorderRef.current) {
          try {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          } catch {}
        }
      } else {
        if (recordingRef.current) {
          try {
            recordingRef.current.stopAndUnloadAsync();
          } catch {}
        }
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
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 120 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              TABLE {tableData?.tableNumber || 1}
            </ThemedText>
            <ConnectionStatus status={connectionStatus} />
          </View>
          <ThemedText type="h2">{tableData?.sessionName || "Session"}</ThemedText>
        </View>

        <View style={styles.statusBar}>
          <SessionTimer startTime={sessionStartTime} isActive={isRecording && !isPaused} />
          <MicLevelIndicator level={micLevel} isActive={isRecording && !isPaused} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.cardHeader}>
            <Feather name="message-circle" size={18} color={theme.accent} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              DISCUSSION TOPIC
            </ThemedText>
          </View>
          <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
            {tableData?.topic || "No topic assigned"}
          </ThemedText>
        </View>

        {tableData?.discussionGuide && tableData.discussionGuide.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.cardHeader}>
              <Feather name="list" size={18} color={theme.accent} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                DISCUSSION GUIDE
              </ThemedText>
            </View>
            {tableData.discussionGuide.map((item, index) => (
              <View key={index} style={styles.guideItem}>
                <View style={[styles.guideNumber, { backgroundColor: theme.accent }]}>
                  <ThemedText type="caption" style={{ color: theme.buttonText }}>
                    {index + 1}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ flex: 1, marginLeft: Spacing.sm }}>
                  {item}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.cardHeader}>
            <Feather name="zap" size={18} color={theme.accent} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              LIVE SUMMARY
            </ThemedText>
          </View>
          {recordingError ? (
            <View style={[styles.errorBanner, { backgroundColor: theme.error + "20" }]}>
              <Feather name="alert-circle" size={16} color={theme.error} />
              <ThemedText type="body" style={{ color: theme.error, marginLeft: Spacing.xs, flex: 1 }}>
                {recordingError}
              </ThemedText>
            </View>
          ) : null}
          {transcriptionStatus ? (
            <ThemedText type="caption" style={{ color: theme.accent, marginTop: Spacing.xs }}>
              {transcriptionStatus}
            </ThemedText>
          ) : null}
          <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.textSecondary }}>
            {summaryData?.content || "Start recording to see live insights..."}
          </ThemedText>
          {summaryData?.themes && summaryData.themes.length > 0 ? (
            <View style={styles.themesContainer}>
              {summaryData.themes.map((t, i) => (
                <View key={i} style={[styles.themeTag, { backgroundColor: theme.accent + "20" }]}>
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {t}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.md }]}>
        {!isRecording ? (
          <Pressable
            style={[styles.recordButton, { backgroundColor: theme.accent }]}
            onPress={startRecording}
          >
            <Animated.View style={[styles.micIconContainer, pulseStyle]}>
              <Feather name="mic" size={28} color={theme.buttonText} />
            </Animated.View>
            <ThemedText type="h4" style={{ color: theme.buttonText }}>
              Start Recording
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.recordingControls}>
            <Pressable
              style={[styles.controlButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={togglePause}
            >
              <Feather
                name={isPaused ? "play" : "pause"}
                size={24}
                color={theme.text}
              />
            </Pressable>
            
            <Pressable
              style={[styles.endButton, { backgroundColor: theme.error }]}
              onPress={handleEndSession}
            >
              <Feather name="square" size={20} color={theme.buttonText} />
              <ThemedText type="body" style={{ color: theme.buttonText, marginLeft: Spacing.xs }}>
                End Session
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
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  guideItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.md,
  },
  guideNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  themesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  themeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  micIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
  },
  endButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
