import { Platform } from "react-native";
import { lightTheme, darkTheme } from "@/theme";
import { spacing, radii, typography, shadows } from "@/theme/tokens";

export const Colors = {
  light: {
    text: lightTheme.colors.text,
    textSecondary: lightTheme.colors.textMuted,
    textMuted: lightTheme.colors.textMuted,
    buttonText: lightTheme.colors.primaryText,
    tabIconDefault: lightTheme.colors.textMuted,
    tabIconSelected: lightTheme.colors.primary,
    link: lightTheme.colors.primary,
    backgroundRoot: lightTheme.colors.background,
    backgroundDefault: lightTheme.colors.surface,
    backgroundSecondary: lightTheme.colors.surfaceAlt,
    backgroundTertiary: lightTheme.colors.surfaceAlt,
    success: lightTheme.colors.success,
    warning: lightTheme.colors.warning,
    error: lightTheme.colors.error,
    info: lightTheme.colors.info,
    border: lightTheme.colors.borderSubtle,
    cardBorder: lightTheme.colors.borderSubtle,
    accent: lightTheme.colors.accent,
    micActive: lightTheme.colors.success,
    micInactive: lightTheme.colors.textMuted,
    connectionGood: lightTheme.colors.success,
    connectionDegraded: lightTheme.colors.warning,
    connectionOffline: lightTheme.colors.error,
  },
  dark: {
    text: darkTheme.colors.text,
    textSecondary: darkTheme.colors.textMuted,
    textMuted: darkTheme.colors.textMuted,
    buttonText: darkTheme.colors.primaryText,
    tabIconDefault: darkTheme.colors.textMuted,
    tabIconSelected: darkTheme.colors.primary,
    link: darkTheme.colors.primary,
    backgroundRoot: darkTheme.colors.background,
    backgroundDefault: darkTheme.colors.surface,
    backgroundSecondary: darkTheme.colors.surfaceAlt,
    backgroundTertiary: darkTheme.colors.surfaceAlt,
    success: darkTheme.colors.success,
    warning: darkTheme.colors.warning,
    error: darkTheme.colors.error,
    info: darkTheme.colors.info,
    border: darkTheme.colors.borderSubtle,
    cardBorder: darkTheme.colors.borderSubtle,
    accent: darkTheme.colors.accent,
    micActive: darkTheme.colors.success,
    micInactive: darkTheme.colors.textMuted,
    connectionGood: darkTheme.colors.success,
    connectionDegraded: darkTheme.colors.warning,
    connectionOffline: darkTheme.colors.error,
  },
};

export const Spacing = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  "2xl": spacing.xxl,
  "3xl": spacing.xxl + spacing.lg,
  "4xl": spacing.xxl + spacing.xl,
  "5xl": spacing.xxl + spacing.xxl,
  "6xl": spacing.xxl + spacing.xxl + spacing.lg,
  inputHeight: 48,
  buttonHeight: 48,
  buttonHeightLarge: 56,
};

export const BorderRadius = {
  xs: radii.sm,
  sm: radii.md,
  md: radii.lg,
  lg: radii.xl,
  xl: radii.xl,
  "2xl": radii.xl + 4,
  "3xl": radii.xl + 8,
  full: radii.full,
};

export const Typography = {
  h1: {
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.semibold as const,
    fontFamily: typography.fontFamily,
  },
  h2: {
    fontSize: typography.sizes.xl,
    lineHeight: typography.lineHeights.xl,
    fontWeight: typography.weights.semibold as const,
    fontFamily: typography.fontFamily,
  },
  h3: {
    fontSize: typography.sizes.lg,
    lineHeight: typography.lineHeights.lg,
    fontWeight: typography.weights.semibold as const,
    fontFamily: typography.fontFamily,
  },
  h4: {
    fontSize: typography.sizes.md,
    lineHeight: typography.lineHeights.md,
    fontWeight: typography.weights.semibold as const,
    fontFamily: typography.fontFamily,
  },
  body: {
    fontSize: typography.sizes.md,
    lineHeight: typography.lineHeights.md,
    fontWeight: typography.weights.regular as const,
    fontFamily: typography.fontFamily,
  },
  small: {
    fontSize: typography.sizes.sm,
    lineHeight: typography.lineHeights.sm,
    fontWeight: typography.weights.regular as const,
    fontFamily: typography.fontFamily,
  },
  caption: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
    fontWeight: typography.weights.regular as const,
    fontFamily: typography.fontFamily,
  },
  link: {
    fontSize: typography.sizes.md,
    lineHeight: typography.lineHeights.md,
    fontWeight: typography.weights.medium as const,
    fontFamily: typography.fontFamily,
  },
};

export const Shadows = {
  sm: shadows.sm,
  md: shadows.md,
  lg: shadows.md,
};

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    mono: "Menlo",
  },
  android: {
    sans: "Inter",
    mono: "monospace",
  },
  default: {
    sans: "System",
    mono: "monospace",
  },
});
