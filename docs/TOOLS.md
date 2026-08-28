# WebMCP tool contract (MCP for Work)

**24 tools**, in three sections: 18 board and monitor tools, 2 room tools, 4 dataset tools.
They live in one registry and one name space (`src/webmcp/schemas.ts` merges
`roomToolSchemas` and `datasetToolSchemas` into `toolSchemas`), so the header pill counts
all 24 and the sections below are for reading, not for wiring.

All tools register once, in the top-level page, via `document.modelContext.registerTool`
(fallback `navigator.modelContext`). Tabs are React state, never navigation, so tools
survive the whole session. Every call is validated with zod, audited, rate-limited
(LIMITS.maxToolCallsPerMinute) and returns a string under LIMITS.toolOutputChars.
Descriptions stay under 500 chars, parameter descriptions under 150 chars.

Tools that echo text derived from the visitor's data (email subjects, document names)
set `untrustedContentHint: true`. All read tools set `readOnlyHint: true`.

## Board and monitors (18 tools)

| Tool | RO | Input (zod) | Effect | Returns |
|---|---|---|---|---|
| get_workspace | yes | {} | none | JSON: mode, categories [{name, description, hasSummary, hasDashboard}], overview present?, monitors [{id, name, schedule, status, nextRunAt}], pendingDrafts count, heldDrafts count |
| create_category | no | {name: string(1..60), description?: string(..300), provenance?: string(..200)} | upsert category by name | "Category X ready. Next: upsert_dataset_summary or upsert_dashboard." |
| upsert_dataset_summary | no | {category, counts?: record<number>, sums?: record<number>, top?: record<[{label,value}]>, period?, rowCount?} | store aggregates, never rows | confirmation with what was stored |
| upsert_dashboard | no | {category, title?, kpis: KPI[1..4], charts?: Chart[0..4], notes?: string[0..6], source?} | replace dashboard for category | "Dashboard for X rendered with N KPIs and M charts." |
| get_dashboard | yes | {category} | none | JSON spec (so the agent edits instead of rebuilding) |
| compose_overview | no | {title, kpis: KPI[1..6], charts?: Chart[0..4], highlights?: string[0..6]} | replace overview | confirmation |
| register_monitor | no | {name, category, schedule: string (cron or "every morning 08:00"), policy: Policy, runner: "local"|"cloud"} | create monitor, compute nextRunAt | "Monitor X registered, runs {schedule} as {runner}. Policy: ... Create the matching ChatGPT scheduled task with this prompt: ..." |
| report_monitor_run | no | {monitorId, findings: string[0..20], drafts: [{kind, target, summary, amount?, fields?}][0..20]} | append run; each draft goes through the policy engine: auto, pending, or held with clause | summary of auto/pending/held counts with held reasons |
| list_monitors | yes | {} | none | JSON monitors with last/next run |
| get_run_log | yes | {monitorId?, limit?: 1..20} | none | JSON runs with findings and draft statuses |
| approve_draft | no | {draftId, note?} | policy check first; refuses out-of-policy and names the clause; else marks approved by agent | "Approved ..." or "Refused: clause <name>: <reason>. A human can approve it from the Monitors tab." |
| decline_draft | no | {draftId, reason?} | mark declined | confirmation |
| set_policy | no | {monitorId, policy: Policy} | replace policy; UI shows a diff | confirmation with diff summary |
| list_feedback | yes | {target?: {kind, id}, includeResolved?: boolean} | none | JSON list of open feedback left by humans on dashboards, the overview, drafts and monitors, newest first. Agent calls this before editing anything. (untrustedContentHint) |
| resolve_feedback | no | {feedbackId, resolution: string(..200)} | mark resolved by agent | confirmation |
| share_board | yes | {} | none | a read-only snapshot URL of the current board (state compressed into the URL fragment, never sent to a server) |
| seed_demo_workspace | no | {} | demo mode only: load the sample workspace | confirmation |
| clear_workspace | no | {confirm: true} | wipe categories, overview, monitors, runs, drafts (audit kept) | confirmation |

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
