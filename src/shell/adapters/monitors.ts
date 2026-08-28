/**
 * ADAPTER: monitor actions and the demo scheduler. Wired to src/monitors (A3).
 * Human decisions go through humanDecide, so they are audited as actor "human".
 */
import { humanDecide, set_policy, simulateRun, startDemoScheduler } from "../../monitors";
import type { Policy, Workspace, WorkspaceStore } from "../../types";
import { withAudit } from "./store";

export type HumanDecision = "approved" | "declined";

const DEMO_TICK_MS = 20_000;

/** A human decision always lands: the approve button is never disabled. */
export async function decideDraft(
  store: WorkspaceStore,
  draftId: string,
  decision: HumanDecision,
): Promise<string> {
  const outcome = humanDecide(store.get(), draftId, decision);
  const next = outcome.next;
  if (next) await store.update((): Workspace => next);
  return outcome.result;
}

export async function setMonitorPolicy(
  store: WorkspaceStore,
  monitorId: string,
  policy: Policy,
): Promise<string> {
  const outcome = set_policy({ monitorId, policy }, store.get());
  if (!outcome.next) return outcome.result;
  const next = withAudit(outcome.next, {
    actor: "human",
    tool: "set_policy",
    args: { monitorId },
    result: outcome.result,
  });
  await store.update((): Workspace => next);
  return outcome.result;
}

/** Demo only: make a monitor report back right now. */
export async function runMonitorNow(store: WorkspaceStore, monitorId: string): Promise<void> {
  const now = new Date();
  await store.update((current) => simulateRun(current, monitorId, now));
}

export function startScheduler(store: WorkspaceStore): () => void {
  return startDemoScheduler(store, { tickMs: DEMO_TICK_MS });
}
