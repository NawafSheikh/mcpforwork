/**
 * Merging two versions of the same board object (docs/TURNS.md).
 *
 * Two agents editing one dashboard almost never touch the same thing: one adds a chart,
 * the other rewrites a KPI. So a write that lands on top of somebody else's recent change
 * is not refused. Anything the other party has that this write does not mention is kept
 * (charts by id, KPIs by label, notes appended), and the reply says what was kept.
 *
 * Only a true collision is refused: the same chart id or the same KPI label, with
 * different content. That is the one case where applying the write would delete work
 * somebody just did, and the fix is one call: read the object again and send it back.
 */
import { stableStringify } from "../store/audit";
import type { Chart, KPI } from "../types";

/** The three mergeable parts every spec on this board has. */
export interface MergeParts {
  readonly kpis: readonly KPI[];
  readonly charts: readonly Chart[];
  /** Dashboard notes or overview highlights: free lines, so they only ever append. */
  readonly lines: readonly string[];
}

export interface MergeResult {
  readonly merged: MergeParts;
  /** Items the incoming write would have overwritten, in words: 'chart "By supplier"'. */
  readonly conflicts: readonly string[];
  /** Items kept from the board because the incoming write did not mention them. */
  readonly kept: readonly string[];
}

const chartKey = (chart: Chart): string => (chart.id?.trim() ?? "") || chart.title.trim();
const kpiKey = (kpi: KPI): string => kpi.label.trim().toLowerCase();
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

function index<T>(items: readonly T[], key: (item: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) out.set(key(item), item);
  return out;
}

interface Split<T> {
  readonly extra: readonly T[];
  readonly conflicts: readonly string[];
  readonly kept: readonly string[];
}

/**
 * What the board holds that the incoming write left out, and what it would overwrite.
 * The same key with the same content is not a conflict: two agents can agree.
 */
function split<T>(
  current: readonly T[],
  incoming: readonly T[],
  key: (item: T) => string,
  label: (item: T) => string,
): Split<T> {
  const mine = index(incoming, key);
  const extra: T[] = [];
  const conflicts: string[] = [];
  const kept: string[] = [];
  for (const item of current) {
    const match = mine.get(key(item));
    if (match === undefined) {
      extra.push(item);
      kept.push(label(item));
      continue;
    }
    if (!same(item, match)) conflicts.push(label(item));
  }
  return { extra, conflicts, kept };
}

/**
 * Fold what is on the board into what the caller sent. The caller's own items always win
 * their place; the board's untouched ones come back at the end, so nothing is lost.
 */
export function mergeParts(current: MergeParts, incoming: MergeParts): MergeResult {
  const kpis = split(current.kpis, incoming.kpis, kpiKey, (kpi) => `KPI "${kpi.label}"`);
  const charts = split(current.charts, incoming.charts, chartKey, (chart) => `chart "${chart.title}"`);
  const lines = current.lines.filter((line) => !incoming.lines.includes(line));
  return {
    merged: {
      kpis: [...incoming.kpis, ...kpis.extra],
      charts: [...incoming.charts, ...charts.extra],
      lines: [...incoming.lines, ...lines],
    },
    conflicts: [...kpis.conflicts, ...charts.conflicts],
    kept: [...kpis.kept, ...charts.kept, ...lines.map((line) => "a note")],
  };
}

const MAX_NAMED = 3;

/** "chart \"By supplier\" and KPI \"Outstanding\"", cut short when there are many. */
export function listNames(names: readonly string[]): string {
  const unique = [...new Set(names)];
  const shown = unique.slice(0, MAX_NAMED);
  const more = unique.length - shown.length;
  const text = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0] ?? "";
  return more > 0 ? `${text} and ${more} more` : text;
}
