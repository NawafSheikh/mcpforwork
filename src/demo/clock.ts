/**
 * Deterministic clock helper for the demo workspace.
 * Every timestamp in the sample data is derived from the `now` passed in, so the
 * seeded board always looks fresh without any hidden global state.
 */
import type { ISODate } from "../types";

const MINUTE_MS = 60_000;

export interface DemoClock {
  /** The instant the sample workspace was built from. */
  readonly now: Date;
  readonly nowIso: ISODate;
  /** ISO timestamp `offsetMinutes` from now (negative for the past). */
  at(offsetMinutes: number): ISODate;
  /** Next occurrence of a local wall-clock hour, e.g. 8 for 08:00. */
  nextDailyAt(hour: number): ISODate;
  /** Next top of the hour. */
  nextHourTop(): ISODate;
}

export function demoClock(now: Date): DemoClock {
  const base = new Date(now.getTime());
  return {
    now: base,
    nowIso: base.toISOString(),
    at: (offsetMinutes: number) =>
      new Date(base.getTime() + offsetMinutes * MINUTE_MS).toISOString(),
    nextDailyAt: (hour: number) => {
      const next = new Date(base.getTime());
      next.setHours(hour, 0, 0, 0);
      if (next.getTime() <= base.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    },
    nextHourTop: () => {
      const next = new Date(base.getTime());
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next.toISOString();
    },
  };
}
