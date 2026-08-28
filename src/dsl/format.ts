/**
 * Formatting helpers shared by the DSL renderers. Pure, no DOM, no state.
 */

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export type DeltaTone = "up" | "down" | "flat";

/** Group-separated number, or "n/a" for NaN and Infinity. */
export function formatNumber(value: number): string {
  return Number.isFinite(value) ? NUMBER_FORMAT.format(value) : "n/a";
}

/** KPI and table cell values: numbers are formatted, strings pass through. */
export function formatValue(value: string | number): string {
  return typeof value === "number" ? formatNumber(value) : value;
}

/** Recharts hands tooltips a loose value type, so accept anything. */
export function formatTooltipValue(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => formatTooltipValue(entry)).join(" to ");
  return "";
}

/** "+3.4%" reads as up, "-2" as down, anything else as flat. */
export function deltaTone(delta?: string): DeltaTone {
  const text = (delta ?? "").trim();
  if (text.startsWith("+")) return "up";
  if (text.startsWith("-") || text.startsWith("\u2212")) return "down";
  return "flat";
}

/** Local HH:MM for an ISO date, empty string when the date cannot be parsed. */
export function formatClock(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
