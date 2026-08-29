/**
 * Two agents on one dashboard, through the real registry.
 *
 * The rule being tested is the one Nawaf asked for: get the work done. A second write
 * inside the minute is applied, not blocked, and what the first agent added comes back
 * with it. The only thing that is ever handed back is a write that would delete the same
 * chart or KPI somebody just changed, and the reply says which call fixes it.
 */
import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import { monitorHandlers } from "../../monitors";
import { workspaceHandlers } from "../../webmcp/handlers";
import { createToolRegistry } from "../../webmcp/registry";
import { turnHandlers } from "../tools";
import type { Chart, KPI, Workspace } from "../../types";

function setup() {
  const store = createWorkspaceStore({ mode: "demo", persist: false });
  const registry = createToolRegistry({
    store,
    handlers: { ...workspaceHandlers, ...monitorHandlers, ...turnHandlers },
  });
  return { store, registry };
}

const chart = (id: string, title: string, value: number): Chart => ({
  id,
  kind: "bar",
  title,
  points: [{ label: "Week 34", value }],
});

const dashboard = (
  charts: readonly Chart[],
  kpis: readonly KPI[] = [{ label: "Outstanding", value: "EUR 9,120" }],
) => ({
  category: "Invoices",
  kpis,
  charts,
});

const charts = (ws: Workspace): readonly Chart[] => ws.categories.Invoices?.dashboard?.charts ?? [];
const chartIds = (ws: Workspace): readonly string[] => charts(ws).map((item) => item.id ?? item.title);

/** Push the object's last write into the past, so the conflict window has closed. */
function ageWrite(ws: Workspace, key: string, minutes: number): Workspace {
  const mark = ws.lastWriter[key];
  if (mark === undefined) return ws;
  const at = new Date(Date.now() - minutes * 60_000).toISOString();
  return { ...ws, lastWriter: { ...ws.lastWriter, [key]: { ...mark, at } } };
}

describe("a second agent writing the same dashboard", () => {
  it("keeps what the first one added and says so", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("by_supplier", "By supplier", 7400)]), caller: "Ana" });
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("by_age", "By ageing bucket", 3100)]),
      caller: "Ben",
    });

    expect(chartIds(store.get())).toEqual(["by_age", "by_supplier"]);
    expect(result).toContain("applied on top");
    expect(result).toContain("Ana");
    expect(result).toContain('chart "By supplier"');
  });

  it("hands back only the write that would delete the same chart", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("by_supplier", "By supplier", 7400)]), caller: "Ana" });
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("by_supplier", "By supplier", 10)]),
      caller: "Ben",
    });

    expect(result).toContain("Ana changed");
    expect(result).toContain("would delete it");
    expect(result).toContain("Call get_dashboard again");
    expect(charts(store.get())[0]?.points[0]?.value).toBe(7400);
    expect(store.get().audit.at(-1)?.ok).toBe(false);
  });

  it("never gets in the way of the agent that wrote it last", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("by_supplier", "By supplier", 7400)]), caller: "Ana" });
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("by_supplier", "By supplier", 9999)]),
      caller: "Ana",
    });

    expect(result).not.toContain("would delete");
    expect(charts(store.get())[0]?.points[0]?.value).toBe(9999);
  });

  it("writes plainly once the minute has passed", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("by_supplier", "By supplier", 7400)]), caller: "Ana" });
    await store.update((ws) => ageWrite(ws, "dashboard:Invoices", 5));
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("by_age", "By ageing bucket", 3100)]),
      caller: "Ben",
    });

    expect(result).not.toContain("applied on top");
    expect(chartIds(store.get())).toEqual(["by_age"]);
  });

  it("merges KPIs by label and appends notes", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", {
      ...dashboard([], [{ label: "Outstanding", value: "EUR 9,120" }]),
      notes: ["From the Gmail thread export."],
      caller: "Ana",
    });
    await registry.call("upsert_dashboard", {
      ...dashboard([], [{ label: "Overdue", value: 6 }]),
      notes: ["Ageing buckets added."],
      caller: "Ben",
    });

    const spec = store.get().categories.Invoices?.dashboard;
    expect(spec?.kpis.map((kpi) => kpi.label)).toEqual(["Overdue", "Outstanding"]);
    expect(spec?.notes).toEqual(["Ageing buckets added.", "From the Gmail thread export."]);
  });
});

describe("expectedUpdatedAt", () => {
  it("goes through untouched when the stamp is the current one", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("a", "A", 1)]), caller: "Ana" });
    const stamp = store.get().categories.Invoices?.dashboard?.updatedAt;
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("a", "A", 2)]),
      expectedUpdatedAt: stamp,
      caller: "Ana",
    });

    expect(result).toContain("Dashboard for Invoices rendered");
    expect(charts(store.get())[0]?.points[0]?.value).toBe(2);
  });

  it("merges rather than refusing when the object moved under a different write", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("a", "A", 1)]), caller: "Ana" });
    await store.update((ws) => ageWrite(ws, "dashboard:Invoices", 5));
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("b", "B", 2)]),
      expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
      caller: "Ben",
    });

    expect(result).toContain("applied on top");
    expect(chartIds(store.get())).toEqual(["b", "a"]);
  });

  it("hands back a stale write that would delete the same chart", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("a", "A", 1)]), caller: "Ana" });
    await store.update((ws) => ageWrite(ws, "dashboard:Invoices", 5));
    const result = await registry.call("upsert_dashboard", {
      ...dashboard([chart("a", "A", 42)]),
      expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
      caller: "Ben",
    });

    expect(result).toContain("Call get_dashboard again");
    expect(charts(store.get())[0]?.points[0]?.value).toBe(1);
  });

  it("hands back a policy written over a fresh one, and applies an identical one", async () => {
    const { registry, store } = setup();
    const registered = await registry.call("register_monitor", {
      name: "Invoice watch",
      category: "Invoices",
      schedule: "every morning 08:00",
      policy: { maxAutoActionsPerRun: 2 },
      runner: "local",
      caller: "Ana",
    });
    const id = /registered as (\S+),/.exec(registered)?.[1] ?? "";
    await registry.call("set_policy", { monitorId: id, policy: { maxAutoActionsPerRun: 3 }, caller: "Ana" });
    const refused = await registry.call("set_policy", {
      monitorId: id,
      policy: { maxAutoActionsPerRun: 9 },
      caller: "Ben",
    });
    const same = await registry.call("set_policy", {
      monitorId: id,
      policy: { maxAutoActionsPerRun: 3 },
      caller: "Ben",
    });

    expect(refused).toContain("would delete it");
    expect(refused).toContain("Call list_monitors again");
    expect(same).toContain("Policy for Invoice watch updated");
    expect(store.get().monitors[id]?.policy.maxAutoActionsPerRun).toBe(3);
  });
});

describe("what a read hands back", () => {
  it("returns the stamp a write can send back", async () => {
    const { registry, store } = setup();
    await registry.call("upsert_dashboard", { ...dashboard([chart("a", "A", 1)]), caller: "Ana" });
    const read = await registry.call("get_dashboard", { category: "Invoices" });
    const workspace = await registry.call("get_workspace", {});

    expect(read).toContain(store.get().categories.Invoices?.dashboard?.updatedAt ?? "never");
    expect(workspace).toContain("updatedAt");
  });

  it("tells a caller what it holds and what is waiting on it", async () => {
    const { registry } = setup();
    await registry.call("create_category", { name: "Invoices", caller: "Ana" });
    await registry.call("add_feedback", {
      target: { kind: "agent", id: "Ana" },
      text: "Split the bar by ageing bucket.",
      caller: "Maria's agent",
    });
    const answer = await registry.call("get_workspace", { caller: "Ana" });

    expect(answer).toContain("You hold: dashboard Invoices.");
    expect(answer).toContain("You have 1 open request.");
  });
});

describe("the optional tools", () => {
  it("puts a name on an object early and takes it off again", async () => {
    const { registry, store } = setup();
    const claimed = await registry.call("claim", { target: { kind: "dashboard", id: "Invoices" }, caller: "Ana" });
    const listed = await registry.call("list_claims", {});
    const released = await registry.call("release", { target: { kind: "dashboard", id: "Invoices" }, caller: "Ana" });

    expect(claimed).toContain("Your name is on dashboard Invoices");
    expect(claimed).toContain("blocks nobody");
    expect(listed).toContain("Ana");
    expect(released).toContain("Your name is off dashboard Invoices");
    expect(store.get().claims).toEqual({});
  });

  it("never takes an object away from somebody else", async () => {
    const { registry, store } = setup();
    await registry.call("claim", { target: { kind: "dashboard", id: "Invoices" }, caller: "Ana" });
    const second = await registry.call("claim", { target: { kind: "dashboard", id: "Invoices" }, caller: "Ben" });
    const release = await registry.call("release", { target: { kind: "dashboard", id: "Invoices" }, caller: "Ben" });

    expect(second).toContain("Ana is working on dashboard Invoices");
    expect(second).toContain("merged on top");
    expect(release).toContain("Only they take their own name off");
    expect(store.get().claims["dashboard:Invoices"]?.holder).toBe("Ana");
  });

  it("says plainly when nobody is on anything", async () => {
    const { registry } = setup();
    expect(await registry.call("list_claims", {})).toContain("Nobody is working on anything");
  });
});
