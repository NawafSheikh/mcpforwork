# WebMCP tool contract (MCP for Work)

**34 tools**, in six sections: 18 board and monitor tools, 2 room tools, 4 dataset tools,
3 turn tools, 2 capability tools, 5 workspace tools. They live in one registry and one
name space (`src/webmcp/schemas.ts` merges `roomToolSchemas`, `datasetToolSchemas`,
`turnToolSchemas`, `capabilityToolSchemas` and `workspaceToolSchemas` into `toolSchemas`),
so the header pill counts all 34 and the sections below are for reading, not for wiring.

Every one of the 34 belongs to exactly one **pack**, and a pack has a switch on the page.
A tool whose pack is off is unregistered from `document.modelContext` and refused by the
registry; see "## Packs" below.

All tools register once, in the top-level page, via `document.modelContext.registerTool`
(fallback `navigator.modelContext`). Tabs are React state, never navigation, so tools
survive the whole session. Every call is validated with zod, audited, rate-limited
(LIMITS.maxToolCallsPerMinute) and returns a string under LIMITS.toolOutputChars.
Descriptions stay under 500 chars, parameter descriptions under 150 chars.

Tools that echo text derived from the visitor's data (email subjects, document names)
set `untrustedContentHint: true`. All read tools set `readOnlyHint: true`.

## Board and monitors (19 tools)

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| get_workspace | yes | {} | none | JSON: mode, categories [{name, description, hasSummary, hasDashboard, updatedAt}], overview present?, monitors [{id, name, schedule, status, nextRunAt}], pendingDrafts count, heldDrafts count. Ends with "You hold: &lt;targets&gt;. You have N open requests." for the `caller` that asked |
| create_category | no | {name: string(1..60), description?: string(..300), provenance?: string(..200)} | upsert category by name | "Category X ready. Next: upsert_dataset_summary or upsert_dashboard." |
| upsert_dataset_summary | no | {category, counts?: record<number>, sums?: record<number>, top?: record<[{label,value}]>, period?, rowCount?} | store aggregates, never rows | confirmation with what was stored |
| upsert_dashboard | no | {category, title?, kpis: KPI[1..4], charts?: Chart[0..4], notes?: string[0..6], source?, expectedUpdatedAt?} | replace dashboard for category, merged with anything a fresh write added (see Turns) | "Dashboard for X rendered with N KPIs and M charts." plus, when it landed on somebody else's change, "&lt;who&gt; changed this 20 s ago; your change was applied on top and their chart "By supplier" kept." |
| get_dashboard | yes | {category} | none | JSON spec including `updatedAt`, which the next upsert_dashboard may send back as `expectedUpdatedAt` (so the agent edits instead of rebuilding) |
| compose_overview | no | {title, kpis: KPI[1..6], charts?: Chart[0..4], highlights?: string[0..6], expectedUpdatedAt?} | replace overview, merged the same way as a dashboard | confirmation |
| register_monitor | no | {name, category, schedule: string (cron or "every morning 08:00"), policy: Policy, runner: "local"|"cloud"} | create monitor, compute nextRunAt | "Monitor X registered, runs {schedule} as {runner}. Policy: ... Create the matching ChatGPT scheduled task with this prompt: ..." |
| report_monitor_run | no | {monitorId, findings: string[0..20], drafts: [{kind, target, summary, amount?, fields?}][0..20]} | append run; each draft goes through the policy engine: auto, pending, or held with clause | summary of auto/pending/held counts with held reasons |
| list_monitors | yes | {} | none | JSON monitors with last/next run and `updatedAt` for `expectedUpdatedAt` |
| get_run_log | yes | {monitorId?, limit?: 1..20} | none | JSON runs with findings and draft statuses |
| approve_draft | no | {draftId, note?} | policy check first; refuses out-of-policy and names the clause; else marks approved by agent | "Approved ..." or "Refused: clause <name>: <reason>. A human can approve it from the Monitors tab." |
| decline_draft | no | {draftId, reason?} | mark declined | confirmation |
| set_policy | no | {monitorId, policy: Policy, expectedUpdatedAt?} | replace policy; UI shows a diff | confirmation with diff summary, or the read-again line when it would overwrite a policy somebody changed in the last minute |
| add_feedback | no | {target: {kind, id}, text: string(1..500)} | append a note authored by the agent, signed `from` the caller (or ChatGPT) | "Note left for &lt;target&gt;. Agents in this room see it through list_feedback." |
| list_feedback | yes | {target?: {kind, id}, includeResolved?: boolean} | none | JSON rows: id, target, `for` (the same target, under the name an addressed note reads by), `from`, `author`, `authorKind` ("person" or "agent"), text, createdAt, resolved, and `addressedTo` on notes handed to an agent. Open notes newest first, agent-addressed ones included; pass `caller` and the notes addressed to that name, or to "*", come first. Rows are dropped from the end until the JSON fits the budget. (untrustedContentHint) |
| resolve_feedback | no | {feedbackId, resolution: string(..200)} | mark resolved by agent | confirmation, naming `from` when the note was signed |
| share_board | yes | {} | none | a read-only snapshot URL of the current board (state compressed into the URL fragment, never sent to a server) |
| clear_workspace | no | {confirm: true} | wipe categories, overview, monitors, runs, drafts (audit kept) | confirmation |

### Feedback targets: the board, and the people on it

`FeedbackTarget.kind` is one of `dashboard` (id = category), `overview`, `draft`, `monitor`,
`agent` (id = the other agent's `caller` name, or `*` for any agent in the room), `person`
(id = a person's display name, or `*` for everyone) and `room` (id = `room`): the last three
are how one visitor's agent hands work to another visitor's agent or asks a named human for
something, with both humans watching the same rows in the rail. get_workspace ends with
"Open feedback: N (M addressed to agents). Call list_feedback before editing." whenever any
open note is addressed to an agent or to the room.

## Common optional field on EVERY tool
`caller?: string(..40)`: the agent or sub-agent names itself ("Classify 1-25"). Stored on the audit event and shown in the Agent activity rail so parallel workers are visible. Never trusted for anything else.

## Zod shapes (source of truth lives in src/webmcp/schemas.ts)

- KPI: {label: string(1..40), value: string|number, delta?: string(..20), hint?: string(..80)}
- ChartPoint: {label: string(1..40), value: number, series?: string(..30)}
- Chart: {kind: "bar"|"line"|"donut"|"table", title: string(1..80), points: ChartPoint[0..12], columns?: string[0..8], rows?: (string|number)[][0..20], note?: string(..160)}
- Policy: {maxAutoActionsPerRun: int 0..50, thresholds?: [{field, op, value, label?}][0..10], allowlist?: string[0..50], denylist?: string[0..50], requireHumanFor?: string[0..20], notes?: string(..300)}

## Policy semantics (src/policy owns the engine)
A draft is:
- "held" (heldReason = clause) if any threshold matches its amount/fields, if its kind or target hits the denylist, if its kind is in requireHumanFor, or if the run already auto-approved maxAutoActionsPerRun drafts;
- "auto" if the policy allows it and an allowlist (when present) contains its kind or target;
- "pending" otherwise (waits for the agent's approve_draft or a human).
approve_draft by the agent re-runs the same check and refuses held drafts with the clause name. Humans in the UI can approve anything; their decision is audited as actor "human".

## Rooms
Multiplayer boards. A room is a short slug in the URL query (`?room=abc123`, never the
fragment, which belongs to `#share=`). Every browser holding the slug keeps its own
workspace and gossips entity-level patches; last writer wins per (kind, key). Owner A10,
`src/rooms/**`, wiring in `src/rooms/INTEGRATION.md`.

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| get_room | yes | {} | none | JSON: {room, url, relay, status, people, agents, here, peers[{label, agent, you}]} or "Not in a room. This board is local to this browser. Call create_room to open one and get a link to share." (untrustedContentHint: peer labels are typed by other visitors) |
| create_room | no | {} | mints a slug, switches sync on for this board, hands the URL back; the workspace itself is unchanged | "Room abc123 is open and this board is now the shared board. Send this link: https://mcpforwork.com/?room=abc123 ..." or, when a room is already open, the existing link plus who is here |

Every room is encrypted end to end: creating one mints a 256 bit secret, the invite link
carries it in the fragment (`?room=<slug>#k=<secret>`) which no browser sends to a server,
and the transport is wrapped so the relay only ever carries `{v, iv, ct, fp}` (src/crypto,
`sealedTransport` in src/rooms/sealed.ts). There is no setting and no passphrase; a room
link with the fragment trimmed off cannot be opened and says so instead of joining.

Transport: a Supabase Realtime public broadcast channel (`private: false`), spoken as
hand-rolled phoenix frames over the native WebSocket, using `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. No table, no RLS policy, no new npm dependency. Without those
variables it falls back to BroadcastChannel, which reaches other tabs of the same browser
profile only and is labelled as such. `RoomTransport` is the seam: a Cloudflare Durable
Object replaces one file.

Honest limits, stated in the UI too: a room is unlisted, not private, so anyone with the
link can read and write the board; there is no sign-in in v1; and the relay never keeps
your board, because there is nothing behind the channel to keep it in. The audit rail IS
shared inside a room, on purpose, so callers and humans from every browser land in one
trail. Malformed patches from a peer are dropped and written to that rail as actor
`system`, tool `room_sync`.

## Turns (3 tools, owner A16, src/turns)

Two people and their agents edit one board. Turns keep that honest without making anybody
wait: claims say who is working on what, versions say whose input counts, and neither ever
asks a human for permission. The design is docs/TURNS.md.

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| claim | no | {target: {kind: "dashboard"\|"overview"\|"monitor"\|"note", id}} | optional: puts the caller's name on one object for 10 minutes | "Your name is on dashboard Invoices until 23:50 ... It blocks nobody." or, when somebody else is on it, their name and how long, with no refusal |
| release | no | {target} | optional: takes the caller's own name off | "Your name is off dashboard Invoices." Somebody else's name is never touched |
| list_claims | yes | {} | none | JSON: claims [{target, holder, holderKind, held, since, expiresAt}]. Expired claims are never listed. (untrustedContentHint) |

### Claims: who is working on what
- **Automatic.** Any write claims the object it touched for that caller: `create_category`,
  `upsert_dataset_summary` and `report_monitor_run` take it, the caller's next write
  refreshes it, and the write that finishes the work (`upsert_dashboard`,
  `compose_overview`, `set_policy`, `resolve_feedback`) hands it back. Ten quiet minutes
  and it expires. A person's edit on the page claims in exactly the same way; there is no
  button to press and no permission to ask for.
- **`claim` and `release` are optional**, for saying early that a long job is starting, or
  that an abandoned one is over. Neither can take an object away from somebody else.
- The card shows the holder ("Maria's agent is working on this &middot; 4 min") and presence
  carries the same line. It is information, never a lock.

### Versions: whose input counts
- Reads return `updatedAt`: per category in `get_workspace`, on the spec in `get_dashboard`,
  per monitor in `list_monitors`. Writes may send it back as `expectedUpdatedAt`.
- A write that lands inside 60 seconds of somebody else's, or that carries a stale
  `expectedUpdatedAt`, is **merged, not refused**: charts by id, KPIs by label, notes and
  highlights appended, and the reply names what was kept.
- The one refusal is a true collision: the same chart id or the same KPI label, changed
  twice. It comes back as "&lt;who&gt; changed chart "By supplier" 20 s ago and this would
  delete it. Call get_dashboard again, then send your change on top.", the workspace
  unchanged, and audited as a failure so both humans see it in the rail. A policy is one
  field, so an unrelated policy written over a fresh one refuses the same way.

### Precedence
1. A person's edit or decision beats an agent's, always: it takes the badge and it is
   never refused.
2. Between agents, whoever writes last wins the field they touched, and everything the
   other one added survives the merge.
3. Nothing in the turn model asks a human to unblock it. Humans get decisions (held
   drafts) and information (badges, the room thread, the rail), never gates.

## Packs (owner A20, src/packs and src/capabilities)

Every published tool belongs to exactly one pack, and a pack is one switch in the Tools
panel (docs/PACKS.md). `src/packs/registry.ts` is the grouping; a test asserts it is
exactly `TOOL_NAMES`, each name once, so a tool can never end up with no switch over it.

| Pack | Risk | Tools | What it is |
|---|---|---|---|
| board | write | 7: get_workspace, create_category, upsert_dataset_summary, upsert_dashboard, get_dashboard, compose_overview, clear_workspace | categories, dashboards and the overview |
| datasets | write | 4: list_datasets, get_dataset_profile, aggregate_dataset, attach_dataset_to_category | profile and aggregate dropped files; rows never leave the browser |
| notes | write | 3: add_feedback, list_feedback, resolve_feedback | requests in all four directions |
| turns | write | 3: claim, release, list_claims | claims and versions |
| monitors | send | 7: register_monitor, report_monitor_run, list_monitors, get_run_log, approve_draft, decline_draft, set_policy | policies, runs and the approval queue: the pack that can act on the outside |
| rooms | write | 5: get_room, create_room, share_board, publish_capabilities, list_capabilities | invite, presence and the capability cards |
| workspaces | write | 5: list_workspaces, create_workspace, switch_workspace, rename_workspace, save_workspace | more than one board in this browser, one per project |

`risk` is `read`, `write`, `send` or `move`, worst case first in the panel. `move` is the
level above `send`: it is the one that can knock something over, and only a bridge pack
carrying a robot profile with a stop and a boundary is ever allowed to be one.

### Switching
- **Defaults**: everything on. In a room, a pack whose risk is `send` or `move` starts
  **off**, because a room is other people's tools as well as yours. A pack nobody has
  touched carries no state at all, so every peer computes the same default from the same
  rules; a hand-flipped switch is stored on the Workspace as `packs[id]` and syncs as the
  `pack` entity, last writer wins.
- **Who**: outside a room, the person looking at the page. Inside a room, only the host,
  and everybody else sees the switches disabled with the reason. Rooms exposes no host
  yet, so the fallback is the lowest client id in presence, which every browser computes
  identically.
- **Effect**: switching a pack off unregisters exactly its tools from
  `document.modelContext` at once (one AbortController per pack), so an agent mid-task
  loses them on its next call. A call that arrives anyway is refused by the registry with
  `The <pack> pack is off in this room; ask the host.` and audited as `ok: false`.

### Capability tools (2 tools, part of the `rooms` pack)

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| publish_capabilities | no | {owner?: {kind: "person"\|"agent"\|"robot", name}, local?: string[0..12], knows?: string[0..12]} | store one card, keyed by owner name; `packs` is measured from the switches, never declared | confirmation naming the packs on, what is held locally and what the owner knows |
| list_capabilities | yes | {} | none | JSON: capabilities [{name, kind, packs, local, knows, updatedAt}], newest first, trimmed from the end to fit. (untrustedContentHint) |

A card says what one person, agent or robot can reach. It is a description, never a
permission: publishing one unlocks nothing and not having one denies nothing. The point is
that an agent can find who has access to a system before asking for it, and then address
the request with `add_feedback` to that name instead of guessing.

### Bridge packs (local, not on the site)
A visitor can switch on **Local bridge** in the panel, which connects to
`ws://127.0.0.1:7331` (never automatically) and turns each pack the bridge serves into a
pack on this page, registered the same way and unregistered the whole way on disconnect.
The wire protocol is mcpforwork-bridge/docs/CONTRACT.md; the page needs
`connect-src ws://127.0.0.1:* ws://localhost:*` in its CSP. Bridge tool names are not in
`TOOL_NAMES` and are not counted by the header pill.

## Workspaces (5 tools, src/workspaces)

A workspace is one piece of work and everybody in it: the people, their agents, what each
is doing and what they have asked of each other. One browser holds many, each a whole
Workspace object under its own IndexedDB key, listed in a small directory
(`mfw:workspaces`) that says which one is open and what each holds. The default workspace
keeps the key every board used before this existed, so nobody's work moved. Saving is
automatic a moment after every change; `save_workspace` flushes and reports what is
actually stored.

The agent uses these to keep one job out of another job's way: `create_workspace` for a
new piece of work, `switch_workspace` to go back to an earlier one, `save_workspace` to
close a run with a line saying what is in it.

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| list_workspaces | yes | {} | none | JSON: workspaces [{id, name, open, holds, work, openRequests, savedAt}], the open one, and whether everything is on disk. (untrustedContentHint) |
| create_workspace | no | {name: string(1..60), note?: string(..200), activate?: boolean} | new empty board under a new key; the board being left is written first; opens it unless activate is false | "Workspace X is open and empty..." naming where the old board went |
| switch_workspace | no | {workspace: name or id} | saves this workspace, opens the other | "Now on X: 3 things on the go, 1 request waiting." Refused while this is a room |
| rename_workspace | no | {name: string(1..60)} | rename the open workspace and its board together | confirmation; a name already taken here gets a number added |
| save_workspace | no | {note?: string(..200)} | flush to IndexedDB now and stamp the entry | "Saved X in this browser: 3 things on the go, 1 request waiting." or the reason nothing could be stored |

**There is no delete tool, deliberately.** Removing somebody's saved work is a person's
action, from the Workspaces panel, behind a confirm.

**A room board is not a workspace.** While the board is a shared room it belongs to the
room, so create, rename, copy and save are all held with one sentence saying why, and
nothing about the room board is stamped into a workspace entry. Switching is still
allowed and is the way out: it reloads the page onto the chosen workspace, leaving the
room. The site tool refuses that, because navigating a page out from under the people in
a room is a person's decision, not an agent's.

## Datasets (4 tools, owner A11, src/dataset)

A human drops a CSV or XLSX on the board. The file is parsed and profiled in their
browser: raw rows live in a module-level Map that dies with the tab, never in the
Workspace, never in IndexedDB, never in a share URL and never in a tool result. The
agent gets the shape of the data and any aggregate it asks for, and nothing else.

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| list_datasets | yes | {} | none | JSON: datasets [{name, rows, profiledAt, columns ["name:type", ...]}] plus the rows-stay-here note. Empty answer tells the agent to ask for a file. (untrustedContentHint) |
| get_dataset_profile | yes | {dataset: string(1..120)} | none | JSON per column: name, type (number/date/boolean/text/empty), nullRate, distinct, min/max/mean/sum for numbers, from/to for dates, top 8 as [label, count] or topWithheld ("emails" or "high-cardinality"); plus 3 example rows with every value masked. Shrinks in whole sections to stay under toolOutputChars. (untrustedContentHint) |
| aggregate_dataset | yes | {dataset, groupBy: column, metric: {column, op: count\|sum\|mean\|min\|max}, top?: 1..12, filter?: {column, op: eq\|neq\|gt\|lt\|contains, value: string\|number\|boolean}} | none | JSON: at most LIMITS.maxPointsPerChart labelled points computed in the browser, plus groups, rowsMatched, skippedBlankOrNonNumeric, singleRowGroupsHidden. Points feed straight into upsert_dashboard. (untrustedContentHint) |
| attach_dataset_to_category | no | {dataset, category: string(1..60)} | upsert category with the PROFILE as its DatasetSummary | confirmation naming what was stored and the provenance "from &lt;file&gt;, profiled in this browser, rows never left the page" |

### Masking rules (src/dataset/mask.ts, tested in src/dataset/__tests__)
- **Emails**: any value matching an email pattern becomes `user@…`, whole value, in sample rows and in labels alike. A column with one address anywhere has its top list withheld entirely and cannot be used as `groupBy`: that call is refused.
- **Sample rows**: text becomes the constant `abc…`, numbers become magnitude buckets (`~1.2k`, `~84k`, `~2.4b`), dates keep the month and lose the day (`2026-08-…`), booleans stay as `true`/`false`, blanks stay blank. Two different names produce the identical token, so nothing is inferable.
- **Labels**: a category label is the one real value that survives, cut to 40 characters. It is only published when the value appears at least twice: a value seen once is a row, not a category. The same rule drops single-row groups from `aggregate_dataset` and reports them as `singleRowGroupsHidden`.
- **Exact cells published, by contract**: a numeric column's `min` and `max`. Those two, and no others.
- Phone-style digits ("+356 9912 3311") are text, not numbers, so they never surface as a min or a max.

### Caps
5 MB or 100,000 rows or 64 columns, whichever is hit first; 8 datasets in memory at a time. Over the cap the drop zone shows an error and nothing is loaded.
