import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING } from "../lib/animations";
import { COLORS, FONTS } from "../lib/design";

interface Props {
  /** File name inside public/shots. */
  src: string;
  /** Caption in the frame's title bar. Real screenshots only, always labelled. */
  chrome?: string;
  width: number;
  height: number;
  delay?: number;
  /** Slow push-in over the shot's whole life, in percent. */
  zoom?: number;
  /** cover crops to the frame, contain shows the whole capture. */
  fit?: "cover" | "contain";
  style?: React.CSSProperties;
}

/**
 * A real screenshot in a window frame. Everything shown here was captured from the
 * shipped product, so the frame is labelled with where it came from.
 */
export const ShotFrame: React.FC<Props> = ({
  src,
  chrome,
  width,
  height,
  delay = 0,
  zoom = 4,
  fit = "cover",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const e = spring({ frame: f, fps, config: SPRING.smooth });
  const scale = 1 + (zoom / 100) * Math.min(f / (fps * 8), 1);
  const barHeight = chrome ? 34 : 0;

  return (
    <div
      style={{
        width,
        height: height + barHeight,
        borderRadius: 14,
        overflow: "hidden",
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        boxShadow: COLORS.shadowXl,
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [30, 0])}px) scale(${interpolate(
          e,
          [0, 1],
          [0.96, 1],
        )})`,
        ...style,
      }}
    >
      {chrome ? (
        <div
          style={{
            height: barHeight,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "0 13px",
            background: COLORS.bgSubtle,
            borderBottom: `1px solid ${COLORS.borderSoft}`,
          }}
        >
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#E06C60" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#E5B449" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#5BBB6A" }} />
          <span
            style={{
              marginLeft: 12,
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.textTertiary,
              letterSpacing: "0.01em",
            }}
          >
            {chrome}
          </span>
        </div>
      ) : null}
      <div style={{ width, height, overflow: "hidden" }}>
        <Img
          src={staticFile(`shots/${src}`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: fit === "cover" ? "top center" : "center",
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
};
