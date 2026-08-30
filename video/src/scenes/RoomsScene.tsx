import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { ShotFrame } from "../components/ShotFrame";
import { cueIn } from "../lib/timing";

/** The four ways a request can travel on one board. */
const DIRECTIONS = [
  { from: "Person", to: "Person", color: COLORS.accent },
  { from: "Person", to: "Agent", color: COLORS.violet },
  { from: "Agent", to: "Person", color: COLORS.ok },
  { from: "Agent", to: "Agent", color: COLORS.warn },
];

const MEMBERS = [
  { name: "You", kind: "person", note: "viewing the board" },
  { name: "Colleague", kind: "person", note: "in the same room" },
  { name: "ChatGPT", kind: "agent", note: "over document.modelContext" },
  { name: "Local harness", kind: "agent", note: "publishing from a machine" },
];

export const RoomsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cInvite = cueIn("rooms", 22);
  const cFour = cueIn("rooms", 23);

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={260} y={300} size={520} color1="#6C4BE022" color2="#2F6FED0A" index={13} opacity={0.44} />
      <GradientOrb x={1700} y={760} size={460} color1="#2F6FED22" color2="#5AA9FF0A" index={14} opacity={0.38} />

      <div style={{ position: "absolute", top: 62, left: 120 }}>
        <SectionHeader
          label="Rooms"
          title="Two browsers, one live board."
          accent={COLORS.violet}
          align="left"
          delay={0}
          size={42}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 84,
          right: 120,
          display: "flex",
          gap: 10,
          opacity: spring({ frame: Math.max(0, frame - cInvite), fps, config: SPRING.gentle }),
        }}
      >
        {["AES-GCM, key in the link", "the relay forwards and forgets", "no table behind it"].map(
          (chip, i) => (
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
                opacity: spring({
                  frame: Math.max(0, frame - cInvite - i * 6),
                  fps,
                  config: SPRING.snappy,
                }),
              }}
            >
              {chip}
            </div>
          ),
        )}
      </div>

      {/* The real room, captured live across two browsers */}
      <div style={{ position: "absolute", left: 120, top: 226 }}>
        <ShotFrame
          src="room_board.png"
          chrome="mcpforwork.com  ·  Room w7a6857xid"
          width={1010}
          height={630}
          delay={4}
          zoom={3}
        />
      </div>

      {/* Who is in it */}
      <div style={{ position: "absolute", left: 1200, top: 250, width: 600 }}>
        {MEMBERS.map((m, i) => {
          const e = spring({
            frame: Math.max(0, frame - cInvite - 10 - i * 8),
            fps,
            config: SPRING.snappy,
          });
          const agent = m.kind === "agent";
          return (
            <div
              key={m.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 18px",
                marginBottom: 10,
                borderRadius: 13,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                boxShadow: COLORS.shadow,
                opacity: e,
                transform: `translateX(${interpolate(e, [0, 1], [22, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: agent ? 9 : "50%",
                  background: agent ? COLORS.gradientBrand : COLORS.bgSubtle,
                  border: agent ? "none" : `1px solid ${COLORS.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: agent ? "#fff" : COLORS.textTertiary,
                  flexShrink: 0,
                }}
              >
                {agent ? "AI" : m.name.slice(0, 1)}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 20,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontFamily: FONTS.text, fontSize: 15, color: COLORS.textTertiary }}>
                  {m.note}
                </div>
              </div>
            </div>
          );
        })}

        {/* Requests travel in four directions on the one queue */}
        <div
          style={{
            marginTop: 26,
            opacity: spring({ frame: Math.max(0, frame - cFour), fps, config: SPRING.smooth }),
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
            One queue, four directions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {DIRECTIONS.map((d, i) => {
              const e = spring({
                frame: Math.max(0, frame - cFour - 6 - i * 7),
                fps,
                config: SPRING.snappy,
              });
              return (
                <div
                  key={`${d.from}-${d.to}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "11px 16px",
                    borderRadius: 11,
                    background: `${d.color}0F`,
                    border: `1px solid ${d.color}2E`,
                    fontFamily: FONTS.text,
                    fontSize: 17,
                    fontWeight: 500,
                    color: COLORS.textPrimary,
                    opacity: e,
                    transform: `scale(${interpolate(e, [0, 1], [0.9, 1])})`,
                  }}
                >
                  {d.from}
                  <span style={{ color: d.color, fontFamily: FONTS.mono }}>{"->"}</span>
                  {d.to}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
