import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { RouteProp, useRoute } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TickerRouteProp = RouteProp<RootStackParamList, "ThemeTicker">;

interface ThemeMapResponse {
  eventName: string;
  themes: { theme: string; count: number }[];
}

export default function ThemeTickerScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<TickerRouteProp>();
  const { eventId } = route.params;

  const { data } = useQuery<ThemeMapResponse>({
    queryKey: ["/api/events", eventId, "theme-map"],
    refetchInterval: 10000,
  });

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h2">{data?.eventName || "Theme Ticker"}</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Live themes across the room
        </ThemedText>
      </View>
      <View style={styles.ticker}>
        {data?.themes?.slice(0, 8).map((themeItem, index) => (
          <View key={themeItem.theme} style={styles.tickerRow}>
            <ThemedText type="h3">{index + 1}.</ThemedText>
            <ThemedText type="h1" style={{ marginLeft: Spacing.md }}>
              {themeItem.theme}
            </ThemedText>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  ticker: {
    marginTop: Spacing["2xl"],
    gap: Spacing.lg,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
});
