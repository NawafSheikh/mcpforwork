/**
 * Schedule parsing for monitors: 5-field cron or a plain English phrase.
 * Everything is local time, so "every morning 08:00" means the visitor's 08:00.
 */

import { describeCron, matchesDay, parseCron } from "./cron";

export interface ParsedSchedule {
  readonly cron: string;
  readonly human: string;
}

export interface ScheduleError {
  readonly error: string;
}

export type ScheduleResult = ParsedSchedule | ScheduleError;

export class CronError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CronError";
  }
}

const HELP =
  'Use a 5-field cron like "0 8 * * *", or a phrase like "every morning 08:00", ' +
  '"every hour", "every monday 09:00", "daily at 18:30", "every 15 minutes".';

const DAY_WORDS: Readonly<Record<string, number>> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const PART_OF_DAY: Readonly<Record<string, [number, number]>> = {
  morning: [8, 0],
  noon: [12, 0],
  afternoon: [14, 0],
  evening: [18, 0],
  night: [21, 0],
  midnight: [0, 0],
};

export function isScheduleError(value: ScheduleResult): value is ScheduleError {
  return "error" in value;
}

function clockFrom(text: string): [number, number] | undefined {
  const explicit = /\b(\d{1,2}):(\d{2})\s*(am|pm)?/.exec(text);
  if (explicit) {
    const hour = withMeridiem(Number(explicit[1]), explicit[3]);
    const minute = Number(explicit[2]);
    return hour <= 23 && minute <= 59 ? [hour, minute] : undefined;
  }
  const short = /\b(\d{1,2})\s*(am|pm)\b/.exec(text);
  if (short) {
    const hour = withMeridiem(Number(short[1]), short[2]);
    return hour <= 23 ? [hour, 0] : undefined;
  }
  return undefined;
}

function withMeridiem(hour: number, meridiem: string | undefined): number {
  if (meridiem === "pm") {
    return hour === 12 ? 12 : hour + 12;
  }
  if (meridiem === "am") {
    return hour === 12 ? 0 : hour;
  }
  return hour;
}

function intervalCron(text: string, clock: [number, number] | undefined): string | undefined {
  const match = /\bevery\s+(\d{1,3})\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/.exec(text);
  if (!match) {
    return undefined;
  }
  const step = Number(match[1]);
  const isMinutes = (match[2] ?? "").startsWith("m");
  if (step < 1 || (isMinutes && step > 59) || (!isMinutes && step > 23)) {
    return undefined;
  }
  return isMinutes ? `*/${step} * * * *` : `${clock?.[1] ?? 0} */${step} * * *`;
}

function dayField(text: string): string {
  if (/\bweekday(s)?\b/.test(text)) {
    return "1-5";
  }
  if (/\bweekend(s)?\b/.test(text)) {
    return "0,6";
  }
  const days = Object.entries(DAY_WORDS)
    .filter(([name]) => new RegExp(`\\b${name}s?\\b`).test(text))
    .map(([, index]) => index)
    .sort((a, b) => a - b);
  return days.length > 0 ? days.join(",") : "*";
}

function partOfDayClock(text: string): [number, number] | undefined {
  const match = Object.keys(PART_OF_DAY).find((word) =>
    new RegExp(`\\b${word}\\b`).test(text),
  );
  return match === undefined ? undefined : PART_OF_DAY[match];
}

function phraseCron(text: string): string | undefined {
  const clock = clockFrom(text);
  const interval = intervalCron(text, clock);
  if (interval) {
    return interval;
  }
  if (/\bevery\s+hour\b|\bhourly\b/.test(text)) {
    return `${clock?.[1] ?? 0} * * * *`;
  }
  const day = dayField(text);
  const resolved = clock ?? partOfDayClock(text);
  const hasDayWord = day !== "*" || /\b(every\s+day|daily|each\s+day)\b/.test(text);
  if (resolved === undefined && !hasDayWord) {
    return undefined;
  }
  const [hour, minute] = resolved ?? [9, 0];
  return `${minute} ${hour} * * ${day}`;
}

/** Turn cron text or an English phrase into a validated cron plus a human label. */
export function parseSchedule(text: string): ScheduleResult {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") {
    return { error: `A schedule is required. ${HELP}` };
  }
  if (trimmed.split(/\s+/).length === 5 && !/[a-z]{4,}/i.test(trimmed)) {
    return parseCron(trimmed)
      ? { cron: normalizeCron(trimmed), human: describeCron(trimmed) }
      : { error: `"${trimmed}" is not a valid cron expression. ${HELP}` };
  }
  const cron = phraseCron(trimmed.toLowerCase());
  if (cron === undefined || !parseCron(cron)) {
    return { error: `Could not read "${trimmed}" as a schedule. ${HELP}` };
  }
  return { cron, human: describeCron(cron) };
}

function normalizeCron(expression: string): string {
  return expression.trim().split(/\s+/).join(" ");
}

function startOfNextMinute(from: Date): Date {
  return new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    from.getHours(),
    from.getMinutes() + 1,
    0,
    0,
  );
}

/** The first local-time minute strictly after `from` that the cron fires on. */
export function nextRunAt(cron: string, from: Date): Date {
  const fields = parseCron(cron);
  if (!fields) {
    throw new CronError(`Cannot compute the next run for "${cron}".`);
  }
  let cursor = startOfNextMinute(from);
  const limit = new Date(from.getFullYear() + 5, from.getMonth(), from.getDate());

  while (cursor.getTime() <= limit.getTime()) {
    if (!matchesDay(fields, cursor)) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      continue;
    }
    if (!fields.hour.has(cursor.getHours())) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        cursor.getHours() + 1,
      );
      continue;
    }
    if (!fields.minute.has(cursor.getMinutes())) {
      cursor = startOfNextMinute(cursor);
      continue;
    }
    return cursor;
  }
  throw new CronError(`"${cron}" has no run in the next five years.`);
}

/** Convenience for callers that only have the stored schedule text. */
export function nextRunFromText(text: string, from: Date): Date | undefined {
  const parsed = parseSchedule(text);
  if (isScheduleError(parsed)) {
    return undefined;
  }
  try {
    return nextRunAt(parsed.cron, from);
  } catch {
    return undefined;
  }
}

export { describeCron, parseCron } from "./cron";
