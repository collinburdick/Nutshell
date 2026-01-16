import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface NudgeData {
  id: number;
  type: string;
  message: string;
  priority: string;
}

interface NudgeBannerProps {
  nudge: NudgeData;
  onDismiss: () => void;
}

export function NudgeBanner({ nudge, onDismiss }: NudgeBannerProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const shake = useSharedValue(0);

  React.useEffect(() => {
    if (nudge.priority === "urgent") {
      shake.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 50 }),
          withTiming(3, { duration: 100 }),
          withTiming(0, { duration: 50 })
        ),
        3,
        true
      );
    }
  }, [nudge.priority]);

  const getIcon = (): keyof typeof Feather.glyphMap => {
    switch (nudge.type) {
      case "time_warning":
        return "clock";
      case "prompt_shift":
        return "arrow-right";
      case "urgent":
        return "alert-triangle";
      default:
        return "bell";
    }
  };

  const getBackgroundColor = () => {
    switch (nudge.priority) {
      case "urgent":
        return theme.error;
      case "high":
        return theme.warning;
      default:
        return theme.info;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor(), paddingTop: insets.top + Spacing.sm },
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather name={getIcon()} size={20} color="#FFFFFF" />
        </View>
        <ThemedText type="body" style={styles.message} numberOfLines={2}>
          {nudge.message}
        </ThemedText>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismissButton, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={12}
        >
          <Feather name="x" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});
