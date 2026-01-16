import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RouteProp, useRoute } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AttendeeRouteProp = RouteProp<RootStackParamList, "AttendeeDashboard">;

interface AggregatedSummary {
  eventName: string;
  overallSummary: string;
  keyInsights: string[];
  keyQuestions: string[];
  themesWithFrequency: { theme: string; prevalence: string }[];
}

interface ActionItem {
  id: number;
  text: string;
  status: string;
}

interface OpenQuestion {
  id: number;
  question: string;
  votes: number;
}

export default function AttendeeDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<AttendeeRouteProp>();
  const { eventId } = route.params;

  const [searchQuery, setSearchQuery] = useState("");
  const [askQuery, setAskQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [askAnswer, setAskAnswer] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [digestContact, setDigestContact] = useState("");
  const [digestTopic, setDigestTopic] = useState("");
  const [digestSubscribed, setDigestSubscribed] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState("");
  const [translatedSummary, setTranslatedSummary] = useState("");

  const { data: summary, isLoading } = useQuery<AggregatedSummary>({
    queryKey: ["/api/events", eventId, "aggregated-summary"],
  });

  const { data: actionItems } = useQuery<ActionItem[]>({
    queryKey: ["/api/events", eventId, "action-items"],
  });

  const { data: recommendations } = useQuery<{ recommendations: string }>({
    queryKey: ["/api/events", eventId, "recommendations"],
  });

  const { data: openQuestions, refetch: refetchOpenQuestions } = useQuery<OpenQuestion[]>({
    queryKey: ["/api/events", eventId, "open-questions"],
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/events/${eventId}/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    onSuccess: (data) => {
      const results = (data.results || []).map((r: { content: string }) => r.content);
      setSearchResults(results);
    },
  });

  const askMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/ask`, { question: askQuery });
      return res.json();
    },
    onSuccess: (data) => {
      setAskAnswer(data.answer || "");
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const res = await apiRequest("POST", `/api/open-questions/${questionId}/upvote`);
      return res.json();
    },
    onSuccess: () => {
      refetchOpenQuestions();
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (value: number) => {
      const res = await apiRequest("POST", "/api/attendee/feedback", {
        eventId,
        rating: value,
      });
      return res.json();
    },
    onSuccess: () => {
      setFeedbackSent(true);
    },
  });

  const digestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/digest-subscribe`, {
        contact: digestContact,
        topic: digestTopic || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setDigestSubscribed(true);
    },
  });

  const translateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/translate-summary`, {
        language: translationLanguage,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTranslatedSummary(data.translation || "");
    },
  });

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg }]}
      >
        <ThemedText type="h2">{summary?.eventName || "Event"}</ThemedText>
        <ThemedText
          type="body"
          style={{
            color: theme.textSecondary,
            marginTop: Spacing.sm,
            fontSize: readingMode ? 18 : undefined,
            lineHeight: readingMode ? 26 : undefined,
          }}
        >
          {summary?.overallSummary || "Insights will appear as sessions conclude."}
        </ThemedText>

        <Pressable
          onPress={() => setReadingMode((prev) => !prev)}
          style={[styles.readingToggle, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="eye" size={14} color={theme.text} />
          <ThemedText type="caption" style={{ color: theme.text }}>
            {readingMode ? "Standard mode" : "Reading mode"}
          </ThemedText>
        </Pressable>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Top Themes</ThemedText>
          <View style={styles.tagRow}>
            {summary?.themesWithFrequency?.map((theme) => (
              <View key={theme.theme} style={[styles.tag, { backgroundColor: theme.link + "20" }]}>
                <ThemedText type="caption" style={{ color: theme.link }}>
                  {theme.theme}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Translate Summary</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Language (e.g., Spanish)"
            placeholderTextColor={theme.textMuted}
            value={translationLanguage}
            onChangeText={setTranslationLanguage}
          />
          <Pressable
            onPress={() => translateMutation.mutate()}
            disabled={!translationLanguage.trim()}
            style={[
              styles.askButton,
              { backgroundColor: theme.link, opacity: !translationLanguage.trim() ? 0.6 : 1 },
            ]}
          >
            <ThemedText type="caption" style={{ color: theme.buttonText }}>
              Translate
            </ThemedText>
          </Pressable>
          {translatedSummary ? (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {translatedSummary}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Action Items</ThemedText>
          {actionItems && actionItems.length > 0 ? (
            actionItems.map((item) => (
              <ThemedText key={item.id} type="body" style={{ color: theme.textSecondary }}>
                • {item.text}
              </ThemedText>
            ))
          ) : (
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              No action items shared yet.
            </ThemedText>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Open Questions</ThemedText>
          {openQuestions && openQuestions.length > 0 ? (
            openQuestions.map((question) => (
              <View key={question.id} style={styles.questionRow}>
                <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1 }}>
                  {question.question}
                </ThemedText>
                <Pressable
                  onPress={() => upvoteMutation.mutate(question.id)}
                  style={[styles.voteButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="arrow-up" size={14} color={theme.text} />
                  <ThemedText type="caption">{question.votes}</ThemedText>
                </Pressable>
              </View>
            ))
          ) : (
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              No open questions yet.
            </ThemedText>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Search the Room</ThemedText>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Search topics like pricing, onboarding..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Pressable
              onPress={() => searchMutation.mutate()}
              style={[styles.searchButton, { backgroundColor: theme.link }]}
            >
              <Feather name="search" size={16} color={theme.buttonText} />
            </Pressable>
          </View>
          {searchResults.length > 0 ? (
            searchResults.slice(0, 5).map((result, index) => (
              <ThemedText key={index} type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                {result}
              </ThemedText>
            ))
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Ask Nutshell</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Ask about trends or decisions..."
            placeholderTextColor={theme.textMuted}
            value={askQuery}
            onChangeText={setAskQuery}
          />
          <Pressable
            onPress={() => askMutation.mutate()}
            style={[styles.askButton, { backgroundColor: theme.link }]}
          >
            <ThemedText type="caption" style={{ color: theme.buttonText }}>
              Ask
            </ThemedText>
          </Pressable>
          {askAnswer ? (
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              {askAnswer}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Follow-up Recommendations</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {recommendations?.recommendations || "Recommendations will appear soon."}
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Subscribe to Digest</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Email or Slack handle"
            placeholderTextColor={theme.textMuted}
            value={digestContact}
            onChangeText={setDigestContact}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Topic (optional)"
            placeholderTextColor={theme.textMuted}
            value={digestTopic}
            onChangeText={setDigestTopic}
          />
          <Pressable
            onPress={() => digestMutation.mutate()}
            disabled={!digestContact.trim() || digestMutation.isPending}
            style={[
              styles.askButton,
              { backgroundColor: theme.link, opacity: !digestContact.trim() ? 0.6 : 1 },
            ]}
          >
            <ThemedText type="caption" style={{ color: theme.buttonText }}>
              {digestSubscribed ? "Subscribed" : "Subscribe"}
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4">Rate This Summary</ThemedText>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  setRating(value);
                  feedbackMutation.mutate(value);
                }}
                style={[
                  styles.ratingChip,
                  { backgroundColor: rating === value ? theme.link : theme.backgroundSecondary },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: rating === value ? theme.buttonText : theme.textSecondary }}
                >
                  {value}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          {feedbackSent ? (
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Thanks for the feedback.
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  askButton: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  ratingRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  ratingChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  readingToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
});
