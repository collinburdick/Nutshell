import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

interface TopBarProps {
  title: string;
  onBack?: () => void;
  rightAction?: { icon: keyof typeof Feather.glyphMap; onPress: () => void };
}

export function TopBar({ title, onBack, rightAction }: TopBarProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: tokens.colors.borderSubtle }]}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.iconButton}>
            <Feather name="arrow-left" size={20} color={tokens.colors.text} />
          </Pressable>
        ) : null}
        <ThemedText type="h3">{title}</ThemedText>
      </View>
      {rightAction ? (
        <Pressable onPress={rightAction.onPress} style={styles.iconButton}>
          <Feather name={rightAction.icon} size={20} color={tokens.colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
