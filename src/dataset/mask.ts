/**
 * Masking (owner A11). Everything the agent can read passes through here.
 *
 * Three rules, in this order:
 *  1. anything that looks like an email becomes "user@…", whole value, no exceptions;
 *  2. numbers become magnitude buckets ("~1.2k"), never the exact figure;
 *  3. any other string in a sample row becomes the constant "abc…".
 *
 * Category labels (the top-8 lists and group-by labels) are the one place a real
 * value is shown, because a bar chart with masked labels is useless. Those still go
 * through the email rule and are cut to 40 characters.
 */

import { toBoolean, toNumber } from "./infer";
import { DATASET_LIMITS, type CellValue, type ColumnType } from "./types";

/** Deliberately loose: it is better to mask a near miss than to leak an address. */
const EMAIL = /[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}/i;

export const EMAIL_MASK = "user@…";
export const TEXT_MASK = "abc…";
export const BLANK_MASK = "";

export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value);
}

/** True when any cell in the sample carries an address. Drives topWithheld. */
export function cellHasEmail(value: CellValue): boolean {
  return typeof value === "string" && looksLikeEmail(value);
}

/** Two significant figures, then a magnitude suffix. Never the exact number. */
export function magnitudeBucket(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "~0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `~${sign}${twoSig(abs / 1e9)}b`;
  if (abs >= 1e6) return `~${sign}${twoSig(abs / 1e6)}m`;
  if (abs >= 1e3) return `~${sign}${twoSig(abs / 1e3)}k`;
  return `~${sign}${twoSig(abs)}`;
}

function twoSig(value: number): string {
  if (value >= 100) return String(Math.round(value / 10) * 10);
  if (value >= 10) return String(Math.round(value));
  if (value >= 1) return trimZero(value.toFixed(1));
  const digits = Math.min(8, Math.max(1, 1 - Math.floor(Math.log10(value))));
  return trimZero(value.toFixed(digits));
}

const trimZero = (text: string): string =>
  text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;

/** Dates keep the month so a period is readable; the day is dropped. */
export function maskDate(value: string): string {
  const match = /^(\d{4})[-/](\d{1,2})/.exec(value.trim());
  if (!match) return TEXT_MASK;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-…`;
}

/**
 * One cell of a sample row. Shape only: type, magnitude, whether it was blank.
 * The column type decides the shape, so a numeric column that arrived as text is
 * still bucketed rather than shown. Nothing here can be joined back to a person.
 */
export function maskSample(value: CellValue, type: ColumnType = "text"): string {
  if (value === null || value === undefined) return BLANK_MASK;
  const text = typeof value === "string" ? value.trim() : "";
  if (typeof value === "string" && text.length === 0) return BLANK_MASK;
  if (typeof value === "string" && looksLikeEmail(text)) return EMAIL_MASK;
  if (type === "number" || typeof value === "number") return magnitudeBucket(toNumber(value) ?? Number.NaN);
  if (type === "date") return maskDate(String(value));
  if (type === "boolean" || typeof value === "boolean") return String(toBoolean(value) ?? value);
  return TEXT_MASK;
}

/**
 * A category label. This is the only place a raw value survives, so it is capped
 * and an address still collapses to the mask.
 */
export function maskLabel(value: CellValue): string {
  if (value === null || value === undefined) return "(blank)";
  if (typeof value !== "string") return truncate(String(value));
  const text = value.trim();
  if (text.length === 0) return "(blank)";
  if (looksLikeEmail(text)) return EMAIL_MASK;
  return truncate(text);
}

function truncate(text: string): string {
  const max = DATASET_LIMITS.labelChars;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
