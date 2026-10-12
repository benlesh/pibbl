import { aggregateOhlcv, sessionVwap, type AggregatedOhlcvPoint, type SessionVwapPoint } from "@pibbl/core/viz";
const rows = [
  { time: 0, session: "A", open: 10, high: 12, low: 9, close: 11, volume: 2 },
  { time: 60000, session: "A", open: 11, high: 14, low: 10, close: 13, volume: 3 },
  { time: 120000, session: "B", open: 13, high: 15, low: 12, close: 14, volume: 4 },
];
export const aggregated: readonly AggregatedOhlcvPoint<(typeof rows)[number]>[] = aggregateOhlcv(rows, {
  time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume",
  bucket: time => { const start = Math.floor(time / 120000) * 120000; return { start, end: start + 120000 }; },
});
export const vwap: readonly SessionVwapPoint<(typeof rows)[number]>[] = sessionVwap(rows, {
  price: row => (row.high + row.low + row.close) / 3, volume: "volume", session: "session",
});
