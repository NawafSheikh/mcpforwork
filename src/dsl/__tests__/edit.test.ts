/**
 * The human edit reducers are pure, which is what makes undo a one-liner:
 * delete keeps the chart and its index, and insert puts the same object back.
 */

import { describe, expect, it } from "vitest";
import {
  insertChart,
  moveChart,
  removeChart,
  renameDashboard,
  renameOverview,
  replaceChart,
  setDashboardCharts,
  setOverviewCharts,
} from "../edit";
import { applyChartView, canSort, canSwitchKind, sortPoints, sortRows } from "../charts/view";
import type { Chart, DashboardSpec, OverviewSpec } from "../../types";

const AT = "2026-08-28T12:04:00.000Z";
const LATER = "2026-08-28T13:00:00.000Z";

const chart = (title: string): Chart => ({
  kind: "bar",
  title,
  points: [
    { label: "b", value: 1 },
    { label: "a", value: 3 },
  ],
});

const charts: readonly Chart[] = [chart("one"), chart("two"), chart("three")];

const dashboard: DashboardSpec = {
  category: "Invoices",
  title: "Invoices",
  kpis: [],
  charts,
  updatedAt: AT,
};

const overview: OverviewSpec = { title: "Whole workspace", kpis: [], charts, updatedAt: AT };

describe("rename", () => {
  it("sets a new title and stamps the edit", () => {
    const next = renameDashboard(dashboard, "  Supplier invoices ", LATER);
    expect(next.title).toBe("Supplier invoices");
    expect(next.updatedAt).toBe(LATER);
    expect(dashboard.title).toBe("Invoices");
  });

  it("falls back to the category name when the field is cleared", () => {
    expect(renameDashboard(dashboard, "   ", LATER).title).toBe("Invoices");
  });

  it("keeps the overview title when the field is cleared", () => {
    expect(renameOverview(overview, "  ", LATER)).toBe(overview);
    expect(renameOverview(overview, "Board", LATER).title).toBe("Board");
  });
});

describe("reorder", () => {
  it("swaps a chart with its neighbour without mutating the input", () => {
    const next = moveChart(charts, 0, 1);
    expect(next.map((entry) => entry.title)).toEqual(["two", "one", "three"]);
    expect(charts.map((entry) => entry.title)).toEqual(["one", "two", "three"]);
  });

  it("moves up as well as down", () => {
    expect(moveChart(charts, 2, -1).map((entry) => entry.title)).toEqual(["one", "three", "two"]);
  });

  it("is a no-op past either end", () => {
    expect(moveChart(charts, 0, -1)).toBe(charts);
    expect(moveChart(charts, 2, 1)).toBe(charts);
    expect(moveChart(charts, 9, 1)).toBe(charts);
  });
});

describe("delete and undo", () => {
  it("removes one chart and leaves the rest alone", () => {
    const next = removeChart(charts, 1);
    expect(next.map((entry) => entry.title)).toEqual(["one", "three"]);
    expect(charts).toHaveLength(3);
  });

  it("puts the same chart back at the same index", () => {
    const removedAt = 1;
    const kept = charts[removedAt] as Chart;
    const after = removeChart(charts, removedAt);
    const restored = insertChart(after, removedAt, kept);
    expect(restored.map((entry) => entry.title)).toEqual(["one", "two", "three"]);
    expect(restored[removedAt]).toBe(kept);
  });

  it("clamps an out of range insert to the ends", () => {
    expect(insertChart(charts, 99, chart("four")).map((entry) => entry.title)).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
  });

  it("ignores an out of range delete", () => {
    expect(removeChart(charts, 7)).toBe(charts);
  });
});

describe("replace and set", () => {
  it("swaps one chart for an edited copy", () => {
    const next = replaceChart(charts, 0, { ...chart("one"), kind: "line" });
    expect(next[0]?.kind).toBe("line");
    expect(charts[0]?.kind).toBe("bar");
  });

  it("writes charts back onto a spec with a new stamp", () => {
    expect(setDashboardCharts(dashboard, [], LATER).charts).toHaveLength(0);
    expect(setDashboardCharts(dashboard, [], LATER).updatedAt).toBe(LATER);
    expect(setOverviewCharts(overview, [], LATER).charts).toHaveLength(0);
  });
});

describe("chart view", () => {
  it("sorts points by value and by label without mutating", () => {
    const points = charts[0]?.points ?? [];
    expect(sortPoints(points, "value").map((point) => point.label)).toEqual(["a", "b"]);
    expect(sortPoints(points, "label").map((point) => point.label)).toEqual(["a", "b"]);
    expect(sortPoints(points, "none")).toBe(points);
    expect(points.map((point) => point.label)).toEqual(["b", "a"]);
  });

  it("sorts table rows on the first numeric column", () => {
    const rows = [
      ["b", 1],
      ["a", 3],
    ] as const;
    expect(sortRows(rows, "value")[0]?.[0]).toBe("a");
    expect(sortRows(rows, "label")[0]?.[0]).toBe("a");
    expect(sortRows(rows, "none")).toBe(rows);
  });

  it("draws the same points as another kind without touching the spec", () => {
    const source = chart("one");
    const shown = applyChartView(source, { kind: "donut", sort: "value" });
    expect(shown.kind).toBe("donut");
    expect(shown.points.map((point) => point.label)).toEqual(["a", "b"]);
    expect(source.kind).toBe("bar");
  });

  it("returns the original chart when the view changes nothing", () => {
    const source = chart("one");
    expect(applyChartView(source, {})).toBe(source);
  });

  it("knows which charts can switch kind or sort", () => {
    expect(canSwitchKind(chart("one"))).toBe(true);
    expect(canSwitchKind({ kind: "table", title: "t", points: [] })).toBe(false);
    expect(canSort(chart("one"), "bar")).toBe(true);
    expect(canSort({ kind: "table", title: "t", points: [], rows: [["a", 1]] }, "table")).toBe(true);
  });
});
