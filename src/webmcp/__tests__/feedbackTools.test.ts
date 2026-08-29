import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import { addFeedback } from "../../feedback/store";
import { workspaceHandlers } from "../handlers";
import { createToolRegistry } from "../registry";
import { FEEDBACK_NOTICE } from "../feedbackTools";
import type { FeedbackTarget, Workspace } from "../../types";

const dashboard: FeedbackTarget = { kind: "dashboard", id: "Invoices" };

const setup = () => {
  const store = createWorkspaceStore({ mode: "local", persist: false });
  const registry = createToolRegistry({ store, handlers: workspaceHandlers });
  return { store, registry };
};

const note = (store: { update(fn: (ws: Workspace) => Workspace): Promise<Workspace> }, text: string) =>
  store.update((ws) => addFeedback(ws, { target: dashboard, text, author: "human" }));

const openId = (ws: Workspace): string => Object.keys(ws.feedback)[0] as string;

describe("caller attribution", () => {
  it("stores the caller on the audit event and keeps it out of the handler args", async () => {
    const { registry, store } = setup();
    await registry.call("create_category", { name: "Invoices", caller: "Classify 1-25" });

    const event = store.get().audit[0];
    expect(event?.caller).toBe("Classify 1-25");
    expect(event?.argsPreview).not.toContain("Classify");
    expect(store.get().categories.Invoices).toBeDefined();
  });

  it("keeps the caller on a call that failed validation", async () => {
    const { registry, store } = setup();
    await registry.call("create_category", { name: "", caller: "Classify 26-50" });

    expect(store.get().audit[0]).toMatchObject({ ok: false, caller: "Classify 26-50" });
  });

  it("leaves caller undefined when the agent does not name itself", async () => {
    const { registry, store } = setup();
    await registry.call("create_category", { name: "Support" });

    expect(store.get().audit[0]?.caller).toBeUndefined();
  });

  it("refuses a caller longer than the limit without losing the call", async () => {
    const { registry, store } = setup();
    const result = await registry.call("create_category", { name: "Hiring", caller: "x".repeat(80) });

    expect(result).toContain("Invalid input for create_category");
    expect(store.get().audit[0]?.caller).toBeUndefined();
  });
});

describe("list_feedback", () => {
  it("returns open notes newest first as JSON", async () => {
    const { registry, store } = setup();
    await note(store, "The revenue chart y axis is wrong");

    const result = await registry.call("list_feedback", {});
    const parsed = JSON.parse(result) as { feedback: readonly Record<string, unknown>[] };

    expect(parsed.feedback[0]).toMatchObject({
      target: dashboard,
      text: "The revenue chart y axis is wrong",
      author: "human",
      resolved: false,
    });
    expect(parsed.feedback[0]).toHaveProperty("id");
    expect(parsed.feedback[0]).toHaveProperty("createdAt");
  });

  it("says so plainly when nothing is open", async () => {
    const { registry } = setup();
    await expect(registry.call("list_feedback", {})).resolves.toContain("No open feedback");
  });

  it("hides resolved notes unless includeResolved is set", async () => {
    const { registry, store } = setup();
    await note(store, "Rename the board");
    await registry.call("resolve_feedback", {
      feedbackId: openId(store.get()),
      resolution: "Renamed it",
    });

    await expect(registry.call("list_feedback", {})).resolves.toContain("No open feedback");
    const all = await registry.call("list_feedback", { includeResolved: true });
    expect(JSON.parse(all).feedback[0]).toMatchObject({ resolved: true });
  });

  it("scopes to one target", async () => {
    const { registry, store } = setup();
    await note(store, "Only on Invoices");

    const other = await registry.call("list_feedback", {
      target: { kind: "monitor", id: "mon_1" },
    });
    expect(other).toContain("No open feedback on monitor mon_1");
  });
});

describe("resolve_feedback", () => {
  it("marks the note resolved by the agent with its resolution", async () => {
    const { registry, store } = setup();
    await note(store, "Add a total row");
    const id = openId(store.get());

    const result = await registry.call("resolve_feedback", { feedbackId: id, resolution: "Added it" });

    expect(result).toContain("Resolved the note on dashboard Invoices");
    expect(store.get().feedback[id]).toMatchObject({ resolvedBy: "agent", resolution: "Added it" });
  });

  it("refuses an unknown id kindly and changes nothing", async () => {
    const { registry, store } = setup();
    const result = await registry.call("resolve_feedback", { feedbackId: "fb_nope", resolution: "x" });

    expect(result).toContain('No feedback with id "fb_nope"');
    expect(result).toContain("workspace is unchanged");
    expect(store.get().feedback).toEqual({});
  });
});

describe("open feedback nudges", () => {
  it("ends get_workspace with the count and what to call", async () => {
    const { registry, store } = setup();
    await note(store, "Two things are off here");

    const result = await registry.call("get_workspace", {});

    expect(result.endsWith("Open feedback: 1. Call list_feedback before editing.")).toBe(true);
    expect(result.startsWith("{")).toBe(true);
  });

  it("says nothing about feedback when there is none", async () => {
    const { registry } = setup();
    await expect(registry.call("get_workspace", {})).resolves.not.toContain("Open feedback");
  });

  it("appends the nudge to a write on the same target", async () => {
    const { registry, store } = setup();
    await note(store, "The KPI labels are too long");

    const touched = await registry.call("upsert_dashboard", {
      category: "Invoices",
      kpis: [{ label: "Open", value: 42 }],
    });
    const untouched = await registry.call("upsert_dashboard", {
      category: "Support",
      kpis: [{ label: "Open", value: 7 }],
    });

    expect(touched).toContain(FEEDBACK_NOTICE);
    expect(untouched).not.toContain(FEEDBACK_NOTICE);
  });
});

describe("share_board", () => {
  it("returns a snapshot link that carries the state in the fragment", async () => {
    const { registry } = setup();
    const result = await registry.call("share_board", {});

    expect(result).toContain("nothing was uploaded");
    expect(result).toContain("#share=");
  });
});
