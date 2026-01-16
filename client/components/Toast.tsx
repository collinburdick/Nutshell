import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
}

export function Toast({ message, variant = "info" }: ToastProps) {
  const { tokens } = useTheme();

  const getColor = () => {
    switch (variant) {
      case "success":
        return tokens.colors.success;
      case "warning":
        return tokens.colors.warning;
      case "error":
        return tokens.colors.error;
      default:
        return tokens.colors.info;
    }
  };

  const color = getColor();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.colors.surface,
          borderColor: color,
          borderRadius: tokens.radii.lg,
          ...tokens.shadows.sm,
        },
      ]}
    >
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <ThemedText type="body" style={{ color: tokens.colors.text }}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
