import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";

interface Props {
  name: string;
  color: string;
  readOnly?: boolean;
  delay?: number;
  /** Frame at which the chip lights up as "being called right now". */
  activeFrom?: number;
  activeFor?: number;
}

/** One registered WebMCP tool. The grid of these is the contract, on screen. */
export const ToolChip: React.FC<Props> = ({
  name,
  color,
  readOnly = false,
  delay = 0,
  activeFrom,
  activeFor = 26,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: Math.max(0, frame - delay), fps, config: SPRING.snappy });

  const active =
    activeFrom !== undefined && frame >= activeFrom && frame < activeFrom + activeFor;
  const glow = active
    ? interpolate(frame - (activeFrom ?? 0), [0, 5, activeFor], [0, 1, 0], {
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 13px",
        borderRadius: 9,
        background: active ? `${color}18` : COLORS.bgCard,
        border: `1px solid ${active ? color : COLORS.border}`,
        boxShadow: active
          ? `0 0 0 ${3 + glow * 5}px ${color}1A, ${COLORS.shadow}`
          : COLORS.shadow,
        opacity: e,
        transform: `scale(${interpolate(e, [0, 1], [0.85, 1]) * (1 + glow * 0.04)})`,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 2,
          background: color,
          opacity: readOnly ? 0.45 : 1,
        }}
      />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 14.5,
          fontWeight: 500,
          color: active ? COLORS.textPrimary : COLORS.textSecondary,
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </div>
  );
};
