import React from "react";
import { View, StyleSheet, Pressable, ViewStyle } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

interface ListRowProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListRow({ title, subtitle, right, onPress, style }: ListRowProps) {
  const { tokens } = useTheme();
  const Component = onPress ? Pressable : View;

  return (
    <Component
      style={[
        styles.row,
        {
          borderBottomColor: tokens.colors.borderSubtle,
        },
        style,
      ]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <ThemedText type="body">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="caption" style={{ color: tokens.colors.textMuted }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </Component>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
});
