import {
  indexTo100,
  percentageReturns,
} from "@pibbl/core/viz";
import { expect, it } from "vitest";

interface Price {
  readonly time: number | null;
  readonly close: number | null;
  readonly label: string;
}

const baseTime = Date.UTC(2026, 0, 2, 16);
const prices: readonly Price[] = [
  { time: baseTime, close: 80, label: "base" },
  { time: baseTime + 86_400_000, close: 100, label: "gain" },
  { time: baseTime + 172_800_000, close: 60, label: "loss" },
];

it("derives cumulative simple percentage returns and indexed values from one exact base", () => {
  const returns = percentageReturns(prices, {
    time: "time",
    value: "close",
    baseTime,
  });
  const indexed = indexTo100(prices, {
    time: "time",
    value: "close",
    baseTime,
  });

  expect(returns).toEqual([
    { datum: prices[0], sourceIndex: 0, time: baseTime, returnPercent: 0 },
    { datum: prices[1], sourceIndex: 1, time: baseTime + 86_400_000, returnPercent: 25 },
    { datum: prices[2], sourceIndex: 2, time: baseTime + 172_800_000, returnPercent: -25 },
  ]);
  expect(indexed).toEqual([
    { datum: prices[0], sourceIndex: 0, time: baseTime, indexValue: 100 },
    { datum: prices[1], sourceIndex: 1, time: baseTime + 86_400_000, indexValue: 125 },
    { datum: prices[2], sourceIndex: 2, time: baseTime + 172_800_000, indexValue: 75 },
  ]);
});

it("preserves every source row and makes explicit missing values and excluded rows into gaps", () => {
  const data: readonly Price[] = [
    { time: baseTime, close: 20, label: "base" },
    { time: baseTime + 1, close: null, label: "missing value" },
    { time: null, close: 40, label: "missing time" },
    { time: baseTime + 3, close: 40, label: "excluded" },
  ];
  const result = percentageReturns(data, {
    time: "time",
    value: "close",
    baseTime,
    defined: (row) => row.label !== "excluded",
  });

  expect(result).toEqual([
    { datum: data[0], sourceIndex: 0, time: baseTime, returnPercent: 0 },
    { datum: data[1], sourceIndex: 1, time: baseTime + 1, returnPercent: null },
    { datum: data[2], sourceIndex: 2, time: null, returnPercent: null },
    { datum: data[3], sourceIndex: 3, time: null, returnPercent: null },
  ]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result?.[0])).toBe(true);
  expect(result?.[0]?.datum).toBe(data[0]);
  expect(data.map((row) => row.label)).toEqual([
    "base",
    "missing value",
    "missing time",
    "excluded",
  ]);
});

it("requires one eligible complete exact positive base observation", () => {
  expect(percentageReturns(prices, {
    time: "time", value: "close", baseTime: baseTime + 2,
  })).toBeUndefined();
  const empty: readonly Price[] = [];
  expect(indexTo100(empty, { time: "time", value: "close", baseTime })).toBeUndefined();
  expect(() => percentageReturns([
    { time: baseTime, close: 10 },
    { time: baseTime, close: 20 },
  ], { time: "time", value: "close", baseTime })).toThrow(/ambiguous/i);
  expect(() => percentageReturns([
    { time: baseTime, close: 0 },
  ], { time: "time", value: "close", baseTime })).toThrow(/positive/i);
  expect(() => indexTo100([
    { time: baseTime, close: -1 },
  ], { time: "time", value: "close", baseTime })).toThrow(/positive/i);
  expect(() => percentageReturns(prices, {
    time: "time", value: "close", baseTime: 1.5,
  })).toThrow(/safe integer/i);
});

it("does not call accessors for excluded rows and rejects nonfinite derived observations", () => {
  const excluded = { value: 3 };
  const result = percentageReturns([excluded, { value: 2 }], {
    time: (row) => {
      if (row === excluded) throw new Error("excluded accessor");
      return baseTime;
    },
    value: (row) => row.value,
    baseTime,
    defined: (row) => row !== excluded,
  });
  expect(result?.[0]).toEqual({
    datum: excluded, sourceIndex: 0, time: null, returnPercent: null,
  });
  expect(() => indexTo100([
    { time: baseTime, close: 1 },
    { time: baseTime + 1, close: Number.MAX_VALUE },
  ], { time: "time", value: "close", baseTime })).toThrow(/finite/i);
});

it("keeps finite scaled values when an avoidable intermediate multiplication or division would overflow or underflow", () => {
  expect(indexTo100([
    { time: baseTime, close: Number.MAX_VALUE },
  ], { time: "time", value: "close", baseTime })?.[0]?.indexValue).toBe(100);
  expect(indexTo100([
    { time: baseTime, close: 100 },
    { time: baseTime + 1, close: Number.MIN_VALUE },
  ], { time: "time", value: "close", baseTime })?.[1]?.indexValue).toBe(Number.MIN_VALUE);
  expect(percentageReturns([
    { time: baseTime, close: Number.MAX_VALUE },
  ], { time: "time", value: "close", baseTime })?.[0]?.returnPercent).toBe(0);
  expect(percentageReturns([
    { time: baseTime, close: 1_000_000_000 },
    { time: baseTime + 1, close: 1_000_000_001 },
  ], { time: "time", value: "close", baseTime })?.[1]?.returnPercent).toBeCloseTo(0.0000001, 14);
});
