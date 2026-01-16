import { Platform } from "react-native";

const primaryAmber = "#D97706";
const primaryAmberDark = "#F59E0B";

export const Colors = {
  light: {
    text: "#1C1917",
    textSecondary: "#57534E",
    textMuted: "#A8A29E",
    buttonText: "#FFFFFF",
    tabIconDefault: "#78716C",
    tabIconSelected: primaryAmber,
    link: primaryAmber,
    backgroundRoot: "#FFFBEB",
    backgroundDefault: "#FEF3C7",
    backgroundSecondary: "#FDE68A",
    backgroundTertiary: "#FCD34D",
    success: "#059669",
    warning: "#D97706",
    error: "#DC2626",
    info: "#0284C7",
    border: "#E7E5E4",
    cardBorder: "rgba(217, 119, 6, 0.2)",
    accent: "#F97316",
    micActive: "#059669",
    micInactive: "#78716C",
    connectionGood: "#059669",
    connectionDegraded: "#D97706",
    connectionOffline: "#DC2626",
  },
  dark: {
    text: "#FAFAF9",
    textSecondary: "#D6D3D1",
    textMuted: "#78716C",
    buttonText: "#FFFFFF",
    tabIconDefault: "#A8A29E",
    tabIconSelected: primaryAmberDark,
    link: primaryAmberDark,
    backgroundRoot: "#1C1917",
    backgroundDefault: "#292524",
    backgroundSecondary: "#44403C",
    backgroundTertiary: "#57534E",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#38BDF8",
    border: "#44403C",
    cardBorder: "rgba(245, 158, 11, 0.3)",
    accent: "#FB923C",
    micActive: "#10B981",
    micInactive: "#A8A29E",
    connectionGood: "#10B981",
    connectionDegraded: "#F59E0B",
    connectionOffline: "#EF4444",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  inputHeight: 52,
  buttonHeight: 56,
  buttonHeightLarge: 72,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
};
