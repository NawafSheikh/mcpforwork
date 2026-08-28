/**
 * Cell coercion and column type inference (owner A11).
 * Pure, allocation light and index based: these run once per cell on files of up to
 * 100k rows, so everything here is a plain loop over primitives.
 */

import type { CellValue, ColumnType } from "./types";

const BLANK = /^\s*$/;
/** 1,234.5 and 1.234,56 and (1,234) all appear in real exports. No inner whitespace. */
const NUMERIC = /^[-+(]?[\d][\d.,']*\)?%?$/;
/**
 * Space grouped thousands only, and only in groups of exactly three.
 * This is what keeps "+356 9912 3311" a phone number rather than a 36 billion salary,
 * which would then publish itself as a column min and max.
 */
const SPACED_NUMERIC = /^[-+(]?\d{1,3}(?: \d{3})+(?:[.,]\d+)?\)?%?$/;
const TRUE_WORDS = new Set(["true", "yes", "y", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0"]);
const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2})?/;
const SLASH_DATE = /^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/;

export function isBlank(value: CellValue): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && BLANK.test(value);
}

/** NaN and Infinity are treated exactly like a blank cell everywhere downstream. */
export function toNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return null;
  const text = value.trim();
  if (text.length === 0) return null;
  if (!NUMERIC.test(text) && !SPACED_NUMERIC.test(text)) return null;
  const negative = text.startsWith("(") || text.startsWith("-");
  const digits = text.replace(/[()%'\s+-]/g, "");
  const normalised = normaliseSeparators(digits);
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** Decide whether "," is a thousands separator or the decimal point. */
function normaliseSeparators(text: string): string {
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma === -1) return text.replace(/,/g, "");
  if (lastDot === -1) {
    const tail = text.length - lastComma - 1;
    return tail === 3 ? text.replace(/,/g, "") : text.replace(",", ".");
  }
  return lastComma > lastDot
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(/,/g, "");
}

export function looksLikeDate(value: CellValue): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!ISO_DATE.test(text) && !SLASH_DATE.test(text)) return false;
  return !Number.isNaN(Date.parse(normaliseDate(text)));
}

function normaliseDate(text: string): string {
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  if (!slash) return text;
  const [, a, b, year] = slash;
  // Ambiguous by nature; day-first is the European default this app is built in.
  return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
}

export function toTimestamp(value: CellValue): number | null {
  if (!looksLikeDate(value)) return null;
  const parsed = Date.parse(normaliseDate(String(value).trim()));
  return Number.isNaN(parsed) ? null : parsed;
}

export function toBoolean(value: CellValue): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  return null;
}

/**
 * Tally of what a column's non-blank cells looked like. Filled by src/dataset/profile,
 * which walks every cell exactly once; nothing else writes to it.
 */
export interface TypeTally {
  filled: number;
  numbers: number;
  dates: number;
  booleans: number;
}

export const emptyTally = (): TypeTally => ({ filled: 0, numbers: 0, dates: 0, booleans: 0 });

/** A column takes a type when at least 90% of its filled cells agree. */
const AGREEMENT = 0.9;

export function typeFromTally(tally: TypeTally): ColumnType {
  if (tally.filled === 0) return "empty";
  const threshold = tally.filled * AGREEMENT;
  if (tally.dates >= threshold) return "date";
  // Numbers win over booleans so a 0/1 quantity column keeps its sums and its mean.
  if (tally.numbers >= threshold) return "number";
  if (tally.booleans >= threshold) return "boolean";
  return "text";
}
