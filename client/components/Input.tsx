import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
}

export function Input({ label, helperText, style, ...props }: InputProps) {
  const { tokens } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="caption" style={{ color: tokens.colors.textMuted }}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: tokens.colors.surfaceAlt,
            borderColor: isFocused ? tokens.colors.focus : tokens.colors.borderSubtle,
            color: tokens.colors.text,
            borderRadius: tokens.radii.md,
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: tokens.spacing.sm,
            minHeight: 48,
          },
          style,
        ]}
        placeholderTextColor={tokens.colors.textMuted}
        onFocus={(event) => {
          setIsFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          props.onBlur?.(event);
        }}
      />
      {helperText ? (
        <ThemedText type="caption" style={{ color: tokens.colors.textMuted }}>
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
  },
});
