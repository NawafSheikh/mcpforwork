import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, countTo } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";

interface Props {
  value: number;
  label: string;
  sub?: string;
  gradient?: string;
  delay?: number;
  size?: number;
}

/** A number that counts up, over a label. Used for the proof beats. */
export const Counter: React.FC<Props> = ({
  value,
  label,
  sub,
  gradient = COLORS.gradientBrand,
  delay = 0,
  size = 104,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const e = spring({ frame: f, fps, config: SPRING.smooth });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [28, 0])}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: size,
          fontWeight: 700,
          letterSpacing: "-0.045em",
          lineHeight: 1,
          background: gradient,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {countTo(value, f, fps, 1.7)}
      </div>
      <div
        style={{
          fontFamily: FONTS.text,
          fontSize: 17,
          fontWeight: 600,
          color: COLORS.textPrimary,
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </div>
      {sub ? (
        <div style={{ fontFamily: FONTS.text, fontSize: 14, color: COLORS.textTertiary }}>{sub}</div>
      ) : null}
    </div>
  );
};
