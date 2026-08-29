# Turns: who is working, whose input counts, what is being worked on

Design for the collaborative workspace, 29 Aug 2026, as built. Turns belong to objects,
never to the room as a whole; nobody waits for a global lock and nobody waits for a human.

The rule the whole feature is measured against: **easy to use, useful, secure, and it gets
the work done.** Nothing here asks a person for permission, nothing here makes an agent
queue behind another agent, and the only thing ever handed back is the one write that
would delete work somebody just did.

## Claims: who is working on what
- **A claim is taken by writing.** Any write claims the object it touched for that caller
  (`create_category`, `upsert_dataset_summary`, `report_monitor_run`), the caller's next
  write refreshes it, and the write that finishes the work (`upsert_dashboard`,
  `compose_overview`, `set_policy`, `resolve_feedback`) hands it back. It expires after 10
  minutes of quiet. A person editing on the page claims the same way, with no toggle to
  press: editing is the claim.
- `claim` and `release` exist and are optional: say early that a long job is starting, or
  that an abandoned one is over. Neither takes an object away from somebody else.
- The card shows the holder, "Maria's agent is working on this · 4 min", and presence
  carries the same line: "2 people, 2 agents · Maria's agent on Invoices". Both are
  information. **A claim never refuses anybody.**

## Requests: the handoff
- A note addressed to an agent, a person, or everyone is that party's turn. Resolving it
  hands the turn back with a resolution line. The room thread is the visible queue of open
  turns, one click from the header.
- `get_workspace` tells each caller "You hold: <targets>. You have N open requests." so an
  agent starts every task by reading what was asked of it.

## Versions: whose input counts
- Reads return `updatedAt`. Writes may carry `expectedUpdatedAt`; it is optional.
- A write that lands inside 60 seconds of somebody else's write on the same object, or
  that carries a stale `expectedUpdatedAt`, is **merged rather than refused**: charts by
  id, KPIs by label, notes and highlights appended. The reply says what was kept:
  "Maria's agent changed this 20 s ago; your change was applied on top and their chart
  "By supplier" kept."
- The single refusal is a true same-field collision, the same chart id or the same KPI
  label changed twice inside that window: "Maria's agent changed chart "By supplier" 20 s
  ago and this would delete it. Call get_dashboard again, then send your change on top."
  The board is unchanged and the refusal is audited as a failure, so both humans see it.
- Rooms sync patches last-writer-wins per object; the merge makes that safe in practice,
  because a second agent's write no longer erases the first one's additions.

## Precedence
1. A person's edit or decision on an object beats an agent's, always. It takes the badge,
   it is never refused, and the agent learns about it on its next call.
2. Between agents, the last writer wins the field it touched and everything the other one
   added survives.
3. Nothing here asks a human to unblock it. People get decisions (held drafts) and
   information (badges, the room thread, the audit rail), never gates.

## What people see
- Card badges for claims, presence with work in progress, the room thread of open
  requests, and the audit rail for the history, including every refusal.
