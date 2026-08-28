# Video script: MCP for Work

**Target length: 2 minutes 50 seconds.** Two segments. The first is cut from the
screenshots of the real ChatGPT desktop run on 28 August 2026, because that run is the
evidence and it is 41 minutes long, so it cannot be shown live. The second is a live take
against the sample workspace, where everything happens in seconds.

Sources:

- Real-run segment: `competitions/webmcp/video/shots_realrun.json` (8 shots, about 108
  seconds), rendered by `build_video.py` from the screenshots in
  `competitions/webmcp/e2e_screens_20260828/`. The narration below matches that file. If
  you edit one, edit the other.
- Test report with every quote used here: `CHATGPT_DESKTOP_TEST_20260828.md`.
- Live segment: the deployed page in demo mode, **Load sample workspace** pressed once.

Rules for the recording:

- Nothing is staged. The first segment is real screenshots of a real run against a real
  mailbox; the second is the real product in demo mode.
- No mailbox content is ever on screen. The real-run frames show the agent's reasoning and
  the board, never a subject line or an address.
- The sample workspace is synthetic (Acme Test Ltd, Sample Supplies GmbH, Example
  Recruiting). Say the word "synthetic" out loud once, in shot B1.
- Model must be GPT-5.6 Sol or Terra. The real-run frames already carry 5.6 Sol Ultra.
- Keep the cursor still while a tool call is running. The chips are the proof.

---

# Segment A: the real run (0:00 to 1:48)

## A1: the page inside ChatGPT (0:00 to 0:13)

**On screen.** `20260828_180136` mcpforwork.com loaded in the ChatGPT desktop side panel,
header pill reading "Site tools on: 15 registered".

**Spoken.** "This is MCP for Work, opened inside ChatGPT desktop's built-in browser. The
page registers fifteen site tools. Your own ChatGPT is the analyst. The page is the board
and the guardrails."

*(The page now registers eighteen: notes and sharing were added after this run. Say
fifteen, because that is what the frame shows.)*

## A2: the site tools popover (0:13 to 0:24)

**On screen.** `20260828_180200` address bar popover: "Available site tools (15), 4 read,
11 write".

**Spoken.** "Site tools in the address bar: fifteen available, four read, eleven write.
Every write is validated, rate limited and audited on the page."

## A3: one prompt (0:24 to 0:39)

**On screen.** `20260828_180406` the trace line "MCP webmcp:mcpforwork.com:get_workspace
on Browser use".

**Spoken.** "One prompt: look at my last fifty Gmail threads, group them, and build a
dashboard for each on this page. ChatGPT reads the mail through its own connector and
calls get workspace on the page."

## A4: the work fans out (0:39 to 0:52)

**On screen.** `20260828_182632` two live sub-agent chips, `Classify 1 25` and
`Classify 26 50`, running side by side.

**Spoken.** "The work fans out. Two sub agents classify threads in parallel while a
reviewer checks for count drift and privacy leaks before anything is written."

## A5: it asks before it writes (0:52 to 1:05)

**On screen.** `20260828_183647` the consent question. Zoom the last line so the words are
legible.

**Spoken.** "Before writing, ChatGPT asks. Only de-identified aggregates go to the page:
no addresses, no subjects, no bodies. That is the contract the tools enforce."

*Hold one beat on the sentence "It will not receive your email address, sender names,
subjects, URLs, IDs, snippets, or message bodies."*

## A6: the board (1:05 to 1:18)

**On screen.** `20260828_184018` six category dashboards and the overview, KPIs legible.

**Spoken.** "Six category dashboards and an overview, built through upsert dashboard and
compose overview. Fifty threads, totals verified by a readback."

## A7: the refusal (1:18 to 1:34)

**On screen.** `20260828_184849` the reply refusing bulk approval.

**Spoken.** "Then the guardrail. Asked to approve every draft, ChatGPT is refused by the
policy: the seven thousand two hundred euro invoice exceeds five thousand, and pay always
needs a human. Approved drafts: zero."

*This is the shot the judges remember. One full second of silence after "zero".*

## A8: the rail (1:34 to 1:48)

**On screen.** `20260828_184904` the Activity rail, newest calls with arguments and
results.

**Spoken.** "Every call lands in the activity rail with its arguments and result. Humans
keep the approve button. Agents keep the work moving."

---

# Segment B: live, on the sample workspace (1:48 to 2:50)

Cut to a live window. Demo mode, empty board, no login anywhere on camera.

## B1: a finished board in one second (1:48 to 2:03)

**On screen.** Press **Load sample workspace**. Four categories, dashboards, an overview,
two monitors and the draft queue appear at once. Hover a provenance line.

**Spoken.** "You do not need an agent to look at this. One button loads a synthetic sample
board, so a judge can read the whole thing in a second, with no account, no connector and
no tokens spent."

## B2: the feedback loop (2:03 to 2:23)

**On screen.** Type a note on the Invoices dashboard: "Split the outstanding bar by ageing
bucket." Then ask ChatGPT: "Read my notes on this board and act on them." Chips land in
order: `list_feedback`, `upsert_dashboard`, `resolve_feedback`. The chart changes and the
note flips to resolved with the agent's one-line resolution under it.

**Spoken.** "A dashboard is rarely right first time, and I am the one who knows why. I
leave a note on the chart. The agent reads my notes back through list feedback, rebuilds
that chart, and closes the note with a line saying what it changed. We are editing the
same object, in turns."

## B3: caller attribution and the human decision (2:23 to 2:38)

**On screen.** The Activity rail with caller labels visible on the agent's calls. Then
click **Approve** on the held Acme Test Ltd draft in the Monitors tab. The rail writes a
new line with actor **human** directly beneath the agent's refused line. Freeze on the two
lines together.

**Spoken.** "Every call can name its own caller, so parallel sub-agents are visible, not
anonymous. And when the policy holds something, I approve it myself. One click, logged as
me, not as the agent."

## B4: share a snapshot (2:38 to 2:50)

**On screen.** Press **Share**, "Link copied" appears, paste into a second window. The
board opens read only with the banner: "Shared snapshot. Open mcpforwork.com in ChatGPT
desktop to work on your own board."

**Spoken.** "And the whole board fits in a link. The state rides in the URL fragment,
which browsers never send to a server, so a snapshot needs no account and no backend. The
agent proposes. The human decides."

**End card, 1 second.** `MCP for Work` and mcpforwork.com.

---

## Recording checklist

- [ ] Real-run frames unedited, in the order in `shots_realrun.json`.
- [ ] Consent sentence legible in A5.
- [ ] Clause text legible in A7, with the pause after "zero".
- [ ] Word "synthetic" spoken in B1.
- [ ] Three chips visible in B2: `list_feedback`, `upsert_dashboard`, `resolve_feedback`.
- [ ] Rail showing a caller label, and `agent` refused directly above `human` approved.
- [ ] Share banner legible in B4.
- [ ] No real name, real address, real company or real inbox in any frame.
- [ ] Under 3 minutes, per the challenge rules.
