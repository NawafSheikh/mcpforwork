# Turns: who is working, whose input counts, what is being worked on

Design for the collaborative workspace, 29 Aug 2026. Turns belong to objects, never to the
room as a whole; nobody waits for a global lock.

## Claims: who is working on what
- Before working on a dashboard, monitor, note or the overview, an agent calls `claim`
  ({target, caller}); a person clicks "I am working on this". The card shows the holder:
  "Maria's agent is working on Invoices".
- A claim expires after 10 minutes without a write, and releases on the write that finishes the
  work (`upsert_dashboard`, `compose_overview`, `set_policy`, `resolve_feedback`) or on `release`.
- Presence carries claims: "2 people, 2 agents · Maria's agent on Invoices, Nawaf on Guardrails".
- Writing to an object someone else holds is refused: "Held by Maria's agent since 23:40.
  Leave a note with add_feedback, or wait." An agent never breaks a person's claim; a person's
  edit breaks an agent's claim, and the agent learns that on its next call.

## Requests: the handoff
- A note addressed to an agent, a person, or everyone is that party's turn. Resolving it hands
  the turn back with a resolution line. The room thread is the visible queue of open turns.
- `get_workspace` tells each caller "you have N open requests" so an agent starts every task by
  reading what was asked of it.

## Versions: whose input counts
- Reads return `updatedAt`. Writes may carry `expectedUpdatedAt`. If the object changed since
  that read, the write is refused with who changed it and when, and the agent is told to read
  again. No silent overwrite of a person's edit by an agent working from a stale copy.
- Rooms sync patches last-writer-wins per object; version-checked writes make that safe in
  practice because an agent will not write over something it has not seen.

## Precedence
1. A person's edit or decision on an object beats an agent's, always.
2. Between agents, the claim holder writes; others leave notes.
3. Without a claim, the version check decides; the loser reads again.

## What people see
- Card badges for claims, presence with work in progress, the room thread of open requests,
  and the audit rail for the history.
