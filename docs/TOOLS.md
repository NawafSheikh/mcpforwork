# WebMCP tool contract (MCP for Work)

All tools register once, in the top-level page, via `document.modelContext.registerTool`
(fallback `navigator.modelContext`). Tabs are React state, never navigation, so tools
survive the whole session. Every call is validated with zod, audited, rate-limited
(LIMITS.maxToolCallsPerMinute) and returns a string under LIMITS.toolOutputChars.
Descriptions stay under 500 chars, parameter descriptions under 150 chars.

Tools that echo text derived from the visitor's data (email subjects, document names)
set `untrustedContentHint: true`. All read tools set `readOnlyHint: true`.

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
| seed_demo_workspace | no | {} | demo mode only: load the sample workspace | confirmation |
| clear_workspace | no | {confirm: true} | wipe categories, overview, monitors, runs, drafts (audit kept) | confirmation |

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
