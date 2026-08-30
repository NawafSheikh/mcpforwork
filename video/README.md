# Demo film (Remotion)

The submission video for the WebMCP Challenge, built as a Remotion composition rather than a
screen recording. Nine scenes, blended into each other, cut against a recorded narration track.

    npm install
    npm run studio      # preview and scrub, http://localhost:3000
    npm run render      # out/mcpforwork_demo.mp4, 1920x1080, 30 fps, h264 + AAC

Length is **2:44.9** (4946 frames at 30 fps), under the 3:00 limit.

## How the timing works

`src/lib/timing.ts` is generated from `src/lib/cues.json`, which is the per-sentence duration
map of the narration. Every scene starts on the frame its own narration line starts, minus half
a crossfade, so the picture stays locked to the voice no matter what the transitions do. Do not
hand edit `timing.ts`: change the narration, regenerate the cues, regenerate the file.

Regenerating narration (Gemini TTS, one clip per sentence, concatenated with a 0.18 s breath):

    export GEMINI_TTS_KEY=...            # never committed
    TTS_SENTENCES_JSON=lines.json TTS_VOICE=Charon \
      TTS_OUT=public/narration.mp3 TTS_CUES_OUT=src/lib/cues.json \
      python tts_gemini.py

## Render cost

Keep the per-frame work cheap or a two minute film takes hours. Two rules learned the hard way
here: no `filter: blur()` on a large element (a 100px blur on a 600px orb cost more per frame
than every other element put together), and no per-frame DOM field (an SVG dot grid of 390
animated circles). Both were replaced by plain gradients and a tiled background, which look the
same and took the render from 2h 32m to about 15 minutes.

## Scenes

| # | Scene | Narration lines | What it has to earn |
|---|---|---|---|
| 1 | Hero | 0-1 | what this is, where it lives |
| 2 | Why WebMCP | 2-5 | the leverage argument: the page ships no model and no mailbox |
| 3 | The contract | 6-8 | aggregates in, rows never; the caps that enforce it |
| 4 | The surface | 9-10 | 34 tools, their annotations, packs switched live |
| 5 | The real run | 11-15 | 28 Aug 2026 inside ChatGPT desktop, unedited captures |
| 6 | The guardrail | 16-21 | two pay drafts held by clause, approved drafts zero |
| 7 | Rooms | 22-23 | two browsers on one board, requests in four directions |
| 8 | Built and proved | 24-25 | 684 tests, 58 files, share with no server |
| 9 | Outro | 26 | the links |

## Where the material comes from

Everything asserted on screen is either read out of this repository or captured from a real run.

- Tool names, packs and annotations: `src/data/tools.ts`, mirrored from `src/packs/registry.ts`
  and `src/webmcp/annotations.ts`. 34 tools, 13 read-only, 7 packs.
- Limits: `LIMITS` in `src/types.ts`.
- The refusal text: the string `approve_draft` actually returns, `src/monitors/handlers.ts`.
- Test counts: `npm test` at the repository root, 684 passing across 58 files.
- Screenshots in `public/shots`: crops of captures taken on 28 August 2026 (ChatGPT desktop) and
  of a live two-browser room. Nothing is staged and nothing is sample data. They are shown
  unedited, which is why `refusal.png` still carries ChatGPT's own punctuation.

The guardrail scene runs its right-hand column in three stages, one per narration line: what
ChatGPT itself reported (`refusal.png`), the exact string `approve_draft` returns, and the page's
own Activity rail (`rail.png`).

## House rules kept

No em dashes in the narration or in any text this project sets. No employer named. No claim the
product does not do. The one place an em dash appears is inside an unedited screenshot of
ChatGPT's own reply, which is evidence and is not re-typed.
