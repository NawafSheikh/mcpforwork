/**
 * Share round trip, tested on the Node side.
 *
 * jsdom has no CompressionStream, so the test polyfills it from node:stream/web here and
 * nowhere else: shipped code reads the constructor off globalThis and falls back when it
 * is missing, which is exactly the second path exercised below.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CompressionStream, DecompressionStream } from "node:stream/web";
import { buildShareUrl, hasShareFragment, readShareFromLocation, readSharePayload } from "../url";
import { toSnapshot } from "../snapshot";
import { unpackPayload } from "../codec";
import type { Workspace } from "../../types";

type Globals = Record<string, unknown>;
const globals = globalThis as unknown as Globals;

function withCompression(): void {
  globals.CompressionStream = CompressionStream;
  globals.DecompressionStream = DecompressionStream;
}

function withoutCompression(): void {
  delete globals.CompressionStream;
  delete globals.DecompressionStream;
}

const AT = "2026-08-28T18:39:00.000Z";

function board(): Workspace {
  return {
    id: "ws_demo",
    name: "Sample workspace (synthetic)",
    mode: "live",
    categories: {
      Invoices: {
        name: "Invoices",
        description: "Supplier invoices found in the mailbox.",
        provenance: "from Gmail, last 30 threads, synthetic sample",
        createdAt: AT,
        summary: { counts: { threads: 14, unpaid: 6 }, sums: { unpaidEur: 9120 }, updatedAt: AT },
        dashboard: {
          category: "Invoices",
          title: "Invoices",
          kpis: [{ label: "Outstanding", value: "EUR 9,120", hint: "6 open" }],
          charts: [
            {
              id: "by_supplier",
              kind: "bar",
              title: "By supplier",
              points: [{ label: "Acme Test Ltd", value: 7400 }],
            },
          ],
          updatedAt: AT,
        },
      },
    },
    overview: {
      title: "Work overview",
      kpis: [{ label: "Categories", value: 1 }],
      charts: [],
      highlights: ["Two drafts held by policy"],
      updatedAt: AT,
    },
    monitors: {
      mon_invoices_demo: {
        id: "mon_invoices_demo",
        name: "Invoice watch",
        category: "Invoices",
        schedule: "every morning 08:00",
        runner: "local",
        status: "active",
        createdAt: AT,
        nextRunAt: AT,
        policy: {
          maxAutoActionsPerRun: 2,
          thresholds: [{ field: "amount", op: "gt", value: 5000, label: "large payment" }],
          requireHumanFor: ["pay"],
        },
      },
    },
    runs: [
      {
        id: "run_inv_0001",
        monitorId: "mon_invoices_demo",
        runner: "local",
        startedAt: AT,
        finishedAt: AT,
        findings: ["2 invoices over EUR 5,000"],
        draftIds: ["draft_inv_001"],
      },
    ],
    drafts: {
      draft_inv_001: {
        id: "draft_inv_001",
        monitorId: "mon_invoices_demo",
        runId: "run_inv_0001",
        kind: "pay",
        target: "Acme Test Ltd INV-2041",
        summary: "Pay invoice INV-2041 for EUR 6,300.",
        amount: 6300,
        fields: { supplier: "Acme Test Ltd", currency: "EUR" },
        status: "held",
        heldReason: "threshold:amount>5000",
      },
    },
    claims: {},
    lastWriter: {},
    feedback: {
      fb_1: {
        id: "fb_1",
        target: { kind: "dashboard", id: "Invoices" },
        text: "Split the bar by ageing bucket.",
        author: "human",
        createdAt: AT,
      },
    },
    audit: [
      {
        id: "ev_1",
        at: AT,
        actor: "agent",
        caller: "Classify 1-25",
        tool: "upsert_dashboard",
        ok: true,
      },
    ],
    updatedAt: AT,
  };
}

function fragment(url: string): string {
  const index = url.indexOf("#");
  return index === -1 ? "" : url.slice(index);
}

function payloadOf(url: string): string {
  return fragment(url).replace("#share=", "");
}

async function roundTrip(ws: Workspace): Promise<Workspace | null> {
  return readShareFromLocation(fragment(await buildShareUrl(ws)));
}

afterEach(withCompression);

describe("buildShareUrl", () => {
  it("returns origin plus pathname plus the share fragment", async () => {
    withCompression();
    const url = await buildShareUrl(board());
    expect(url.startsWith(`${window.location.origin}${window.location.pathname}#share=`)).toBe(true);
    expect(hasShareFragment(fragment(url))).toBe(true);
  });

  it("compresses when CompressionStream exists and stays plain when it does not", async () => {
    withCompression();
    const deflated = payloadOf(await buildShareUrl(board()));
    withoutCompression();
    const plain = payloadOf(await buildShareUrl(board()));
    expect(deflated.startsWith("1")).toBe(true);
    expect(plain.startsWith("0")).toBe(true);
    expect(deflated.length).toBeLessThan(plain.length);
  });

  it("leaves the audit trail behind", async () => {
    withCompression();
    expect(Object.keys(toSnapshot(board()))).not.toContain("audit");
    const bytes = await unpackPayload(payloadOf(await buildShareUrl(board())));
    const json = new TextDecoder().decode(bytes ?? new Uint8Array());
    expect(json).not.toContain("Classify 1-25");
    expect(json).not.toContain("audit");
  });

  it("refuses a board that would not fit in a link", async () => {
    withCompression();
    let seed = 7;
    let filler = "";
    while (filler.length < 240_000) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      filler += seed.toString(36);
    }
    const big: Workspace = {
      ...board(),
      categories: {
        Invoices: { name: "Invoices", description: filler, createdAt: AT },
      },
    };
    await expect(buildShareUrl(big)).rejects.toThrow(/too big to share/);
  });
});

describe("readShareFromLocation", () => {
  it("round trips the board through a compressed link", async () => {
    withCompression();
    const restored = await roundTrip(board());
    expect(restored).not.toBeNull();
    expect(restored?.mode).toBe("local");
    expect(restored?.name).toBe("Sample workspace (synthetic) (shared)");
    expect(restored?.audit).toEqual([]);
    expect(restored?.categories.Invoices?.dashboard?.charts[0]?.points[0]?.value).toBe(7400);
    expect(restored?.overview?.highlights?.[0]).toBe("Two drafts held by policy");
    expect(restored?.monitors.mon_invoices_demo?.policy.thresholds?.[0]?.value).toBe(5000);
    expect(restored?.runs[0]?.findings[0]).toBe("2 invoices over EUR 5,000");
    expect(restored?.drafts.draft_inv_001?.heldReason).toBe("threshold:amount>5000");
    expect(restored?.feedback.fb_1?.text).toBe("Split the bar by ageing bucket.");
  });

  it("round trips without CompressionStream and reads back where it exists", async () => {
    withoutCompression();
    const url = await buildShareUrl(board());
    withCompression();
    const restored = await readShareFromLocation(fragment(url));
    expect(restored?.categories.Invoices?.name).toBe("Invoices");
  });

  it("never says shared twice", async () => {
    withCompression();
    const once = await roundTrip(board());
    const twice = await roundTrip(once as Workspace);
    expect(twice?.name).toBe("Sample workspace (synthetic) (shared)");
  });

  it("returns null for no fragment, a foreign fragment or a broken payload", async () => {
    withCompression();
    expect(hasShareFragment("")).toBe(false);
    expect(await readShareFromLocation("")).toBeNull();
    expect(await readShareFromLocation("#tab=board")).toBeNull();
    expect(await readShareFromLocation("#share=not base64 !!")).toBeNull();
    expect(await readShareFromLocation("#share=1AAAAAAAAAAA")).toBeNull();
    expect(await readSharePayload("9abc")).toBeNull();
  });
});

describe("hostile payloads", () => {
  async function readJson(value: unknown): Promise<Workspace | null> {
    withoutCompression();
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return readSharePayload(`0${base64}`);
  }

  it("drops unknown keys, coerces wrong types and keeps the prototype clean", async () => {
    const restored = await readJson({
      id: 42,
      name: { nope: true },
      mode: "live",
      evil: "dropped",
      categories: {
        ["__proto__"]: { name: "polluted", createdAt: AT },
        Invoices: { name: "Invoices", createdAt: AT, description: 9, extra: "dropped" },
      },
      monitors: { m1: { id: "m1", name: "M", policy: { maxAutoActionsPerRun: 9e99 } } },
      drafts: "not a record",
      feedback: [],
      audit: [{ id: "ev", actor: "agent" }],
    });
    expect(restored).not.toBeNull();
    expect(restored?.mode).toBe("local");
    expect(restored?.audit).toEqual([]);
    expect(restored?.categories.Invoices?.description).toBeUndefined();
    expect(Object.keys(restored?.categories ?? {})).toEqual(["Invoices"]);
    expect(({} as Record<string, unknown>).name).toBeUndefined();
    expect((restored?.categories as Record<string, unknown>).evil).toBeUndefined();
    expect(restored?.monitors.m1?.policy.maxAutoActionsPerRun).toBe(999);
    expect(restored?.drafts).toEqual({});
    expect(restored?.runs).toEqual([]);
  });

  it("caps oversized collections", async () => {
    const charts = Array.from({ length: 40 }, (_, i) => ({
      kind: "bar",
      title: `chart ${i}`,
      points: Array.from({ length: 90 }, (_, p) => ({ label: `p${p}`, value: p })),
    }));
    const restored = await readJson({
      id: "ws",
      name: "Big",
      categories: {
        Invoices: {
          name: "Invoices",
          createdAt: AT,
          dashboard: { category: "Invoices", kpis: [], charts, updatedAt: AT },
        },
      },
      monitors: {},
      runs: Array.from({ length: 90 }, (_, i) => ({ id: `r${i}`, monitorId: "m", startedAt: AT })),
      drafts: {},
      feedback: {},
    });
    const dashboard = restored?.categories.Invoices?.dashboard;
    expect(dashboard?.charts.length).toBe(4);
    expect(dashboard?.charts[0]?.points.length).toBe(12);
    expect(restored?.runs.length).toBe(20);
  });
});
