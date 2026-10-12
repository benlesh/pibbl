import {
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
} from "@pibbl/core/viz";
import { expect, it } from "vitest";

interface Price {
  readonly close: number | null;
  readonly name: string;
}

it("derives aligned SMA, EMA, and population Bollinger bands from consecutive observations", () => {
  const prices: readonly Price[] = [
    { close: 1, name: "one" },
    { close: 2, name: "two" },
    { close: 3, name: "three" },
    { close: 4, name: "four" },
  ];
  const options = { value: "close", period: 3 } as const;

  expect(
    simpleMovingAverage(prices, options).map((point) => point.average),
  ).toEqual([null, null, 2, 3]);
  expect(
    exponentialMovingAverage(prices, options).map((point) => point.average),
  ).toEqual([null, null, 2, 3]);
  expect(
    bollingerBands(prices, options).map((point) => [
      point.mean,
      point.lower,
      point.upper,
    ]),
  ).toEqual([
    [null, null, null],
    [null, null, null],
    [2, 2 - 2 * Math.sqrt(2 / 3), 2 + 2 * Math.sqrt(2 / 3)],
    [3, 3 - 2 * Math.sqrt(2 / 3), 3 + 2 * Math.sqrt(2 / 3)],
  ]);
});

it("resets warmup at missing or excluded rows and preserves source ownership", () => {
  const excluded = { close: 100, name: "exclude" } as const;
  const prices: readonly Price[] = [
    { close: 1, name: "one" },
    { close: 2, name: "two" },
    { close: null, name: "gap" },
    excluded,
    { close: 4, name: "four" },
    { close: 5, name: "five" },
  ];
  const result = exponentialMovingAverage(prices, {
    value: (row) => {
      if (row === excluded) throw new Error("excluded accessor");
      return row.close;
    },
    period: 2,
    defined: (row) => row !== excluded,
  });

  expect(result.map((point) => point.average)).toEqual([
    null,
    1.5,
    null,
    null,
    null,
    4.5,
  ]);
  expect(result[3]).toMatchObject({
    datum: excluded,
    sourceIndex: 3,
    average: null,
  });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result[0])).toBe(true);
});

it("keeps finite translated extreme values and validates indicator options", () => {
  const high = Number.MAX_VALUE / 4;
  const data = [
    { close: high },
    { close: -high },
    { close: high },
    { close: -high },
  ];
  expect(
    simpleMovingAverage(data, { value: "close", period: 2 }).map(
      (point) => point.average,
    ),
  ).toEqual([null, 0, 0, 0]);
  expect(
    bollingerBands(data, { value: "close", period: 2, multiplier: 0 }).map(
      (point) => point.mean,
    ),
  ).toEqual([null, 0, 0, 0]);
  expect(
    simpleMovingAverage([{ close: high }, { close: high }], {
      value: "close",
      period: 2,
    })[1]?.average,
  ).toBe(high);
  expect(
    exponentialMovingAverage(
      [{ close: high }, { close: -high }, { close: high }],
      {
        value: "close",
        period: 2,
      },
    )[2]?.average! / high,
  ).toBeCloseTo(2 / 3);
  expect(() =>
    simpleMovingAverage(data, { value: "close", period: 0 }),
  ).toThrow(/period/i);
  expect(() =>
    exponentialMovingAverage(data, { value: "close", period: 1.5 }),
  ).toThrow(/period/i);
  expect(() =>
    bollingerBands(data, { value: "close", period: 2, multiplier: -1 }),
  ).toThrow(/multiplier/i);
});

it("turns undefined and nonfinite observations into reset gaps without mutating records", () => {
  const data = [
    { close: 1 },
    { close: undefined },
    { close: Number.NaN },
    { close: Number.POSITIVE_INFINITY },
    { close: 2 },
    { close: 4 },
  ];
  const before = data.map((row) => row.close);
  expect(
    simpleMovingAverage(data, { value: "close", period: 2 }).map(
      (point) => point.average,
    ),
  ).toEqual([null, null, null, null, null, 3]);
  expect(
    bollingerBands(data, { value: "close", period: 2 }).map((point) => [
      point.mean,
      point.lower,
      point.upper,
    ]),
  ).toEqual([
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [3, 1, 5],
  ]);
  expect(data.map((row) => row.close)).toEqual(before);
});
