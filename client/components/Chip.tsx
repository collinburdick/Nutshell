import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, selected = false, onPress, style }: ChipProps) {
  const { tokens } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? tokens.colors.blueTint : tokens.colors.surfaceAlt,
          borderColor: selected ? tokens.colors.primary : tokens.colors.borderSubtle,
          borderRadius: tokens.radii.full,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.xs,
        },
        style,
      ]}
    >
      <ThemedText
        type="caption"
        style={{ color: selected ? tokens.colors.primary : tokens.colors.textMuted }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
