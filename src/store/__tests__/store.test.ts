import { describe, expect, it } from "vitest";
import { createWorkspaceStore, emptyWorkspace } from "../createStore";
import { appendAudit, makeAuditEvent } from "../audit";
import { workspaceSummary } from "../selectors";
import { LIMITS, type Workspace } from "../../types";

const store = () => createWorkspaceStore({ mode: "demo", persist: false });

const withCategory = (ws: Workspace, name: string): Workspace => ({
  ...ws,
  categories: { ...ws.categories, [name]: { name, createdAt: "2026-08-28T09:00:00.000Z" } },
});

describe("createWorkspaceStore", () => {
  it("never mutates the previous workspace", async () => {
    const s = store();
    const before = s.get();
    const after = await s.update((ws) => withCategory(ws, "Invoices"));

    expect(after).not.toBe(before);
    expect(before.categories).toEqual({});
    expect(Object.keys(after.categories)).toEqual(["Invoices"]);
    expect(s.get()).toBe(after);
  });

  it("caps the audit trail at LIMITS.maxAuditEvents and keeps the newest", async () => {
    const s = store();
    const overflow = LIMITS.maxAuditEvents + 25;
    await s.update((ws) => {
      let next = ws;
      for (let i = 0; i < overflow; i += 1) {
        next = appendAudit(next, makeAuditEvent({ actor: "agent", tool: `t${i}`, ok: true }));
      }
      return next;
    });

    const { audit } = s.get();
    expect(audit).toHaveLength(LIMITS.maxAuditEvents);
    expect(audit[audit.length - 1]?.tool).toBe(`t${overflow - 1}`);
    expect(audit[0]?.tool).toBe(`t${overflow - LIMITS.maxAuditEvents}`);
  });

  it("notifies subscribers synchronously and stops after unsubscribe", async () => {
    const s = store();
    const seen: string[] = [];
    const stop = s.subscribe((ws) => seen.push(ws.name));

    const promise = s.update((ws) => ({ ...ws, name: "First" }));
    expect(seen).toEqual(["First"]);
    await promise;

    stop();
    await s.update((ws) => ({ ...ws, name: "Second" }));
    expect(seen).toEqual(["First"]);
    expect(s.get().name).toBe("Second");
  });

  it("resets back to an empty workspace", async () => {
    const s = store();
    await s.update((ws) => withCategory(ws, "Support"));
    const cleared = await s.reset();

    expect(cleared.categories).toEqual({});
    expect(cleared.mode).toBe("demo");
    expect(workspaceSummary(cleared).categories).toEqual([]);
  });

  it("stays in memory when IndexedDB is unavailable", async () => {
    const s = createWorkspaceStore({ mode: "live" });
    await expect(s.ready).resolves.toBeDefined();
    expect(s.isPersistent()).toBe(false);
    expect(s.key).toBe("mfw:workspace:live");
    await expect(s.update((ws) => ({ ...ws, name: "Live" }))).resolves.toBeDefined();
    s.dispose();
  });
});

describe("emptyWorkspace", () => {
  it("builds an empty board for the mode", () => {
    const ws = emptyWorkspace("demo");
    expect(ws.mode).toBe("demo");
    expect(ws.runs).toEqual([]);
    expect(workspaceSummary(ws)).toMatchObject({
      mode: "demo",
      hasOverview: false,
      pendingDrafts: 0,
      heldDrafts: 0,
    });
  });
});
