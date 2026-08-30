#!/usr/bin/env python3
"""Generate src/lib/timing.ts from the narration cue map.

    python tools/timing.py

Remotion's TransitionSeries steals frames from both neighbours of a transition, so a scene's
absolute start is not the sum of the durations before it. This works the arithmetic backwards:
pick the absolute frame each scene should start on (its first narration line, minus half a
crossfade so the blend is centred on the cue) and solve for the durations that put it there.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUES = ROOT / "src" / "lib" / "cues.json"
OUT = ROOT / "src" / "lib" / "timing.ts"

FPS = 30
TRANSITION = 20      # 0.67 s crossfade between scenes
LEAD = TRANSITION // 2
TAIL_SECONDS = 4.6   # hold on the outro after the last word

# (key, label, first narration line, last narration line)
SCENES = [
    ("hero", "Hero", 0, 1),
    ("why", "Why WebMCP", 2, 5),
    ("contract", "The contract", 6, 8),
    ("surface", "The safe surface", 9, 10),
    ("realrun", "The real run", 11, 15),
    ("guardrail", "The guardrail", 16, 21),
    ("rooms", "Rooms", 22, 23),
    ("proof", "Proof", 24, 25),
    ("outro", "Outro", 26, 26),
]


def main() -> None:
    cues = json.loads(CUES.read_text(encoding="utf-8"))
    if SCENES[-1][3] != len(cues) - 1:
        raise SystemExit(
            f"scene map covers lines 0..{SCENES[-1][3]} but the cue map has {len(cues)}",
        )

    end = round((cues[-1]["e"] + TAIL_SECONDS) * FPS)
    starts = [0] + [round(cues[first]["s"] * FPS) - LEAD for _, _, first, _ in SCENES[1:]]
    durations = [
        (starts[i + 1] if i + 1 < len(SCENES) else end)
        - starts[i]
        + (TRANSITION if i < len(SCENES) - 1 else 0)
        for i in range(len(SCENES))
    ]
    total = sum(durations) - TRANSITION * (len(SCENES) - 1)

    lines = [
        "// GENERATED from the narration track. Do not hand edit: run tools/timing.py.",
        "// Every scene starts on the frame its narration line starts, minus a half crossfade,",
        "// so the picture and the voice stay locked whatever the transitions do.",
        "",
        f"export const FPS = {FPS};",
        f"export const TRANSITION_FRAMES = {TRANSITION};",
        f"export const NARRATION_SECONDS = {cues[-1]['e']:.2f};",
        "",
        "export const SCENES = {",
    ]
    for (key, label, first, last), duration, start in zip(SCENES, durations, starts):
        lines.append(
            f'  {key}: {{ duration: {duration}, label: "{label}", '
            f"startFrame: {start}, cues: [{first}, {last}] }},",
        )
    lines += [
        "} as const;",
        "",
        "export type SceneKey = keyof typeof SCENES;",
        "",
        f"export const TOTAL_DURATION = {total};",
        "",
        "/** Absolute cue times of every narration line, in frames. */",
        "export const CUE_FRAMES: readonly number[] = [",
        "  " + ", ".join(str(round(c["s"] * FPS)) for c in cues) + ",",
        "];",
        "",
        "/** Frame of narration line `index`, relative to the start of scene `key`. */",
        "export const cueIn = (key: SceneKey, index: number): number =>",
        "  CUE_FRAMES[index] - SCENES[key].startFrame;",
    ]
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    minutes, seconds = divmod(total / FPS, 60)
    print(f"wrote {OUT}")
    print(f"total {total} frames = {total / FPS:.2f}s = {int(minutes)}:{seconds:05.2f}")
    for (key, _, first, last), duration, start in zip(SCENES, durations, starts):
        print(
            f"  {key:10s} start {start:5d}f ({start / FPS:6.2f}s)  "
            f"dur {duration:4d}f ({duration / FPS:5.2f}s)  lines {first}-{last}",
        )


if __name__ == "__main__":
    main()
