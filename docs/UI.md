# UI redesign: a workspace for people and their agents

Written 29 Aug 2026. The current shell is a dashboard app with collaboration bolted on. The
redesign puts the collaboration in the frame and the objects in the middle.

## Principles
0. Easy, useful, secure, gets things done. Fewer buttons, sensible defaults, one visible next
   step. Agents act by default; humans get decisions and information, never gates.
1. Who is here and what they are doing is always visible, never a popover.
2. Every object shows its state of work: who holds it, who changed it last, what is asked of it.
3. Agents and people use the same surface; the page tells each what to do next in plain words.
4. Nothing important lives only in a header button. Buttons in the header are for the room.
5. Light, calm, dense enough for work. Tokens only. Keyboard reachable.

## Layout (three columns on wide screens, stacked on narrow)

### Top bar (room)
- Wordmark, room name (editable by host), lock badge (encrypted room or local board), invite
  (write link, read-only link), Tools (packs switches), your name chip, theme.
- Connected-agent pill: "Site tools on: 28" or the exact fix if not.

### Left rail (people, agents, places)
- Members: every person with their name, what they are viewing, what they hold. Every agent
  with its caller name, its person, what it is working on, last call time.
- Places: Overview, then categories with record counts and share of board, then Monitors,
  Datasets, Requests, Activity. Pinned first. Badges for open requests and held drafts.

### Center (the object)
- Overview: executive summary banner, domain cards, drop zone folded below.
- Category page: title, holder badge ("Maria's agent is working on this · 4 min", or "I am
  working on this" toggle), KPI cards, charts with switchers, AI Intelligence, aggregates,
  notes for the agent, ask-the-agent prompts. Remote change pulses with the author chip.
- Monitors page: policy as a sentence, guardrail form, runs, approval queue with Approve and
  Decline always available to a person, held clauses in red.
- Datasets page: profiles, aggregates the agent asked for, forget file.
- Requests page: the room thread of all four kinds (person to person, person to agent, agent to
  person, agent to agent), open first, resolved folded; composer with target picker
  (everyone, a person, an agent, any agent) and "runs in your ChatGPT, not here" hint.

### Right panel (live)
- Live feed: every call and human action as it lands, grouped by peer, newest first, filter by
  person or agent, click to jump to the object.
- Open for you: requests addressed to you, drafts held for you, claims you hold.
- Next step card for the connected agent: the exact prompt to paste next, updated by state
  (empty board: starter; open requests: "check list_feedback"; held drafts: approve prompt).

## States
- First visit outside ChatGPT: the hero with the three steps and Watch it build, inside the
  center column, with the rails already visible (empty members list explains rooms).
- First visit inside ChatGPT: "Your agent is in the room", the starter prompt, the rails alive.
- Sample loaded: ribbon in the center column, everything else real.
- Shared snapshot: read-only center, rails show "snapshot, nobody live".
- Room without key: locked center with "ask the host for the link with the key".

## Components to keep
Dashboard renderer, charts, guardrail form, prompt library, backup, drop zone, replay,
FeedbackBox, RoomRequests, NameChip. Rebuild the shell around them; do not rebuild them.

## Acceptance
- A stranger understands in ten seconds that people and agents work here together.
- A judge can find the four-way thread, the claims, the approvals and the live feed without
  clicking a header button.
- Everything renders on a 390 px phone as a stacked layout with a bottom tab bar
  (Board, Requests, Live, People).
