/**
 * Nice y-axis domains derived from the data, never a hardcoded maximum.
 * A chart whose biggest value is 2 must draw against a 0..2 axis, not against
 * whatever round number the chart library happens to like, or every bar of 1
 * renders as a sliver. Pure module: no DOM, no state, no mutation.
 */

import type { ChartPoint } from "../../types";

/** Mantissas of a "nice" step: 1, 2, 2.5 and 5 at every power of ten. */
const MANTISSAS = [1, 2, 2.5, 5, 10] as const;

/** Target number of gaps between ticks. Five gaps reads well at 220px tall. */
export const DEFAULT_INTERVALS = 5;

/** Guard against a pathological step producing hundreds of ticks. */
const MAX_TICKS = 13;
const POWER_SEARCH_DEPTH = 4;
const EPSILON = 1e-9;

export interface AxisDomain {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
  /** False when every value is a whole number, so the axis shows no ".5" ticks. */
  readonly allowDecimals: boolean;
}

/** True when every finite value is a whole number. Empty counts as integer. */
export function allIntegers(values: readonly number[]): boolean {
  return values.every((value) => Number.isInteger(value));
}

/**
 * Smallest nice step (1, 2, 2.5 or 5 times a power of ten) that covers the span
 * in at most `intervals` gaps. Integer data never gets a step below 1.
 */
export function niceStep(span: number, intervals: number, integersOnly: boolean): number {
  const rough = span / Math.max(1, intervals);
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const start = Math.floor(Math.log10(rough));
  for (let power = start; power <= start + POWER_SEARCH_DEPTH; power += 1) {
    const scale = 10 ** power;
    for (const mantissa of MANTISSAS) {
      const step = mantissa * scale;
      if (integersOnly && (step < 1 || !Number.isInteger(step))) continue;
      if (step + EPSILON >= rough) return step;
    }
  }
  return integersOnly ? Math.max(1, Math.ceil(rough)) : rough;
}

/** Round away floating point dust introduced by multiplying a fractional step. */
export function roundToStep(value: number, step: number): number {
  const decimals = Math.min(10, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
  return Number(value.toFixed(decimals));
}

/** Nice domain and tick list for a list of raw values. */
export function valueDomain(values: readonly number[], intervals: number = DEFAULT_INTERVALS): AxisDomain {
  const finite = values.filter((value) => Number.isFinite(value));
  const allowDecimals = !allIntegers(finite);
  const top = Math.max(0, ...finite);
  const bottom = Math.min(0, ...finite);
  const step = niceStep(top - bottom, intervals, !allowDecimals);
  const max = top > 0 ? ceilToStep(top, step) : 0;
  const min = bottom < 0 ? -ceilToStep(-bottom, step) : 0;
  const upper = max === min ? min + step : max;
  return { min, max: upper, ticks: buildTicks(min, upper, step), allowDecimals };
}

/** Same, straight from a chart's points. */
export function pointsDomain(
  points: readonly ChartPoint[],
  intervals: number = DEFAULT_INTERVALS,
): AxisDomain {
  return valueDomain((points ?? []).map((point) => point.value), intervals);
}

function ceilToStep(value: number, step: number): number {
  return roundToStep(Math.ceil(value / step - EPSILON) * step, step);
}

function buildTicks(min: number, max: number, step: number): readonly number[] {
  const raw = Math.round((max - min) / step);
  const count = Math.min(MAX_TICKS - 1, Math.max(1, raw));
  const size = (max - min) / count;
  return Array.from({ length: count + 1 }, (_unused, index) => roundToStep(min + index * size, step));
}
