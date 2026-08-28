/**
 * Turn the flat ChartPoint list into recharts rows.
 * Points without a series name share one implicit series called "value".
 */

import type { ChartPoint } from "../../types";

export const VALUE_KEY = "value";
export const LABEL_KEY = "label";

export type SeriesRow = Record<string, string | number>;

export interface SeriesData {
  readonly rows: readonly SeriesRow[];
  readonly keys: readonly string[];
}

export function toSeriesData(points: readonly ChartPoint[]): SeriesData {
  const source = points ?? [];
  const keys = unique(source.map((point) => point.series?.trim() || VALUE_KEY));
  const labels = unique(source.map((point) => point.label));
  return { rows: labels.map((label) => buildRow(label, source)), keys };
}

/** Recharts mutates nothing but types its data as a mutable array. */
export function toChartData(rows: readonly SeriesRow[]): SeriesRow[] {
  return [...rows];
}

/** Donut slices only ever carry one value per label. */
export function toSliceData(points: readonly ChartPoint[]): SeriesRow[] {
  return (points ?? []).map((point) => ({ [LABEL_KEY]: point.label, [VALUE_KEY]: point.value }));
}

function buildRow(label: string, points: readonly ChartPoint[]): SeriesRow {
  return points
    .filter((point) => point.label === label)
    .reduce<SeriesRow>(
      (row, point) => ({ ...row, [point.series?.trim() || VALUE_KEY]: point.value }),
      { [LABEL_KEY]: label },
    );
}

function unique(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values));
}
