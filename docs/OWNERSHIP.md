# Path ownership (parallel build, 28 Aug 2026)

One owner per path. Others read but never edit. Shared types in src/types.ts and the tool
contract in docs/TOOLS.md change only through the orchestrator.

| Owner | Paths | Delivers |
|---|---|---|
| A1 dsl | src/dsl/** | DashboardSpec and OverviewSpec renderers (recharts), KPI cards, table, empty states, validation helpers for the DSL |
| A2 store+webmcp | src/store/**, src/webmcp/** | WorkspaceStore on idb-keyval with in-memory demo fallback, zod schemas, tool registry, rate limiter, audit writer, registerAll() |
| A3 policy+monitors | src/policy/**, src/monitors/**, packages/** | policy engine (ported from mcpforwork-d365-control-plane packages), schedule parsing and nextRunAt, demo run simulator, draft state machine, report_monitor_run and approve_draft logic |
| A4 shell | src/shell/**, src/App.tsx, src/main.tsx, src/styles/** , public/** | app shell, tabs, WebMCP status pill, audit rail, monitors UI with human approve, policy diff, landing copy, seed button |
| A5 live+deploy | src/live/**, src/demo/**, README.md, docs/DESCRIPTION.md, docs/DEPLOY.md, vercel.json | live adapter to clawai.eu API (Supabase auth), demo sample workspace, README, submission description draft, deploy config |

Rules for every owner:
- Immutable state: return new objects, never mutate.
- Files under 400 lines, functions under 50 lines, no console.log in shipped code.
- Validate every tool input with zod at the boundary; never trust the agent.
- No employer, client or personal data anywhere: sample data is synthetic and obviously so.
- No commits: the orchestrator commits per wave.
- No new dependencies beyond package.json without asking the orchestrator.
- Never grep or list node_modules.

# Wave 2 ownership (28 Aug 2026, evening)

| Owner | Paths | Delivers |
|---|---|---|
| A6 feedback+attribution | src/webmcp/**, src/store/**, src/feedback/**, src/shell/AgentRail.tsx, src/shell/tabs/Activity.tsx | optional `caller` on every tool, shown in the rail; list_feedback and resolve_feedback tools; feedback store helpers; FeedbackBox UI exported from src/feedback/ui; share_board tool wired to src/share when it exists |
| A7 board editing | src/dsl/**, src/shell/tabs/Board.tsx, src/shell/tabs/board/** | y-axis fix, inline human editing (rename, reorder, pin, delete chart), "Ask the agent" targeted prompts, FeedbackBox mounted on every dashboard and the overview, readOnly mode for shared snapshots |
| A9 share+header+docs | src/share/**, src/App.tsx, src/main.tsx, src/shell/Header.tsx, src/shell/tabs/About.tsx, src/shell/lib/constants.ts, src/demo/**, README.md, docs/DESCRIPTION.md, docs/VIDEO_SCRIPT.md | share snapshot in the URL fragment and read-only rendering, Share button, verified ChatGPT browser path, scoped starter prompts, sample feedback, docs updated with real-run evidence |

# Wave 3 ownership (28 Aug 2026, night)

| Owner | Paths | Delivers |
|---|---|---|
| A10 rooms | src/rooms/** (new), docs/TOOLS.md "## Rooms" section, this row block | multiplayer board rooms: `?room=<slug>` in the query, entity-level patch sync with last-writer-wins, full-state snapshot for late joiners, presence (`usePresence`), one shared audit rail, `get_room` and `create_room` tools; transport is Supabase Realtime public broadcast over hand-rolled phoenix frames (no SDK, no table, no new dependency) behind a `RoomTransport` interface, with a BroadcastChannel fallback for a single browser profile. Mount points and the five-step wiring are in `src/rooms/INTEGRATION.md`; the orchestrator wires the store key switch (`roomStoreKey`), `configureRooms`, the two tool merges, the Header "Invite to room" button and the presence chip. |

# Wave 3 ownership, datasets (28 Aug 2026)

| Owner | Paths | Delivers |
|---|---|---|
| A11 datasets | src/dataset/** , the "## Datasets" section of docs/TOOLS.md, this row block | Drop a CSV or XLSX on the board and the agent never sees a row: client-side papaparse/SheetJS parsing, column profiling with masking, an in-memory-only registry, and four tools (list_datasets, get_dataset_profile, aggregate_dataset, attach_dataset_to_category) exported with their zod schemas, JSON Schemas, annotations and handler map. DropZone + ProfileCard UI with progress, caps, error state and "Forget this file". Mount points and wiring in src/dataset/INTEGRATION.md; the orchestrator wires the shell and the registry. |

# Wave 3 ownership, editable guardrails and prompts (28 Aug 2026)

| Owner | Paths | Delivers |
|---|---|---|
| A13 guardrails+prompts | src/shell/tabs/PolicyEditor.tsx, src/shell/tabs/policy/** , src/prompts/** , this row block, plus one mount edit in src/shell/Header.tsx (three lines: the `../prompts` import and the `<PromptLibrary />` and `<Backup />` buttons in HeaderActions) | Guardrails as a form instead of a JSON textarea: a 0 to 50 stepper with the sentence it means, threshold rows (field with suggestions, operator, value, label), chips for "always ask a human for", the allowlist and the denylist, notes, a live describePolicy sentence and a diffPolicy preview against the saved policy. "Edit as JSON" keeps the old textarea for power users, synced both ways and validated inline with the same zod policySchema the set_policy tool uses; an invalid form cannot save. Saving still goes through setMonitorPolicy, so it is a set_policy call audited as actor "human". src/prompts is the prompt library: templates in localStorage under "mfw:prompts" (versioned, capped at 20 prompts and 1000 characters, per-prompt and whole-library reset), seeded from STARTER_PROMPT, QUICK_PROMPT and MONITOR_PROMPT with {{threads}} and {{category}} lifted out and filled at copy time. Also the Backup popover: download the board as plain JSON (the share snapshot, so feedback travels and the audit trail does not) and restore one back through fromSnapshot with a confirm step, audited as actor "human", tool "restore". Note for whoever owns the copy buttons: Hero and Board can switch from the STARTER_PROMPT constant to `getPrompt("starter")` from src/prompts once A12 lands, and they then pick up the user's own edit for free. |
