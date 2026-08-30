import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";

interface Props {
  label: string;
  title: string;
  accent?: string;
  delay?: number;
  align?: "center" | "left";
  size?: number;
}

/** The eyebrow pill plus headline every scene opens on. */
export const SectionHeader: React.FC<Props> = ({
  label,
  title,
  accent = COLORS.accent,
  delay = 0,
  align = "center",
  size = 46,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const pill = spring({ frame: f, fps, config: SPRING.smooth });
  const head = spring({ frame: Math.max(0, f - 7), fps, config: SPRING.smooth });

  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "6px 15px",
          borderRadius: 20,
          background: `${accent}14`,
          marginBottom: 12,
          opacity: pill,
          transform: `translateY(${interpolate(pill, [0, 1], [14, 0])}px)`,
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
        <span
          style={{
            fontFamily: FONTS.text,
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: size,
          fontWeight: 700,
          color: COLORS.textPrimary,
          letterSpacing: "-0.035em",
          lineHeight: 1.12,
          opacity: head,
          transform: `translateY(${interpolate(head, [0, 1], [24, 0])}px)`,
        }}
      >
        {title}
      </div>
    </div>
  );
};
