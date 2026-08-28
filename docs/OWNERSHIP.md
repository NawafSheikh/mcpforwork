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
