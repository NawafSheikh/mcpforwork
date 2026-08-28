/**
 * Dataset types (owner A11). The rule this module exists to enforce:
 * a DatasetTable (raw cells) never leaves the browser tab and never reaches a tool
 * result, the store or IndexedDB. Only a DatasetProfile, which is masked and
 * aggregate-only, is ever handed to the agent.
 *
 * Rows are arrays, not objects, on purpose: no header string can ever become an
 * object key, so a hostile spreadsheet cannot reach Object.prototype.
 */

import type { ISODate } from "../types";

export type CellValue = string | number | boolean | null;

/** Raw parsed file. In-memory only. Never serialised, never persisted. */
export interface DatasetTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly CellValue[])[];
}

export type ColumnType = "number" | "date" | "boolean" | "text" | "empty";

export interface NumericStats {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly sum: number;
}

export interface DateRange {
  readonly min: string;
  readonly max: string;
}

/** A masked label with how many rows carried it. Labels are never raw emails. */
export interface ValueCount {
  readonly label: string;
  readonly count: number;
}

export interface ColumnProfile {
  readonly name: string;
  readonly type: ColumnType;
  /** Share of rows that were blank, 0..1, rounded to 4 decimals. */
  readonly nullRate: number;
  readonly cardinality: number;
  /** Distinct values hit the internal cap, so cardinality is a floor, not an exact count. */
  readonly cardinalityAtLeast?: boolean;
  readonly numeric?: NumericStats;
  readonly dateRange?: DateRange;
  /** Top 8 masked values, only for columns that behave like categories. */
  readonly top?: readonly ValueCount[];
  /** Why no top list: the column is an identifier or holds email addresses. */
  readonly topWithheld?: "high-cardinality" | "emails";
  /** Set when any cell in the column looked like an email address. */
  readonly hasEmails?: boolean;
}

/** Three example rows with every value masked. Column name -> masked token. */
export type MaskedRow = Readonly<Record<string, string>>;

export interface DatasetProfile {
  readonly id: string;
  /** The file name the human dropped. */
  readonly name: string;
  readonly rowCount: number;
  readonly bytes: number;
  readonly columns: readonly ColumnProfile[];
  readonly sample: readonly MaskedRow[];
  readonly profiledAt: ISODate;
}

/** What the in-memory registry holds: the profile the agent may see, plus the rows it may not. */
export interface LoadedDataset {
  readonly profile: DatasetProfile;
  readonly table: DatasetTable;
}

export type MetricOp = "count" | "sum" | "mean" | "min" | "max";
export type FilterOp = "eq" | "neq" | "gt" | "lt" | "contains";

export interface AggregatePoint {
  readonly label: string;
  readonly value: number;
}

export interface AggregateResult {
  readonly points: readonly AggregatePoint[];
  /** Distinct groups found before the top-N cut. */
  readonly groups: number;
  /** Rows left after the filter. */
  readonly matched: number;
  /** Rows skipped because the metric cell was blank or not a number. */
  readonly skipped: number;
  /** Groups withheld because a single row stood behind them. */
  readonly hidden: number;
}

/** Hard caps for a file a human drops. Whichever is hit first wins. */
export const DATASET_LIMITS = {
  maxBytes: 5_000_000,
  maxRows: 100_000,
  maxColumns: 64,
  topValues: 8,
  sampleRows: 3,
  labelChars: 40,
  /** Above this many distinct values a text column is an identifier, not a category. */
  categoricalMax: 50,
  /**
   * A value seen once is a row, not a category. It is never listed in a top 8 and never
   * returned as an aggregate group: the sum of one row is that row's cell.
   */
  minLabelCount: 2,
} as const;

export const PROVENANCE_SUFFIX = "profiled in this browser, rows never left the page";

export const provenanceFor = (fileName: string): string =>
  `from ${fileName}, ${PROVENANCE_SUFFIX}`;
