import type { LineAccessor } from "./types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";

/** One half-open time interval used to group complete OHLCV records. See {@link AggregateOhlcvOptions}. */
export interface OhlcvBucket {
  /** Inclusive finite start coordinate. */
  readonly start: number;
  /** Exclusive finite end coordinate after the start. */
  readonly end: number;
}

/** Original source record that contributed to an aggregated OHLCV bar. See {@link AggregatedOhlcvPoint}. */
export interface OhlcvSource<D> {
  /** Caller-owned complete contributing record. */
  readonly datum: D;
  /** Original source index. */
  readonly sourceIndex: number;
}

/** One frozen OHLCV bar aggregated without sorting caller-owned records. See {@link aggregateOhlcv}. */
export interface AggregatedOhlcvPoint<D> extends OhlcvBucket {
  /** Open from the first contributing record. */
  readonly open: number;
  /** Maximum high from contributing records. */
  readonly high: number;
  /** Minimum low from contributing records. */
  readonly low: number;
  /** Close from the last contributing record. */
  readonly close: number;
  /** Finite sum of non-negative contributing volumes. */
  readonly volume: number;
  /** Frozen references to contributing caller-owned records. */
  readonly sources: readonly OhlcvSource<D>[];
}

/** Inputs for chronological OHLCV aggregation. See {@link aggregateOhlcv}. */
export interface AggregateOhlcvOptions<D> {
  /** Numeric property or callback that supplies each record's time coordinate. */
  readonly time: LineAccessor<D>;
  /** Numeric property or callback that supplies open. */
  readonly open: LineAccessor<D>;
  /** Numeric property or callback that supplies high. */
  readonly high: LineAccessor<D>;
  /** Numeric property or callback that supplies low. */
  readonly low: LineAccessor<D>;
  /** Numeric property or callback that supplies close. */
  readonly close: LineAccessor<D>;
  /** Numeric property or callback that supplies non-negative volume. */
  readonly volume: LineAccessor<D>;
  /**
   * Returns the half-open aggregate bucket for one eligible finite timestamp, or null to skip it.
   * @param time - Eligible finite source timestamp.
   * @returns A containing half-open bucket, or null when the record is not aggregated.
   * @see {@link OhlcvBucket}
   */
  readonly bucket: (time: number) => OhlcvBucket | null;
  /**
   * Excludes a record before its OHLCV and bucket accessors run.
   * @param datum - Original source observation.
   * @param index - Zero-based source index.
   * @param data - Complete caller-supplied source array.
   * @returns Whether this observation may contribute.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/** A valid session identifier supplied to {@link sessionVwap}. */
export type SessionIdentifier = string | number;

/**
 * A property or callback that supplies the session containing a source record.
 * @param datum - Source observation under consideration.
 * @param index - Zero-based source index.
 * @param data - Complete caller-supplied source array.
 * @returns The record's string or finite numeric session identifier.
 * @see {@link SessionVwapOptions}
 */
export type SessionAccessor<D> =
  | { [K in keyof D]-?: D[K] extends SessionIdentifier ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => SessionIdentifier);

/** Inputs for source-aligned session VWAP. See {@link sessionVwap}. */
export interface SessionVwapOptions<D> {
  /** Numeric property or callback that supplies each record's price. */
  readonly price: LineAccessor<D>;
  /** Numeric property or callback that supplies non-negative volume. */
  readonly volume: LineAccessor<D>;
  /** Property or callback that supplies the current string or finite numeric session identifier. */
  readonly session: SessionAccessor<D>;
  /**
   * Excludes a row before price and volume accessors run; its session still resets state.
   * @param datum - Original source observation.
   * @param index - Zero-based source index.
   * @param data - Complete caller-supplied source array.
   * @returns Whether this observation participates in VWAP calculation.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/** One frozen source-aligned session VWAP point. See {@link sessionVwap}. */
export interface SessionVwapPoint<D> {
  /** Caller-owned original record. */
  readonly datum: D;
  /** Original source index, including excluded and incomplete records. */
  readonly sourceIndex: number;
  /** Evaluated session, including for an excluded source record. */
  readonly session: SessionIdentifier;
  /** Finite volume accumulated for this session before or including this record. */
  readonly cumulativeVolume: number;
  /** Session VWAP after this valid record, null for incomplete or excluded records. */
  readonly vwap: number | null;
}

function validBucket(value: OhlcvBucket | null, time: number): OhlcvBucket | null {
  if (value === null) return null;
  if (value === undefined || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("aggregateOhlcv bucket must return an object or null.");
  const { start, end } = value;
  if (!finiteCoordinate(start) || !finiteCoordinate(end) || start >= end)
    throw new RangeError("aggregateOhlcv bucket bounds must be finite and increasing.");
  if (time < start || time >= end)
    throw new RangeError("aggregateOhlcv bucket must contain its source time.");
  return value;
}

function validateCandle(
  open: number, high: number, low: number, close: number, volume: number,
): void {
  if (volume < 0) throw new RangeError("aggregateOhlcv volume must be non-negative.");
  if (low > high || open < low || open > high || close < low || close > high)
    throw new RangeError("aggregateOhlcv high and low must contain open and close.");
}

function sessionAccessor<D>(input: SessionAccessor<D>): (datum: D, index: number, data: readonly D[]) => SessionIdentifier {
  return typeof input === "function"
    ? input
    : (datum) => datum[input] as SessionIdentifier;
}

function validSession(value: unknown): value is SessionIdentifier {
  if (typeof value === "string") return true;
  if (typeof value === "number" && Number.isFinite(value)) return true;
  throw new TypeError("sessionVwap session must be a string or finite number.");
}

function weightedAverage(previous: number, previousVolume: number, price: number, volume: number): number {
  const total = previousVolume + volume;
  if (!Number.isFinite(total)) throw new RangeError("sessionVwap cumulative volume must be finite.");
  const scale = Math.max(Math.abs(previous), Math.abs(price));
  if (scale === 0) return 0;
  const result = ((previous / scale) * (previousVolume / total) + (price / scale) * (volume / total)) * scale;
  if (!Number.isFinite(result)) throw new RangeError("sessionVwap derived value must be finite.");
  return result;
}

/**
 * Aggregates source-ordered complete OHLCV records into caller-defined chronological buckets.
 *
 * It never sorts or mutates source records. Missing, excluded, and null-bucket records are skipped;
 * finite malformed candles, negative volume, noncontiguous bucket bounds, and time disorder reject.
 * @param data - Caller-owned source observations in chronological order.
 * @param options - OHLCV accessors, bucket definition, and optional participation callback.
 * @returns Frozen anchored aggregate bars with frozen original source references.
 * @see {@link AggregateOhlcvOptions}
 * @see {@link AggregatedOhlcvPoint}
 */
export function aggregateOhlcv<D>(data: readonly D[], options: AggregateOhlcvOptions<D>): readonly AggregatedOhlcvPoint<D>[] {
  const rows = pointData(data, "aggregateOhlcv");
  const time = pointAccessor(options.time), open = pointAccessor(options.open), high = pointAccessor(options.high);
  const low = pointAccessor(options.low), close = pointAccessor(options.close), volume = pointAccessor(options.volume);
  const aggregates: AggregatedOhlcvPoint<D>[] = [];
  let previousTime: number | undefined;
  let current: { start: number; end: number; open: number; high: number; low: number; close: number; volume: number; sources: OhlcvSource<D>[] } | undefined;
  for (let index = 0; index < rows.length; index++) {
    const datum = rows[index]!;
    if (!(options.defined?.(datum, index, rows) ?? true)) continue;
    const timestamp = time(datum, index, rows);
    if (!finiteCoordinate(timestamp)) continue;
    if (previousTime !== undefined && timestamp < previousTime)
      throw new RangeError("aggregateOhlcv data must be chronological.");
    previousTime = timestamp;
    const interval = validBucket(options.bucket(timestamp), timestamp);
    if (interval === null) continue;
    const o = open(datum, index, rows), h = high(datum, index, rows), l = low(datum, index, rows);
    const c = close(datum, index, rows), v = volume(datum, index, rows);
    if (!finiteCoordinate(o) || !finiteCoordinate(h) || !finiteCoordinate(l)
      || !finiteCoordinate(c) || !finiteCoordinate(v)) continue;
    validateCandle(o, h, l, c, v);
    if (current === undefined || current.start !== interval.start || current.end !== interval.end) {
      if (current !== undefined) {
        if (interval.start < current.end)
          throw new RangeError("aggregateOhlcv buckets must be non-overlapping and source ordered.");
        aggregates.push(Object.freeze({ ...current, sources: Object.freeze(current.sources) }));
      }
      current = { start: interval.start, end: interval.end, open: o, high: h, low: l, close: c, volume: v, sources: [Object.freeze({ datum, sourceIndex: index })] };
      continue;
    }
    const nextVolume = current.volume + v;
    if (!Number.isFinite(nextVolume)) throw new RangeError("aggregateOhlcv volume must remain finite.");
    current.high = Math.max(current.high, h);
    current.low = Math.min(current.low, l);
    current.close = c;
    current.volume = nextVolume;
    current.sources.push(Object.freeze({ datum, sourceIndex: index }));
  }
  if (current !== undefined)
    aggregates.push(Object.freeze({ ...current, sources: Object.freeze(current.sources) }));
  return Object.freeze(aggregates);
}

/**
 * Derives source-aligned volume-weighted prices that reset whenever the session identifier changes.
 *
 * Missing prices or volumes and excluded rows produce null without changing the current accumulated
 * state. Zero-volume complete records preserve the preceding VWAP; negative volumes reject.
 * @param data - Caller-owned source observations in presentation order.
 * @param options - Price, volume, session accessors, and optional participation callback.
 * @returns Frozen source-aligned points with current cumulative volume and VWAP or null.
 * @see {@link SessionVwapOptions}
 * @see {@link SessionVwapPoint}
 */
export function sessionVwap<D>(data: readonly D[], options: SessionVwapOptions<D>): readonly SessionVwapPoint<D>[] {
  const rows = pointData(data, "sessionVwap");
  const price = pointAccessor(options.price), volume = pointAccessor(options.volume), session = sessionAccessor(options.session);
  const results: SessionVwapPoint<D>[] = [];
  let activeSession: SessionIdentifier | undefined;
  let cumulativeVolume = 0;
  let average: number | undefined;
  for (let index = 0; index < rows.length; index++) {
    const datum = rows[index]!;
    const currentSession = session(datum, index, rows);
    validSession(currentSession);
    if (activeSession !== currentSession) {
      activeSession = currentSession;
      cumulativeVolume = 0;
      average = undefined;
    }
    if (!(options.defined?.(datum, index, rows) ?? true)) {
      results.push(Object.freeze({ datum, sourceIndex: index, session: currentSession, cumulativeVolume, vwap: null }));
      continue;
    }
    const currentPrice = price(datum, index, rows), currentVolume = volume(datum, index, rows);
    if (!finiteCoordinate(currentPrice) || !finiteCoordinate(currentVolume)) {
      results.push(Object.freeze({ datum, sourceIndex: index, session: currentSession, cumulativeVolume, vwap: null }));
      continue;
    }
    if (currentVolume < 0) throw new RangeError("sessionVwap volume must be non-negative.");
    if (currentVolume > 0) {
      average = average === undefined ? currentPrice : weightedAverage(average, cumulativeVolume, currentPrice, currentVolume);
      cumulativeVolume += currentVolume;
      if (!Number.isFinite(cumulativeVolume)) throw new RangeError("sessionVwap cumulative volume must be finite.");
    }
    results.push(Object.freeze({ datum, sourceIndex: index, session: currentSession, cumulativeVolume, vwap: average ?? null }));
  }
  return Object.freeze(results);
}
