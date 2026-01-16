import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ConnectionStatusProps {
  status: "connected" | "degraded" | "offline";
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { theme } = useTheme();
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (status === "degraded" || status === "offline") {
      pulse.value = withRepeat(
        withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [status]);

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return theme.connectionGood;
      case "degraded":
        return theme.connectionDegraded;
      case "offline":
        return theme.connectionOffline;
    }
  };

  const getStatusIcon = (): keyof typeof Feather.glyphMap => {
    switch (status) {
      case "connected":
        return "wifi";
      case "degraded":
        return "wifi";
      case "offline":
        return "wifi-off";
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "degraded":
        return "Weak Signal";
      case "offline":
        return "Offline";
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const color = getStatusColor();

  return (
    <View style={[styles.container, { backgroundColor: `${color}15` }]}>
      <Animated.View style={animatedStyle}>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </Animated.View>
      <Feather name={getStatusIcon()} size={14} color={color} />
      <ThemedText type="caption" style={{ color, fontWeight: "500" }}>
        {getStatusLabel()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
