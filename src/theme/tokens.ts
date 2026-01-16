import { Platform } from "react-native";

export const palette = {
  ink: "#0B0D12",
  paper: "#FFFFFF",
  canvas: "#F6F7F9",
  border: "#E6E8EE",
  mutedText: "#5B616E",
  navy: "#0B2D5C",
  blue: "#1B62F2",
  bluePressed: "#144CC0",
  blueTint: "#E8F0FF",
  teal: "#16B8A6",
  tealTint: "#E6FBF8",
  success: "#12B76A",
  warning: "#F79009",
  error: "#D92D20",
  info: "#2E90FA",
};

export const typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "Inter",
    default: "System",
  }),
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    display: 32,
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
  },
  lineHeights: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    display: 40,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

export const zIndex = {
  base: 0,
  sticky: 10,
  overlay: 20,
  modal: 30,
  toast: 40,
};

export const motion = {
  fast: 150,
  normal: 240,
  slow: 360,
};
