import { Text, type TextProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "h1" | "h2" | "h3" | "h4" | "body" | "small" | "caption" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  ...rest
}: ThemedTextProps) {
  const { isDark, tokens } = useTheme();

  const getColor = () => {
    if (isDark && darkColor) {
      return darkColor;
    }

    if (!isDark && lightColor) {
      return lightColor;
    }

    if (type === "link") {
      return tokens.colors.primary;
    }

    return tokens.colors.text;
  };

  const getTypeStyle = () => {
    switch (type) {
      case "h1":
        return tokens.typography.sizes.display
          ? {
              fontSize: tokens.typography.sizes.display,
              lineHeight: tokens.typography.lineHeights.display,
              fontWeight: tokens.typography.weights.semibold,
              fontFamily: tokens.typography.fontFamily,
            }
          : {};
      case "h2":
        return {
          fontSize: tokens.typography.sizes.xl,
          lineHeight: tokens.typography.lineHeights.xl,
          fontWeight: tokens.typography.weights.semibold,
          fontFamily: tokens.typography.fontFamily,
        };
      case "h3":
        return {
          fontSize: tokens.typography.sizes.lg,
          lineHeight: tokens.typography.lineHeights.lg,
          fontWeight: tokens.typography.weights.semibold,
          fontFamily: tokens.typography.fontFamily,
        };
      case "h4":
        return {
          fontSize: tokens.typography.sizes.md,
          lineHeight: tokens.typography.lineHeights.md,
          fontWeight: tokens.typography.weights.semibold,
          fontFamily: tokens.typography.fontFamily,
        };
      case "body":
        return {
          fontSize: tokens.typography.sizes.md,
          lineHeight: tokens.typography.lineHeights.md,
          fontWeight: tokens.typography.weights.regular,
          fontFamily: tokens.typography.fontFamily,
        };
      case "small":
        return {
          fontSize: tokens.typography.sizes.sm,
          lineHeight: tokens.typography.lineHeights.sm,
          fontWeight: tokens.typography.weights.regular,
          fontFamily: tokens.typography.fontFamily,
        };
      case "caption":
        return {
          fontSize: tokens.typography.sizes.xs,
          lineHeight: tokens.typography.lineHeights.xs,
          fontWeight: tokens.typography.weights.regular,
          fontFamily: tokens.typography.fontFamily,
        };
      case "link":
        return {
          fontSize: tokens.typography.sizes.md,
          lineHeight: tokens.typography.lineHeights.md,
          fontWeight: tokens.typography.weights.medium,
          fontFamily: tokens.typography.fontFamily,
        };
      default:
        return {
          fontSize: tokens.typography.sizes.md,
          lineHeight: tokens.typography.lineHeights.md,
          fontWeight: tokens.typography.weights.regular,
          fontFamily: tokens.typography.fontFamily,
        };
    }
  };

  return (
    <Text style={[{ color: getColor() }, getTypeStyle(), style]} {...rest} />
  );
}
