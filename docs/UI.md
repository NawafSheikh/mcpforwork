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
- Wordmark, room name (editable by host), lock badge (encrypted room or local board),
  Workspaces (which board is open, whether it is saved, the whole list), invite
  (write link, read-only link), Tools (packs switches), your name chip, theme.
- Connected-agent pill: "Site tools on: 29" or the exact fix if not.

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


## First run: a blank canvas (29 Aug, Nawaf)
The first thing on mcpforwork.com is an empty board and three questions about the person,
in this order, in the centre column with the rails already around them:

1. **"What should we call you?"** with an inline field. It writes the display name, so the
   top bar chip and the members rail change in the same tick. Before it is set the rail
   says "You" and the chip says "Set your name"; the word "Someone" never reaches a screen.
2. **"Your agent."** Outside the ChatGPT desktop browser: "Not connected. Your ChatGPT
   joins when this page runs inside it", the three steps, and copy buttons for the address
   and the starter prompt. Inside it: "ChatGPT is in the room" and the prompt card alone.
3. **"What you control."** Six rows, each with its real state and one action:
   Workspaces ("My workspace, saved just now" or the name and how many more are here,
   opens the Workspaces panel), Board
   ("empty, your agent builds it" or a category count), Guardrails ("no monitors yet" or a
   count, opens Monitors), Tools ("34 tools in 7 packs, all on", opens the Tools popover),
   Rooms ("only this browser" or the room and its member count, Invite), Data ("nothing
   dropped" or a dataset count, opens Datasets).

There is no sample board, no seeded demo, no live public room to peek at, no replay and no
hero headline over 26 px. Nothing on the page is pre-filled: `seed_demo_workspace` is gone,
the board is empty until an agent fills it, and every number on screen is a real count of
something that is actually there.

The next step card in the right panel follows the same order: no name yet, tell us your
name (it focuses the field); named but outside ChatGPT, open this page inside ChatGPT
desktop with the steps; inside ChatGPT with an empty board, the starter prompt; after that
open requests, held drafts, then the invite.

## States
- First visit outside ChatGPT: the three first-run questions in the center column, with the
  rails already visible (empty members list explains rooms).
- First visit inside ChatGPT: the same three, with "ChatGPT is in the room" on the second.
- Shared snapshot: read-only center, rails show "snapshot, nobody live".
- Room without key: locked center with "ask the host for the link with the key".

## Components to keep
Dashboard renderer, charts, guardrail form, prompt library, backup, drop zone,
FeedbackBox, RoomRequests. Rebuild the shell around them; do not rebuild them.

## Acceptance
- A stranger understands in ten seconds that people and agents work here together.
- A judge can find the four-way thread, the claims, the approvals and the live feed without
  clicking a header button.
- Everything renders on a 390 px phone as a stacked layout with a bottom tab bar
  (Board, Requests, Live, People).

## Workspaces (29 Aug, Nawaf: "allow people to create workspaces and save workspace")
A person keeps more than one board in one browser, one per piece of work, and can see at
a glance that it is saved.

- **The button** is in the top bar next to the agent pill and reads "Workspaces", with the
  count once there is more than one. Its tooltip is the answer to the question this page
  kept getting asked: `My workspace: Saved just now`.
- **The panel** is a list. A row is the name and what it holds ("3 categories, 1 monitor,
  supplier mailbox only"); clicking it opens that board. Above the list: the save state
  and a Save now button. Below it: one field, "New workspace, for example Invoices", and
  Create and open. Per row: Copy (a version to fall back to, which does not move you off
  the board you are on) and Delete (the only thing on the page that asks twice).
- **Nothing is lost by switching.** The board being left is written to disk before the
  other is read, and comes back exactly as it was.
- **A room board is not a workspace**, and the panel says so instead of pretending: the
  actions are held, and opening a workspace from there is the way out of the room.
- **The agent has the same five moves** (docs/TOOLS.md, workspaces pack) except deleting,
  which no tool can do.
