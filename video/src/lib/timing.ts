// GENERATED from the narration track. Do not hand edit: run tools/timing.py.
// Every scene starts on the frame its narration line starts, minus a half crossfade,
// so the picture and the voice stay locked whatever the transitions do.

export const FPS = 30;
export const TRANSITION_FRAMES = 20;
export const NARRATION_SECONDS = 160.26;

export const SCENES = {
  hero: { duration: 419, label: "Hero", startFrame: 0, cues: [0, 1] },
  why: { duration: 739, label: "Why WebMCP", startFrame: 399, cues: [2, 5] },
  contract: { duration: 534, label: "The contract", startFrame: 1118, cues: [6, 8] },
  surface: { duration: 444, label: "The safe surface", startFrame: 1632, cues: [9, 10] },
  realrun: { duration: 959, label: "The real run", startFrame: 2056, cues: [11, 15] },
  guardrail: { duration: 851, label: "The guardrail", startFrame: 2995, cues: [16, 21] },
  rooms: { duration: 405, label: "Rooms", startFrame: 3826, cues: [22, 23] },
  proof: { duration: 454, label: "Proof", startFrame: 4211, cues: [24, 25] },
  outro: { duration: 301, label: "Outro", startFrame: 4645, cues: [26, 26] },
} as const;

export type SceneKey = keyof typeof SCENES;

export const TOTAL_DURATION = 4946;

/** Absolute cue times of every narration line, in frames. */
export const CUE_FRAMES: readonly number[] = [
  0, 212, 409, 573, 779, 902, 1128, 1346, 1455, 1642, 1900, 2066, 2250, 2441, 2667, 2833, 3005, 3105, 3222, 3417, 3500, 3700, 3836, 4010, 4221, 4473, 4655,
];

/** Frame of narration line `index`, relative to the start of scene `key`. */
export const cueIn = (key: SceneKey, index: number): number =>
  CUE_FRAMES[index] - SCENES[key].startFrame;
