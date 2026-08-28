/**
 * Keyword to glyph mapping for category and KPI chips.
 * A board of "Invoices, Recruiting, Support" should look designed without an
 * icon dependency, so one emoji and one of six tones is derived from the name.
 * Pure and deterministic: the same name always gets the same chip.
 */

export const ICON_TONES = 6;

export interface CategoryIcon {
  readonly glyph: string;
  /** 0..5, used as a CSS modifier so the chip picks a tone from the palette. */
  readonly tone: number;
}

const RULES: readonly (readonly [RegExp, string])[] = [
  [/invoic|bill|payment|payable|finance|budget/i, "\u{1F4B6}"],
  [/mail|inbox|thread|newsletter|message/i, "\u{2709}"],
  [/ticket|support|helpdesk|customer|service/i, "\u{1F3A7}"],
  [/hir|recruit|candidat|applicant|talent|job/i, "\u{1F464}"],
  [/meet|calendar|schedul|agenda/i, "\u{1F4C5}"],
  [/contract|legal|agreement|policy|complian/i, "\u{1F4DC}"],
  [/report|analytic|metric|insight|kpi/i, "\u{1F4C8}"],
  [/task|todo|action|follow/i, "\u{2705}"],
  [/risk|alert|incident|escalat|overdue/i, "\u{1F6A8}"],
  [/deal|sale|revenue|pipeline|lead/i, "\u{1F4BC}"],
  [/travel|expense|trip|flight/i, "\u{2708}"],
  [/doc|file|attachment|report/i, "\u{1F4C4}"],
  [/vendor|supplier|procure|order/i, "\u{1F4E6}"],
];

const FALLBACK_GLYPH = "\u{1F4CA}";

/** Glyph plus a stable tone for one category name. */
export function categoryIcon(name: string): CategoryIcon {
  return { glyph: glyphFor(name), tone: toneFor(name) };
}

/** KPI chips only need the glyph. */
export function kpiIcon(label: string): string {
  return glyphFor(label);
}

function glyphFor(text: string): string {
  const found = RULES.find(([pattern]) => pattern.test(text));
  return found ? found[1] : FALLBACK_GLYPH;
}

function toneFor(text: string): number {
  let sum = 0;
  for (let index = 0; index < text.length; index += 1) sum += text.charCodeAt(index);
  return sum % ICON_TONES;
}
