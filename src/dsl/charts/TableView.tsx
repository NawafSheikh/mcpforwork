/**
 * Plain HTML table for a Chart of kind "table".
 * Falls back to the points list when the agent sent no columns or rows.
 */

import type { ChartPoint } from "../../types";
import { formatValue } from "../format";

export type TableRow = readonly (string | number)[];

export interface TableViewProps {
  readonly columns?: readonly string[];
  readonly rows?: readonly TableRow[];
  readonly points?: readonly ChartPoint[];
  readonly caption?: string;
}

interface TableModel {
  readonly columns: readonly string[];
  readonly rows: readonly TableRow[];
}

export function TableView({ columns, rows, points, caption }: TableViewProps) {
  const table = buildTable(columns, rows, points);
  return (
    <table className="mfw-table">
      {caption ? <caption className="mfw-visually-hidden">{caption}</caption> : null}
      <thead>
        <tr>
          {table.columns.map((column, index) => (
            <th key={`${column}-${index}`} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={`row-${rowIndex}`}>
            {table.columns.map((column, cellIndex) => (
              <td key={`${column}-${cellIndex}`} className={typeof row[cellIndex] === "number" ? "mfw-num" : ""}>
                {cellText(row[cellIndex])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildTable(
  columns: readonly string[] | undefined,
  rows: readonly TableRow[] | undefined,
  points: readonly ChartPoint[] | undefined,
): TableModel {
  if (rows && rows.length > 0) {
    return { columns: columns && columns.length > 0 ? columns : headersFor(rows), rows };
  }
  const fromPoints = (points ?? []).map((point): TableRow => [point.label, point.value]);
  return { columns: columns && columns.length > 0 ? columns : ["Item", "Value"], rows: fromPoints };
}

function headersFor(rows: readonly TableRow[]): readonly string[] {
  const width = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  return Array.from({ length: width }, (_unused, index) => `Column ${index + 1}`);
}

function cellText(cell: string | number | undefined): string {
  return cell === undefined ? "" : formatValue(cell);
}
