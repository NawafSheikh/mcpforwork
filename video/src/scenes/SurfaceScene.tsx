import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING } from "../lib/animations";
import { COLORS, FONTS, PACK_COLOR } from "../lib/design";
import { GradientOrb } from "../components/GradientOrb";
import { SectionHeader } from "../components/SectionHeader";
import { ToolChip } from "../components/ToolChip";
import { TOOLS, TOOL_COUNT, READ_ONLY_COUNT, WRITE_COUNT } from "../data/tools";
import { cueIn } from "../lib/timing";

const COLUMNS: readonly (readonly string[])[] = [
  ["board", "workspaces", "datasets"],
  ["notes", "turns", "monitors", "rooms"],
];

const PACK_LABEL: Record<string, string> = {
  board: "Board",
  workspaces: "Workspaces",
  datasets: "Datasets",
  notes: "Notes",
  turns: "Turns",
  monitors: "Monitors",
  rooms: "Rooms",
};

/** The pack the scene switches off on camera, to show gating is live. */
const GATED = "monitors";

const Switch: React.FC<{ on: number; color: string }> = ({ on, color }) => (
  <div
    style={{
      width: 34,
      height: 19,
      borderRadius: 999,
      background: `rgba(20,38,60,${0.12 + 0.0 * on})`,
      backgroundImage: `linear-gradient(90deg, ${color} 0%, ${color} 100%)`,
      backgroundSize: `${on * 100}% 100%`,
      backgroundRepeat: "no-repeat",
      position: "relative",
      transition: "none",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 2.5,
        left: 2.5 + on * 15,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(20,38,60,0.3)",
      }}
    />
  </div>
);

export const SurfaceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cHints = cueIn("surface", 9);
  const cPacks = cueIn("surface", 10);
  const toggleAt = cPacks + 92;

  // The gated pack rides its switch from on to off over half a second.
  const gateOn = interpolate(frame, [toggleAt, toggleAt + 14], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hintsIn = spring({ frame: Math.max(0, frame - cHints), fps, config: SPRING.smooth });
  const packsIn = spring({ frame: Math.max(0, frame - cPacks + 6), fps, config: SPRING.smooth });

  let chipIndex = 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <GradientOrb x={1720} y={300} size={480} color1="#2F6FED22" color2="#6C4BE00A" index={7} opacity={0.4} />
      <GradientOrb x={200} y={880} size={460} color1="#1F9D6B1A" color2="#2F6FED0A" index={8} opacity={0.35} />

      <div style={{ position: "absolute", top: 62, left: 120 }}>
        <SectionHeader
          label="The surface"
          title="34 tools, annotated and switchable."
          align="left"
          delay={0}
          size={42}
        />
      </div>

      {/* The count, and the two annotations the protocol asks for */}
      <div
        style={{
          position: "absolute",
          top: 74,
          right: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 19,
            color: COLORS.textSecondary,
            opacity: spring({ frame, fps, config: SPRING.gentle }),
          }}
        >
          {TOOL_COUNT} registered
          <span style={{ color: COLORS.textMuted }}>
            {"  ·  "}
            {READ_ONLY_COUNT} read
            {"  ·  "}
            {WRITE_COUNT} write
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, opacity: hintsIn }}>
          {[
            { label: "readOnlyHint", color: COLORS.ok },
            { label: "untrustedContentHint", color: COLORS.warn },
          ].map((hint, i) => {
            const e = spring({
              frame: Math.max(0, frame - cHints - i * 10),
              fps,
              config: SPRING.snappy,
            });
            return (
              <div
                key={hint.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 15px",
                  borderRadius: 999,
                  background: `${hint.color}14`,
                  border: `1px solid ${hint.color}33`,
                  fontFamily: FONTS.mono,
                  fontSize: 16,
                  color: hint.color,
                  opacity: e,
                  transform: `scale(${interpolate(e, [0, 1], [0.88, 1])})`,
                }}
              >
                {hint.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* The pack columns */}
      <div
        style={{
          position: "absolute",
          top: 268,
          left: 120,
          right: 120,
          display: "flex",
          gap: 60,
        }}
      >
        {COLUMNS.map((column, ci) => (
          <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 46 }}>
            {column.map((pack) => {
              const color = PACK_COLOR[pack] ?? COLORS.accent;
              const tools = TOOLS.filter((t) => t.pack === pack);
              const gated = pack === GATED;
              const dim = gated ? 0.25 + 0.75 * gateOn : 1;
              const headIn = spring({
                frame: Math.max(0, frame - cPacks + 4),
                fps,
                config: SPRING.snappy,
              });

              return (
                <div key={pack} style={{ opacity: dim }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONTS.text,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color,
                      }}
                    >
                      {PACK_LABEL[pack]}
                    </span>
                    <span
                      style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted }}
                    >
                      {tools.length}
                    </span>
                    <div style={{ opacity: headIn * packsIn, marginLeft: 2 }}>
                      <Switch on={gated ? gateOn : 1} color={color} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
                    {tools.map((tool) => {
                      const delay = chipIndex * 3;
                      chipIndex += 1;
                      return (
                        <ToolChip
                          key={tool.name}
                          name={tool.name}
                          color={color}
                          readOnly={tool.readOnly}
                          delay={delay}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* How the surface exists in the first place */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 132,
          display: "flex",
          gap: 18,
          justifyContent: "center",
          opacity: spring({ frame: Math.max(0, frame - 60), fps, config: SPRING.gentle }),
        }}
      >
        {[
          ["Registered once", "from the top-level page, not per tab"],
          ["Tabs are React state", "never navigation, so the set survives the conversation"],
          ["A shared snapshot", "registers nothing at all"],
        ].map(([head, note], i) => {
          const e = spring({ frame: Math.max(0, frame - 60 - i * 8), fps, config: SPRING.snappy });
          return (
            <div
              key={head}
              style={{
                padding: "16px 22px",
                borderRadius: 14,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                boxShadow: COLORS.shadow,
                opacity: e,
                transform: `translateY(${interpolate(e, [0, 1], [16, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 20,
                  fontWeight: 650,
                  color: COLORS.textPrimary,
                  letterSpacing: "-0.02em",
                }}
              >
                {head}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: FONTS.text,
                  fontSize: 16,
                  color: COLORS.textTertiary,
                }}
              >
                {note}
              </div>
            </div>
          );
        })}
      </div>

      {/* What the toggle actually did */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 58,
          textAlign: "center",
          fontFamily: FONTS.text,
          fontSize: 20,
          color: COLORS.textTertiary,
          opacity: interpolate(frame, [toggleAt + 6, toggleAt + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        A pack switched off is unregistered from{" "}
        <span style={{ fontFamily: FONTS.mono, color: COLORS.textSecondary }}>
          document.modelContext
        </span>{" "}
        on the next call.
      </div>
    </AbsoluteFill>
  );
};
