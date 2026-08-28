/**
 * The board's own pure halves: workspace transforms behind every human edit,
 * the pinned list, and the prompts that name the tools the agent must call.
 */

import { describe, expect, it } from "vitest";
import {
  applyInsert,
  applyMove,
  applyRemove,
  applyRename,
  applyReplace,
  chartAt,
  chartsOf,
  targetLabel,
  type EditTarget,
} from "../mutate";
import { sortPinnedFirst, togglePinned } from "../pinned";
import { buildDashboardPrompt, chartPrompt, dashboardPrompt, overviewPrompt } from "../prompts";
import { summaryFacts, summaryRows } from "../SummaryTable";
import type { Chart, DashboardSpec, DatasetSummary, Workspace } from "../../../../types";

const AT = "2026-08-28T12:00:00.000Z";
const LATER = "2026-08-28T13:00:00.000Z";

const chart = (title: string): Chart => ({ kind: "bar", title, points: [{ label: "a", value: 1 }] });

const dashboard: DashboardSpec = {
  category: "Invoices",
  title: "Invoices",
  kpis: [],
  charts: [chart("one"), chart("two")],
  updatedAt: AT,
};

function workspace(): Workspace {
  return {
    id: "mfw-demo",
    name: "Demo workspace",
    mode: "demo",
    categories: { Invoices: { name: "Invoices", createdAt: AT, dashboard } },
    overview: { title: "Whole workspace", kpis: [], charts: [chart("cross")], updatedAt: AT },
    monitors: {},
    runs: [],
    drafts: {},
    feedback: {},
    audit: [],
    updatedAt: AT,
  };
}

const DASH: EditTarget = { kind: "dashboard", category: "Invoices" };
const OVER: EditTarget = { kind: "overview" };

describe("workspace transforms", () => {
  it("renames a dashboard without touching the rest of the workspace", () => {
    const before = workspace();
    const after = applyRename(before, DASH, "Supplier invoices", LATER);
    expect(after.categories.Invoices?.dashboard?.title).toBe("Supplier invoices");
    expect(before.categories.Invoices?.dashboard?.title).toBe("Invoices");
    expect(after.overview).toBe(before.overview);
  });

  it("renames the overview", () => {
    expect(applyRename(workspace(), OVER, "Board", LATER).overview?.title).toBe("Board");
  });

  it("reorders, removes and puts a chart back at the same index", () => {
    const before = workspace();
    expect(chartsOf(applyMove(before, DASH, 0, 1, LATER), DASH).map((entry) => entry.title)).toEqual([
      "two",
      "one",
    ]);

    const removedAt = 0;
    const kept = chartAt(before, DASH, removedAt) as Chart;
    const gone = applyRemove(before, DASH, removedAt, LATER);
    expect(chartsOf(gone, DASH).map((entry) => entry.title)).toEqual(["two"]);

    const back = applyInsert(gone, DASH, removedAt, kept, LATER);
    expect(chartsOf(back, DASH).map((entry) => entry.title)).toEqual(["one", "two"]);
  });

  it("replaces one chart with a kept view of it", () => {
    const after = applyReplace(workspace(), DASH, 0, { ...chart("one"), kind: "donut" }, LATER);
    expect(chartsOf(after, DASH)[0]?.kind).toBe("donut");
  });

  it("leaves a workspace alone when the target does not exist", () => {
    const before = workspace();
    const missing: EditTarget = { kind: "dashboard", category: "Nope" };
    expect(applyRename(before, missing, "x", LATER)).toBe(before);
    expect(chartAt(before, missing, 0)).toBeUndefined();
  });

  it("names the target for the audit line", () => {
    expect(targetLabel(DASH)).toBe("Invoices");
    expect(targetLabel(OVER)).toBe("the overview");
  });
});

describe("pinned categories", () => {
  it("toggles immutably", () => {
    const list: readonly string[] = ["Invoices"];
    expect(togglePinned(list, "Support")).toEqual(["Invoices", "Support"]);
    expect(togglePinned(list, "Invoices")).toEqual([]);
    expect(list).toEqual(["Invoices"]);
  });

  it("sorts pinned entries first, in pin order", () => {
    const items = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(sortPinnedFirst(items, ["c", "b"]).map((item) => item.name)).toEqual(["c", "b", "a"]);
    expect(items.map((item) => item.name)).toEqual(["a", "b", "c"]);
  });
});

describe("prompts", () => {
  it("names the exact tools and the exact chart", () => {
    const prompt = chartPrompt("Invoices", "Open items by category");
    expect(prompt).toContain("mcpforwork.com");
    expect(prompt).toContain("get_dashboard");
    expect(prompt).toContain("upsert_dashboard");
    expect(prompt).toContain("Open items by category");
    expect(prompt).toContain("Keep the other charts");
  });

  it("points the dashboard and overview prompts at the feedback tools", () => {
    expect(dashboardPrompt("Invoices")).toContain("list_feedback");
    expect(overviewPrompt()).toContain("compose_overview");
    expect(buildDashboardPrompt("Invoices", ["unpaid = 6"])).toContain("unpaid = 6");
  });
});

describe("summary table", () => {
  const summary: DatasetSummary = {
    counts: { unpaid: 6 },
    sums: { unpaidEur: 9120 },
    top: { suppliers: [{ label: "Acme Test Ltd", value: 7400 }] },
    rowCount: 14,
    updatedAt: AT,
  };

  it("flattens counts, sums and top lists into rows", () => {
    const rows = summaryRows(summary);
    expect(rows).toContainEqual(["Counts", "unpaid", 6]);
    expect(rows).toContainEqual(["Sums", "unpaidEur", 9120]);
    expect(rows).toContainEqual(["Top suppliers", "Acme Test Ltd", 7400]);
  });

  it("turns the same rows into prompt facts", () => {
    expect(summaryFacts(summary)).toContain("unpaid = 6");
  });
});
