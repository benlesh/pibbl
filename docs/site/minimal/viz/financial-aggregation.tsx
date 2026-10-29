import {
  aggregateOhlcv,
  sessionVwap,
  type AggregateOhlcvOptions,
  type AggregatedOhlcvPoint,
  type OhlcvBucket,
  type OhlcvSource,
  type SessionAccessor,
  type SessionIdentifier,
  type SessionVwapOptions,
  type SessionVwapPoint,
} from "@pibbl/core/viz";

type Row = {
  readonly time: number;
  readonly session: "A" | "B";
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
};

const rows: readonly Row[] = [
  { time: 0, session: "A", open: 10, high: 12, low: 9, close: 11, volume: 2 },
  {
    time: 60_000,
    session: "A",
    open: 11,
    high: 14,
    low: 10,
    close: 13,
    volume: 3,
  },
  {
    time: 120_000,
    session: "B",
    open: 13,
    high: 15,
    low: 12,
    close: 14,
    volume: 4,
  },
];
const bucket = (time: number): OhlcvBucket => {
  const start = Math.floor(time / 120_000) * 120_000;
  return { start, end: start + 120_000 };
};
const aggregateOptions: AggregateOhlcvOptions<Row> = {
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  volume: "volume",
  bucket,
};
const session: SessionAccessor<Row> = "session";
const vwapOptions: SessionVwapOptions<Row> = {
  price: (row) => (row.high + row.low + row.close) / 3,
  volume: "volume",
  session,
};

export const aggregated: readonly AggregatedOhlcvPoint<Row>[] = aggregateOhlcv(
  rows,
  aggregateOptions,
);
export const firstSource: OhlcvSource<Row> | undefined =
  aggregated[0]?.sources[0];
export const firstSession: SessionIdentifier = rows[0]!.session;
export const vwap: readonly SessionVwapPoint<Row>[] = sessionVwap(
  rows,
  vwapOptions,
);

const output = document.createElement("pre");
output.textContent = JSON.stringify({ aggregated, vwap }, null, 2);
document.body.append(output);
