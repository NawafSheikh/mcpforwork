# Video script (2:44.9, motion graphics with real captures)

The submission film is a Remotion composition, not a screen recording: `video/`. Nine scenes
blended into each other, cut against a recorded narration track, 1920x1080 at 30 fps.
Render with `cd video && npm install && npm run render`, output `video/out/mcpforwork_demo.mp4`.

Every number and quote below is read out of this repository or captured from a real run. No
sample data, no re-enactment, no em dashes.

## Narration, in order

The file `video/lines.json` is the source of truth; each line is synthesised on its own so the
scene timings can be locked to it (`video/tools/narrate.py`, then `video/tools/timing.py`).

| # | Scene | Line |
|---|---|---|
| 0 | Hero | MCP for Work is a workspace where a person and their own agent do the same job on the same page. |
| 1 | Hero | It is live at mcpforwork dot com, open source, and it needs no login. |
| 2 | Why WebMCP | Building a dashboard over your work mail is a data problem, not a rendering problem. |
| 3 | Why WebMCP | The hard part is reading the threads and computing the totals, and your ChatGPT already does that. |
| 4 | Why WebMCP | So this page ships no model and no mailbox integration. |
| 5 | Why WebMCP | It ships thirty four tools, a policy engine and a renderer, registered through document dot modelContext. |
| 6 | The contract | The tools accept counts, sums, top lists and chart points. They never accept rows. |
| 7 | The contract | That is a property of the protocol, not a promise. |
| 8 | The contract | Every input is validated by zod at the boundary, with hard caps on size and on rate. |
| 9 | The surface | Read tools carry readOnlyHint. Anything echoing a human's own words carries untrustedContentHint. |
| 10 | The surface | The thirty four tools sit in seven packs, and every pack has a switch on the page. |
| 11 | The real run | On the twenty eighth of August, this ran for real inside ChatGPT desktop. |
| 12 | The real run | One prompt, and GPT five point six read fifty Gmail threads through its own connector. |
| 13 | The real run | It split the classification across two sub agents, and a third checked the counts before anything was written. |
| 14 | The real run | Then it stopped and asked whether it could send the de-identified counts and dates to the page. |
| 15 | The real run | Nothing else left the mailbox. Six dashboards and an overview were built through the site tools. |
| 16 | The guardrail | Then the part that decides whether any of this is safe. |
| 17 | The guardrail | Asked to approve every payment, the page held both. |
| 18 | The guardrail | One was over the five thousand euro threshold. The other was a pay action, and pay always needs a human. |
| 19 | The guardrail | Approved drafts, zero. |
| 20 | The guardrail | That refusal is not advice a model may ignore. It is a function that returns false. |
| 21 | The guardrail | The human writes the rule, and every call lands in the audit rail. |
| 22 | Rooms | Then invite somebody. One encrypted link puts two browsers on one live board. |
| 23 | Rooms | Two people, two agents, one shared trail, and requests running in four directions between them. |
| 24 | Built and proved | Underneath: six hundred and eighty four tests across fifty eight files, all green, MIT licensed and public. |
| 25 | Built and proved | Press share, and the whole board travels in a URL fragment with no server behind it. |
| 26 | Outro | MCP for Work. Bring your own agent, and keep the veto. |

## What is on screen, and where it comes from

| Scene | On screen | Source |
|---|---|---|
| Why WebMCP | The page ships no model, no mailbox integration, no copy of your data; one wire labelled `document.modelContext` | `src/webmcp/register.ts` |
| The contract | The real `upsert_dashboard` signature and the caps 4 KPIs / 4 charts / 12 points / 20 rows / 1500 chars / 60 calls a minute | `src/webmcp/schemas.ts`, `LIMITS` in `src/types.ts` |
| The surface | All 34 tool names in their 7 packs, 13 read-only, and a pack switched off on camera | `src/packs/registry.ts`, `src/webmcp/annotations.ts` |
| The real run | Four unedited crops of the ChatGPT desktop capture of 28 Aug 2026, and the model's own consent question | `video/public/shots`, cropped from the full-window captures kept with the submission material |
| The guardrail | The stored policy, the two held drafts with their clause names, the exact string `approve_draft` returns, and the Activity rail that logged it | `src/policy/engine.ts`, `src/monitors/handlers.ts` |
| The guardrail | The two findings were demo findings, asked for on camera so the guardrail could be exercised on demand. The scene says so, and the unedited capture of the prompt is on screen while it does. What is real is the refusal. | test report, 28 Aug 2026 |
| Rooms | A live two-browser room with two people and two agents in the member rail | live room capture, 29 Aug 2026 |
| Built and proved | 684 tests across 58 files | `npm test` at the repository root |

## Judging criteria this has to serve

- **WebMCP leverage**: scenes 2 to 4, which argue that the page deliberately ships no model and
  no data, and show the typed surface and the annotations that make that structural.
- **Execution**: scene 8, plus the fact that every claim on screen is traceable to a file.
- **Impact**: scene 5, a real thirty minute run over fifty real threads, ending in six dashboards.
- **Creativity**: scenes 6 and 7, the agent overruled by a rule it cannot argue with, and four
  directions of request traffic across two browsers.

## Still to do

Upload is Nawaf's call. Nothing in this repository posts it.
