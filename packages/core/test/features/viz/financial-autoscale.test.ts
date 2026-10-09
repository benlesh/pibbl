import {
  padLinearDomain,
  visibleOhlcPriceExtent,
} from "@pibbl/core/viz";
import { expect, it } from "vitest";

interface Candle {
  readonly time: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly close: number | null;
}

const candles: readonly Candle[] = [
  { time: 100, open: 10, high: 14, low: 8, close: 12 },
  { time: 200, open: 12, high: 15, low: 11, close: 13 },
  { time: 300, open: 13, high: 99, low: 12, close: 14 },
];

function visibleExtent(
  data: readonly Candle[] = candles,
  visibleRange: readonly [number, number] = [0, 1],
) {
  return visibleOhlcPriceExtent(data, {
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
    positionAtTime: (time) => (time - 100) / 100,
    visibleRange,
  });
}

it("returns the ascending high/low extent of complete candles whose centers are visible", () => {
  const result = visibleExtent();
  expect(result).toEqual([8, 15]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(visibleExtent(candles, [1.5, -0.5])).toEqual([8, 15]);
  expect(visibleExtent(candles, [1.1, 1.9])).toBeUndefined();
});

it("skips incomplete candles and excludes unknown mapped positions without touching source data", () => {
  const data: readonly Candle[] = [
    { time: 100, open: 10, high: 14, low: 8, close: 12 },
    { time: null, open: 12, high: 50, low: 1, close: 13 },
    { time: 200, open: null, high: 50, low: 1, close: 13 },
    { time: 300, open: 13, high: 99, low: 12, close: 14 },
  ];
  const result = visibleOhlcPriceExtent(data, {
    time: "time", open: "open", high: "high", low: "low", close: "close",
    positionAtTime: (time) => time === 100 ? 0 : undefined,
    visibleRange: [0, 0],
  });
  expect(result).toEqual([8, 14]);
  expect(data[0]?.high).toBe(14);
});

it("runs defined before accessors and rejects finite malformed candles or invalid visibility", () => {
  const malformed: readonly Candle[] = [
    { time: 100, open: 10, high: 9, low: 8, close: 11 },
  ];
  expect(() => visibleExtent(malformed)).toThrow(/low <= open\/close <= high/i);
  expect(() => visibleOhlcPriceExtent(candles, {
    time: "time", open: "open", high: "high", low: "low", close: "close",
    defined: () => false,
    positionAtTime: () => Infinity,
    visibleRange: [0, 1],
  })).not.toThrow();
  expect(() => visibleOhlcPriceExtent(candles, {
    time: "time", open: "open", high: "high", low: "low", close: "close",
    positionAtTime: () => Infinity,
    visibleRange: [0, 1],
  })).toThrow(/positionAtTime/i);
  expect(() => visibleExtent(candles, [0, Infinity])).toThrow(/visibleRange/i);
});

it("pads normal and flat domains, preserving direction and rejecting unrepresentable domains", () => {
  expect(padLinearDomain([10, 20])).toEqual([9, 21]);
  expect(padLinearDomain([20, 10], { padding: 0.2 })).toEqual([22, 8]);
  expect(padLinearDomain([0, 0])).toEqual([-0.6, 0.6]);
  expect(padLinearDomain([50, 50], { minimumSpan: 4, padding: 0.25 })).toEqual([47, 53]);
  expect(Object.isFrozen(padLinearDomain([10, 20]))).toBe(true);
  expect(() => padLinearDomain([1, 2], { padding: -1 })).toThrow(/padding/i);
  expect(() => padLinearDomain([1, 2], { minimumSpan: 0 })).toThrow(/minimumSpan/i);
  expect(() => padLinearDomain([Number.MAX_VALUE, Number.MAX_VALUE])).toThrow(/finite|distinct/i);
});
