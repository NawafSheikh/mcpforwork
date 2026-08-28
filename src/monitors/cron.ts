/**
 * Minimal 5-field cron parsing, matching and description. No library.
 * Supports the wildcard, single values, a-b ranges, a,b lists and step syntax
 * (star slash n), plus three-letter month and weekday names.
 * All matching is in local time.
 */

export interface CronFields {
  readonly minute: ReadonlySet<number>;
  readonly hour: ReadonlySet<number>;
  readonly dayOfMonth: ReadonlySet<number>;
  readonly month: ReadonlySet<number>;
  readonly dayOfWeek: ReadonlySet<number>;
  readonly dayOfMonthAny: boolean;
  readonly dayOfWeekAny: boolean;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_ALIASES: Readonly<Record<string, number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const MONTH_ALIASES: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function alias(token: string, kind: "dow" | "month"): number | undefined {
  const table = kind === "dow" ? DAY_ALIASES : MONTH_ALIASES;
  return table[token.slice(0, 3).toLowerCase()];
}

function toValue(
  token: string,
  min: number,
  max: number,
  kind: "dow" | "month" | "plain",
): number | undefined {
  const named = kind === "plain" ? undefined : alias(token, kind);
  const raw = named ?? (/^\d{1,4}$/.test(token) ? Number(token) : undefined);
  if (raw === undefined) {
    return undefined;
  }
  const value = kind === "dow" && raw === 7 ? 0 : raw;
  return value >= min && value <= max ? value : undefined;
}

function expandRange(
  from: number,
  to: number,
  step: number,
  max: number,
): number[] {
  const end = to >= from ? to : max;
  const values: number[] = [];
  for (let value = from; value <= end; value += step) {
    values.push(value);
  }
  return values;
}

function parsePart(
  part: string,
  min: number,
  max: number,
  kind: "dow" | "month" | "plain",
): number[] | undefined {
  const [range, stepText, ...rest] = part.split("/");
  if (rest.length > 0 || range === undefined || range === "") {
    return undefined;
  }
  const step = stepText === undefined ? 1 : Number(stepText);
  if (!Number.isInteger(step) || step < 1) {
    return undefined;
  }
  if (range === "*") {
    return expandRange(min, max, step, max);
  }
  const [fromText, toText, ...extra] = range.split("-");
  if (extra.length > 0 || fromText === undefined) {
    return undefined;
  }
  const from = toValue(fromText, min, max, kind);
  if (from === undefined) {
    return undefined;
  }
  if (toText === undefined) {
    return stepText === undefined ? [from] : expandRange(from, max, step, max);
  }
  const to = toValue(toText, min, max, kind);
  return to === undefined ? undefined : expandRange(from, to, step, max);
}

function parseField(
  field: string,
  min: number,
  max: number,
  kind: "dow" | "month" | "plain" = "plain",
): ReadonlySet<number> | undefined {
  const values: number[] = [];
  for (const part of field.split(",")) {
    const parsed = parsePart(part.trim(), min, max, kind);
    if (parsed === undefined || parsed.length === 0) {
      return undefined;
    }
    values.push(...parsed);
  }
  return new Set(values);
}

/** Parse a 5-field cron expression. Returns undefined when it is not valid. */
export function parseCron(expression: string): CronFields | undefined {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return undefined;
  }
  const [minuteText, hourText, domText, monthText, dowText] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const minute = parseField(minuteText, 0, 59);
  const hour = parseField(hourText, 0, 23);
  const dayOfMonth = parseField(domText, 1, 31);
  const month = parseField(monthText, 1, 12, "month");
  const dayOfWeek = parseField(dowText, 0, 7, "dow");
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return undefined;
  }
  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    dayOfMonthAny: domText === "*",
    dayOfWeekAny: dowText === "*",
  };
}

/** Standard cron day semantics: restricted day-of-month and day-of-week are ORed. */
export function matchesDay(fields: CronFields, date: Date): boolean {
  if (!fields.month.has(date.getMonth() + 1)) {
    return false;
  }
  const domHit = fields.dayOfMonth.has(date.getDate());
  const dowHit = fields.dayOfWeek.has(date.getDay());
  if (fields.dayOfMonthAny && fields.dayOfWeekAny) {
    return true;
  }
  if (fields.dayOfMonthAny) {
    return dowHit;
  }
  if (fields.dayOfWeekAny) {
    return domHit;
  }
  return domHit || dowHit;
}

function sorted(values: ReadonlySet<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function stepOf(values: ReadonlySet<number>, min: number, max: number): number | undefined {
  const list = sorted(values);
  const first = list[0];
  if (list.length < 2 || first !== min) {
    return undefined;
  }
  const step = (list[1] ?? min) - min;
  const expected = expandRange(min, max, step, max);
  return list.length === expected.length ? step : undefined;
}

function describeDays(fields: CronFields): string {
  if (!fields.dayOfMonthAny) {
    return `on day ${sorted(fields.dayOfMonth).join(", ")} of the month`;
  }
  if (fields.dayOfWeekAny) {
    return "every day";
  }
  const days = sorted(fields.dayOfWeek);
  if (days.length === 5 && days.every((day) => day >= 1 && day <= 5)) {
    return "every weekday";
  }
  return `every ${days.map((day) => DAY_NAMES[day] ?? String(day)).join(", ")}`;
}

/** Plain-English rendering of a cron expression, for the UI and tool replies. */
export function describeCron(expression: string): string {
  const fields = parseCron(expression);
  if (!fields) {
    return expression;
  }
  const minuteStep = stepOf(fields.minute, 0, 59);
  if (minuteStep === 1) {
    return "every minute";
  }
  if (minuteStep !== undefined) {
    return `every ${minuteStep} minutes`;
  }
  const minutes = sorted(fields.minute);
  const minute = minutes[0] ?? 0;
  const hourStep = stepOf(fields.hour, 0, 23);
  if (hourStep === 1) {
    return minute === 0 ? "every hour, on the hour" : `every hour at :${pad(minute)}`;
  }
  if (hourStep !== undefined) {
    return `every ${hourStep} hours at :${pad(minute)}`;
  }
  const hour = sorted(fields.hour)[0] ?? 0;
  return `${describeDays(fields)} at ${pad(hour)}:${pad(minute)}`;
}
