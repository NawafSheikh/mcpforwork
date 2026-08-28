/** Type inference, per column stats, and the masked schema example. */
import { describe, expect, it } from "vitest";
import { looksLikeDate, toBoolean, toNumber, toTimestamp } from "../infer";
import { columnByName, profilePeriod, profileTable } from "../profile";
import type { CellValue, DatasetTable } from "../types";

const table = (columns: readonly string[], rows: readonly (readonly CellValue[])[]): DatasetTable => ({
  columns,
  rows,
});

const profileOf = (input: DatasetTable) =>
  profileTable(input, { id: "ds_test", name: "sample.csv", bytes: 1024, now: () => new Date("2026-08-28T09:00:00.000Z") });

describe("number coercion", () => {
  const cases: readonly (readonly [CellValue, number | null])[] = [
    ["1,234.5", 1234.5],
    ["1.234,56", 1234.56],
    ["(1,200)", -1200],
    ["-42", -42],
    ["  7  ", 7],
    ["abc", null],
    ["", null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [true, 1],
    [null, null],
  ];

  it.each(cases)("reads %s as %s", (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
});

describe("date and boolean coercion", () => {
  it("accepts ISO and day first slashes, rejects a bare year", () => {
    expect(looksLikeDate("2026-08-27")).toBe(true);
    expect(looksLikeDate("27/08/2026")).toBe(true);
    expect(looksLikeDate("2026")).toBe(false);
    expect(looksLikeDate("banana")).toBe(false);
    expect(toTimestamp("2026-08-27")).toBe(Date.parse("2026-08-27"));
  });

  it("reads the usual spreadsheet words", () => {
    expect(toBoolean("yes")).toBe(true);
    expect(toBoolean("NO")).toBe(false);
    expect(toBoolean("maybe")).toBe(null);
  });
});

describe("column profiling", () => {
  const invoices = table(
    ["region", "amount", "paid_on", "settled", "note"],
    [
      ["EMEA", "1200", "2026-01-05", "yes", "first"],
      ["EMEA", "800", "2026-02-11", "no", ""],
      ["AMER", "400", "2026-03-02", "yes", "third"],
      ["AMER", "", "2026-04-19", "no", "fourth"],
      ["APAC", "600.5", "2026-05-30", "yes", "fifth"],
    ],
  );

  it("types each column from what most of its cells look like", () => {
    const profile = profileOf(invoices);
    expect(profile.columns.map((column) => column.type)).toEqual([
      "text",
      "number",
      "date",
      "boolean",
      "text",
    ]);
  });

  it("reports the null rate against every row, not just the filled ones", () => {
    const profile = profileOf(invoices);
    expect(columnByName(profile, "amount")?.nullRate).toBe(0.2);
    expect(columnByName(profile, "note")?.nullRate).toBe(0.2);
    expect(columnByName(profile, "region")?.nullRate).toBe(0);
  });

  it("computes min, max, mean and sum over the numeric cells only", () => {
    const numeric = columnByName(profileOf(invoices), "amount")?.numeric;
    expect(numeric).toEqual({ min: 400, max: 1200, mean: 750.125, sum: 3000.5 });
  });

  it("gives a date column its range and the file its period", () => {
    const profile = profileOf(invoices);
    expect(columnByName(profile, "paid_on")?.dateRange).toEqual({
      min: "2026-01-05",
      max: "2026-05-30",
    });
    expect(profilePeriod(profile)).toBe("2026-01-05 to 2026-05-30");
  });

  it("counts distinct values and ranks the top ones", () => {
    const region = columnByName(profileOf(invoices), "region");
    expect(region?.cardinality).toBe(3);
    expect(region?.top).toEqual([
      { label: "AMER", count: 2 },
      { label: "EMEA", count: 2 },
    ]);
  });

  it("caps a top list at eight values", () => {
    const rows = Array.from({ length: 40 }, (_row, index) => [`tier-${index % 20}`]);
    const top = columnByName(profileOf(table(["tier"], rows)), "tier")?.top;
    expect(top).toHaveLength(8);
    expect(top?.every((item) => item.count === 2)).toBe(true);
  });
});

describe("values the profile refuses to list", () => {
  it("withholds the top list of an identifier column", () => {
    const rows = Array.from({ length: 120 }, (_row, index) => [`order-${index}`]);
    const column = columnByName(profileOf(table(["order_id"], rows)), "order_id");
    expect(column?.top).toBeUndefined();
    expect(column?.topWithheld).toBe("high-cardinality");
    expect(column?.cardinality).toBe(120);
  });

  it("withholds the top list of an email column even when it is short", () => {
    const rows = [["a@corp.com"], ["a@corp.com"], ["b@corp.com"]];
    const column = columnByName(profileOf(table(["contact"], rows)), "contact");
    expect(column?.hasEmails).toBe(true);
    expect(column?.topWithheld).toBe("emails");
    expect(JSON.stringify(column)).not.toContain("corp.com");
  });
});

describe("performance", () => {
  const REGIONS = ["EMEA", "AMER", "APAC", "LATAM", "MEA"] as const;
  const big = table(
    ["region", "team", "amount", "issued", "email", "note", "flag", "score"],
    Array.from({ length: 50_000 }, (_row, index): readonly CellValue[] => [
      REGIONS[index % REGIONS.length] as string,
      `team-${index % 37}`,
      String((index % 977) + 0.5),
      `2026-0${(index % 9) + 1}-15`,
      `person${index}@corp.com`,
      `free text number ${index}`,
      index % 2 === 0 ? "yes" : "no",
      String(index % 100),
    ]),
  );

  it("profiles 50k rows across 8 columns inside two seconds", () => {
    const started = Date.now();
    const profile = profileOf(big);
    const elapsed = Date.now() - started;
    expect(profile.rowCount).toBe(50_000);
    expect(columnByName(profile, "region")?.top).toHaveLength(5);
    expect(columnByName(profile, "email")?.topWithheld).toBe("emails");
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("the three row schema example", () => {
  const people = table(
    ["name", "email", "salary", "start", "active"],
    [
      ["Alice Smith", "alice@corp.com", "84217", "2024-03-01", "yes"],
      ["Bo Chen", "bo@corp.com", "91004", "2023-11-15", "no"],
      ["Cato Rossi", "cato@corp.com", "77500", "2025-06-30", "yes"],
      ["Dee Okafor", "dee@corp.com", "68000", "2022-01-09", "yes"],
    ],
  );

  it("shows three rows, no more", () => {
    expect(profileOf(people).sample).toHaveLength(3);
  });

  it("masks every value in them", () => {
    const [first] = profileOf(people).sample;
    expect(first).toEqual({
      name: "abc…",
      email: "user@…",
      salary: "~84k",
      start: "2024-03-…",
      active: "true",
    });
  });

  it("leaks no name, address, exact salary or exact date", () => {
    const text = JSON.stringify(profileOf(people));
    for (const secret of ["Alice", "Smith", "alice@corp.com", "84217", "2024-03-01", "Okafor"]) {
      expect(text).not.toContain(secret);
    }
  });
});
