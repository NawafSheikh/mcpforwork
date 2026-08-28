/**
 * The four tools, driven exactly as the registry drives them: parse with the zod schema,
 * then call the handler with the validated input and the current workspace.
 */
import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import { LIMITS, type Workspace } from "../../types";
import { createDatasetHandlers } from "../handlers";
import { createDatasetRegistry } from "../memory";
import { profileTable } from "../profile";
import { datasetToolSchemas } from "../schemas";
import type { CellValue, DatasetTable, LoadedDataset } from "../types";

const emptyWorkspace = (): Workspace =>
  createWorkspaceStore({ mode: "demo", persist: false }).get();

const load = (name: string, table: DatasetTable): LoadedDataset => ({
  table,
  profile: profileTable(table, { id: `ds_${name}`, name, bytes: 2048 }),
});

const invoices: DatasetTable = {
  columns: ["region", "owner_email", "amount", "issued"],
  rows: [
    ["EMEA", "ana@corp.com", "1200", "2026-01-05"],
    ["EMEA", "ben@corp.com", "800", "2026-02-11"],
    ["AMER", "ana@corp.com", "400", "2026-03-02"],
    ["AMER", "cai@corp.com", "600", "2026-04-19"],
  ],
};

function setup() {
  const registry = createDatasetRegistry();
  registry.put(load("invoices.csv", invoices));
  return { registry, handlers: createDatasetHandlers(registry) };
}

const run = async <K extends keyof typeof datasetToolSchemas>(
  name: K,
  raw: unknown,
  ws: Workspace = emptyWorkspace(),
) => {
  const { registry, handlers } = setup();
  const input = datasetToolSchemas[name].parse(raw);
  // The registry strips caller before the handler ever sees it.
  const { caller: _caller, ...rest } = input as Record<string, unknown>;
  const handler = handlers[name] as (i: unknown, w: Workspace) => unknown;
  return { registry, outcome: await handler(rest, ws) } as {
    registry: ReturnType<typeof createDatasetRegistry>;
    outcome: { next?: Workspace; result: string };
  };
};

describe("list_datasets", () => {
  it("tells the agent to ask for a file when none is loaded", async () => {
    const handlers = createDatasetHandlers(createDatasetRegistry());
    const outcome = await handlers.list_datasets({}, emptyWorkspace());
    expect(outcome.result).toContain("No dataset is loaded");
    expect(outcome.next).toBeUndefined();
  });

  it("names the file, the row count and every column with its type", async () => {
    const { outcome } = await run("list_datasets", { caller: "Worker 1" });
    const parsed = JSON.parse(outcome.result) as { datasets: { columns: string[] }[] };
    expect(outcome.result).toContain("invoices.csv");
    expect(parsed.datasets[0]?.columns).toContain("amount:number");
    expect(outcome.result.length).toBeLessThanOrEqual(LIMITS.toolOutputChars);
  });
});

describe("get_dataset_profile", () => {
  it("refuses an unknown name and lists what is loaded", async () => {
    const { outcome } = await run("get_dataset_profile", { dataset: "ghost.csv" });
    expect(outcome.result).toContain("No dataset called \"ghost.csv\"");
    expect(outcome.result).toContain("invoices.csv");
  });

  it("returns the shape and a masked sample, never an address", async () => {
    const { outcome } = await run("get_dataset_profile", { dataset: "invoices.csv" });
    const parsed = JSON.parse(outcome.result) as { sample: Record<string, string>[] };
    expect(parsed.sample[0]).toEqual({
      region: "abc…",
      owner_email: "user@…",
      amount: "~1.2k",
      issued: "2026-01-…",
    });
    expect(outcome.result).not.toContain("ana@corp.com");
    expect(outcome.result).not.toContain("EMEA\",\"1200");
  });

  it("stays inside the output budget on a wide file and still parses as JSON", async () => {
    const columns = Array.from({ length: 40 }, (_c, index) => `metric_number_${index}`);
    const rows = Array.from({ length: 30 }, (): readonly CellValue[] =>
      columns.map((_column, index) => String(index * 137)),
    );
    const registry = createDatasetRegistry();
    registry.put(load("wide.csv", { columns, rows }));
    const handlers = createDatasetHandlers(registry);
    const outcome = await handlers.get_dataset_profile({ dataset: "wide.csv" }, emptyWorkspace());
    expect(outcome.result.length).toBeLessThanOrEqual(LIMITS.toolOutputChars);
    expect(() => JSON.parse(outcome.result)).not.toThrow();
  });
});

describe("aggregate_dataset", () => {
  it("returns labelled points a dashboard can use", async () => {
    const { outcome } = await run("aggregate_dataset", {
      dataset: "invoices.csv",
      groupBy: "region",
      metric: { column: "amount", op: "sum" },
    });
    const parsed = JSON.parse(outcome.result) as { points: { label: string; value: number }[] };
    expect(parsed.points).toEqual([
      { label: "EMEA", value: 2000 },
      { label: "AMER", value: 1000 },
    ]);
    expect(outcome.result.length).toBeLessThanOrEqual(LIMITS.toolOutputChars);
  });

  it("refuses to group by a column of email addresses", async () => {
    const { outcome } = await run("aggregate_dataset", {
      dataset: "invoices.csv",
      groupBy: "owner_email",
      metric: { column: "amount", op: "sum" },
    });
    expect(outcome.result).toContain("Refused");
    expect(outcome.result).toContain("one row per person");
    expect(outcome.result).not.toContain("ana@corp.com");
  });

  it("refuses to sum a text column and says what to do instead", async () => {
    const { outcome } = await run("aggregate_dataset", {
      dataset: "invoices.csv",
      groupBy: "region",
      metric: { column: "region", op: "sum" },
    });
    expect(outcome.result).toContain("op count");
  });

  it("turns an unknown column into a sentence, not a thrown error", async () => {
    const { outcome } = await run("aggregate_dataset", {
      dataset: "invoices.csv",
      groupBy: "nope",
      metric: { column: "amount", op: "sum" },
    });
    expect(outcome.result).toContain("Unknown groupBy column");
  });

  it("rejects a top outside 1..12 at the schema, before any handler runs", () => {
    expect(
      datasetToolSchemas.aggregate_dataset.safeParse({
        dataset: "invoices.csv",
        groupBy: "region",
        metric: { column: "amount", op: "sum" },
        top: 99,
      }).success,
    ).toBe(false);
  });
});

describe("attach_dataset_to_category", () => {
  it("stores the profile as the category summary with honest provenance", async () => {
    const { outcome } = await run("attach_dataset_to_category", {
      dataset: "invoices.csv",
      category: "Invoices",
    });
    const category = outcome.next?.categories["Invoices"];
    expect(category?.provenance).toBe(
      "from invoices.csv, profiled in this browser, rows never left the page",
    );
    expect(category?.summary?.rowCount).toBe(4);
    expect(category?.summary?.sums).toEqual({ amount: 3000 });
    expect(category?.summary?.counts).toEqual({ "region distinct": 2, "owner_email distinct": 3 });
    expect(category?.summary?.period).toBe("2026-01-05 to 2026-04-19");
    expect(outcome.result).toContain("rows themselves stayed in the browser");
  });

  it("puts no cell of the file into the workspace", async () => {
    const { outcome } = await run("attach_dataset_to_category", {
      dataset: "invoices.csv",
      category: "Invoices",
    });
    const stored = JSON.stringify(outcome.next);
    for (const secret of ["ana@corp.com", "ben@corp.com", "1200", "2026-02-11"]) {
      expect(stored).not.toContain(secret);
    }
  });

  it("refuses once the workspace is at the category cap", async () => {
    const base = emptyWorkspace();
    const full: Workspace = {
      ...base,
      categories: Object.fromEntries(
        Array.from({ length: LIMITS.maxCategories }, (_c, index) => [
          `c${index}`,
          { name: `c${index}`, createdAt: base.updatedAt },
        ]),
      ),
    };
    const { outcome } = await run(
      "attach_dataset_to_category",
      { dataset: "invoices.csv", category: "One more" },
      full,
    );
    expect(outcome.result).toContain("Refused");
    expect(outcome.next).toBeUndefined();
  });
});
