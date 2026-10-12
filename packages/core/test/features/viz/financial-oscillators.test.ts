import {
  movingAverageConvergenceDivergence,
  relativeStrengthIndex,
  stochasticOscillator,
} from "@pibbl/core/viz";
import { expect, it } from "vitest";

it("derives aligned Wilder RSI after a full period of price changes", () => {
  const data = [
    { close: 1 },
    { close: 2 },
    { close: 3 },
    { close: 2 },
    { close: 2 },
  ];
  expect(
    relativeStrengthIndex(data, { value: "close", period: 2 }).map(
      (point) => point.rsi,
    ),
  ).toEqual([null, null, 100, 50, 50]);
});

it("seeds MACD EMAs and delays signal and histogram until MACD has enough values", () => {
  const data = [{ close: 1 }, { close: 2 }, { close: 3 }, { close: 4 }];
  expect(
    movingAverageConvergenceDivergence(data, {
      value: "close",
      fastPeriod: 2,
      slowPeriod: 3,
      signalPeriod: 2,
    }).map((point) => [point.macd, point.signal, point.histogram]),
  ).toEqual([
    [null, null, null],
    [null, null, null],
    [0.5, null, null],
    [0.5, 0.5, 0],
  ]);
});

it("derives rolling stochastic values and resets smoothing at a zero range", () => {
  const data = [
    { high: 10, low: 0, close: 5 },
    { high: 12, low: 2, close: 12 },
    { high: 13, low: 3, close: 8 },
    { high: 5, low: 5, close: 5 },
    { high: 5, low: 5, close: 5 },
    { high: 6, low: 4, close: 5 },
  ];
  const result = stochasticOscillator(data, {
    high: "high",
    low: "low",
    close: "close",
    lookbackPeriod: 2,
    kPeriod: 1,
    dPeriod: 2,
  });
  expect(result.map((point) => point.rawK)).toEqual([
    null,
    100,
    expect.any(Number),
    expect.any(Number),
    null,
    expect.any(Number),
  ]);
  expect(result[2]?.rawK).toBeCloseTo((6 / 11) * 100);
  expect(result[3]?.rawK).toBeCloseTo(20);
  expect(result[5]?.rawK).toBeCloseTo(50);
  expect(result.map((point) => point.k)).toEqual([
    null,
    100,
    expect.any(Number),
    expect.any(Number),
    null,
    expect.any(Number),
  ]);
  expect(result[2]?.k).toBeCloseTo((6 / 11) * 100);
  expect(result[3]?.k).toBeCloseTo(20);
  expect(result[5]?.k).toBeCloseTo(50);
  expect(result.map((point) => point.d)).toEqual([
    null,
    null,
    expect.any(Number),
    expect.any(Number),
    null,
    null,
  ]);
  expect(result[2]?.d).toBeCloseTo(((6 / 11) * 100 + 100) / 2);
  expect(result[3]?.d).toBeCloseTo(((6 / 11) * 100 + 20) / 2);
});

it("keeps stochastic %K finite for an opposite-extreme finite range", () => {
  const extreme = stochasticOscillator(
    [{ high: Number.MAX_VALUE, low: -Number.MAX_VALUE, close: 0 }],
    {
      high: "high",
      low: "low",
      close: "close",
      lookbackPeriod: 1,
      kPeriod: 1,
      dPeriod: 1,
    },
  );
  expect(extreme[0]?.rawK).toBe(50);
  expect(extreme[0]?.k).toBe(50);
  expect(extreme[0]?.d).toBe(50);
});

it("resets each oscillator at gaps and rejects invalid periods or malformed candles", () => {
  const skipped = { close: 40 } as const;
  const prices = [
    { close: 1 },
    { close: 2 },
    { close: null },
    skipped,
    { close: 3 },
    { close: 4 },
  ];
  const rsi = relativeStrengthIndex(prices, {
    value: (row) => {
      if (row === skipped) throw new Error("excluded accessor");
      return row.close;
    },
    period: 1,
    defined: (row) => row !== skipped,
  });
  expect(rsi.map((point) => point.rsi)).toEqual([
    null,
    100,
    null,
    null,
    null,
    100,
  ]);
  const macd = movingAverageConvergenceDivergence(prices, {
    value: (row) => {
      if (row === skipped) throw new Error("excluded accessor");
      return row.close;
    },
    fastPeriod: 1,
    slowPeriod: 2,
    signalPeriod: 1,
    defined: (row) => row !== skipped,
  });
  expect(macd.map((point) => point.macd)).toEqual([
    null,
    0.5,
    null,
    null,
    null,
    0.5,
  ]);
  const stochasticRows = [
    { high: 2, low: 0, close: 1 },
    { high: 3, low: 1, close: 3 },
    { high: 4, low: 2, close: null },
    { high: 4, low: 2, close: 3 },
    { high: 5, low: 3, close: 5 },
  ];
  const excludedCandle = stochasticRows[3]!;
  const stochastic = stochasticOscillator(stochasticRows, {
    high: (row) => {
      if (row === excludedCandle) throw new Error("excluded accessor");
      return row.high;
    },
    low: "low",
    close: "close",
    lookbackPeriod: 2,
    kPeriod: 1,
    dPeriod: 1,
    defined: (row) => row !== excludedCandle,
  });
  expect(stochastic.map((point) => point.rawK)).toEqual([
    null,
    100,
    null,
    null,
    null,
  ]);
  for (const output of [rsi, macd, stochastic]) {
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output[0])).toBe(true);
  }
  expect(rsi[3]).toMatchObject({ datum: skipped, sourceIndex: 3, rsi: null });
  expect(macd[3]).toMatchObject({ datum: skipped, sourceIndex: 3, macd: null });
  expect(stochastic[4]).toMatchObject({
    datum: stochasticRows[4],
    sourceIndex: 4,
  });
  expect(() =>
    movingAverageConvergenceDivergence(prices, {
      value: "close",
      fastPeriod: 2,
      slowPeriod: 2,
      signalPeriod: 1,
    }),
  ).toThrow(/fastPeriod/i);
  expect(() =>
    stochasticOscillator([{ high: 2, low: 3, close: 2 }], {
      high: "high",
      low: "low",
      close: "close",
      lookbackPeriod: 1,
      kPeriod: 1,
      dPeriod: 1,
    }),
  ).toThrow(/low <= close <= high/i);
  expect(() =>
    stochasticOscillator([{ high: 3, low: 1, close: 4 }], {
      high: "high",
      low: "low",
      close: "close",
      lookbackPeriod: 1,
      kPeriod: 1,
      dPeriod: 1,
    }),
  ).toThrow(/low <= close <= high/i);
  expect(() =>
    relativeStrengthIndex(null as unknown as readonly { close: number }[], {
      value: "close",
      period: 1,
    }),
  ).toThrow(/data must be an array/i);
});
