import React from "react";
import { useCurrentFrame } from "remotion";
import { float } from "../lib/animations";

interface Props {
  x: number;
  y: number;
  size: number;
  color1: string;
  color2: string;
  index?: number;
  opacity?: number;
}

/**
 * Soft drifting colour blob. Two or three of these carry every scene's depth.
 *
 * The softness comes from the gradient's own stops, not from a CSS blur: a 100px blur on a
 * 600px element costs Chrome more per frame than everything else in a scene put together.
 */
export const GradientOrb: React.FC<Props> = ({
  x,
  y,
  size,
  color1,
  color2,
  index = 0,
  opacity = 0.35,
}) => {
  const frame = useCurrentFrame();
  const dx = float(frame, index, size * 0.07, 0.014);
  const dy = float(frame, index + 5, size * 0.05, 0.019);

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2 + dx,
        top: y - size / 2 + dy,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 42% 40%, ${color1} 0%, ${color2} 40%, transparent 72%)`,
        opacity,
        transform: `scale(${1 + Math.sin(frame * 0.011 + index) * 0.06})`,
        pointerEvents: "none",
      }}
    />
  );
};
