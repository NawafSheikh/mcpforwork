import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, perlinFloat } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { cueIn } from "../lib/timing";

const TITLE = "MCP for Work";
const SUB = "A workspace where a person and their own agent do the same job, on the same page.";

const FACTS = [
  { value: "34", label: "site tools" },
  { value: "0", label: "models shipped" },
  { value: "0", label: "logins" },
];

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mark = spring({ frame, fps, config: SPRING.hero });
  const chars = TITLE.split("").map((char, i) => ({
    char,
    e: spring({ frame: Math.max(0, frame - 18 - i * 1.6), fps, config: SPRING.snappy }),
  }));
  const sub = spring({ frame: Math.max(0, frame - 62), fps, config: SPRING.gentle });

  // The second narration line names the URL and the licence.
  const urlIn = cueIn("hero", 1);
  const url = spring({ frame: Math.max(0, frame - urlIn + 6), fps, config: SPRING.smooth });

  const driftX = perlinFloat(frame, 0, 4, 0.006);
  const driftY = perlinFloat(frame, 7, 3, 0.008);

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={300} y={200} size={560} color1="#2F6FED33" color2="#6C4BE011" index={0} opacity={0.5} />
      <GradientOrb x={1600} y={800} size={620} color1="#5AA9FF2E" color2="#2F6FED11" index={1} opacity={0.4} />
      <GradientOrb x={980} y={1000} size={420} color1="#6C4BE022" color2="#2F6FED0A" index={2} opacity={0.3} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${driftX}px, ${driftY}px)`,
        }}
      >
        {/* The product's own MW mark */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 26,
            background: COLORS.gradientBrand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 38,
            transform: `scale(${mark}) rotate(${interpolate(mark, [0, 1], [-14, 0])}deg)`,
            opacity: mark,
            boxShadow: "0 26px 64px rgba(47, 111, 237, 0.34)",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: 34,
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
            display: "flex",
            fontFamily: FONTS.display,
            fontSize: 92,
            fontWeight: 700,
            color: COLORS.textPrimary,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            marginBottom: 22,
          }}
        >
          {chars.map(({ char, e }, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: e,
                transform: `translateY(${interpolate(e, [0, 1], [30, 0])}px)`,
                whiteSpace: char === " " ? "pre" : undefined,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </div>

        <div
          style={{
            fontFamily: FONTS.text,
            fontSize: 25,
            color: COLORS.textSecondary,
            maxWidth: 900,
            textAlign: "center",
            lineHeight: 1.45,
            opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [16, 0])}px)`,
          }}
        >
          {SUB}
        </div>

        {/* URL bar plus the three facts, on the second line of narration */}
        <div
          style={{
            marginTop: 52,
            display: "flex",
            alignItems: "center",
            gap: 44,
            opacity: url,
            transform: `translateY(${interpolate(url, [0, 1], [24, 0])}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 24px",
              borderRadius: 999,
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              boxShadow: COLORS.shadow,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: COLORS.ok,
                opacity: 0.5 + 0.5 * Math.sin(frame * 0.12),
              }}
            />
            <span style={{ fontFamily: FONTS.mono, fontSize: 19, color: COLORS.textPrimary }}>
              mcpforwork.com
            </span>
            <span
              style={{
                fontFamily: FONTS.text,
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.textMuted,
                padding: "3px 8px",
                borderRadius: 6,
                background: COLORS.bgSubtle,
              }}
            >
              MIT
            </span>
          </div>

          {FACTS.map((f, i) => {
            const e = spring({
              frame: Math.max(0, frame - urlIn - 14 - i * 7),
              fps,
              config: SPRING.snappy,
            });
            return (
              <div key={f.label} style={{ textAlign: "center", opacity: e, transform: `scale(${e})` }}>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 40,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    background: COLORS.gradientBrand,
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    lineHeight: 1,
                  }}
                >
                  {f.value}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontFamily: FONTS.text,
                    fontSize: 13,
                    color: COLORS.textTertiary,
                  }}
                >
                  {f.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
