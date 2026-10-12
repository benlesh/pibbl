import type { LineAccessor, LinearDomain } from "./types.js";
import type { CandlestickSeries } from "./candlestick-series.js";
import type { LinearScale } from "./linear-scale-component.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";

/** Inputs that identify complete OHLC candle values. See {@link visibleOhlcPriceExtent}. */
export interface VisibleOhlcPriceExtentOptions<D> {
  /** UTC-millisecond property or callback. */
  readonly time: LineAccessor<D>;
  /** Opening-price property or callback. */
  readonly open: LineAccessor<D>;
  /** High-price property or callback. */
  readonly high: LineAccessor<D>;
  /** Low-price property or callback. */
  readonly low: LineAccessor<D>;
  /** Closing-price property or callback. */
  readonly close: LineAccessor<D>;
  /**
   * Maps an exact timestamp into the coordinate system used by visibleRange.
   * @param time - Finite UTC-millisecond timestamp from the current source row.
   * @returns A finite position, or undefined to exclude the row.
   * @see ResolvedTradingTimeScale
   */
  readonly positionAtTime: (time: number) => number | undefined;
  /** Two finite endpoints in the positionAtTime coordinate system; either order is accepted. */
  readonly visibleRange: LinearDomain;
  /**
   * Excludes an original row before any accessor runs.
   * @param datum - Original source row.
   * @param index - Source index.
   * @param data - Complete original source array.
   * @returns Whether this row participates.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/** Options for expanding a continuous numeric domain. See {@link padLinearDomain}. */
export interface PadLinearDomainOptions {
  /** Fraction of the effective span added to each side; defaults to 0.1. */
  readonly padding?: number;
  /** Positive span floor before padding. Flat domains use a deterministic fallback when omitted. */
  readonly minimumSpan?: number;
}

function pair(value: readonly number[], name: string): LinearDomain {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite))
    throw new RangeError(`${name} requires two finite endpoints.`);
  return Object.freeze([value[0]!, value[1]!]);
}

/**
 * Finds the ascending low/high extent of complete OHLC rows whose mapped center is visible. See
 * {@link CandlestickSeries}.
 *
 * The supplied position function keeps elapsed-time and fractional trading-slot visibility
 * explicit. It does not sort or mutate data, interpolate timestamps, or use painted pixels.
 * @param data - Original OHLC records in application-owned source order.
 * @param options - Named accessors and one caller-defined visibility coordinate system.
 * @returns Frozen ascending low/high endpoints, or undefined when no complete visible candle exists.
 * @see CandlestickSeries
 */
export function visibleOhlcPriceExtent<D>(
  data: readonly D[],
  options: VisibleOhlcPriceExtentOptions<D>,
): LinearDomain | undefined {
  const rows = pointData(data, "visibleOhlcPriceExtent");
  if (typeof options.positionAtTime !== "function")
    throw new TypeError("visibleOhlcPriceExtent positionAtTime must be a function.");
  const visibleRange = pair(options.visibleRange, "visibleOhlcPriceExtent visibleRange");
  const minimum = Math.min(...visibleRange), maximum = Math.max(...visibleRange);
  const time = pointAccessor(options.time), open = pointAccessor(options.open),
    high = pointAccessor(options.high), low = pointAccessor(options.low), close = pointAccessor(options.close);
  let minimumPrice = Infinity, maximumPrice = -Infinity;
  for (let index = 0; index < rows.length; index++) {
    const datum = rows[index]!;
    if (options.defined && !options.defined(datum, index, rows)) continue;
    const timestamp = time(datum, index, rows);
    if (!finiteCoordinate(timestamp)) continue;
    const position = options.positionAtTime(timestamp);
    if (position === undefined) continue;
    if (!finiteCoordinate(position))
      throw new RangeError("visibleOhlcPriceExtent positionAtTime must return a finite number or undefined.");
    if (position < minimum || position > maximum) continue;
    const opening = open(datum, index, rows), highest = high(datum, index, rows),
      lowest = low(datum, index, rows), closing = close(datum, index, rows);
    if (!finiteCoordinate(opening) || !finiteCoordinate(highest) ||
      !finiteCoordinate(lowest) || !finiteCoordinate(closing)) continue;
    if (lowest > Math.min(opening, closing) || highest < Math.max(opening, closing))
      throw new RangeError(
        `visibleOhlcPriceExtent: malformed OHLC at source index ${index}; require low <= open/close <= high.`,
      );
    minimumPrice = Math.min(minimumPrice, lowest);
    maximumPrice = Math.max(maximumPrice, highest);
  }
  return minimumPrice === Infinity
    ? undefined
    : Object.freeze([minimumPrice, maximumPrice]);
}

/**
 * Expands a finite numeric domain by equal proportional padding on both sides. See
 * {@link LinearScale}.
 *
 * Flat domains first receive minimumSpan or max(abs(value) * 0.02, 1), then padding.
 * Input direction is preserved and output endpoints are frozen.
 * @param domain - Two finite numeric endpoints, including equal values.
 * @param options - Padding fraction and optional positive effective-span floor.
 * @returns A distinct finite padded domain in the input direction.
 * @see LinearScale
 */
export function padLinearDomain(
  domain: LinearDomain,
  options: PadLinearDomainOptions = {},
): LinearDomain {
  const input = pair(domain, "padLinearDomain domain");
  const padding = options.padding ?? 0.1;
  if (typeof padding !== "number" || !Number.isFinite(padding) || padding < 0)
    throw new RangeError("padLinearDomain padding must be finite and nonnegative.");
  const suppliedMinimum = options.minimumSpan;
  if (suppliedMinimum !== undefined &&
    (typeof suppliedMinimum !== "number" || !Number.isFinite(suppliedMinimum) || suppliedMinimum <= 0))
    throw new RangeError("padLinearDomain minimumSpan must be finite and positive.");
  const ascending = input[0] <= input[1];
  const lower = Math.min(...input), upper = Math.max(...input);
  const rawSpan = upper - lower;
  let span = rawSpan;
  if (rawSpan === 0) span = suppliedMinimum ?? Math.max(Math.abs(lower) * 0.02, 1);
  else if (suppliedMinimum !== undefined) span = Math.max(rawSpan, suppliedMinimum);
  const midpoint = lower + rawSpan / 2;
  const half = span / 2 + span * padding;
  const start = midpoint - half, end = midpoint + half;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end)
    throw new RangeError("padLinearDomain result must have distinct finite endpoints.");
  return Object.freeze(ascending ? [start, end] : [end, start]);
}
