import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING, countTo } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { ShotFrame } from "../components/ShotFrame";
import { cueIn } from "../lib/timing";

/** The policy a human wrote in one sentence, as the page stored it. */
const POLICY = [
  { key: "thresholds", value: "amount > 5000  ->  hold" },
  { key: "requireHumanFor", value: '["pay"]' },
  { key: "maxAutoActionsPerRun", value: "0" },
];

/**
 * The two drafts the run produced, and the clause that caught each one. The findings were
 * demo findings, asked for on camera so the guardrail could be exercised on demand; what is
 * real is the policy engine's decision, which is the point of the scene.
 */
const DRAFTS = [
  {
    title: "Demo finding, pay invoice EUR 7,200",
    clause: "threshold:amount>5000",
    reason: "amount is 7200, which trips threshold:amount>5000.",
  },
  {
    title: "Demo finding, pay invoice EUR 900",
    clause: "requireHumanFor:pay",
    reason: 'Actions of kind "pay" always need a human decision.',
  },
];

export const GuardrailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cOpen = cueIn("guardrail", 16);
  const cHeld = cueIn("guardrail", 17);
  const cClauses = cueIn("guardrail", 18);
  const cZero = cueIn("guardrail", 19);
  const cFunction = cueIn("guardrail", 20);
  const cRail = cueIn("guardrail", 21);

  const policyIn = spring({ frame: Math.max(0, frame - cOpen - 6), fps, config: SPRING.smooth });
  const zeroIn = spring({ frame: Math.max(0, frame - cZero), fps, config: SPRING.bouncy });
  const fnIn = spring({ frame: Math.max(0, frame - cFunction + 10), fps, config: SPRING.smooth });

  // The right column runs three stages, each tied to the line being spoken:
  // what ChatGPT itself reported, what the tool returned, and where it was recorded.
  const stage: "chat" | "code" | "rail" =
    frame >= cRail - 12 ? "rail" : frame >= cFunction - 10 ? "code" : "chat";

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={300} y={260} size={520} color1="#B47D0E1F" color2="#D6454508" index={11} opacity={0.45} />
      <GradientOrb x={1680} y={820} size={480} color1="#D645451A" color2="#B47D0E08" index={12} opacity={0.4} />

      <div style={{ position: "absolute", top: 66, left: 120 }}>
        <SectionHeader
          label="The guardrail"
          title="A rule the agent cannot argue with."
          accent={COLORS.warn}
          align="left"
          delay={0}
          size={42}
        />
      </div>

      {/* The rule, as a human wrote it */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 232,
          width: 560,
          padding: "22px 26px",
          borderRadius: 16,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.shadowLg,
          opacity: policyIn,
          transform: `translateY(${interpolate(policyIn, [0, 1], [22, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.text,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.textMuted,
            marginBottom: 12,
          }}
        >
          Written by the human, in one sentence
        </div>
        {POLICY.map((row, i) => {
          const e = spring({
            frame: Math.max(0, frame - cOpen - 12 - i * 7),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={row.key}
              style={{
                display: "flex",
                gap: 12,
                padding: "7px 0",
                fontFamily: FONTS.mono,
                fontSize: 19,
                opacity: e,
              }}
            >
              <span style={{ color: COLORS.violet, minWidth: 230 }}>{row.key}</span>
              <span style={{ color: COLORS.textPrimary }}>{row.value}</span>
            </div>
          );
        })}
      </div>

      {/* The two drafts, and what the page did with them */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 468,
          width: 900,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {DRAFTS.map((draft, i) => {
          const e = spring({
            frame: Math.max(0, frame - cHeld - i * 12),
            fps,
            config: SPRING.smooth,
          });
          const clause = spring({
            frame: Math.max(0, frame - cClauses - i * 22),
            fps,
            config: SPRING.snappy,
          });
          return (
            <div
              key={draft.title}
              style={{
                padding: "18px 24px",
                borderRadius: 15,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `4px solid ${COLORS.warn}`,
                boxShadow: COLORS.shadow,
                opacity: e,
                transform: `translateX(${interpolate(e, [0, 1], [-24, 0])}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 23,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {draft.title}
                </span>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: `${COLORS.warn}1A`,
                    color: COLORS.warn,
                    fontFamily: FONTS.text,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    opacity: clause,
                    transform: `scale(${interpolate(clause, [0, 1], [0.8, 1])})`,
                  }}
                >
                  held
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 16,
                    color: COLORS.danger,
                    opacity: clause,
                  }}
                >
                  {draft.clause}
                </span>
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontFamily: FONTS.text,
                  fontSize: 17,
                  color: COLORS.textTertiary,
                  opacity: clause,
                }}
              >
                {draft.reason}
              </div>
            </div>
          );
        })}
      </div>

      {/* Approved: zero */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 726,
          display: "flex",
          alignItems: "center",
          gap: 22,
          opacity: zeroIn,
          transform: `scale(${interpolate(zeroIn, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 128,
            fontWeight: 700,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            background: COLORS.gradientHold,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {countTo(0, Math.max(0, frame - cZero), fps, 0.5)}
        </div>
        <div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 30,
              fontWeight: 650,
              color: COLORS.textPrimary,
              letterSpacing: "-0.025em",
            }}
          >
            drafts approved
          </div>
          <div style={{ fontFamily: FONTS.text, fontSize: 18, color: COLORS.textTertiary, marginTop: 4 }}>
            of the two it was told to approve
          </div>
        </div>
      </div>

      {/* Right, stage one: ChatGPT's own account of being refused */}
      {stage === "chat" ? (
        <div style={{ position: "absolute", left: 1112, top: 232 }}>
          <ShotFrame
            src="refusal.png"
            chrome="ChatGPT desktop  ·  28 Aug 2026  ·  monitor run with two demo findings"
            width={660}
            height={610}
            delay={Math.max(0, cHeld - 10)}
            zoom={2}
            fit="contain"
          />
        </div>
      ) : null}

      {/* Right, stage two: what the tool actually returns */}
      {stage === "code" ? (
        <div
          style={{
            position: "absolute",
            left: 1080,
            top: 232,
            width: 720,
            opacity: fnIn,
            transform: `translateY(${interpolate(fnIn, [0, 1], [26, 0])}px)`,
          }}
        >
          <div
            style={{
              padding: "26px 30px",
              borderRadius: 16,
              background: COLORS.bgInk,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: COLORS.shadowXl,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 15,
                color: COLORS.textMuted,
                marginBottom: 14,
              }}
            >
              approve_draft returns
            </div>
            {[
              "Refused: clause threshold:amount>5000:",
              "amount is 7200, which trips",
              "threshold:amount>5000.",
              "A human can approve it from the",
              "Monitors tab.",
            ].map((line, i) => {
              const e = spring({
                frame: Math.max(0, frame - cFunction + 4 - i * 5),
                fps,
                config: SPRING.snappy,
              });
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 23,
                    lineHeight: 1.5,
                    color: i === 0 ? COLORS.danger : "rgba(230,237,243,0.9)",
                    opacity: e,
                  }}
                >
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Right, stage three: the rail that recorded every call */}
      {stage === "rail" ? (
        <div style={{ position: "absolute", left: 1080, top: 232 }}>
          <ShotFrame
            src="rail.png"
            chrome="mcpforwork.com  ·  Activity"
            width={720}
            height={520}
            delay={Math.max(0, cRail - 12)}
            zoom={3}
          />
          <div
            style={{
              marginTop: 14,
              width: 720,
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontSize: 14,
              color: COLORS.textMuted,
            }}
          >
            every call, its arguments and its result, on the page
          </div>
        </div>
      ) : null}

      {/* The punchline, which stays up whichever panel is on the right */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 900,
          width: 900,
          fontFamily: FONTS.display,
          fontSize: 30,
          fontWeight: 600,
          color: COLORS.textPrimary,
          letterSpacing: "-0.025em",
          lineHeight: 1.35,
          opacity: spring({ frame: Math.max(0, frame - cFunction), fps, config: SPRING.smooth }),
        }}
      >
        Not advice the model may weigh up. A function that returns false.
      </div>
    </AbsoluteFill>
  );
};
