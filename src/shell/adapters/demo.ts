/**
 * ADAPTER: sample workspace. Wired to src/demo (A5).
 * Seeding keeps the existing audit trail: it is an event, not a reset.
 */
import { seedDemoHandler } from "../../demo/sampleWorkspace";
import type { WorkspaceStore } from "../../types";
import { withAudit } from "./store";

/** Loads the synthetic sample workspace. Returns what to tell the human. */
export async function seedSampleWorkspace(store: WorkspaceStore): Promise<string> {
  const outcome = seedDemoHandler({}, store.get());
  if (!outcome.next) return outcome.result;
  const seeded = withAudit(outcome.next, {
    actor: "human",
    tool: "seed_demo_workspace",
    result: outcome.result,
  });
  await store.reset(seeded);
  return outcome.result;
}
