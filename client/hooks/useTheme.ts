import { useTheme as useThemeContext } from "@/theme/ThemeProvider";

type LegacyTheme = {
  text: string;
  textSecondary: string;
  textMuted: string;
  buttonText: string;
  tabIconDefault: string;
  tabIconSelected: string;
  link: string;
  backgroundRoot: string;
  backgroundDefault: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  cardBorder: string;
  accent: string;
  micActive: string;
  micInactive: string;
  connectionGood: string;
  connectionDegraded: string;
  connectionOffline: string;
  overlay: string;
  overlayStrong: string;
};

export function useTheme(): { theme: LegacyTheme; tokens: ReturnType<typeof useThemeContext>["theme"]; isDark: boolean } {
  const { theme: tokens, isDark } = useThemeContext();
  const theme: LegacyTheme = {
    text: tokens.colors.text,
    textSecondary: tokens.colors.textMuted,
    textMuted: tokens.colors.textMuted,
    buttonText: tokens.colors.primaryText,
    tabIconDefault: tokens.colors.textMuted,
    tabIconSelected: tokens.colors.primary,
    link: tokens.colors.primary,
    backgroundRoot: tokens.colors.background,
    backgroundDefault: tokens.colors.surface,
    backgroundSecondary: tokens.colors.surfaceAlt,
    backgroundTertiary: tokens.colors.surfaceAlt,
    success: tokens.colors.success,
    warning: tokens.colors.warning,
    error: tokens.colors.error,
    info: tokens.colors.info,
    border: tokens.colors.borderSubtle,
    cardBorder: tokens.colors.borderSubtle,
    accent: tokens.colors.accent,
    micActive: tokens.colors.success,
    micInactive: tokens.colors.textMuted,
    connectionGood: tokens.colors.success,
    connectionDegraded: tokens.colors.warning,
    connectionOffline: tokens.colors.error,
    overlay: tokens.colors.overlay,
    overlayStrong: tokens.colors.overlayStrong,
  };

  return {
    theme,
    tokens,
    isDark,
  };
}
