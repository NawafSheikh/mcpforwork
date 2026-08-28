/**
 * Tool output text (owner A11). Everything an agent reads about a dataset is built
 * here, so there is exactly one place to audit for a leak.
 *
 * Two jobs: shape the JSON, and fit it inside LIMITS.toolOutputChars by dropping whole
 * sections in a fixed order rather than letting the registry cut a string mid object.
 */

import { LIMITS } from "../types";
import type { AggregateResult, ColumnProfile, DatasetProfile } from "./types";

export const ROWS_NOTE = "Values are masked and aggregated. Rows never left the browser.";

/**
 * Build at each detail level in turn and take the first that fits the budget.
 * Returns null rather than a sliced string: half a JSON object is worse than a short
 * one, so every caller supplies its own guaranteed small fallback.
 */
function fit(build: (level: number) => unknown, levels: number, budget: number): string | null {
  for (let level = 0; level < levels; level += 1) {
    const text = JSON.stringify(build(level));
    if (text.length <= budget) return text;
  }
  return null;
}

/** Drop items from the tail until the whole thing fits. Always terminates at zero. */
function shrink(build: (keep: number) => unknown, items: number, budget: number): string {
  for (let keep = items; keep >= 0; keep -= 1) {
    const text = JSON.stringify(build(keep));
    if (text.length <= budget) return text;
  }
  return JSON.stringify({ truncated: true, note: ROWS_NOTE });
}

const nameAndType = (column: ColumnProfile): string => `${column.name}:${column.type}`;

/** list_datasets: what exists, how big, what the columns are called. */
export function datasetListText(profiles: readonly DatasetProfile[], budget: number): string {
  if (profiles.length === 0) {
    return "No dataset is loaded. Ask the human to drop a CSV or XLSX on the board; the file is parsed in their browser and only the profile reaches you.";
  }
  const entry = (profile: DatasetProfile, level: number): Record<string, unknown> => ({
    name: profile.name,
    rows: profile.rowCount,
    profiledAt: profile.profiledAt,
    ...(level === 0
      ? { columns: profile.columns.map(nameAndType) }
      : { columns: profile.columns.length }),
  });
  const attempt = fit(
    (level) => ({ datasets: profiles.map((profile) => entry(profile, level)), note: ROWS_NOTE }),
    2,
    budget,
  );
  if (attempt !== null) return attempt;
  return shrink(
    (keep) => ({
      datasets: profiles.slice(0, keep).map((profile) => entry(profile, 1)),
      more: profiles.length - keep,
      note: ROWS_NOTE,
    }),
    profiles.length,
    budget,
  );
}

function columnJson(column: ColumnProfile, level: number): Record<string, unknown> {
  const head = {
    name: column.name,
    type: column.type,
    nullRate: column.nullRate,
    distinct: column.cardinalityAtLeast ? `${column.cardinality}+` : column.cardinality,
  };
  if (level >= 2) return head;
  return {
    ...head,
    ...(column.numeric ?? {}),
    ...(column.dateRange ? { from: column.dateRange.min, to: column.dateRange.max } : {}),
    ...(column.top ? { top: column.top.map((item) => [item.label, item.count]) } : {}),
    ...(column.topWithheld ? { topWithheld: column.topWithheld } : {}),
  };
}

const SAMPLE_NOTE = `${ROWS_NOTE} Sample values are masked: text is abc…, numbers are magnitude buckets, addresses are user@….`;

/** get_dataset_profile: the whole shape of the file, none of its contents. */
export function profileText(profile: DatasetProfile, budget: number): string {
  const attempt = fit(
    (level) => ({
      dataset: profile.name,
      rows: profile.rowCount,
      profiledAt: profile.profiledAt,
      columns: profile.columns.map((column) => columnJson(column, level)),
      ...(level === 0 ? { sample: profile.sample } : {}),
      ...(level >= 2 ? { truncated: true } : {}),
      note: level === 0 ? SAMPLE_NOTE : ROWS_NOTE,
    }),
    3,
    budget,
  );
  if (attempt !== null) return attempt;
  const names = profile.columns.map(nameAndType);
  return shrink(
    (keep) => ({
      dataset: profile.name,
      rows: profile.rowCount,
      columns: names.slice(0, keep),
      moreColumns: names.length - keep,
      truncated: true,
      note: `${ROWS_NOTE} Too wide for one answer: aggregate_dataset still works on every column.`,
    }),
    names.length,
    budget,
  );
}

export interface AggregateView {
  readonly dataset: string;
  readonly groupBy: string;
  readonly metric: string;
  readonly result: AggregateResult;
  readonly filtered: boolean;
}

/** aggregate_dataset: at most LIMITS.maxPointsPerChart labelled points, ready for a chart. */
export function aggregateText(view: AggregateView, budget: number): string {
  const { result } = view;
  const skipped = result.skipped > 0 ? { skippedBlankOrNonNumeric: result.skipped } : {};
  const hidden =
    result.hidden > 0
      ? { singleRowGroupsHidden: result.hidden, hiddenReason: "a group of one row is that row" }
      : {};
  return shrink(
    (keep) => ({
      dataset: view.dataset,
      groupBy: view.groupBy,
      metric: view.metric,
      points: result.points.slice(0, keep),
      groups: result.groups,
      rowsMatched: result.matched,
      ...skipped,
      ...hidden,
      ...(view.filtered ? { filtered: true } : {}),
      ...(keep < result.points.length ? { truncated: true } : {}),
      note: `${ROWS_NOTE} Feed these points straight into upsert_dashboard.`,
    }),
    result.points.length,
    budget,
  );
}

/** The sentence a human should be able to read over the agent's shoulder. */
export const notLoadedText = (name: string, known: readonly string[]): string =>
  known.length === 0
    ? `No dataset called "${name}" is loaded. Nothing has been dropped on this board yet.`
    : `No dataset called "${name}" is loaded. Loaded now: ${known.join(", ")}.`;

export const budgetFor = (tail: string): number => LIMITS.toolOutputChars - tail.length;
