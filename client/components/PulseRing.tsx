import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

interface PulseRingProps {
  size?: number;
  strokeWidth?: number;
}

export function PulseRing({ size = 56, strokeWidth = 4 }: PulseRingProps) {
  const { tokens } = useTheme();
  const radius = (size - strokeWidth) / 2;

  return (
    <View>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="pulseRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={tokens.palette.blue} />
            <Stop offset="100%" stopColor={tokens.palette.teal} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#pulseRing)"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.7}
        />
      </Svg>
    </View>
  );
}
