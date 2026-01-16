import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MicLevelIndicatorProps {
  level: number;
  isActive: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
};

export function MicLevelIndicator({ level, isActive }: MicLevelIndicatorProps) {
  const { theme } = useTheme();
  const barCount = 5;

  return (
    <View style={styles.container}>
      <ThemedText type="caption" style={{ color: theme.textMuted, marginRight: Spacing.sm }}>
        MIC
      </ThemedText>
      <View style={styles.barsContainer}>
        {Array.from({ length: barCount }).map((_, index) => {
          const threshold = (index + 1) / barCount;
          const isLit = isActive && level >= threshold;

          return (
            <AnimatedBar
              key={index}
              isLit={isLit}
              activeColor={theme.micActive}
              inactiveColor={theme.micInactive}
              height={12 + index * 3}
            />
          );
        })}
      </View>
    </View>
  );
}

interface AnimatedBarProps {
  isLit: boolean;
  activeColor: string;
  inactiveColor: string;
  height: number;
}

function AnimatedBar({ isLit, activeColor, inactiveColor, height }: AnimatedBarProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(isLit ? activeColor : inactiveColor, springConfig),
    transform: [{ scaleY: withSpring(isLit ? 1 : 0.6, springConfig) }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { height },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 24,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
