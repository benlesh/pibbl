import { aggregateOhlcv, sessionVwap } from "@pibbl/core/viz";
import { expect, it } from "vitest";

interface Candle {
  readonly time: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly close: number | null;
  readonly volume: number | null;
  readonly session: string;
}

const candles: readonly Candle[] = [
  { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 30, session: "A" },
  { time: 2, open: 11, high: 15, low: 10, close: 14, volume: 20, session: "A" },
  { time: 6, open: 14, high: 16, low: 13, close: 15, volume: 40, session: "B" },
];

it("aggregates chronological complete OHLCV records into frozen anchored bars", () => {
  const result = aggregateOhlcv(candles, {
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
    volume: "volume",
    bucket: (time) => time < 5 ? { start: 0, end: 5 } : { start: 5, end: 10 },
  });

  expect(result).toEqual([
    {
      start: 0, end: 5, open: 10, high: 15, low: 9, close: 14, volume: 50,
      sources: [{ datum: candles[0], sourceIndex: 0 }, { datum: candles[1], sourceIndex: 1 }],
    },
    {
      start: 5, end: 10, open: 14, high: 16, low: 13, close: 15, volume: 40,
      sources: [{ datum: candles[2], sourceIndex: 2 }],
    },
  ]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result[0])).toBe(true);
  expect(Object.isFrozen(result[0]!.sources)).toBe(true);
  expect(Object.isFrozen(result[0]!.sources[0])).toBe(true);
  expect(candles.map((candle) => candle.close)).toEqual([11, 14, 15]);
});

it("skips missing or excluded rows and rejects malformed candles and bucket order", () => {
  const excluded = candles[1]!;
  expect(aggregateOhlcv([...candles, { ...candles[2], time: null }], {
    time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume",
    bucket: (time) => ({ start: time < 5 ? 0 : 5, end: time < 5 ? 5 : 10 }),
    defined: (candle) => candle !== excluded,
  })).toMatchObject([{ open: 10, close: 11, volume: 30 }, { open: 14, close: 15, volume: 40 }]);
  expect(() => aggregateOhlcv([{ ...candles[0], high: 8 }], {
    time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume",
    bucket: () => ({ start: 0, end: 5 }),
  })).toThrow(/high/i);
  expect(() => aggregateOhlcv([{ ...candles[0], volume: -1 }], {
    time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume",
    bucket: () => ({ start: 0, end: 5 }),
  })).toThrow(/volume/i);
  expect(() => aggregateOhlcv([candles[0]!, candles[2]!], {
    time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume",
    bucket: (time) => time < 5 ? { start: 5, end: 10 } : { start: 0, end: 5 },
  })).toThrow(/bucket/i);
});

it("derives source-aligned session VWAP without letting gaps or zero volume reset it", () => {
  const rows: readonly Candle[] = [
    candles[0]!,
    { ...candles[1], close: null, session: "A" },
    { ...candles[1], volume: 0, session: "A" },
    candles[2]!,
  ];
  const result = sessionVwap(rows, {
    price: "close",
    volume: "volume",
    session: "session",
  });

  expect(result).toEqual([
    { datum: rows[0], sourceIndex: 0, session: "A", cumulativeVolume: 30, vwap: 11 },
    { datum: rows[1], sourceIndex: 1, session: "A", cumulativeVolume: 30, vwap: null },
    { datum: rows[2], sourceIndex: 2, session: "A", cumulativeVolume: 30, vwap: 11 },
    { datum: rows[3], sourceIndex: 3, session: "B", cumulativeVolume: 40, vwap: 15 },
  ]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result[0])).toBe(true);
});

it("resets at an excluded session boundary and rejects negative volume or invalid session identity", () => {
  const excluded = candles[1]!;
  expect(sessionVwap(candles, {
    price: (candle) => {
      if (candle === excluded) throw new Error("excluded accessor");
      return candle.close;
    },
    volume: "volume",
    session: "session",
    defined: (candle) => candle !== excluded,
  })[1]).toEqual({ datum: excluded, sourceIndex: 1, session: "A", cumulativeVolume: 30, vwap: null });
  const boundary = { ...candles[2], session: "B" };
  expect(sessionVwap([candles[0]!, boundary, candles[2]!], {
    price: "close", volume: "volume", session: "session",
    defined: (candle) => candle !== boundary,
  })[1]).toEqual({ datum: boundary, sourceIndex: 1, session: "B", cumulativeVolume: 0, vwap: null });
  expect(() => sessionVwap([{ ...candles[0], volume: -1 }], {
    price: "close", volume: "volume", session: "session",
  })).toThrow(/volume/i);
  expect(() => sessionVwap([{ ...candles[0], session: Number.NaN }], {
    price: "close", volume: "volume", session: "session" as never,
  })).toThrow(/session/i);
});
