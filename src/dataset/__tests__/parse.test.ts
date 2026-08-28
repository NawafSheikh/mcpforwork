/** Parsing: real CSV quirks, a real XLSX round trip, the caps, and no prototype reach. */
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  DatasetFileError,
  checkSize,
  formatBytes,
  normaliseHeaders,
  parseCsvText,
  parseFile,
  tableFromGrid,
} from "../parse";
import { DATASET_LIMITS } from "../types";

const csv = [
  "region,amount,note",
  'EMEA,1200,"a note, with a comma"',
  "AMER,800,plain",
  "APAC,,",
].join("\n");

describe("csv", () => {
  it("takes the first row as the header and keeps quoted commas whole", () => {
    const table = parseCsvText(csv, "orders.csv");
    expect(table.columns).toEqual(["region", "amount", "note"]);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]?.[2]).toBe("a note, with a comma");
  });

  it("pads a short row instead of shifting the columns", () => {
    const table = parseCsvText("a,b,c\n1,2", "short.csv");
    expect(table.rows[0]).toEqual(["1", "2", null]);
  });

  it("names blank headers and disambiguates duplicates", () => {
    expect(normaliseHeaders(["name", "", "name", null])).toEqual([
      "name",
      "column_2",
      "name_2",
      "column_4",
    ]);
  });

  it("refuses a file with a header and nothing else", () => {
    expect(() => parseCsvText("a,b,c", "empty.csv")).toThrow(DatasetFileError);
    expect(() => parseCsvText("a,b,c", "empty.csv")).toThrow(/no data rows/);
  });
});

describe("hostile headers", () => {
  it("cannot reach Object.prototype, because rows are arrays", () => {
    const table = parseCsvText("__proto__,constructor\npolluted,also", "evil.csv");
    expect(table.columns).toEqual(["__proto__", "constructor"]);
    expect(table.rows[0]).toEqual(["polluted", "also"]);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call({}, "polluted")).toBe(false);
  });
});

describe("caps", () => {
  it("refuses a file over five megabytes before reading a byte of it", () => {
    expect(() => checkSize("huge.csv", DATASET_LIMITS.maxBytes + 1)).toThrow(DatasetFileError);
    expect(() => checkSize("huge.csv", DATASET_LIMITS.maxBytes + 1)).toThrow(/cap is 5.0 MB/);
    expect(() => checkSize("fine.csv", DATASET_LIMITS.maxBytes)).not.toThrow();
  });

  it("refuses more rows than the cap", () => {
    const grid = [["a"], ...Array.from({ length: DATASET_LIMITS.maxRows + 1 }, () => ["x"])];
    expect(() => tableFromGrid(grid, "long.csv")).toThrow(/cap is 100,000/);
  });

  it("refuses more columns than the cap", () => {
    const wide = Array.from({ length: DATASET_LIMITS.maxColumns + 1 }, (_c, i) => `c${i}`);
    expect(() => tableFromGrid([wide, wide], "wide.csv")).toThrow(/cap is 64/);
  });

  it("prints sizes a human recognises", () => {
    expect(formatBytes(5_000_000)).toBe("5.0 MB");
    expect(formatBytes(12_400)).toBe("12 KB");
  });
});

describe("whole file path", () => {
  const asFile = (content: BlobPart, name: string): File => new File([content], name);

  it("parses a dropped CSV and profiles it, reporting progress on the way", async () => {
    const phases: string[] = [];
    const loaded = await parseFile(asFile(csv, "orders.csv"), {
      onProgress: (progress) => phases.push(progress.phase),
    });
    expect(loaded.profile.name).toBe("orders.csv");
    expect(loaded.profile.rowCount).toBe(3);
    expect(loaded.profile.columns.map((column) => column.type)).toEqual([
      "text",
      "number",
      "text",
    ]);
    expect(phases).toContain("parsing");
    expect(phases[phases.length - 1]).toBe("done");
  });

  it("parses a real XLSX workbook, dates included", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["team", "spend", "when"],
      ["Ops", 1200, new Date("2026-03-04T00:00:00.000Z")],
      ["Ops", 900, new Date("2026-04-04T00:00:00.000Z")],
      ["Sales", 400, new Date("2026-05-04T00:00:00.000Z")],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const loaded = await parseFile(asFile(bytes, "spend.xlsx"));
    expect(loaded.table.columns).toEqual(["team", "spend", "when"]);
    expect(loaded.profile.rowCount).toBe(3);
    expect(loaded.profile.columns[1]?.numeric?.sum).toBe(2500);
    expect(loaded.profile.columns[2]?.type).toBe("date");
  });

  it("refuses a file type it cannot parse", async () => {
    await expect(parseFile(asFile("{}", "notes.json"))).rejects.toThrow(/not a CSV or XLSX/);
  });

  it("refuses an oversized file without reading it", async () => {
    const big = new File(["x"], "big.csv");
    Object.defineProperty(big, "size", { value: DATASET_LIMITS.maxBytes + 1 });
    await expect(parseFile(big)).rejects.toThrow(DatasetFileError);
  });
});
