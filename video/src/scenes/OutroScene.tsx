import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, perlinFloat } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { cueIn } from "../lib/timing";

const LINKS = [
  { label: "mcpforwork.com", note: "no login, nothing pre-filled" },
  { label: "github.com/NawafSheikh/mcpforwork", note: "MIT, public" },
];

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cEnd = cueIn("outro", 26);

  const mark = spring({ frame: Math.max(0, frame - 4), fps, config: SPRING.hero });
  const line = spring({ frame: Math.max(0, frame - cEnd - 4), fps, config: SPRING.smooth });
  const links = spring({ frame: Math.max(0, frame - cEnd - 30), fps, config: SPRING.smooth });

  const driftX = perlinFloat(frame, 3, 3, 0.006);
  const driftY = perlinFloat(frame, 9, 2.5, 0.008);

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={420} y={280} size={600} color1="#2F6FED2E" color2="#6C4BE00F" index={17} opacity={0.5} />
      <GradientOrb x={1520} y={800} size={560} color1="#5AA9FF2E" color2="#2F6FED0A" index={18} opacity={0.42} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${driftX}px, ${driftY}px)`,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 23,
            background: COLORS.gradientBrand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 30,
            transform: `scale(${mark})`,
            opacity: mark,
            boxShadow: "0 24px 60px rgba(47, 111, 237, 0.32)",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          >
            MW
          </span>
        </div>

        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 74,
            fontWeight: 700,
            color: COLORS.textPrimary,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            marginBottom: 20,
            opacity: mark,
            transform: `translateY(${interpolate(mark, [0, 1], [22, 0])}px)`,
          }}
        >
          MCP for Work
        </div>

        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 30,
            fontWeight: 500,
            color: COLORS.textSecondary,
            letterSpacing: "-0.02em",
            opacity: line,
            transform: `translateY(${interpolate(line, [0, 1], [16, 0])}px)`,
          }}
        >
          Bring your own agent, and keep the veto.
        </div>

        <div
          style={{
            marginTop: 52,
            display: "flex",
            gap: 20,
            opacity: links,
            transform: `translateY(${interpolate(links, [0, 1], [18, 0])}px)`,
          }}
        >
          {LINKS.map((link) => (
            <div
              key={link.label}
              style={{
                padding: "16px 26px",
                borderRadius: 14,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                boxShadow: COLORS.shadow,
                textAlign: "center",
              }}
            >
              <div style={{ fontFamily: FONTS.mono, fontSize: 21, color: COLORS.textPrimary }}>
                {link.label}
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontFamily: FONTS.text,
                  fontSize: 14,
                  color: COLORS.textMuted,
                }}
              >
                {link.note}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 40,
            fontFamily: FONTS.text,
            fontSize: 15,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.textMuted,
            opacity: spring({ frame: Math.max(0, frame - cEnd - 52), fps, config: SPRING.gentle }),
          }}
        >
          WebMCP Challenge 2026
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
