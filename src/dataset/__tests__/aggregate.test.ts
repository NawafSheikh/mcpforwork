/** Group by, filters, top N, junk numbers, and 50k rows inside the budget. */
import { describe, expect, it } from "vitest";
import { AggregateError, aggregateTable, passesFilter } from "../aggregate";
import { LIMITS } from "../../types";
import type { CellValue, DatasetTable } from "../types";

const orders: DatasetTable = {
  columns: ["region", "channel", "amount", "closed"],
  rows: [
    ["EMEA", "direct", "100", "yes"],
    ["EMEA", "partner", "300", "no"],
    ["EMEA", "direct", "200", "yes"],
    ["AMER", "direct", "500", "yes"],
    ["AMER", "partner", "50", "no"],
    ["APAC", "partner", "", "yes"],
    ["APAC", "direct", "not a number", "no"],
  ],
};

const query = (over: Partial<Parameters<typeof aggregateTable>[1]> = {}) =>
  aggregateTable(orders, {
    groupBy: "region",
    metric: { column: "amount", op: "sum" },
    ...over,
  });

describe("group by and metrics", () => {
  it("sums a numeric column per group, biggest first", () => {
    expect(query().points).toEqual([
      { label: "EMEA", value: 600 },
      { label: "AMER", value: 550 },
    ]);
  });

  it("counts the rows that actually carry a value", () => {
    const result = query({ metric: { column: "amount", op: "count" } });
    expect(result.points).toEqual([
      { label: "EMEA", value: 3 },
      { label: "AMER", value: 2 },
    ]);
  });

  it("means over the numeric cells, not over every row", () => {
    const result = query({ metric: { column: "amount", op: "mean" } });
    expect(result.points[0]).toEqual({ label: "AMER", value: 275 });
    expect(result.points[1]).toEqual({ label: "EMEA", value: 200 });
  });

  it("returns min ascending and max descending, because that is the interesting end", () => {
    const min = query({ metric: { column: "amount", op: "min" } });
    expect(min.points[0]).toEqual({ label: "AMER", value: 50 });
    const max = query({ metric: { column: "amount", op: "max" } });
    expect(max.points[0]).toEqual({ label: "AMER", value: 500 });
  });

  it("groups blanks under a named bucket rather than dropping them", () => {
    const table: DatasetTable = {
      columns: ["team", "hours"],
      rows: [["a", "1"], ["a", "2"], [null, "3"], ["  ", "4"]],
    };
    const result = aggregateTable(table, {
      groupBy: "team",
      metric: { column: "hours", op: "sum" },
    });
    expect(result.points).toEqual([
      { label: "(blank)", value: 7 },
      { label: "a", value: 3 },
    ]);
  });
});

describe("groups of one row", () => {
  it("withholds them, because the sum of one row is that row", () => {
    const result = query();
    expect(result.groups).toBe(3);
    expect(result.hidden).toBe(1);
    expect(result.points.map((point) => point.label)).not.toContain("APAC");
  });

  it("withholds them for count as well, so the rule is one rule", () => {
    const table: DatasetTable = { columns: ["g"], rows: [["x"], ["x"], ["lonely"]] };
    const result = aggregateTable(table, { groupBy: "g", metric: { column: "g", op: "count" } });
    expect(result.points).toEqual([{ label: "x", value: 2 }]);
    expect(result.hidden).toBe(1);
  });
});

describe("blank and junk cells", () => {
  it("skips them and says how many it skipped", () => {
    const result = query();
    expect(result.skipped).toBe(2);
    expect(result.matched).toBe(orders.rows.length);
    expect(result.points.every((point) => Number.isFinite(point.value))).toBe(true);
  });

  it("never emits NaN when a whole group is unparseable", () => {
    const table: DatasetTable = { columns: ["g", "v"], rows: [["x", "abc"], ["x", ""]] };
    const result = aggregateTable(table, { groupBy: "g", metric: { column: "v", op: "mean" } });
    expect(result.points).toEqual([]);
    expect(result.skipped).toBe(2);
  });

  it("still answers when only some cells in a group are junk", () => {
    const table: DatasetTable = {
      columns: ["g", "v"],
      rows: [["x", "10"], ["x", "abc"], ["x", "30"]],
    };
    const result = aggregateTable(table, { groupBy: "g", metric: { column: "v", op: "mean" } });
    expect(result.points).toEqual([{ label: "x", value: 20 }]);
    expect(result.skipped).toBe(1);
  });
});

describe("filters", () => {
  it("eq and neq compare as text, case insensitively", () => {
    const eq = query({ filter: { column: "channel", op: "eq", value: "DIRECT" } });
    expect(eq.matched).toBe(4);
    const neq = query({ filter: { column: "channel", op: "neq", value: "direct" } });
    expect(neq.matched).toBe(3);
  });

  it("contains matches a substring, case insensitively", () => {
    const result = query({ filter: { column: "region", op: "contains", value: "EM" } });
    expect(result.points).toEqual([{ label: "EMEA", value: 600 }]);
  });

  it("gt and lt compare as numbers when both sides are numeric", () => {
    const result = query({ filter: { column: "amount", op: "gt", value: 150 } });
    expect(result.matched).toBe(3);
    expect(result.points).toEqual([{ label: "EMEA", value: 500 }]);
    expect(result.hidden).toBe(1);
  });

  it("breaks ties alphabetically, so a chart is stable between calls", () => {
    const table: DatasetTable = {
      columns: ["g", "v"],
      rows: [["zeta", "5"], ["zeta", "5"], ["alpha", "5"], ["alpha", "5"]],
    };
    const result = aggregateTable(table, { groupBy: "g", metric: { column: "v", op: "sum" } });
    expect(result.points.map((point) => point.label)).toEqual(["alpha", "zeta"]);
  });

  it("falls back to text order when a side is not a number", () => {
    expect(passesFilter("banana", "gt", "apple")).toBe(true);
    expect(passesFilter("apple", "lt", "banana")).toBe(true);
    expect(passesFilter(null, "contains", "")).toBe(false);
  });
});

describe("top N", () => {
  const wide: DatasetTable = {
    columns: ["bucket", "value"],
    rows: Array.from({ length: 200 }, (_row, index): readonly CellValue[] => [
      `bucket-${index % 40}`,
      String(index),
    ]),
  };

  it("never returns more points than a chart can hold", () => {
    const result = aggregateTable(wide, {
      groupBy: "bucket",
      metric: { column: "value", op: "sum" },
    });
    expect(result.groups).toBe(40);
    expect(result.points).toHaveLength(LIMITS.maxPointsPerChart);
  });

  it("honours a smaller top and clamps a larger one", () => {
    const small = aggregateTable(wide, {
      groupBy: "bucket",
      metric: { column: "value", op: "sum" },
      top: 3,
    });
    expect(small.points).toHaveLength(3);
    const huge = aggregateTable(wide, {
      groupBy: "bucket",
      metric: { column: "value", op: "sum" },
      top: 999,
    });
    expect(huge.points).toHaveLength(LIMITS.maxPointsPerChart);
  });
});

describe("unknown columns", () => {
  it("names the column and points at get_dataset_profile", () => {
    expect(() => query({ groupBy: "nope" })).toThrow(AggregateError);
    expect(() => query({ groupBy: "nope" })).toThrow(/get_dataset_profile/);
    expect(() => query({ metric: { column: "nope", op: "sum" } })).toThrow(AggregateError);
    expect(() =>
      query({ filter: { column: "nope", op: "eq", value: "x" } }),
    ).toThrow(/filter column/);
  });
});

describe("performance", () => {
  const REGIONS = ["EMEA", "AMER", "APAC", "LATAM", "MEA"] as const;
  const big: DatasetTable = {
    columns: ["region", "channel", "amount", "day"],
    rows: Array.from({ length: 50_000 }, (_row, index): readonly CellValue[] => [
      REGIONS[index % REGIONS.length] as string,
      index % 3 === 0 ? "direct" : "partner",
      String((index % 977) + 1),
      `2026-0${(index % 9) + 1}-15`,
    ]),
  };

  it("aggregates 50k rows well inside two seconds", () => {
    const started = Date.now();
    const result = aggregateTable(big, {
      groupBy: "region",
      metric: { column: "amount", op: "sum" },
      filter: { column: "channel", op: "eq", value: "direct" },
    });
    const elapsed = Date.now() - started;
    expect(result.groups).toBe(5);
    expect(result.matched).toBe(16_667);
    expect(elapsed).toBeLessThan(2000);
  });
});
