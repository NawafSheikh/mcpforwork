/**
 * The y-axis must come from the data. A chart whose biggest value is 2 drew
 * against a 0..12 axis before this helper existed, which made every bar a sliver.
 */

import { describe, expect, it } from "vitest";
import { allIntegers, niceStep, pointsDomain, roundToStep, valueDomain } from "../charts/domain";
import type { ChartPoint } from "../../types";

describe("valueDomain", () => {
  it("never invents headroom above small integer data", () => {
    const axis = valueDomain([1, 2, 2]);
    expect(axis.min).toBe(0);
    expect(axis.max).toBe(2);
    expect(axis.max).toBeLessThan(12);
  });

  it("turns off decimals when every value is a whole number", () => {
    expect(valueDomain([1, 2, 3]).allowDecimals).toBe(false);
    expect(valueDomain([1, 2.5]).allowDecimals).toBe(true);
  });

  it("never emits a fractional tick for integer data", () => {
    const axis = valueDomain([1, 2, 3]);
    expect(axis.ticks.every((tick) => Number.isInteger(tick))).toBe(true);
  });

  it("rounds a large maximum up to a nice number, not to a hardcoded one", () => {
    const axis = valueDomain([7400, 5200, 3100, 2750]);
    expect(axis.max).toBeGreaterThanOrEqual(7400);
    expect(axis.max % 1000).toBe(0);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max);
  });

  it("gives an all-zero chart a usable axis instead of a flat line", () => {
    const axis = valueDomain([0, 0]);
    expect(axis.max).toBeGreaterThan(0);
    expect(axis.min).toBe(0);
  });

  it("extends below zero only when the data goes there", () => {
    expect(valueDomain([5, 10]).min).toBe(0);
    expect(valueDomain([-4, 10]).min).toBeLessThanOrEqual(-4);
  });

  it("ignores values that are not finite", () => {
    const axis = valueDomain([1, Number.NaN, Number.POSITIVE_INFINITY, 3]);
    expect(axis.max).toBe(3);
    expect(Number.isFinite(axis.max)).toBe(true);
  });

  it("keeps the tick count readable", () => {
    const axis = valueDomain([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(axis.ticks.length).toBeGreaterThan(1);
    expect(axis.ticks.length).toBeLessThanOrEqual(13);
  });
});

describe("niceStep", () => {
  it("never drops below one for integer data", () => {
    expect(niceStep(2, 5, true)).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(niceStep(3, 5, true))).toBe(true);
  });

  it("allows fractional steps for fractional data", () => {
    expect(niceStep(1, 5, false)).toBeLessThan(1);
  });

  it("falls back to one for a degenerate span", () => {
    expect(niceStep(0, 5, true)).toBe(1);
    expect(niceStep(Number.NaN, 5, false)).toBe(1);
  });
});

describe("helpers", () => {
  it("allIntegers treats an empty list as integer", () => {
    expect(allIntegers([])).toBe(true);
    expect(allIntegers([1, 2])).toBe(true);
    expect(allIntegers([1, 2.5])).toBe(false);
  });

  it("roundToStep clears floating point dust", () => {
    expect(roundToStep(0.30000000000000004, 0.1)).toBe(0.3);
  });

  it("pointsDomain reads straight from chart points", () => {
    const points: readonly ChartPoint[] = [
      { label: "a", value: 1 },
      { label: "b", value: 2 },
    ];
    expect(pointsDomain(points).max).toBe(2);
  });
});
