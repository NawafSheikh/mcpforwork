import React from "react";
import { interpolate } from "remotion";
import { COLORS } from "../lib/design";
import { TOTAL_DURATION } from "../lib/timing";

const DOT_SPACING = 74;

/**
 * One background for the whole film, mounted under the TransitionSeries. It never
 * restarts, so every crossfade lands on continuous motion instead of a hard cut.
 *
 * Deliberately cheap: two soft colour fields and one tiled dot layer that drifts by
 * background-position. An earlier version drew 390 SVG circles a frame off a noise field,
 * which looked the same and cost about two seconds of render time per frame.
 */
export const PersistentBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / TOTAL_DURATION;
  const orb1X = interpolate(t, [0, 1], [260, 1620]);
  const orb1Y = interpolate(t, [0, 1], [280, 760]);
  const orb2X = interpolate(t, [0, 1], [1560, 380]);
  const orb2Y = interpolate(t, [0, 1], [700, 220]);
  const hue1 = interpolate(t, [0, 0.35, 0.7, 1], [222, 252, 210, 222]);
  const hue2 = interpolate(t, [0, 0.35, 0.7, 1], [205, 160, 262, 205]);

  // The grid breathes rather than marches: a slow lissajous over one cell.
  const gridX = Math.sin(frame * 0.004) * 14;
  const gridY = Math.cos(frame * 0.0031) * 11;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: orb1X - 340,
          top: orb1Y - 340,
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: `radial-gradient(circle, hsla(${hue1}, 84%, 66%, 0.14), hsla(${hue1}, 84%, 66%, 0.05) 45%, transparent 70%)`,
          transform: `scale(${1 + Math.sin(frame * 0.009) * 0.08})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: orb2X - 280,
          top: orb2Y - 280,
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `radial-gradient(circle, hsla(${hue2}, 72%, 62%, 0.11), hsla(${hue2}, 72%, 62%, 0.04) 45%, transparent 70%)`,
          transform: `scale(${1 + Math.cos(frame * 0.012) * 0.06})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: -DOT_SPACING,
          backgroundImage: `radial-gradient(circle, ${COLORS.textMuted}33 1.3px, transparent 1.5px)`,
          backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
          backgroundPosition: `${gridX}px ${gridY}px`,
        }}
      />
    </div>
  );
};
