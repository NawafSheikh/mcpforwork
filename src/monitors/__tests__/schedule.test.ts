import { describe, expect, it } from "vitest";

import {
  CronError,
  isScheduleError,
  nextRunAt,
  parseSchedule,
} from "../schedule";

function cronOf(text: string): string {
  const parsed = parseSchedule(text);
  if (isScheduleError(parsed)) {
    throw new Error(`expected a cron for "${text}", got ${parsed.error}`);
  }
  return parsed.cron;
}

function humanOf(text: string): string {
  const parsed = parseSchedule(text);
  if (isScheduleError(parsed)) {
    throw new Error(`expected a schedule for "${text}", got ${parsed.error}`);
  }
  return parsed.human;
}

describe("parseSchedule phrases", () => {
  it("reads the documented phrases", () => {
    expect(cronOf("every morning 08:00")).toBe("0 8 * * *");
    expect(cronOf("every hour")).toBe("0 * * * *");
    expect(cronOf("every monday 09:00")).toBe("0 9 * * 1");
    expect(cronOf("daily at 18:30")).toBe("30 18 * * *");
    expect(cronOf("every 15 minutes")).toBe("*/15 * * * *");
  });

  it("reads looser wording, meridiems and parts of the day", () => {
    expect(cronOf("Every Morning")).toBe("0 8 * * *");
    expect(cronOf("every evening")).toBe("0 18 * * *");
    expect(cronOf("every day at 6pm")).toBe("0 18 * * *");
    expect(cronOf("daily at 12am")).toBe("0 0 * * *");
    expect(cronOf("every weekday 09:30")).toBe("30 9 * * 1-5");
    expect(cronOf("every friday and monday at 07:00")).toBe("0 7 * * 1,5");
    expect(cronOf("every 2 hours")).toBe("0 */2 * * *");
    expect(cronOf("hourly")).toBe("0 * * * *");
  });

  it("describes what it parsed in plain English", () => {
    expect(humanOf("every morning 08:00")).toBe("every day at 08:00");
    expect(humanOf("every hour")).toBe("every hour, on the hour");
    expect(humanOf("every monday 09:00")).toBe("every Monday at 09:00");
    expect(humanOf("every 15 minutes")).toBe("every 15 minutes");
    expect(humanOf("every weekday 09:30")).toBe("every weekday at 09:30");
    expect(humanOf("0 0 1 * *")).toBe("on day 1 of the month at 00:00");
  });

  it("passes valid cron through unchanged and normalises the spacing", () => {
    expect(cronOf("0 8 * * *")).toBe("0 8 * * *");
    expect(cronOf("30  18  *  *  1-5")).toBe("30 18 * * 1-5");
    expect(cronOf("*/5 * * * *")).toBe("*/5 * * * *");
    expect(cronOf("0 9 * * MON")).toBe("0 9 * * MON");
  });

  it("returns an error object with help text for anything it cannot read", () => {
    for (const text of ["", "   ", "sometime soon", "99 99 * * *", "0 8 * *"]) {
      const parsed = parseSchedule(text);
      expect(isScheduleError(parsed)).toBe(true);
      if (isScheduleError(parsed)) {
        expect(parsed.error).toContain("every morning 08:00");
      }
    }
  });

  it("rejects an out-of-range interval instead of guessing", () => {
    expect(isScheduleError(parseSchedule("every 90 minutes"))).toBe(true);
  });
});

describe("nextRunAt", () => {
  it("finds the next daily run later the same day", () => {
    const from = new Date(2026, 7, 28, 6, 30);
    const next = nextRunAt("0 8 * * *", from);
    expect(next.getDate()).toBe(28);
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
  });

  it("rolls to tomorrow once today's slot has passed", () => {
    const next = nextRunAt("0 8 * * *", new Date(2026, 7, 28, 9, 0));
    expect(next.getDate()).toBe(29);
    expect(next.getHours()).toBe(8);
  });

  it("is always strictly after the given moment", () => {
    const from = new Date(2026, 7, 28, 8, 0, 0, 0);
    expect(nextRunAt("0 8 * * *", from).getDate()).toBe(29);
  });

  it("walks minute steps", () => {
    const next = nextRunAt("*/15 * * * *", new Date(2026, 7, 28, 10, 7));
    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(15);
    expect(nextRunAt("*/15 * * * *", next).getMinutes()).toBe(30);
  });

  it("walks hour steps and the top of the hour", () => {
    expect(nextRunAt("0 * * * *", new Date(2026, 7, 28, 10, 7)).getHours()).toBe(11);
    expect(nextRunAt("0 */6 * * *", new Date(2026, 7, 28, 7, 0)).getHours()).toBe(12);
  });

  it("honours a single day of the week", () => {
    const next = nextRunAt("0 9 * * 1", new Date(2026, 7, 28, 12, 0));
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(9);
    expect(next.getTime()).toBeGreaterThan(new Date(2026, 7, 28, 12, 0).getTime());
  });

  it("honours weekday ranges", () => {
    const saturday = new Date(2026, 7, 29, 12, 0);
    expect(saturday.getDay()).toBe(6);
    expect(nextRunAt("0 9 * * 1-5", saturday).getDay()).toBe(1);
  });

  it("honours a day of the month and a month", () => {
    const next = nextRunAt("0 0 1 * *", new Date(2026, 7, 28, 12, 0));
    expect(next.getDate()).toBe(1);
    expect(next.getMonth()).toBe(8);
    expect(nextRunAt("0 0 1 1 *", new Date(2026, 7, 28)).getFullYear()).toBe(2027);
  });

  it("throws a CronError rather than returning a wrong date", () => {
    expect(() => nextRunAt("not a cron", new Date())).toThrow(CronError);
    expect(() => nextRunAt("0 0 30 2 *", new Date(2026, 7, 28))).toThrow(CronError);
  });
});
