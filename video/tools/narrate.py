#!/usr/bin/env python3
"""Record the narration track, one clip per sentence, and write the cue map.

    GEMINI_TTS_KEY=... python tools/narrate.py

Reads lines.json (one sentence per entry), synthesises each sentence on its own so its
real duration can be measured, concatenates them with a short breath between, and writes
public/narration.mp3 plus src/lib/cues.json. The cue map is what src/lib/timing.ts is
generated from, so the picture can be locked to the voice.

The key is read from the environment and is never written to disk here.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import wave
from pathlib import Path

from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
LINES = ROOT / "lines.json"
CLIPS = ROOT / "out" / "tts_clips"
OUT_MP3 = ROOT / "public" / "narration.mp3"
OUT_CUES = ROOT / "src" / "lib" / "cues.json"

VOICE = os.environ.get("TTS_VOICE", "Charon")
MODELS = ["gemini-2.5-pro-preview-tts", "gemini-2.5-flash-preview-tts"]
GAP_SECONDS = 0.18
SAMPLE_RATE = 24_000

STYLE = (
    "Audio profile: a polished modern technology product explainer voiceover, recorded clean "
    "in a studio. Scene: a two minute demo film for a panel of hackathon judges. Directors "
    "notes: confident, precise and warm, a senior engineer showing peers something they built "
    "and believe in. Natural human pacing with small dynamic lifts, clear articulation, "
    "understated, never an announcer, never robotic. Now say: "
)


def synthesise(client: genai.Client, text: str) -> bytes:
    """Raw PCM for one sentence, falling back to the flash model when the pro one is busy."""
    last: Exception | None = None
    for model in MODELS:
        for attempt in range(4):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=STYLE + text,
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE),
                            ),
                        ),
                    ),
                )
                return response.candidates[0].content.parts[0].inline_data.data
            except Exception as error:  # noqa: BLE001 - reported, then retried or re-raised
                last = error
                message = str(error).upper()
                if "429" in message or "RESOURCE_EXHAUSTED" in message:
                    break
                if "500" in message or "INTERNAL" in message or "UNAVAILABLE" in message:
                    time.sleep(2 + attempt * 3)
                    continue
                raise
    raise RuntimeError(f"TTS failed for {text[:40]!r}") from last


def duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
    )
    return float(out.decode().strip())


def main() -> None:
    sentences = json.loads(LINES.read_text(encoding="utf-8"))
    if not isinstance(sentences, list) or not all(isinstance(s, str) and s.strip() for s in sentences):
        raise SystemExit("lines.json must be a JSON array of non-empty strings")

    client = genai.Client(api_key=os.environ["GEMINI_TTS_KEY"])
    CLIPS.mkdir(parents=True, exist_ok=True)

    cues: list[dict[str, object]] = []
    paths: list[Path] = []
    cursor = 0.0
    for index, sentence in enumerate(sentences):
        clip = CLIPS / f"s{index:02d}.wav"
        if not clip.exists() or clip.stat().st_size < 1024:
            pcm = synthesise(client, sentence)
            with wave.open(str(clip), "wb") as handle:
                handle.setnchannels(1)
                handle.setsampwidth(2)
                handle.setframerate(SAMPLE_RATE)
                handle.writeframes(pcm)
        seconds = duration(clip)
        cues.append({"i": index, "s": round(cursor, 2), "e": round(cursor + seconds, 2), "t": sentence})
        paths.append(clip)
        cursor += seconds + GAP_SECONDS
        print(f"  s{index:02d} {seconds:5.2f}s  start {cues[index]['s']:6.2f}  {sentence[:52]}")

    silence = CLIPS / "_gap.wav"
    with wave.open(str(silence), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS))

    listing = CLIPS / "_list.txt"
    listing.write_text(
        "".join(f"file '{p.name}'\nfile '_gap.wav'\n" for p in paths),
        encoding="utf-8",
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", "_list.txt", "-c", "copy", "_full.wav"],
        cwd=CLIPS, check=True,
    )
    OUT_MP3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(CLIPS / "_full.wav"),
         "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
    )
    OUT_CUES.write_text(json.dumps(cues, indent=2), encoding="utf-8")
    print(f"\ntotal {cursor:.2f}s, voice {VOICE}")
    print(f"wrote {OUT_MP3} and {OUT_CUES}")
    print("now run: python tools/timing.py")


if __name__ == "__main__":
    main()
