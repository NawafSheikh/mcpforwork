/**
 * The test this feature exists for.
 *
 * A payroll file goes in. Every tool is called the way an agent would call it, plus the
 * profile and the workspace the write tool produces. Nothing that came out may contain a
 * name, an address, a phone number, an exact salary or a note. The one documented
 * exception is a repeated category label, which is what makes a chart possible at all.
 */
import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import type { Workspace } from "../../types";
import { createDatasetHandlers } from "../handlers";
import { createDatasetRegistry } from "../memory";
import { profileTable } from "../profile";
import type { CellValue, DatasetTable } from "../types";

const PEOPLE = [
  ["Alice Smith", "alice.smith@corp.com", "+356 9912 3311", "84217", "Ops", "EMEA", "on a warning"],
  ["Bo Chen", "bo.chen@corp.com", "+356 9912 3312", "91004", "Ops", "APAC", "asked for a raise"],
  ["Cato Rossi", "cato@corp.com", "+356 9912 3313", "77500", "Sales", "EMEA", "leaving in May"],
  ["Dee Okafor", "dee.okafor@corp.com", "+356 9912 3314", "68000", "Sales", "AMER", "new joiner"],
  ["Eve Nowak", "eve@corp.com", "+356 9912 3315", "120400", "Exec", "EMEA", "board matter"],
] as const;

const payroll: DatasetTable = {
  columns: ["name", "email", "phone", "salary", "team", "region", "hr_note"],
  rows: PEOPLE.map((row) => [...row] as readonly CellValue[]),
};

/**
 * Everything in the file that must never appear in an answer.
 *
 * The salaries listed here are the ones that are neither the column minimum nor its
 * maximum. min and max are exact by contract: docs/TOOLS.md promises them for every
 * numeric column, and they are the only two cells a numeric column ever publishes.
 */
const MIDDLE_SALARIES = ["84217", "91004", "77500"];

const SECRETS = [
  ...PEOPLE.map((row) => row[0]),
  ...PEOPLE.map((row) => row[1]),
  ...PEOPLE.map((row) => row[2]),
  ...PEOPLE.map((row) => row[6]),
  ...MIDDLE_SALARIES,
  "corp.com",
  "9912",
];

const expectClean = (text: string): void => {
  for (const secret of SECRETS) expect(text).not.toContain(secret);
};

const emptyWorkspace = (): Workspace =>
  createWorkspaceStore({ mode: "local", persist: false }).get();

function setup() {
  const registry = createDatasetRegistry();
  registry.put({
    table: payroll,
    profile: profileTable(payroll, { id: "ds_pay", name: "payroll.csv", bytes: 4096 }),
  });
  return createDatasetHandlers(registry);
}

describe("a payroll file dropped on the board", () => {
  it("leaks nothing through list_datasets", async () => {
    const outcome = await setup().list_datasets({}, emptyWorkspace());
    expectClean(outcome.result);
    expect(outcome.result).toContain("payroll.csv");
  });

  it("leaks nothing through get_dataset_profile", async () => {
    const outcome = await setup().get_dataset_profile({ dataset: "payroll.csv" }, emptyWorkspace());
    expectClean(outcome.result);
    expect(outcome.result).toContain("user@…");
    expect(outcome.result).toContain("abc…");
  });

  it("leaks nothing through aggregate_dataset, and still answers the question", async () => {
    const outcome = await setup().aggregate_dataset(
      { dataset: "payroll.csv", groupBy: "team", metric: { column: "salary", op: "sum" } },
      emptyWorkspace(),
    );
    expectClean(outcome.result);
    const parsed = JSON.parse(outcome.result) as {
      points: { label: string; value: number }[];
      singleRowGroupsHidden?: number;
    };
    // Team labels repeat, so they are categories rather than people. Exec is one person,
    // so its total would be that person's salary and it is withheld.
    expect(parsed.points).toEqual([
      { label: "Ops", value: 175221 },
      { label: "Sales", value: 145500 },
    ]);
    expect(parsed.singleRowGroupsHidden).toBe(1);
  });

  it("refuses to group by the email column at all", async () => {
    const outcome = await setup().aggregate_dataset(
      { dataset: "payroll.csv", groupBy: "email", metric: { column: "salary", op: "sum" } },
      emptyWorkspace(),
    );
    expectClean(outcome.result);
    expect(outcome.result).toContain("Refused");
  });

  it("leaks nothing into the workspace through attach_dataset_to_category", async () => {
    const outcome = await setup().attach_dataset_to_category(
      { dataset: "payroll.csv", category: "People" },
      emptyWorkspace(),
    );
    expectClean(outcome.result);
    expectClean(JSON.stringify(outcome.next));
    expect(outcome.next?.categories["People"]?.summary?.rowCount).toBe(5);
  });

  it("keeps the phone column out of the numeric statistics", async () => {
    const outcome = await setup().get_dataset_profile({ dataset: "payroll.csv" }, emptyWorkspace());
    const parsed = JSON.parse(outcome.result) as { columns: { name: string; type: string }[] };
    const phone = parsed.columns.find((column) => column.name === "phone");
    // Spaced digits are a phone number, not a 36 billion salary whose min and max publish it.
    expect(phone?.type).toBe("text");
  });

  it("publishes exactly two salary cells, the documented min and max", async () => {
    const outcome = await setup().get_dataset_profile({ dataset: "payroll.csv" }, emptyWorkspace());
    const parsed = JSON.parse(outcome.result) as {
      columns: { name: string; min?: number; max?: number }[];
    };
    const salary = parsed.columns.find((column) => column.name === "salary");
    expect(salary?.min).toBe(68000);
    expect(salary?.max).toBe(120400);
    for (const middle of MIDDLE_SALARIES) expect(outcome.result).not.toContain(middle);
  });

  it("never lists a value that appears only once, even in a small file", async () => {
    const outcome = await setup().get_dataset_profile({ dataset: "payroll.csv" }, emptyWorkspace());
    const parsed = JSON.parse(outcome.result) as {
      columns: { name: string; top?: [string, number][]; topWithheld?: string }[];
    };
    const byName = new Map(parsed.columns.map((column) => [column.name, column]));
    expect(byName.get("name")?.topWithheld).toBe("high-cardinality");
    expect(byName.get("hr_note")?.topWithheld).toBe("high-cardinality");
    expect(byName.get("email")?.topWithheld).toBe("emails");
    expect(byName.get("region")?.top).toEqual([["EMEA", 3]]);
  });

  it("keeps the rows reachable only through the registry, never through a handler", async () => {
    const registry = createDatasetRegistry();
    registry.put({
      table: payroll,
      profile: profileTable(payroll, { id: "ds_pay", name: "payroll.csv", bytes: 4096 }),
    });
    const handlers = createDatasetHandlers(registry);
    const answers = await Promise.all([
      handlers.list_datasets({}, emptyWorkspace()),
      handlers.get_dataset_profile({ dataset: "payroll.csv" }, emptyWorkspace()),
      handlers.aggregate_dataset(
        { dataset: "payroll.csv", groupBy: "region", metric: { column: "salary", op: "mean" } },
        emptyWorkspace(),
      ),
      handlers.aggregate_dataset(
        { dataset: "payroll.csv", groupBy: "team", metric: { column: "hr_note", op: "count" } },
        emptyWorkspace(),
      ),
    ]);
    expectClean(answers.map((answer) => answer.result).join(" "));

    // And forgetting the file really removes it: the tools go blind immediately.
    expect(registry.forget("payroll.csv")).toBe(true);
    expect(registry.table("payroll.csv")).toBeUndefined();
    const after = await handlers.get_dataset_profile({ dataset: "payroll.csv" }, emptyWorkspace());
    expect(after.result).toContain("No dataset called");
  });
});
