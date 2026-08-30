import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, easeInOutCubic } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { cueIn } from "../lib/timing";

/** The real signature of the tool that draws a dashboard (src/webmcp/schemas.ts). */
const SIGNATURE: readonly { text: string; tone: "key" | "type" | "plain" | "comment" }[] = [
  { text: "upsert_dashboard({", tone: "key" },
  { text: "  category: string,", tone: "type" },
  { text: "  kpis:     KPI[1..4],", tone: "type" },
  { text: "  charts:   Chart[0..4],", tone: "type" },
  { text: "  notes:    string[0..6],", tone: "type" },
  { text: "})", tone: "key" },
  { text: "", tone: "plain" },
  { text: "KPI   = { label, value, delta? }", tone: "plain" },
  { text: "Chart = { kind, points[0..12] }", tone: "plain" },
];

/** What no tool on the page will take, however the agent asks. */
const REFUSED = ["message bodies", "subjects", "sender names", "raw rows"];

/** Straight from LIMITS in src/types.ts. */
const LIMITS = [
  "zod at the boundary",
  "4 KPIs",
  "4 charts",
  "12 points a chart",
  "20 table rows",
  "1500 chars back",
  "60 calls a minute",
];

const TONE: Record<string, string> = {
  key: COLORS.violet,
  type: COLORS.textPrimary,
  plain: COLORS.textTertiary,
  comment: COLORS.textMuted,
};

export const ContractScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cShape = cueIn("contract", 6);
  const cProperty = cueIn("contract", 7);
  const cLimits = cueIn("contract", 8);

  const card = spring({ frame: Math.max(0, frame - cShape + 6), fps, config: SPRING.smooth });
  const wall = easeInOutCubic(Math.min(1, Math.max(0, (frame - cShape - 40) / 20)));
  const stamp = spring({ frame: Math.max(0, frame - cProperty), fps, config: SPRING.bouncy });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={1660} y={760} size={520} color1="#6C4BE022" color2="#2F6FED0A" index={5} opacity={0.42} />
      <GradientOrb x={260} y={240} size={440} color1="#2F6FED22" color2="#5AA9FF0A" index={6} opacity={0.38} />

      <div style={{ position: "absolute", top: 78, left: 0, right: 0 }}>
        <SectionHeader
          label="The contract"
          title="Aggregates in. Rows never."
          accent={COLORS.violet}
          delay={0}
        />
      </div>

      {/* Left: what the page refuses, behind a wall it does not negotiate over */}
      <div style={{ position: "absolute", left: 190, top: 336, width: 330 }}>
        <div
          style={{
            fontFamily: FONTS.text,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.danger,
            marginBottom: 16,
            opacity: wall,
          }}
        >
          No tool accepts
        </div>
        {REFUSED.map((item, i) => {
          const e = spring({
            frame: Math.max(0, frame - cShape - 44 - i * 8),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={item}
              style={{
                fontFamily: FONTS.text,
                fontSize: 21,
                color: COLORS.textTertiary,
                padding: "9px 0",
                opacity: e * 0.85,
                transform: `translateX(${interpolate(e, [0, 1], [-16, 0])}px)`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* The wall itself */}
      <div
        style={{
          position: "absolute",
          left: 566,
          top: 340,
          width: 4,
          height: 240 * wall,
          borderRadius: 3,
          background: `linear-gradient(180deg, ${COLORS.danger}, ${COLORS.danger}22)`,
          opacity: 0.7,
        }}
      />

      {/* Right: the typed shape a tool does accept */}
      <div
        style={{
          position: "absolute",
          left: 660,
          top: 312,
          width: 700,
          padding: "28px 34px",
          borderRadius: 18,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.shadowXl,
          opacity: card,
          transform: `translateY(${interpolate(card, [0, 1], [26, 0])}px)`,
        }}
      >
        {SIGNATURE.map((line, i) => {
          const e = spring({
            frame: Math.max(0, frame - cShape - 6 - i * 4),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 23,
                lineHeight: 1.62,
                whiteSpace: "pre",
                color: TONE[line.tone],
                opacity: e,
              }}
            >
              {line.text || " "}
            </div>
          );
        })}
      </div>

      {/* The line that makes it structural rather than a promise */}
      <div
        style={{
          position: "absolute",
          left: 660,
          top: 742,
          width: 700,
          padding: "18px 26px",
          borderRadius: 14,
          background: `${COLORS.violet}12`,
          border: `1px solid ${COLORS.violet}30`,
          opacity: stamp,
          transform: `scale(${interpolate(stamp, [0, 1], [0.94, 1])})`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 25,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: "-0.02em",
          }}
        >
          A property of the protocol, not a promise.
        </span>
      </div>

      {/* The caps, once the narration reaches validation */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 862,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "0 200px",
        }}
      >
        {LIMITS.map((limit, i) => {
          const e = spring({
            frame: Math.max(0, frame - cLimits - 2 - i * 6),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={limit}
              style={{
                padding: "9px 17px",
                borderRadius: 999,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                boxShadow: COLORS.shadow,
                fontFamily: FONTS.mono,
                fontSize: 17,
                color: COLORS.textSecondary,
                opacity: e,
                transform: `scale(${interpolate(e, [0, 1], [0.86, 1])})`,
              }}
            >
              {limit}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
