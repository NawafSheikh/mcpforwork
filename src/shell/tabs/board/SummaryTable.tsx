/**
 * The stored aggregates for one category, as a compact table.
 * This is what a category looks like before any dashboard exists, and it stays
 * visible afterwards so a human can see the numbers the charts were built from.
 * Aggregates only: the contract never carries a raw record.
 */

import { TableView, formatNumber } from "../../../dsl";
import type { DatasetSummary } from "../../../types";
import "./board.css";

const COLUMNS = ["Group", "Measure", "Value"] as const;
const MAX_TOP_ITEMS = 5;

type Row = readonly (string | number)[];

export interface SummaryTableProps {
  readonly summary: DatasetSummary;
  readonly caption?: string;
}

export function SummaryTable({ summary, caption }: SummaryTableProps): JSX.Element {
  const rows = summaryRows(summary);
  return (
    <div className="mfw-summary">
      <div className="mfw-summary__body">
        <TableView columns={[...COLUMNS]} rows={rows} caption={caption ?? "Stored aggregates"} />
      </div>
      <p className="mfw-summary__meta">{summaryMeta(summary)}</p>
    </div>
  );
}

/** Counts, then sums, then the top lists, flattened into one table. */
export function summaryRows(summary: DatasetSummary): readonly Row[] {
  return [
    ...entries(summary.counts).map(([key, value]): Row => ["Counts", key, value]),
    ...entries(summary.sums).map(([key, value]): Row => ["Sums", key, value]),
    ...topRows(summary),
  ];
}

/** One line under the table saying how fresh and how big the sample is. */
export function summaryMeta(summary: DatasetSummary): string {
  const parts = [
    summary.period ? `period ${summary.period}` : undefined,
    typeof summary.rowCount === "number" ? `${formatNumber(summary.rowCount)} records` : undefined,
    "aggregates only, no raw records stored",
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

/** Short facts for the "build this dashboard" prompt. */
export function summaryFacts(summary: DatasetSummary): readonly string[] {
  return summaryRows(summary)
    .slice(0, 12)
    .map((row) => `${String(row[1])} = ${String(row[2])}`);
}

function entries(record: Readonly<Record<string, number>> | undefined): readonly (readonly [string, number])[] {
  return Object.entries(record ?? {}).map(([key, value]) => [key, value] as const);
}

function topRows(summary: DatasetSummary): readonly Row[] {
  return Object.entries(summary.top ?? {}).flatMap(([group, items]) =>
    (items ?? []).slice(0, MAX_TOP_ITEMS).map((item): Row => [`Top ${group}`, item.label, item.value]),
  );
}
