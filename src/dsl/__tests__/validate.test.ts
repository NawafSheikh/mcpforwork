import { describe, expect, it } from "vitest";
import { LIMITS } from "../../types";
import type { Chart, DashboardSpec, KPI, OverviewSpec } from "../../types";
import {
  OVERVIEW_KPI_LIMIT,
  chartKey,
  clampChart,
  clampDashboard,
  clampOverview,
  describeDashboard,
  describeOverview,
} from "../validate";

const AT = "2026-08-28T12:04:00";

function kpis(count: number): readonly KPI[] {
  return Array.from({ length: count }, (_unused, index) => ({ label: `k${index}`, value: index }));
}

function points(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ label: `p${index}`, value: index }));
}

function rows(count: number, width: number): readonly (readonly (string | number)[])[] {
  return Array.from({ length: count }, (_unused, r) =>
    Array.from({ length: width }, (_cell, c) => `r${r}c${c}`),
  );
}

function chart(overrides: Partial<Chart> = {}): Chart {
  return { kind: "bar", title: "Chart", points: points(3), ...overrides };
}

function dashboard(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return { category: "invoices", kpis: kpis(2), charts: [chart()], updatedAt: AT, ...overrides };
}

function overview(overrides: Partial<OverviewSpec> = {}): OverviewSpec {
  return { title: "Everything", kpis: kpis(2), charts: [chart()], updatedAt: AT, ...overrides };
}

describe("clampDashboard", () => {
  it("keeps at most LIMITS.maxKpis KPIs and LIMITS.maxCharts charts", () => {
    const spec = dashboard({ kpis: kpis(9), charts: [chart(), chart(), chart(), chart(), chart(), chart()] });
    const clamped = clampDashboard(spec);
    expect(clamped.kpis).toHaveLength(LIMITS.maxKpis);
    expect(clamped.charts).toHaveLength(LIMITS.maxCharts);
    expect(clamped.kpis[0]?.label).toBe("k0");
  });

  it("truncates points per chart and table rows", () => {
    const spec = dashboard({
      charts: [
        chart({ points: points(40) }),
        chart({ kind: "table", columns: ["a", "b"], rows: rows(60, 2), points: [] }),
      ],
    });
    const clamped = clampDashboard(spec);
    expect(clamped.charts[0]?.points).toHaveLength(LIMITS.maxPointsPerChart);
    expect(clamped.charts[1]?.rows).toHaveLength(LIMITS.maxTableRows);
  });

  it("truncates columns to the table column limit and trims wide rows to match", () => {
    const spec = dashboard({
      charts: [chart({ kind: "table", columns: Array.from({ length: 12 }, (_u, i) => `c${i}`), rows: rows(2, 12) })],
    });
    const clamped = clampDashboard(spec);
    expect(clamped.charts[0]?.columns).toHaveLength(8);
    expect(clamped.charts[0]?.rows?.[0]).toHaveLength(8);
  });

  it("caps notes and leaves the input untouched", () => {
    const notes = Array.from({ length: 10 }, (_u, i) => `note ${i}`);
    const spec = dashboard({ kpis: kpis(9), notes });
    const clamped = clampDashboard(spec);
    expect(clamped.notes).toHaveLength(6);
    expect(spec.kpis).toHaveLength(9);
    expect(spec.notes).toHaveLength(10);
    expect(clamped).not.toBe(spec);
    expect(clamped.category).toBe("invoices");
    expect(clamped.updatedAt).toBe(AT);
  });

  it("survives a spec with nothing in it", () => {
    const clamped = clampDashboard({ category: "empty", kpis: [], charts: [], updatedAt: AT });
    expect(clamped.kpis).toEqual([]);
    expect(clamped.charts).toEqual([]);
    expect(clamped.notes).toBeUndefined();
  });
});

describe("clampOverview", () => {
  it("allows six KPIs and caps highlights", () => {
    const spec = overview({
      kpis: kpis(9),
      highlights: Array.from({ length: 11 }, (_u, i) => `h${i}`),
    });
    const clamped = clampOverview(spec);
    expect(clamped.kpis).toHaveLength(OVERVIEW_KPI_LIMIT);
    expect(clamped.highlights).toHaveLength(6);
    expect(spec.kpis).toHaveLength(9);
  });

  it("applies the same chart limits as a dashboard", () => {
    const spec = overview({ charts: [chart({ points: points(30) }), chart(), chart(), chart(), chart()] });
    const clamped = clampOverview(spec);
    expect(clamped.charts).toHaveLength(LIMITS.maxCharts);
    expect(clamped.charts[0]?.points).toHaveLength(LIMITS.maxPointsPerChart);
  });
});

describe("clampChart", () => {
  it("returns a new chart and keeps the original points array intact", () => {
    const source = chart({ points: points(20) });
    const clamped = clampChart(source);
    expect(clamped).not.toBe(source);
    expect(source.points).toHaveLength(20);
    expect(clamped.points).toHaveLength(LIMITS.maxPointsPerChart);
    expect(clamped.title).toBe("Chart");
  });
});

describe("describeDashboard", () => {
  it("summarises KPIs, charts and the update time on one line", () => {
    const spec = dashboard({
      kpis: kpis(4),
      charts: [chart({ kind: "bar" }), chart({ kind: "table", rows: rows(2, 2) })],
    });
    expect(describeDashboard(spec)).toBe("4 KPIs, 2 charts (bar, table), updated 12:04");
  });

  it("lists each chart kind once", () => {
    const spec = dashboard({ kpis: kpis(1), charts: [chart({ kind: "bar" }), chart({ kind: "bar" })] });
    expect(describeDashboard(spec)).toBe("1 KPI, 2 charts (bar), updated 12:04");
  });

  it("names the empty cases", () => {
    const spec = dashboard({ kpis: [], charts: [] });
    expect(describeDashboard(spec)).toBe("no KPIs, no charts, updated 12:04");
  });

  it("drops the clock when the timestamp cannot be parsed", () => {
    expect(describeDashboard(dashboard({ kpis: kpis(2), charts: [], updatedAt: "not-a-date" }))).toBe(
      "2 KPIs, no charts",
    );
  });

  it("describes an overview the same way", () => {
    expect(describeOverview(overview({ kpis: kpis(3), charts: [chart({ kind: "donut" })] }))).toBe(
      "3 KPIs, 1 chart (donut), updated 12:04",
    );
  });
});

describe("chartKey", () => {
  it("prefers the chart id and falls back to the index", () => {
    expect(chartKey(chart({ id: "spend-by-team" }), 2)).toBe("spend-by-team");
    expect(chartKey(chart({ id: "  " }), 2)).toBe("chart-2");
    expect(chartKey(chart(), 0)).toBe("chart-0");
  });
});
