/**
 * Client-side insight helpers. Everything here is computed from data the agent
 * already sent: no server call, no model call, no new fields on the contract.
 * Pure functions only, so the board can call them straight from render.
 */

import type { Chart, ChartPoint } from "../types";
import { formatNumber } from "./format";

export type Severity = "danger" | "warn" | "info" | "ok";

const DANGER = /overdue|breach|fail|risk|blocked|urgent|critical|lost|churn|escalat|missing|error/i;
const WARN = /watch|delay|pending|slow|waiting|due soon|approach|held|unpaid|backlog/i;
const OK = /resolved|done|complete|approved|paid|improv|up |ahead|on track|healthy|cleared/i;

/** Severity for one narrative line, from the words the agent used. */
export function insightSeverity(text: string): Severity {
  if (DANGER.test(text)) return "danger";
  if (WARN.test(text)) return "warn";
  if (OK.test(text)) return "ok";
  return "info";
}

/** Percent of a total, 0 when the total is zero or not finite. */
export function shareOfTotal(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export interface TopShare {
  readonly label: string;
  readonly value: number;
  readonly share: number;
}

/** Largest point and how much of the total it carries. */
export function topShare(points: readonly ChartPoint[]): TopShare | null {
  const usable = (points ?? []).filter((point) => Number.isFinite(point.value) && point.value > 0);
  if (usable.length === 0) return null;
  const total = usable.reduce((sum, point) => sum + point.value, 0);
  const top = usable.reduce((best, point) => (point.value > best.value ? point : best), usable[0] as ChartPoint);
  return { label: top.label, value: top.value, share: shareOfTotal(top.value, total) };
}

/**
 * One "how to read this" line under a chart title. The agent's own note wins;
 * otherwise the share of the largest mark is the honest computed fallback.
 */
export function chartCaption(chart: Chart): string | undefined {
  const note = chart.note?.trim();
  if (note) return note;
  if (chart.kind === "table") return undefined;
  const top = topShare(chart.points ?? []);
  if (!top || top.share <= 0) return undefined;
  const noun = chart.kind === "line" ? "peak" : "largest";
  return `${top.label} is the ${noun} at ${formatNumber(top.value)}, ${top.share}% of the total shown.`;
}
