import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, easeInOutCubic } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { Counter } from "../components/Counter";
import { cueIn } from "../lib/timing";

const STACK = [
  "TypeScript",
  "React 18",
  "Vite",
  "zod",
  "recharts",
  "IndexedDB",
  "Web Crypto",
  "Supabase broadcast",
  "Vercel",
];

export const ProofScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cTests = cueIn("proof", 24);
  const cShare = cueIn("proof", 25);

  // The share line draws from the board to the fragment, and stops there.
  const draw = easeInOutCubic(Math.min(1, Math.max(0, (frame - cShare - 4) / 26)));
  const shareIn = spring({ frame: Math.max(0, frame - cShare), fps, config: SPRING.smooth });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={300} y={780} size={520} color1="#1F9D6B1A" color2="#2F6FED0A" index={15} opacity={0.42} />
      <GradientOrb x={1660} y={260} size={460} color1="#2F6FED22" color2="#6C4BE00A" index={16} opacity={0.38} />

      <div style={{ position: "absolute", top: 92, left: 0, right: 0 }}>
        <SectionHeader label="Built and proved" title="What is underneath." accent={COLORS.ok} delay={0} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 316,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 108,
        }}
      >
        <Counter value={684} label="tests" sub="all green" delay={cTests} gradient={COLORS.gradientOk} />
        <Counter value={58} label="test files" sub="unit to integration" delay={cTests + 12} />
        <Counter value={34} label="site tools" sub="one registry" delay={cTests + 24} />
        <Counter
          value={0}
          label="backend for a share"
          sub="none needed"
          delay={cTests + 36}
          gradient={COLORS.gradientBrand}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 546,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 11,
          flexWrap: "wrap",
          padding: "0 300px",
        }}
      >
        {STACK.map((item, i) => {
          const e = spring({
            frame: Math.max(0, frame - cTests - 40 - i * 4),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={item}
              style={{
                padding: "9px 17px",
                borderRadius: 999,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                boxShadow: COLORS.shadow,
                fontFamily: FONTS.text,
                fontSize: 17,
                color: COLORS.textSecondary,
                opacity: e,
                transform: `scale(${interpolate(e, [0, 1], [0.88, 1])})`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* Share: the board goes into the link, and nowhere else */}
      <div
        style={{
          position: "absolute",
          top: 700,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          opacity: shareIn,
        }}
      >
        <div
          style={{
            padding: "20px 30px",
            borderRadius: 15,
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.border}`,
            boxShadow: COLORS.shadowLg,
            fontFamily: FONTS.display,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: "-0.02em",
          }}
        >
          The whole board
        </div>
        <div style={{ width: 120, height: 3, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 3,
              width: `${draw * 100}%`,
              background: COLORS.accent,
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            padding: "20px 30px",
            borderRadius: 15,
            background: COLORS.bgInk,
            boxShadow: COLORS.shadowLg,
            fontFamily: FONTS.mono,
            fontSize: 24,
            color: COLORS.textOnInk,
            opacity: draw,
          }}
        >
          mcpforwork.com/#...
        </div>
        <div style={{ width: 120, height: 3, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 3,
              width: 120,
              background: `repeating-linear-gradient(90deg, ${COLORS.textMuted} 0 6px, transparent 6px 12px)`,
              opacity: draw * 0.5,
            }}
          />
        </div>
        <div
          style={{
            padding: "20px 30px",
            borderRadius: 15,
            border: `1px dashed ${COLORS.textMuted}`,
            fontFamily: FONTS.text,
            fontSize: 22,
            color: COLORS.textMuted,
            opacity: draw * 0.85,
          }}
        >
          no server
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 116,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONTS.text,
          fontSize: 20,
          color: COLORS.textTertiary,
          opacity: spring({ frame: Math.max(0, frame - cShare - 34), fps, config: SPRING.gentle }),
        }}
      >
        MIT licensed, public, and every commit inside the submission window.
      </div>
    </AbsoluteFill>
  );
};
