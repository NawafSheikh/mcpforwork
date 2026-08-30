import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, easeInOutCubic } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { cueIn } from "../lib/timing";

const ANALYST = [
  "Reads the threads through its own connectors",
  "Decides the categories",
  "Computes the totals",
];

const NOT_SHIPPED = ["a model", "a mailbox integration", "a copy of your data"];
const SHIPPED = ["34 tools", "a policy engine", "a renderer"];

const NODE_W = 470;
const LEFT_X = 210;
const RIGHT_X = 1240;
const NODE_Y = 420;

const Row: React.FC<{
  text: string;
  delay: number;
  color: string;
  struck?: boolean;
  mono?: boolean;
}> = ({ text, delay, color, struck = false, mono = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: Math.max(0, frame - delay), fps, config: SPRING.snappy });
  // The strike draws itself across the row a beat after the row lands.
  const strike = struck ? easeInOutCubic(Math.min(1, Math.max(0, (frame - delay - 12) / 14))) : 0;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "11px 0",
        opacity: e * (struck ? 0.6 : 1),
        transform: `translateX(${interpolate(e, [0, 1], [-14, 0])}px)`,
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: mono ? FONTS.mono : FONTS.text,
          fontSize: mono ? 20 : 19,
          fontWeight: mono ? 500 : 400,
          color: struck ? COLORS.textTertiary : COLORS.textPrimary,
        }}
      >
        {text}
      </span>
      {struck ? (
        <div
          style={{
            position: "absolute",
            left: 18,
            top: "50%",
            height: 2,
            width: `${strike * 88}%`,
            background: COLORS.danger,
            borderRadius: 2,
            opacity: 0.8,
          }}
        />
      ) : null}
    </div>
  );
};

export const WhyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cThesis = cueIn("why", 2);
  const cAnalyst = cueIn("why", 3);
  const cNoModel = cueIn("why", 4);
  const cShips = cueIn("why", 5);

  const leftCard = spring({ frame: Math.max(0, frame - cAnalyst + 12), fps, config: SPRING.smooth });
  const rightCard = spring({ frame: Math.max(0, frame - cNoModel + 8), fps, config: SPRING.smooth });

  // The wire is only drawn once the page has something to offer.
  const link = easeInOutCubic(Math.min(1, Math.max(0, (frame - cShips + 4) / 26)));
  const pulse = (((frame - cShips) % 60) + 60) / 60 % 1;
  const showShipped = frame >= cShips - 2;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={210} y={760} size={520} color1="#2F6FED22" color2="#6C4BE00A" index={3} opacity={0.45} />
      <GradientOrb x={1700} y={260} size={480} color1="#5AA9FF26" color2="#2F6FED0A" index={4} opacity={0.4} />

      <div style={{ position: "absolute", top: 92, left: 0, right: 0 }}>
        <SectionHeader
          label="Why WebMCP"
          title="The hard part is not the rendering."
          delay={Math.max(0, cThesis - 6)}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 238,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONTS.text,
          fontSize: 21,
          color: COLORS.textTertiary,
          opacity: spring({ frame: Math.max(0, frame - cThesis - 8), fps, config: SPRING.gentle }),
        }}
      >
        A dashboard over your work mail is a data problem. The reasoning already lives somewhere else.
      </div>

      {/* The analyst: the model the visitor already pays for, holding its own connectors */}
      <div
        style={{
          position: "absolute",
          left: LEFT_X,
          top: NODE_Y,
          width: NODE_W,
          padding: "26px 30px 22px",
          borderRadius: 20,
          background: COLORS.bgInk,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: COLORS.shadowXl,
          opacity: leftCard,
          transform: `translateY(${interpolate(leftCard, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.text,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.accentSky,
            marginBottom: 8,
          }}
        >
          The analyst
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.textOnInk,
            letterSpacing: "-0.03em",
            marginBottom: 14,
          }}
        >
          Your own ChatGPT
        </div>
        {ANALYST.map((row, i) => {
          const e = spring({
            frame: Math.max(0, frame - cAnalyst - 16 - i * 9),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={row}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 0",
                opacity: e,
                transform: `translateX(${interpolate(e, [0, 1], [-12, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: COLORS.accentSky,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: FONTS.text, fontSize: 18, color: "rgba(230,237,243,0.86)" }}>
                {row}
              </span>
            </div>
          );
        })}
      </div>

      {/* The page: deliberately empty of everything that would need your data */}
      <div
        style={{
          position: "absolute",
          left: RIGHT_X,
          top: NODE_Y,
          width: NODE_W,
          padding: "26px 30px 22px",
          borderRadius: 20,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.shadowXl,
          opacity: rightCard,
          transform: `translateY(${interpolate(rightCard, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.text,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: showShipped ? COLORS.ok : COLORS.danger,
            marginBottom: 8,
          }}
        >
          {showShipped ? "The page ships" : "The page does not ship"}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 26,
            fontWeight: 500,
            color: COLORS.textPrimary,
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          mcpforwork.com
        </div>
        {showShipped
          ? SHIPPED.map((row, i) => (
              <Row key={row} text={row} delay={cShips + 6 + i * 8} color={COLORS.ok} mono />
            ))
          : NOT_SHIPPED.map((row, i) => (
              <Row key={row} text={row} delay={cNoModel + 14 + i * 11} color={COLORS.danger} struck />
            ))}
      </div>

      {/* The one wire between them */}
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <line
          x1={LEFT_X + NODE_W}
          y1={NODE_Y + 152}
          x2={LEFT_X + NODE_W + (RIGHT_X - LEFT_X - NODE_W) * link}
          y2={NODE_Y + 152}
          stroke={COLORS.accent}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {link > 0.98 ? (
          <circle
            cx={LEFT_X + NODE_W + (RIGHT_X - LEFT_X - NODE_W) * pulse}
            cy={NODE_Y + 152}
            r={6}
            fill={COLORS.accent}
            opacity={1 - Math.abs(pulse - 0.5) * 0.8}
          />
        ) : null}
      </svg>

      <div
        style={{
          position: "absolute",
          left: LEFT_X + NODE_W,
          width: RIGHT_X - LEFT_X - NODE_W,
          top: NODE_Y + 170,
          textAlign: "center",
          fontFamily: FONTS.mono,
          fontSize: 17,
          color: COLORS.textTertiary,
          opacity: link,
        }}
      >
        document.modelContext
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 108,
          textAlign: "center",
          fontFamily: FONTS.display,
          fontSize: 27,
          fontWeight: 500,
          color: COLORS.textSecondary,
          letterSpacing: "-0.02em",
          opacity: spring({ frame: Math.max(0, frame - cShips - 40), fps, config: SPRING.gentle }),
        }}
      >
        The model brings the data and the reasoning. The page brings the tools and the rules.
      </div>
    </AbsoluteFill>
  );
};
