/**
 * Parsing (owner A11). CSV through papaparse, XLSX through SheetJS, both entirely in
 * this tab: no upload, no worker on someone else's machine, no network call.
 *
 * Rows come out as arrays rather than objects, so a header called "__proto__" is just
 * a string in a list and can never become a key on anything.
 */

import Papa from "papaparse";
import { profileTable } from "./profile";
import { DATASET_LIMITS, type CellValue, type DatasetTable, type LoadedDataset } from "./types";

export type ParsePhase = "reading" | "parsing" | "profiling" | "done";

export interface ParseProgress {
  readonly phase: ParsePhase;
  /** 0..1, coarse and monotonic. */
  readonly ratio: number;
  readonly rows: number;
}

export interface ParseOptions {
  readonly onProgress?: (progress: ParseProgress) => void;
  readonly now?: () => Date;
}

/** Every failure a human can cause, in words they can act on. */
export class DatasetFileError extends Error {}

const MB = 1_000_000;
const CSV_EXT = /\.(csv|tsv|txt)$/i;
const XLSX_EXT = /\.(xlsx|xlsm|xls)$/i;

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const formatBytes = (bytes: number): string =>
  bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;

export function checkSize(name: string, bytes: number): void {
  if (bytes <= DATASET_LIMITS.maxBytes) return;
  throw new DatasetFileError(
    `${name} is ${formatBytes(bytes)}. The cap is ${formatBytes(DATASET_LIMITS.maxBytes)} so parsing stays instant and nothing has to leave this tab. Filter or split the file and drop it again.`,
  );
}

function checkShape(name: string, rows: number, columns: number): void {
  if (rows > DATASET_LIMITS.maxRows) {
    throw new DatasetFileError(
      `${name} holds ${rows.toLocaleString("en-GB")} rows. The cap is ${DATASET_LIMITS.maxRows.toLocaleString("en-GB")}. Aggregate or split it first.`,
    );
  }
  if (columns > DATASET_LIMITS.maxColumns) {
    throw new DatasetFileError(
      `${name} has ${columns} columns. The cap is ${DATASET_LIMITS.maxColumns}. Drop the columns you do not need and try again.`,
    );
  }
  if (rows === 0) throw new DatasetFileError(`${name} has a header but no data rows.`);
}

/** Blank and duplicate headers are real; both get a stable, boring name. */
export function normaliseHeaders(raw: readonly CellValue[]): readonly string[] {
  const seen = new Map<string, number>();
  return raw.map((cell, index) => {
    const base = String(cell ?? "").trim() || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function normaliseCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoOf(value);
  return String(value);
}

const isoOf = (date: Date): string => {
  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
};

const isEmptyRow = (row: readonly CellValue[]): boolean =>
  row.every((cell) => cell === null || (typeof cell === "string" && cell.trim().length === 0));

/** Grid in, table out: first row is the header, the rest are padded to its width. */
export function tableFromGrid(grid: readonly (readonly unknown[])[], name: string): DatasetTable {
  const [head, ...body] = grid;
  if (head === undefined) throw new DatasetFileError(`${name} is empty.`);
  const columns = normaliseHeaders(head.map(normaliseCell));
  const rows = body
    .map((row) => {
      const cells = row.map(normaliseCell);
      return columns.map((_column, index) => cells[index] ?? null);
    })
    .filter((row) => !isEmptyRow(row));
  checkShape(name, rows.length, columns.length);
  return { columns, rows };
}

export function parseCsvText(text: string, name: string): DatasetTable {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  const fatal = parsed.errors.find((error) => error.type === "Quotes" || error.code === "UndetectableDelimiter");
  if (fatal) {
    throw new DatasetFileError(`${name} could not be read as CSV: ${fatal.message}.`);
  }
  return tableFromGrid(parsed.data, name);
}

/** SheetJS is a megabyte, so it only loads when someone actually drops a spreadsheet. */
async function parseWorkbook(buffer: ArrayBuffer, name: string): Promise<DatasetTable> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheetName = book.SheetNames[0];
  const sheet = sheetName ? book.Sheets[sheetName] : undefined;
  if (!sheet) throw new DatasetFileError(`${name} has no sheets to read.`);
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  return tableFromGrid(grid, name);
}

const report = (options: ParseOptions, phase: ParsePhase, ratio: number, rows: number): void =>
  options.onProgress?.({ phase, ratio, rows });

/** The whole path a dropped file takes: bytes, grid, profile. Rows stop here. */
export async function parseFile(file: File, options: ParseOptions = {}): Promise<LoadedDataset> {
  const name = file.name || "dropped file";
  checkSize(name, file.size);
  report(options, "reading", 0.1, 0);
  await tick();
  report(options, "parsing", 0.35, 0);
  const table = await readTable(file, name);
  await tick();
  report(options, "profiling", 0.75, table.rows.length);
  const profile = profileTable(table, {
    id: `ds_${Math.random().toString(36).slice(2, 10)}`,
    name,
    bytes: file.size,
    ...(options.now ? { now: options.now } : {}),
  });
  report(options, "done", 1, table.rows.length);
  return { profile, table };
}

async function readTable(file: File, name: string): Promise<DatasetTable> {
  if (XLSX_EXT.test(name)) return parseWorkbook(await readBuffer(file), name);
  if (!CSV_EXT.test(name)) {
    throw new DatasetFileError(`${name} is not a CSV or XLSX file. Drop a .csv or .xlsx instead.`);
  }
  return parseCsvText(await readText(file), name);
}

/** Blob.text and Blob.arrayBuffer are recent; FileReader is the floor everywhere. */
function viaReader<T extends string | ArrayBuffer>(start: (reader: FileReader) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(new DatasetFileError("The browser could not read that file."));
    start(reader);
  });
}

const readText = (file: File): Promise<string> =>
  typeof file.text === "function"
    ? file.text()
    : viaReader<string>((reader) => reader.readAsText(file));

const readBuffer = (file: File): Promise<ArrayBuffer> =>
  typeof file.arrayBuffer === "function"
    ? file.arrayBuffer()
    : viaReader<ArrayBuffer>((reader) => reader.readAsArrayBuffer(file));
