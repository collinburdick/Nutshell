import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

type BadgeVariant = "info" | "success" | "warning" | "error" | "neutral";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = "neutral", style }: BadgeProps) {
  const { tokens } = useTheme();

  const getColor = () => {
    switch (variant) {
      case "success":
        return tokens.colors.success;
      case "warning":
        return tokens.colors.warning;
      case "error":
        return tokens.colors.error;
      case "info":
        return tokens.colors.info;
      default:
        return tokens.colors.textMuted;
    }
  };

  const color = getColor();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}20`,
          borderColor: color,
          borderRadius: tokens.radii.full,
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
