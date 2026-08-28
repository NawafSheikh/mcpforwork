/**
 * Profile preview (owner A11): what the agent will be able to see, shown to the human
 * first. Every value on this card is the masked one, so the card doubles as the proof
 * that the masking is real. "Forget this file" drops the rows out of memory for good.
 */

import { formatBytes } from "../parse";
import type { ColumnProfile, DatasetProfile } from "../types";
import "./dataset.css";

const WITHHELD_LABELS: Readonly<Record<NonNullable<ColumnProfile["topWithheld"]>, string>> = {
  emails: "addresses withheld",
  "high-cardinality": "too many values to list",
};

const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

const compact = (value: number): string =>
  Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value * 100) / 100);

/** The right hand cell of the column table: whatever that column type can honestly say. */
function columnFacts(column: ColumnProfile): string {
  if (column.numeric) {
    return `min ${compact(column.numeric.min)} · max ${compact(column.numeric.max)} · mean ${compact(column.numeric.mean)}`;
  }
  if (column.dateRange) return `${column.dateRange.min} to ${column.dateRange.max}`;
  if (column.top) return column.top.map((item) => `${item.label} (${item.count})`).slice(0, 3).join(" · ");
  if (column.topWithheld) return WITHHELD_LABELS[column.topWithheld];
  return "";
}

function ColumnRow({ column }: { readonly column: ColumnProfile }): JSX.Element {
  return (
    <tr>
      <td className="mfw-ds__col">{column.name}</td>
      <td>
        <span className={`mfw-ds__type mfw-ds__type-${column.type}`}>{column.type}</span>
      </td>
      <td className="mfw-ds__num">{column.cardinalityAtLeast ? `${column.cardinality}+` : column.cardinality}</td>
      <td className="mfw-ds__num">{percent(column.nullRate)}</td>
      <td className="mfw-ds__facts">{columnFacts(column)}</td>
    </tr>
  );
}

function SampleRow({
  row,
  columns,
}: {
  readonly row: Readonly<Record<string, string>>;
  readonly columns: readonly ColumnProfile[];
}): JSX.Element {
  return (
    <tr>
      {columns.map((column) => (
        <td key={column.name} className="mfw-ds__masked">
          {row[column.name] === "" ? "·" : row[column.name]}
        </td>
      ))}
    </tr>
  );
}

export interface ProfileCardProps {
  readonly profile: DatasetProfile;
  readonly onForget: (name: string) => void;
}

export function ProfileCard({ profile, onForget }: ProfileCardProps): JSX.Element {
  const sampleColumns = profile.columns.slice(0, 6);
  return (
    <article className="mfw-ds__card">
      <header className="mfw-ds__card-top">
        <div>
          <h4 className="mfw-ds__name">{profile.name}</h4>
          <p className="mfw-ds__meta">
            {`${profile.rowCount.toLocaleString("en-GB")} rows · ${profile.columns.length} columns · ${formatBytes(profile.bytes)} · in memory only`}
          </p>
        </div>
        <button type="button" className="mfw-ds__forget" onClick={() => onForget(profile.name)}>
          Forget this file
        </button>
      </header>

      <table className="mfw-ds__table">
        <caption className="mfw-ds__caption">What the agent can see</caption>
        <thead>
          <tr>
            <th scope="col">Column</th>
            <th scope="col">Type</th>
            <th scope="col">Distinct</th>
            <th scope="col">Blank</th>
            <th scope="col">Aggregates</th>
          </tr>
        </thead>
        <tbody>
          {profile.columns.map((column) => (
            <ColumnRow key={column.name} column={column} />
          ))}
        </tbody>
      </table>

      {profile.sample.length > 0 ? (
        <div className="mfw-ds__sample">
          <p className="mfw-ds__sample-title">Example rows, masked</p>
          <table className="mfw-ds__table mfw-ds__table-sample">
            <thead>
              <tr>
                {sampleColumns.map((column) => (
                  <th key={column.name} scope="col">
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profile.sample.map((row, index) => (
                <SampleRow key={index} row={row} columns={sampleColumns} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
