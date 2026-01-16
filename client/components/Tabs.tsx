import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ items, activeKey, onChange }: TabsProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.colors.surfaceAlt,
          borderRadius: tokens.radii.full,
          borderColor: tokens.colors.borderSubtle,
        },
      ]}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[
              styles.tab,
              {
                backgroundColor: isActive ? tokens.colors.primary : "transparent",
                borderRadius: tokens.radii.full,
              },
            ]}
          >
            <ThemedText
              type="caption"
              style={{ color: isActive ? tokens.colors.primaryText : tokens.colors.textMuted }}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
});
