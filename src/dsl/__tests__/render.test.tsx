/** Smoke tests: the renderers must mount for real specs, empty specs and edge specs. */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category, DashboardSpec, OverviewSpec } from "../../types";
import { CategoryCard } from "../CategoryCard";
import { DashboardView } from "../DashboardView";
import { OverviewView } from "../OverviewView";

const AT = "2026-08-28T12:04:00";

const dashboard: DashboardSpec = {
  category: "invoices",
  title: "Invoices",
  kpis: [
    { label: "Open", value: 12400, delta: "+8%", hint: "vs last week" },
    { label: "Overdue", value: "3", delta: "-1" },
  ],
  charts: [
    { id: "by-team", kind: "bar", title: "By team", points: [{ label: "Ops", value: 4 }], note: "synthetic" },
    { kind: "line", title: "Trend", points: [{ label: "Mon", value: 1, series: "a" }] },
    { kind: "donut", title: "Split", points: [{ label: "Paid", value: 7 }] },
    { kind: "table", title: "Rows", points: [], columns: ["Vendor", "Amount"], rows: [["Acme", 120]] },
  ],
  notes: ["synthetic sample data"],
  source: "demo workspace",
  updatedAt: AT,
};

describe("DashboardView", () => {
  it("renders KPIs, chart titles, table cells and the edit control", () => {
    const html = renderToStaticMarkup(<DashboardView spec={dashboard} onEdit={() => undefined} highlight />);
    expect(html).toContain("Invoices");
    expect(html).toContain("12,400");
    expect(html).toContain("By team");
    expect(html).toContain("Acme");
    expect(html).toContain("mfw-edit");
    expect(html).toContain("mfw-pulse");
  });

  it("shows both empty states when the spec carries nothing", () => {
    const html = renderToStaticMarkup(
      <DashboardView spec={{ category: "empty", kpis: [], charts: [], updatedAt: AT }} />,
    );
    expect(html).toContain("No KPIs yet");
    expect(html).toContain("No charts yet");
    expect(html).not.toContain("mfw-pulse");
  });

  it("renders a chart with no points as an inline empty state", () => {
    const spec: DashboardSpec = {
      category: "invoices",
      kpis: [],
      charts: [{ kind: "bar", title: "Nothing", points: [] }],
      updatedAt: AT,
    };
    expect(renderToStaticMarkup(<DashboardView spec={spec} />)).toContain("No data points yet");
  });
});

describe("OverviewView", () => {
  it("renders the title, KPIs and highlights", () => {
    const spec: OverviewSpec = {
      title: "Whole workspace",
      kpis: [{ label: "Categories", value: 3 }],
      charts: [],
      highlights: ["Two monitors are active"],
      updatedAt: AT,
    };
    const html = renderToStaticMarkup(<OverviewView spec={spec} />);
    expect(html).toContain("Whole workspace");
    expect(html).toContain("Two monitors are active");
    expect(html).toContain("No overview charts yet");
  });
});

describe("CategoryCard", () => {
  it("shows provenance, both pills and the children slot", () => {
    const category: Category = {
      name: "invoices",
      description: "Synthetic vendor invoices",
      provenance: "uploaded CSV",
      createdAt: AT,
      summary: { updatedAt: AT },
      dashboard,
    };
    const html = renderToStaticMarkup(
      <CategoryCard category={category} selected onSelect={() => undefined}>
        <span>slot</span>
      </CategoryCard>,
    );
    expect(html).toContain("uploaded CSV");
    expect(html).toContain("summary stored");
    expect(html).toContain("dashboard ready");
    expect(html).toContain("slot");
    expect(html).toContain("mfw-cat--selected");
  });

  it("falls back to the pending pills", () => {
    const html = renderToStaticMarkup(
      <CategoryCard category={{ name: "empty", createdAt: AT }} />,
    );
    expect(html).toContain("summary pending");
    expect(html).toContain("dashboard pending");
  });
});
