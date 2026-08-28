/**
 * The seeded demo workspace: a finished board a judge can look at in one second,
 * without a login, without a connector, and without spending a token.
 *
 * Every timestamp is derived from the `now` argument, so the sample always looks
 * like it was produced this morning. All company names are synthetic and obviously
 * so ("Acme Test Ltd", "Sample Supplies GmbH", "Example Recruiting").
 */
import { LIMITS, type Workspace } from "../types";
import { demoClock } from "./clock";
import { sampleCategories } from "./sampleCategories";
import { sampleFeedback } from "./sampleFeedback";
import {
  sampleAudit,
  sampleDrafts,
  sampleMonitors,
  sampleOverview,
  sampleRuns,
} from "./sampleOps";

export { DEMO_PROVENANCE } from "./sampleCategories";
export {
  DEMO_FEEDBACK_DRAFT,
  DEMO_FEEDBACK_INVOICES,
  DEMO_FEEDBACK_OVERVIEW,
  DEMO_FEEDBACK_TICKETS,
} from "./sampleFeedback";
export {
  CLAUSE_AMOUNT,
  CLAUSE_REQUIRE_HUMAN_PAY,
  DEMO_MONITOR_INVOICES,
  DEMO_MONITOR_TICKETS,
} from "./sampleOps";

export const DEMO_WORKSPACE_ID = "ws_demo";
export const DEMO_WORKSPACE_NAME = "Sample workspace (synthetic)";

/**
 * Build the full sample workspace. Pure: same `now` in, same workspace out.
 * Never mutates anything and never reads storage.
 */
export function sampleWorkspace(now: Date): Workspace {
  const clock = demoClock(now);
  return {
    id: DEMO_WORKSPACE_ID,
    name: DEMO_WORKSPACE_NAME,
    mode: "demo",
    categories: sampleCategories(clock),
    overview: sampleOverview(clock),
    monitors: sampleMonitors(clock),
    runs: sampleRuns(clock),
    drafts: sampleDrafts(clock),
    feedback: sampleFeedback(clock),
    audit: sampleAudit(clock),
    updatedAt: clock.nowIso,
  };
}

/** What seed_demo_workspace hands back to the tool registry. */
export interface SeedDemoOutcome {
  readonly next?: Workspace;
  readonly result: string;
}

/**
 * Handler for the seed_demo_workspace tool.
 * Demo mode only: in live mode it refuses rather than overwriting a real board.
 * The input is ignored on purpose (the tool takes no arguments), but it is accepted
 * as `unknown` so the registry can pass whatever the agent sent without casting.
 */
export function seedDemoHandler(input: unknown, ws: Workspace): SeedDemoOutcome {
  void input;
  if (ws.mode !== "demo") {
    return {
      result:
        "Refused: seed_demo_workspace only runs in demo mode. This workspace is live, " +
        "and seeding would overwrite real categories and monitors. Switch to demo mode first.",
    };
  }
  const seeded = sampleWorkspace(new Date());
  const next: Workspace = {
    ...seeded,
    id: ws.id,
    name: ws.name,
    // Keep the existing audit trail: seeding is an event in the history, not a reset of it.
    audit: [...ws.audit, ...seeded.audit].slice(-LIMITS.maxAuditEvents),
  };
  const categoryCount = Object.keys(next.categories).length;
  const monitorCount = Object.keys(next.monitors).length;
  const draftCount = Object.keys(next.drafts).length;
  const noteCount = Object.keys(next.feedback).length;
  return {
    next,
    result:
      "Sample workspace loaded: " +
      categoryCount +
      " categories with dashboards, an overview, " +
      monitorCount +
      " monitors, " +
      next.runs.length +
      " runs, " +
      draftCount +
      " drafts (2 held) and " +
      noteCount +
      " notes (3 open). All data is synthetic. Call get_workspace or list_feedback to see it.",
  };
}
