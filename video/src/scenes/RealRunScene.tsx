import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { SPRING } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { cueIn } from "../lib/timing";

/**
 * Everything in this scene is a capture from one ChatGPT desktop conversation on
 * 28 August 2026. No re-enactment, no sample data.
 */
const BEATS = [
  {
    cue: 12,
    title: "One prompt, pasted into the chat",
    body: "50 unique threads read through the visitor's own Gmail connector.",
  },
  {
    cue: 13,
    title: "The work fanned out",
    body: "Two sub agents classified in parallel; a third reviewed the counts for drift before any write.",
  },
  {
    cue: 14,
    title: "It asked before it wrote",
    body: null,
    quote:
      "It will not receive your email address, sender names, subjects, URLs, IDs, snippets, or message bodies.",
    quoteBy: "ChatGPT, unprompted, before its first write",
  },
  {
    cue: 15,
    title: "Six dashboards and an overview",
    body: "Built entirely through create_category, upsert_dashboard and compose_overview.",
  },
] as const;

const SHOT_X = 830;
const SHOT_Y = 240;
const SHOT_W = 980;
const SHOT_H = 690;

export const RealRunScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cOpen = cueIn("realrun", 11);
  const cPrompt = cueIn("realrun", 12);
  const cParallel = cueIn("realrun", 13);
  const cAsk = cueIn("realrun", 14);
  const cBuilt = cueIn("realrun", 15);

  const shots = [
    { src: "pageintro.png", from: cOpen, to: cParallel },
    { src: "parallel.png", from: cParallel, to: cAsk },
    { src: "consent.png", from: cAsk, to: cBuilt },
    { src: "dashboards.png", from: cBuilt, to: 10_000 },
  ];

  const CUES: Record<number, number> = {
    12: cPrompt,
    13: cParallel,
    14: cAsk,
    15: cBuilt,
  };

  const frameIn = spring({ frame: Math.max(0, frame - cOpen), fps, config: SPRING.smooth });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={240} y={840} size={520} color1="#2F6FED22" color2="#6C4BE00A" index={9} opacity={0.42} />
      <GradientOrb x={1780} y={180} size={420} color1="#5AA9FF22" color2="#2F6FED0A" index={10} opacity={0.36} />

      <div style={{ position: "absolute", top: 74, left: 120 }}>
        <SectionHeader
          label="The real run"
          title="28 August 2026, inside ChatGPT desktop."
          align="left"
          delay={0}
          size={42}
        />
      </div>

      {/* Provenance line, so a judge knows what they are looking at */}
      <div
        style={{
          position: "absolute",
          top: 88,
          right: 120,
          display: "flex",
          gap: 10,
          opacity: spring({ frame: Math.max(0, frame - 8), fps, config: SPRING.gentle }),
        }}
      >
        {["GPT-5.6", "50 Gmail threads", "30m 04s", "unedited capture"].map((chip, i) => (
          <div
            key={chip}
            style={{
              padding: "8px 15px",
              borderRadius: 999,
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              boxShadow: COLORS.shadow,
              fontFamily: FONTS.mono,
              fontSize: 15,
              color: COLORS.textTertiary,
              opacity: spring({ frame: Math.max(0, frame - 8 - i * 5), fps, config: SPRING.snappy }),
            }}
          >
            {chip}
          </div>
        ))}
      </div>

      {/* Left: the beats of the run, added as the narration reaches them */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 262,
          width: 640,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {BEATS.map((beat, i) => {
          const at = CUES[beat.cue] ?? 0;
          const e = spring({ frame: Math.max(0, frame - at), fps, config: SPRING.smooth });
          const live = frame >= at && frame < at + 60;
          return (
            <div
              key={beat.title}
              style={{
                padding: "20px 24px",
                borderRadius: 16,
                background: COLORS.bgCard,
                border: `1px solid ${live ? `${COLORS.accent}55` : COLORS.border}`,
                boxShadow: live ? `0 0 0 4px ${COLORS.accent}12, ${COLORS.shadow}` : COLORS.shadow,
                opacity: e,
                transform: `translateX(${interpolate(e, [0, 1], [-26, 0])}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 7 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: COLORS.gradientBrand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 24,
                    fontWeight: 650,
                    color: COLORS.textPrimary,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {beat.title}
                </span>
              </div>
              {beat.body ? (
                <div
                  style={{
                    fontFamily: FONTS.text,
                    fontSize: 18,
                    lineHeight: 1.5,
                    color: COLORS.textTertiary,
                    paddingLeft: 33,
                  }}
                >
                  {beat.body}
                </div>
              ) : null}
              {"quote" in beat && beat.quote ? (
                <div style={{ paddingLeft: 33 }}>
                  <div
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 19,
                      lineHeight: 1.5,
                      color: COLORS.textPrimary,
                      borderLeft: `3px solid ${COLORS.ok}`,
                      paddingLeft: 14,
                      marginTop: 4,
                    }}
                  >
                    {beat.quote}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      color: COLORS.textMuted,
                      paddingLeft: 17,
                    }}
                  >
                    {beat.quoteBy}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Right: the capture itself, crossfading between the four moments */}
      <div
        style={{
          position: "absolute",
          left: SHOT_X,
          top: SHOT_Y,
          width: SHOT_W,
          height: SHOT_H,
          borderRadius: 16,
          overflow: "hidden",
          background: "#12161C",
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.shadowXl,
          opacity: frameIn,
          transform: `translateY(${interpolate(frameIn, [0, 1], [28, 0])}px)`,
        }}
      >
        {shots.map((shot) => {
          const o = interpolate(
            frame,
            [shot.from - 10, shot.from + 8, shot.to - 8, shot.to + 10],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          if (o <= 0.001) return null;
          const held = Math.max(0, frame - shot.from);
          return (
            <Img
              key={shot.src}
              src={staticFile(`shots/${shot.src}`)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: o,
                transform: `scale(${1 + Math.min(held / (fps * 14), 1) * 0.03})`,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: SHOT_X,
          top: SHOT_Y + SHOT_H + 14,
          width: SHOT_W,
          textAlign: "center",
          fontFamily: FONTS.mono,
          fontSize: 14,
          color: COLORS.textMuted,
          opacity: frameIn,
        }}
      >
        screen capture, ChatGPT desktop, 28 Aug 2026
      </div>
    </AbsoluteFill>
  );
};
