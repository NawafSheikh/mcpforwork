/**
 * Defensive coercers for the rendering half of a shared board: KPIs, charts,
 * dashboards, the overview, dataset summaries and categories.
 * Every function returns a fresh object or null. Unknown keys never survive.
 */
import type {
  Category,
  Chart,
  ChartKind,
  ChartPoint,
  DashboardSpec,
  DatasetSummary,
  KPI,
  OverviewSpec,
  TopItem,
} from "../types";
import { CAP } from "./caps";
import {
  asArray,
  asEnum,
  asNumber,
  asNumberMap,
  asRecord,
  asString,
  asStringList,
  asText,
  asIso,
  isSafeKey,
} from "./coerce";

const CHART_KINDS: readonly ChartKind[] = ["bar", "line", "donut", "table"];

export function coerceKpi(raw: unknown): KPI | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const label = asString(rec.label, CAP.label);
  if (label === undefined) return null;
  const numeric = asNumber(rec.value);
  const value = numeric ?? asString(rec.value, CAP.label);
  if (value === undefined) return null;
  const delta = asString(rec.delta, CAP.delta);
  const hint = asString(rec.hint, CAP.hint);
  return { label, value, ...(delta ? { delta } : {}), ...(hint ? { hint } : {}) };
}

function coercePoint(raw: unknown): ChartPoint | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const label = asString(rec.label, CAP.label);
  const value = asNumber(rec.value);
  if (label === undefined || value === undefined) return null;
  const series = asString(rec.series, CAP.label);
  return { label, value, ...(series ? { series } : {}) };
}

function coerceRow(raw: unknown): readonly (string | number)[] {
  return asArray(raw, CAP.columns).map((cell) => asNumber(cell) ?? asString(cell, CAP.label) ?? "");
}

function coerceList<T>(raw: unknown, max: number, one: (item: unknown) => T | null): readonly T[] {
  const out: T[] = [];
  for (const item of asArray(raw, max)) {
    const value = one(item);
    if (value !== null) out.push(value);
  }
  return out;
}

export function coerceChart(raw: unknown): Chart | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const title = asString(rec.title, CAP.title);
  if (title === undefined) return null;
  const id = asString(rec.id, CAP.label);
  const columns = asStringList(rec.columns, CAP.columns, CAP.label);
  const rows = asArray(rec.rows, CAP.rows).map(coerceRow);
  const note = asString(rec.note, CAP.note);
  return {
    kind: asEnum(rec.kind, CHART_KINDS, "bar"),
    title,
    points: coerceList(rec.points, CAP.points, coercePoint),
    ...(id ? { id } : {}),
    ...(columns.length > 0 ? { columns } : {}),
    ...(rows.length > 0 ? { rows } : {}),
    ...(note ? { note } : {}),
  };
}

export function coerceDashboard(raw: unknown, category: string, at: string): DashboardSpec | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const kpis = coerceList(rec.kpis, CAP.kpis, coerceKpi);
  const charts = coerceList(rec.charts, CAP.charts, coerceChart);
  if (kpis.length === 0 && charts.length === 0) return null;
  const title = asString(rec.title, CAP.title);
  const notes = asStringList(rec.notes, CAP.notes, CAP.note);
  const source = asString(rec.source, CAP.provenance);
  return {
    category,
    kpis,
    charts,
    updatedAt: asIso(rec.updatedAt, at),
    ...(title ? { title } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(source ? { source } : {}),
  };
}

export function coerceOverview(raw: unknown, at: string): OverviewSpec | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const kpis = coerceList(rec.kpis, CAP.overviewKpis, coerceKpi);
  const charts = coerceList(rec.charts, CAP.charts, coerceChart);
  if (kpis.length === 0 && charts.length === 0) return null;
  const highlights = asStringList(rec.highlights, CAP.highlights, CAP.note);
  return {
    title: asText(rec.title, CAP.title, "Overview"),
    kpis,
    charts,
    updatedAt: asIso(rec.updatedAt, at),
    ...(highlights.length > 0 ? { highlights } : {}),
  };
}

function coerceTopItem(raw: unknown): TopItem | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const label = asString(rec.label, CAP.label);
  const value = asNumber(rec.value);
  if (label === undefined || value === undefined) return null;
  return { label, value };
}

function coerceTop(raw: unknown): Readonly<Record<string, readonly TopItem[]>> | undefined {
  const rec = asRecord(raw);
  if (rec === null) return undefined;
  const out: Record<string, readonly TopItem[]> = {};
  let kept = 0;
  for (const [rawKey, rawValue] of Object.entries(rec)) {
    if (kept >= CAP.topLists) break;
    const key = asString(rawKey, CAP.label);
    if (key === undefined || !isSafeKey(key)) continue;
    const items = coerceList(rawValue, CAP.topItems, coerceTopItem);
    if (items.length === 0) continue;
    out[key] = items;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

export function coerceSummary(raw: unknown, at: string): DatasetSummary | undefined {
  const rec = asRecord(raw);
  if (rec === null) return undefined;
  const counts = asNumberMap(rec.counts, CAP.summaryKeys, CAP.label);
  const sums = asNumberMap(rec.sums, CAP.summaryKeys, CAP.label);
  const top = coerceTop(rec.top);
  const period = asString(rec.period, CAP.label);
  const rowCount = asNumber(rec.rowCount);
  if (!counts && !sums && !top && !period && rowCount === undefined) return undefined;
  return {
    updatedAt: asIso(rec.updatedAt, at),
    ...(counts ? { counts } : {}),
    ...(sums ? { sums } : {}),
    ...(top ? { top } : {}),
    ...(period ? { period } : {}),
    ...(rowCount === undefined ? {} : { rowCount }),
  };
}

export function coerceCategory(raw: unknown, key: string, at: string): Category | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const name = asString(rec.name, CAP.name) ?? asString(key, CAP.name);
  if (name === undefined) return null;
  const description = asString(rec.description, CAP.description);
  const provenance = asString(rec.provenance, CAP.provenance);
  const summary = coerceSummary(rec.summary, at);
  const dashboard = coerceDashboard(rec.dashboard, name, at);
  return {
    name,
    createdAt: asIso(rec.createdAt, at),
    ...(description ? { description } : {}),
    ...(provenance ? { provenance } : {}),
    ...(summary ? { summary } : {}),
    ...(dashboard ? { dashboard } : {}),
  };
}
