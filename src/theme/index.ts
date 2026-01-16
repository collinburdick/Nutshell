import { lightColors, darkColors } from "./colors";
import { spacing, radii, shadows, zIndex, motion, typography, palette } from "./tokens";

export type Theme = {
  colors: typeof lightColors;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  zIndex: typeof zIndex;
  motion: typeof motion;
  typography: typeof typography;
  palette: typeof palette;
};

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  radii,
  shadows,
  zIndex,
  motion,
  typography,
  palette,
};

export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  radii,
  shadows,
  zIndex,
  motion,
  typography,
  palette,
};
