import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Modal,
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
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { MicLevelIndicator } from "@/components/MicLevelIndicator";
import { SessionTimer } from "@/components/SessionTimer";
import { NudgeBanner } from "@/components/NudgeBanner";
import { PulseRing } from "@/components/PulseRing";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Session">;
type SessionRouteProp = RouteProp<RootStackParamList, "Session">;

interface TableData {
  id: number;
  tableNumber: number;
  topic: string;
  sessionName: string;
  discussionGuide: string[];
  agendaPhases?: string[];
  status: string;
}

interface SummaryData {
  content: string;
  themes: string[];
  actionItems: string[];
  openQuestions: string[];
  sentimentScore: number | null;
  sentimentConfidence: number | null;
  missingAngles: string[];
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
  const [bufferedChunks, setBufferedChunks] = useState(0);
  const [showParkingLotModal, setShowParkingLotModal] = useState(false);
  const [showNuggetModal, setShowNuggetModal] = useState(false);
  const [parkingLotText, setParkingLotText] = useState("");
  const [nuggetText, setNuggetText] = useState("");
  const [handsFree, setHandsFree] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [handoffCode, setHandoffCode] = useState<string | null>(null);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const analyserIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pendingAudioQueueRef = useRef<string[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const pulseAnim = useSharedValue(1);
  const pingFailuresRef = useRef(0);
  const isFlushingRef = useRef(false);

  const MAX_BUFFER_CHUNKS = 12;
  const PING_INTERVAL_MS = 5000;
  const PING_TIMEOUT_MS = 3000;

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

  const parkingLotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tables/${tableId}/parking-lot`, { text: parkingLotText });
      return res.json();
    },
    onSuccess: () => {
      setParkingLotText("");
      setShowParkingLotModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const nuggetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tables/${tableId}/golden-nuggets`, { text: nuggetText });
      return res.json();
    },
    onSuccess: () => {
      setNuggetText("");
      setShowNuggetModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const handoffMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tables/${tableId}/handoff`, { deviceName: "handoff" });
      return res.json();
    },
    onSuccess: (data) => {
      setHandoffCode(data.joinCode);
      setShowHandoffModal(true);
    },
  });

  const enqueueAudio = (audioBase64: string) => {
    pendingAudioQueueRef.current.push(audioBase64);
    while (pendingAudioQueueRef.current.length > MAX_BUFFER_CHUNKS) {
      pendingAudioQueueRef.current.shift();
    }
    setBufferedChunks(pendingAudioQueueRef.current.length);
  };

  const flushQueuedAudio = useCallback(async () => {
    if (isFlushingRef.current) return;
    if (connectionStatus === "offline") return;
    if (pendingAudioQueueRef.current.length === 0) return;

    isFlushingRef.current = true;
    try {
      while (pendingAudioQueueRef.current.length > 0 && connectionStatus !== "offline") {
        const nextAudio = pendingAudioQueueRef.current[0];
        try {
          await sendAudioMutation.mutateAsync(nextAudio);
          pendingAudioQueueRef.current.shift();
          setBufferedChunks(pendingAudioQueueRef.current.length);
        } catch {
          break;
        }
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [connectionStatus, sendAudioMutation]);

  const sendAudioBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 100) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64 && base64.length > 100) {
        if (connectionStatus === "offline") {
          enqueueAudio(base64);
          setTranscriptionStatus("Buffering audio...");
          return;
        }
        sendAudioMutation.mutate(base64, {
          onError: () => {
            enqueueAudio(base64);
          },
        });
      }
    };
    reader.readAsDataURL(blob);
  }, [connectionStatus, sendAudioMutation]);

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
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      analyserDataRef.current = new Uint8Array(analyser.fftSize);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      
      if (analyserIntervalRef.current) {
        clearInterval(analyserIntervalRef.current);
      }
      analyserIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || !analyserDataRef.current) return;
        analyserRef.current.getByteTimeDomainData(analyserDataRef.current);
        let sumSquares = 0;
        for (let i = 0; i < analyserDataRef.current.length; i++) {
          const centered = (analyserDataRef.current[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / analyserDataRef.current.length);
        setMicLevel(Math.min(1, rms * 2.5));
      }, 120);

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
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          isMeteringEnabled: true,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
          isMeteringEnabled: true,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      };
      await recording.prepareToRecordAsync(recordingOptions);
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === "number") {
          const normalized = Math.min(1, Math.max(0, (status.metering + 60) / 60));
          setMicLevel(normalized);
        }
      });
      recording.setProgressUpdateInterval(200);
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
          if (Platform.OS !== "web" && micLevel <= 0.05) {
            setMicLevel(0.1);
          }
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
        if (analyserIntervalRef.current) {
          clearInterval(analyserIntervalRef.current);
          analyserIntervalRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;
        analyserDataRef.current = null;
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

  const micTip = !isRecording
    ? null
    : micLevel < 0.15
      ? "Move the mic closer to the group."
      : micLevel > 0.85
        ? "Audio is very loud. Move the mic away."
        : "Mic placement looks good.";

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const pingServer = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
        const start = Date.now();
        const res = await fetch(new URL("/api/ping", getApiUrl()).toString(), {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          throw new Error("Ping failed");
        }
        const latency = Date.now() - start;
        pingFailuresRef.current = 0;
        if (latency > 2000) {
          setConnectionStatus("degraded");
        } else {
          setConnectionStatus("connected");
        }
      } catch {
        pingFailuresRef.current += 1;
        if (pingFailuresRef.current >= 3) {
          setConnectionStatus("offline");
        } else {
          setConnectionStatus("degraded");
        }
      }
    };

    interval = setInterval(pingServer, PING_INTERVAL_MS);
    pingServer();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    flushQueuedAudio();
  }, [connectionStatus, flushQueuedAudio]);

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
      if (analyserIntervalRef.current) {
        clearInterval(analyserIntervalRef.current);
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
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setHandsFree((prev) => !prev)}
                style={[styles.handsFreeToggle, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="maximize" size={14} color={theme.text} />
                <ThemedText type="caption" style={{ color: theme.text }}>
                  {handsFree ? "Standard" : "Hands-free"}
                </ThemedText>
              </Pressable>
              <ConnectionStatus status={connectionStatus} />
            </View>
          </View>
          <ThemedText type="h2">{tableData?.sessionName || "Session"}</ThemedText>
        </View>

        <View style={styles.statusBar}>
          <SessionTimer startTime={sessionStartTime} isActive={isRecording && !isPaused} />
          <View style={styles.pulseRingWrap}>
            {isRecording && !isPaused ? <PulseRing size={44} strokeWidth={3} /> : null}
            <View style={styles.pulseRingInner}>
              <MicLevelIndicator level={micLevel} isActive={isRecording && !isPaused} />
            </View>
          </View>
        </View>
        {micTip ? (
          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.md }}>
            {micTip}
          </ThemedText>
        ) : null}

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

        {tableData?.agendaPhases && tableData.agendaPhases.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.cardHeader}>
              <Feather name="clock" size={18} color={theme.accent} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                AGENDA PHASES
              </ThemedText>
            </View>
            <View style={styles.phasesRow}>
              {tableData.agendaPhases.map((phase, index) => (
                <View key={index} style={[styles.phaseChip, { backgroundColor: theme.backgroundRoot }]}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {phase}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.cardHeader}>
            <Feather name="zap" size={18} color={theme.accent} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              LIVE SUMMARY
            </ThemedText>
            {summaryData?.updatedAt ? (
              <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: "auto" }}>
                Updated {new Date(summaryData.updatedAt).toLocaleTimeString()}
              </ThemedText>
            ) : null}
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
          {bufferedChunks > 0 ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Buffering {bufferedChunks * 10}s of audio for backfill
            </ThemedText>
          ) : null}
          <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.textSecondary }}>
            {summaryData?.content || "Start recording to see live insights..."}
          </ThemedText>
          {summaryData?.missingAngles && summaryData.missingAngles.length > 0 ? (
            <View style={styles.missingAngles}>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                WHAT'S MISSING
              </ThemedText>
              {summaryData.missingAngles.map((angle, index) => (
                <ThemedText key={index} type="body" style={{ color: theme.textSecondary }}>
                  • {angle}
                </ThemedText>
              ))}
            </View>
          ) : null}
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
          {summaryData?.sentimentScore !== null && summaryData?.sentimentScore !== undefined ? (
            <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.sm }}>
              Sentiment: {summaryData.sentimentScore} (confidence {summaryData.sentimentConfidence ?? "—"})
            </ThemedText>
          ) : null}
          <View style={styles.quickActions}>
            <Pressable
              onPress={() => setShowParkingLotModal(true)}
              style={[styles.quickActionButton, { backgroundColor: theme.backgroundRoot }]}
            >
              <Feather name="bookmark" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Parking Lot
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowNuggetModal(true)}
              style={[styles.quickActionButton, { backgroundColor: theme.backgroundRoot }]}
            >
              <Feather name="star" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Golden Nugget
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handoffMutation.mutate()}
              style={[styles.quickActionButton, { backgroundColor: theme.backgroundRoot }]}
            >
              <Feather name="repeat" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Handoff
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.cardHeader}>
            <Feather name="shield" size={18} color={theme.accent} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              PRIVACY MODE
            </ThemedText>
          </View>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            De-identified capture is active. No names or personal info are stored.
          </ThemedText>
        </View>
      </ScrollView>

      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.md }]}>
        {!isRecording ? (
          <Pressable
            style={[
              styles.recordButton,
              {
                backgroundColor: theme.accent,
                paddingVertical: handsFree ? Spacing["2xl"] : Spacing.lg,
              },
            ]}
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
              style={[
                styles.endButton,
                {
                  backgroundColor: theme.error,
                  paddingVertical: handsFree ? Spacing["2xl"] : Spacing.lg,
                },
              ]}
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

      <Modal
        visible={showParkingLotModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParkingLotModal(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowParkingLotModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Parking Lot</ThemedText>
              <Pressable onPress={() => setShowParkingLotModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.modalInput,
                { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 },
              ]}
              placeholder="Capture an out-of-scope item..."
              placeholderTextColor={theme.textMuted}
              value={parkingLotText}
              onChangeText={setParkingLotText}
              multiline
            />
            <Pressable
              onPress={() => parkingLotMutation.mutate()}
              disabled={!parkingLotText.trim() || parkingLotMutation.isPending}
              style={({ pressed }) => [
                styles.modalButton,
                { backgroundColor: theme.link, opacity: !parkingLotText.trim() || pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText type="body" style={{ color: theme.buttonText }}>
                Save
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showNuggetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNuggetModal(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowNuggetModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Golden Nugget</ThemedText>
              <Pressable onPress={() => setShowNuggetModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.modalInput,
                { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 },
              ]}
              placeholder="Mark a standout insight..."
              placeholderTextColor={theme.textMuted}
              value={nuggetText}
              onChangeText={setNuggetText}
              multiline
            />
            <Pressable
              onPress={() => nuggetMutation.mutate()}
              disabled={!nuggetText.trim() || nuggetMutation.isPending}
              style={({ pressed }) => [
                styles.modalButton,
                { backgroundColor: theme.link, opacity: !nuggetText.trim() || pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText type="body" style={{ color: theme.buttonText }}>
                Save
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showHandoffModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHandoffModal(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowHandoffModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Handoff Code</ThemedText>
              <Pressable onPress={() => setShowHandoffModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Share this code with the new device to continue capturing.
            </ThemedText>
            <View style={[styles.handoffCode, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText type="h3">{handoffCode || "—"}</ThemedText>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  handsFreeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  pulseRingWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingInner: {
    position: "absolute",
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
  phasesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  phaseChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
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
  missingAngles: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  quickActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalInput: {
    minHeight: 100,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  modalButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  handoffCode: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
