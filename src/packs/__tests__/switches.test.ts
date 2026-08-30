/**
 * Switching a pack off, end to end: the tools leave document.modelContext at once and
 * the registry refuses the call an agent makes anyway, with the sentence PACKS.md
 * promises and a failed line in the audit rail.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceStore, type PersistentWorkspaceStore } from "../../store";
import { createToolDefinitions } from "../../webmcp/definitions";
import { workspaceHandlers } from "../../webmcp/handlers";
import { registerAllTools } from "../../webmcp/register";
import { createToolRegistry } from "../../webmcp/registry";
import { createPackController } from "../controller";
import { packOffText } from "../registry";
import { packStateOf, packViews, setPackState } from "../state";
import { fakeContext, installContext, removeContext } from "./fixtures";

const MONITOR_TOOLS = 7;
const ALL_TOOLS = 39;

function bundle(store: PersistentWorkspaceStore) {
  const packs = createPackController(store);
  const registry = createToolRegistry({ store, handlers: workspaceHandlers, packs });
  return { packs, registry, definitions: createToolDefinitions(registry) };
}

let live: PersistentWorkspaceStore | null = null;

afterEach(() => {
  live?.dispose();
  live = null;
  removeContext();
});

function store(): PersistentWorkspaceStore {
  live = createWorkspaceStore({ mode: "local", persist: false });
  return live;
}

describe("pack switches", () => {
  it("registers every pack when nothing has been switched", async () => {
    const context = fakeContext();
    installContext(context);
    const { packs, registry, definitions } = bundle(store());

    const result = await registerAllTools(registry, definitions, { packs });

    expect(result.registered).toHaveLength(ALL_TOOLS);
    expect(context.tools.size).toBe(ALL_TOOLS);
  });

  it("unregisters exactly one pack's tools when it is switched off, and puts them back", async () => {
    const context = fakeContext();
    installContext(context);
    const current = store();
    const { packs, registry, definitions } = bundle(current);
    const seen: number[] = [];
    await registerAllTools(registry, definitions, {
      packs,
      onRegistered: (names) => seen.push(names.length),
    });

    await packs.setPack("monitors", false);

    expect(context.tools.size).toBe(ALL_TOOLS - MONITOR_TOOLS);
    expect(context.tools.has("approve_draft")).toBe(false);
    expect(context.tools.has("upsert_dashboard")).toBe(true);
    expect(seen.at(-1)).toBe(ALL_TOOLS - MONITOR_TOOLS);

    await packs.setPack("monitors", true);

    expect(context.tools.size).toBe(ALL_TOOLS);
    expect(context.tools.has("approve_draft")).toBe(true);
  });

  it("refuses a call to a switched-off tool and audits it as a failure", async () => {
    const current = store();
    const { packs, registry } = bundle(current);
    await packs.setPack("monitors", false);

    const answer = await registry.call("approve_draft", { draftId: "d1" });

    expect(answer).toBe(packOffText("monitors"));
    const last = current.get().audit.at(-1);
    expect(last?.ok).toBe(false);
    expect(last?.tool).toBe("approve_draft");
  });

  it("still answers a tool in a pack that is on", async () => {
    const current = store();
    const { packs, registry } = bundle(current);
    await packs.setPack("monitors", false);

    const answer = await registry.call("get_workspace", {});

    expect(answer).not.toContain("pack is off");
  });

  it("records who moved the switch and syncs it as workspace state", async () => {
    const current = store();
    const { packs } = bundle(current);

    await packs.setPack("notes", false);

    const state = packStateOf(current.get(), "notes");
    expect(state?.enabled).toBe(false);
    expect(state?.changedBy.length).toBeGreaterThan(0);
    expect(state?.changedAt).toMatch(/^\d{4}-/);
  });

  it("pins a default on, and leaves the board untouched for a repeat or an unknown pack", () => {
    const ws = createWorkspaceStore({ mode: "local", persist: false });
    const before = ws.get();

    // Saying "on" out loud is not a no-op: it pins the pack against the room default,
    // which is what a host does when they want monitors on with other people watching.
    const pinned = setPackState(before, { id: "monitors", enabled: true, by: "Ana" });
    expect(packStateOf(pinned, "monitors")?.enabled).toBe(true);

    expect(setPackState(pinned, { id: "monitors", enabled: true, by: "Ben" })).toBe(pinned);
    expect(setPackState(before, { id: "nope", enabled: false, by: "Ana" })).toBe(before);
    ws.dispose();
  });

  it("shows eight rows with a risk and a tool count", () => {
    const views = packViews(createWorkspaceStore({ mode: "local", persist: false }).get(), false);
    expect(views).toHaveLength(8);
    expect(views.every((view) => view.enabled)).toBe(true);
    expect(views.every((view) => view.changedBy === undefined)).toBe(true);
    expect(views.reduce((sum, view) => sum + view.pack.tools.length, 0)).toBe(ALL_TOOLS);
  });
});
