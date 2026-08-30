/** Motion helpers shared by every scene: springs, easing, organic float, counters. */
import { noise2D } from "@remotion/noise";

export const SPRING = {
  smooth: { damping: 26, mass: 1, stiffness: 140 },
  snappy: { damping: 20, mass: 0.6, stiffness: 200 },
  bouncy: { damping: 13, mass: 0.8, stiffness: 160 },
  gentle: { damping: 30, mass: 1.2, stiffness: 80 },
  hero: { damping: 22, mass: 0.9, stiffness: 120 },
} as const;

export const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Perlin drift, for backgrounds that never sit perfectly still. */
export const perlinFloat = (frame: number, seed: number, amplitude = 8, speed = 0.008): number =>
  noise2D("float", frame * speed, seed) * amplitude;

/** Cheap sine float when a full noise field is overkill. */
export const float = (frame: number, index: number, amp = 6, speed = 0.03): number =>
  Math.sin(frame * speed + index * 1.2) * amp;

/** Counts up to `target` over `duration` seconds, easing out so it lands softly. */
export const countTo = (target: number, frame: number, fps: number, duration = 1.6): number =>
  Math.round(target * easeOutExpo(Math.min(Math.max(frame, 0) / (fps * duration), 1)));
