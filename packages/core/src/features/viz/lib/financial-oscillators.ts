import type { LineAccessor } from "./types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";

/**
 * Shared inputs for source-aligned closing-price oscillators.
 *
 * @see {@link RelativeStrengthIndexPoint}
 * @see {@link MovingAverageConvergenceDivergencePoint}
 */
export interface OscillatorOptions<D> {
  /**
   * Numeric property or callback that supplies each closing observation.
   *
   * @see {@link LineAccessor}
   */
  readonly value: LineAccessor<D>;
  /**
   * Excludes a row before its accessor runs and resets the current warmup.
   *
   * @param datum - Source observation under consideration.
   * @param index - Zero-based source index.
   * @param data - Complete caller-supplied source data.
   * @returns Whether the observation participates in the consecutive calculation.
   * @see {@link LineAccessor}
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/**
 * Inputs for Wilder's relative strength index.
 *
 * @see {@link OscillatorOptions}
 * @see {@link RelativeStrengthIndexPoint}
 */
export interface RelativeStrengthIndexOptions<D> extends OscillatorOptions<D> {
  /**
   * Positive safe number of consecutive price changes used by Wilder smoothing.
   *
   * @see {@link relativeStrengthIndex}
   */
  readonly period: number;
}

/**
 * Inputs for moving average convergence/divergence.
 *
 * @see {@link OscillatorOptions}
 * @see {@link MovingAverageConvergenceDivergencePoint}
 */
export interface MovingAverageConvergenceDivergenceOptions<
  D,
> extends OscillatorOptions<D> {
  /** Positive safe EMA period shorter than slowPeriod. */
  readonly fastPeriod: number;
  /** Positive safe EMA period longer than fastPeriod. */
  readonly slowPeriod: number;
  /** Positive safe EMA period used to smooth available MACD observations. */
  readonly signalPeriod: number;
}

/**
 * Inputs for the rolling stochastic oscillator.
 *
 * @see {@link StochasticOscillatorPoint}
 * @see {@link LineAccessor}
 */
export interface StochasticOscillatorOptions<D> {
  /** Numeric property or callback that supplies each high. See {@link LineAccessor}. */
  readonly high: LineAccessor<D>;
  /** Numeric property or callback that supplies each low. See {@link LineAccessor}. */
  readonly low: LineAccessor<D>;
  /** Numeric property or callback that supplies each close. See {@link LineAccessor}. */
  readonly close: LineAccessor<D>;
  /** Positive safe count of consecutive OHLC rows in the raw %K range. */
  readonly lookbackPeriod: number;
  /** Positive safe count of raw %K values in the smoothed %K average. */
  readonly kPeriod: number;
  /** Positive safe count of smoothed %K values in the %D average. */
  readonly dPeriod: number;
  /**
   * Excludes a row before its accessors run and resets all oscillator warmup.
   *
   * @param datum - Source observation under consideration.
   * @param index - Zero-based source index.
   * @param data - Complete caller-supplied source data.
   * @returns Whether the observation participates in consecutive windows.
   * @see {@link LineAccessor}
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/**
 * One source-aligned relative strength index observation.
 *
 * @see {@link RelativeStrengthIndexOptions}
 */
export interface RelativeStrengthIndexPoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original source index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Wilder RSI from zero through 100, or null during warmup and gaps. */
  readonly rsi: number | null;
}

/**
 * One source-aligned moving average convergence/divergence observation.
 *
 * @see {@link MovingAverageConvergenceDivergenceOptions}
 */
export interface MovingAverageConvergenceDivergencePoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original source index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Fast EMA minus slow EMA, or null before both are seeded. */
  readonly macd: number | null;
  /** EMA of available MACD values, or null during signal warmup. */
  readonly signal: number | null;
  /** MACD minus its signal, or null before the signal is available. */
  readonly histogram: number | null;
}

/**
 * One source-aligned stochastic oscillator observation.
 *
 * @see {@link StochasticOscillatorOptions}
 */
export interface StochasticOscillatorPoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original source index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Unsmoothed %K from zero through 100, or null during warmup/a zero range. */
  readonly rawK: number | null;
  /** SMA-smoothed %K, or null during warmup/a zero range. */
  readonly k: number | null;
  /** SMA of smoothed %K, or null during warmup/a zero range. */
  readonly d: number | null;
}

function positivePeriod(period: number, name: string): void {
  if (!Number.isSafeInteger(period) || period <= 0)
    throw new RangeError(`${name} must be a positive safe integer.`);
}

function mean(values: readonly number[]): number {
  let scale = 0;
  for (const value of values) scale = Math.max(scale, Math.abs(value));
  if (scale === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value / scale;
  const result = (sum / values.length) * scale;
  if (!Number.isFinite(result))
    throw new RangeError("oscillator derived value must be finite.");
  return result;
}

function weighted(previous: number, next: number, alpha: number): number {
  const scale = Math.max(Math.abs(previous), Math.abs(next));
  if (scale === 0) return 0;
  const result =
    ((previous / scale) * (1 - alpha) + (next / scale) * alpha) * scale;
  if (!Number.isFinite(result))
    throw new RangeError("oscillator derived value must be finite.");
  return result;
}

function rollingPush(values: number[], value: number, period: number): void {
  values.push(value);
  if (values.length > period) values.shift();
}

function oscillatorValues<D>(
  data: readonly D[],
  options: OscillatorOptions<D>,
): readonly (number | null)[] {
  const rows = pointData(data, "oscillator");
  const value = pointAccessor(options.value);
  return Object.freeze(
    rows.map((datum, index) => {
      if (!(options.defined?.(datum, index, rows) ?? true)) return null;
      const observed = value(datum, index, rows);
      return finiteCoordinate(observed) ? observed : null;
    }),
  );
}

/**
 * Derives source-aligned Wilder relative strength index observations.
 *
 * The first RSI follows a full `period` of consecutive price changes, requiring `period + 1`
 * consecutive prices. Flat average gain/loss yields 50; gain-only yields 100 and loss-only yields
 * 0. Missing, nonfinite, and excluded rows produce null and reset the seed.
 *
 * @param data - Source observations, retained in their original order.
 * @param options - Closing value accessor, Wilder period, and optional participation callback.
 * @returns Frozen source-aligned RSI observations.
 * @see {@link RelativeStrengthIndexOptions}
 * @see {@link RelativeStrengthIndexPoint}
 */
export function relativeStrengthIndex<D>(
  data: readonly D[],
  options: RelativeStrengthIndexOptions<D>,
): readonly RelativeStrengthIndexPoint<D>[] {
  positivePeriod(options.period, "RSI period");
  const values = oscillatorValues(data, options);
  const gains: number[] = [],
    losses: number[] = [];
  let previous: number | undefined;
  let averageGain: number | undefined, averageLoss: number | undefined;
  return Object.freeze(
    data.map((datum, sourceIndex) => {
      const value = values[sourceIndex];
      if (value === null) {
        gains.length = 0;
        losses.length = 0;
        previous = undefined;
        averageGain = undefined;
        averageLoss = undefined;
        return Object.freeze({ datum, sourceIndex, rsi: null });
      }
      if (previous === undefined) {
        previous = value;
        return Object.freeze({ datum, sourceIndex, rsi: null });
      }
      const change = value - previous;
      if (!Number.isFinite(change))
        throw new RangeError("RSI change must be finite.");
      previous = value;
      const gain = Math.max(change, 0),
        loss = Math.max(-change, 0);
      if (averageGain === undefined || averageLoss === undefined) {
        gains.push(gain);
        losses.push(loss);
        if (gains.length < options.period)
          return Object.freeze({ datum, sourceIndex, rsi: null });
        averageGain = mean(gains);
        averageLoss = mean(losses);
      } else {
        averageGain = weighted(averageGain, gain, 1 / options.period);
        averageLoss = weighted(averageLoss, loss, 1 / options.period);
      }
      const rsi =
        averageGain === 0 && averageLoss === 0
          ? 50
          : averageLoss === 0
            ? 100
            : averageGain === 0
              ? 0
              : 100 - 100 / (1 + averageGain / averageLoss);
      if (!Number.isFinite(rsi))
        throw new RangeError("RSI derived value must be finite.");
      return Object.freeze({ datum, sourceIndex, rsi });
    }),
  );
}

/**
 * Derives source-aligned MACD, signal, and histogram observations from SMA-seeded EMAs.
 *
 * Missing, nonfinite, and excluded rows produce null fields and reset all EMA warmup. The MACD
 * value appears once both price EMAs are seeded; signal and histogram wait for their own EMA seed.
 *
 * @param data - Source observations, retained in their original order.
 * @param options - Closing value accessor, ordered EMA periods, and participation callback.
 * @returns Frozen source-aligned MACD observations.
 * @see {@link MovingAverageConvergenceDivergenceOptions}
 * @see {@link MovingAverageConvergenceDivergencePoint}
 */
export function movingAverageConvergenceDivergence<D>(
  data: readonly D[],
  options: MovingAverageConvergenceDivergenceOptions<D>,
): readonly MovingAverageConvergenceDivergencePoint<D>[] {
  positivePeriod(options.fastPeriod, "MACD fastPeriod");
  positivePeriod(options.slowPeriod, "MACD slowPeriod");
  positivePeriod(options.signalPeriod, "MACD signalPeriod");
  if (options.fastPeriod >= options.slowPeriod)
    throw new RangeError("MACD fastPeriod must be less than slowPeriod.");
  const values = oscillatorValues(data, options);
  const fastSeed: number[] = [],
    slowSeed: number[] = [],
    signalSeed: number[] = [];
  const fastAlpha = 2 / (options.fastPeriod + 1),
    slowAlpha = 2 / (options.slowPeriod + 1);
  const signalAlpha = 2 / (options.signalPeriod + 1);
  let fast: number | undefined,
    slow: number | undefined,
    signal: number | undefined;
  const reset = () => {
    fastSeed.length = 0;
    slowSeed.length = 0;
    signalSeed.length = 0;
    fast = undefined;
    slow = undefined;
    signal = undefined;
  };
  return Object.freeze(
    data.map((datum, sourceIndex) => {
      const value = values[sourceIndex];
      if (value === null) {
        reset();
        return Object.freeze({
          datum,
          sourceIndex,
          macd: null,
          signal: null,
          histogram: null,
        });
      }
      if (fast === undefined) {
        fastSeed.push(value);
        if (fastSeed.length === options.fastPeriod) fast = mean(fastSeed);
      } else fast = weighted(fast, value, fastAlpha);
      if (slow === undefined) {
        slowSeed.push(value);
        if (slowSeed.length === options.slowPeriod) slow = mean(slowSeed);
      } else slow = weighted(slow, value, slowAlpha);
      if (fast === undefined || slow === undefined)
        return Object.freeze({
          datum,
          sourceIndex,
          macd: null,
          signal: null,
          histogram: null,
        });
      const macd = fast - slow;
      if (!Number.isFinite(macd))
        throw new RangeError("MACD derived value must be finite.");
      if (signal === undefined) {
        signalSeed.push(macd);
        if (signalSeed.length === options.signalPeriod)
          signal = mean(signalSeed);
      } else signal = weighted(signal, macd, signalAlpha);
      const histogram = signal === undefined ? null : macd - signal;
      if (histogram !== null && !Number.isFinite(histogram))
        throw new RangeError("MACD histogram must be finite.");
      return Object.freeze({
        datum,
        sourceIndex,
        macd,
        signal: signal ?? null,
        histogram,
      });
    }),
  );
}

interface OhlcValue {
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

function stochasticValues<D>(
  data: readonly D[],
  options: StochasticOscillatorOptions<D>,
): readonly (OhlcValue | null)[] {
  const rows = pointData(data, "stochastic oscillator");
  const high = pointAccessor(options.high),
    low = pointAccessor(options.low),
    close = pointAccessor(options.close);
  return Object.freeze(
    rows.map((datum, index) => {
      if (!(options.defined?.(datum, index, rows) ?? true)) return null;
      const highValue = high(datum, index, rows);
      const lowValue = low(datum, index, rows);
      const closeValue = close(datum, index, rows);
      if (
        !finiteCoordinate(highValue) ||
        !finiteCoordinate(lowValue) ||
        !finiteCoordinate(closeValue)
      )
        return null;
      const values: OhlcValue = {
        high: highValue,
        low: lowValue,
        close: closeValue,
      };
      if (
        values.low > values.high ||
        values.close < values.low ||
        values.close > values.high
      )
        throw new RangeError(
          "stochastic oscillator requires low <= close <= high.",
        );
      return Object.freeze(values);
    }),
  );
}

/**
 * Derives source-aligned rolling stochastic %K, smoothed %K, and %D observations.
 *
 * %K uses the trailing high/low range. A zero range yields null raw %K and resets only the %K/%D
 * smoothing warmup, while its complete OHLC row remains in the rolling range. Missing, nonfinite,
 * and excluded rows reset every window; malformed finite candles reject.
 *
 * @param data - Source OHLC observations, retained in their original order.
 * @param options - OHLC accessors, rolling periods, and optional participation callback.
 * @returns Frozen source-aligned stochastic oscillator observations.
 * @see {@link StochasticOscillatorOptions}
 * @see {@link StochasticOscillatorPoint}
 */
export function stochasticOscillator<D>(
  data: readonly D[],
  options: StochasticOscillatorOptions<D>,
): readonly StochasticOscillatorPoint<D>[] {
  positivePeriod(options.lookbackPeriod, "stochastic lookbackPeriod");
  positivePeriod(options.kPeriod, "stochastic kPeriod");
  positivePeriod(options.dPeriod, "stochastic dPeriod");
  const values = stochasticValues(data, options);
  const window: OhlcValue[] = [],
    kValues: number[] = [],
    dValues: number[] = [];
  const reset = () => {
    window.length = 0;
    kValues.length = 0;
    dValues.length = 0;
  };
  const resetSmoothing = () => {
    kValues.length = 0;
    dValues.length = 0;
  };
  return Object.freeze(
    data.map((datum, sourceIndex) => {
      const value = values[sourceIndex];
      if (value === null) {
        reset();
        return Object.freeze({
          datum,
          sourceIndex,
          rawK: null,
          k: null,
          d: null,
        });
      }
      window.push(value);
      if (window.length > options.lookbackPeriod) window.shift();
      if (window.length < options.lookbackPeriod)
        return Object.freeze({
          datum,
          sourceIndex,
          rawK: null,
          k: null,
          d: null,
        });
      let high = -Infinity,
        low = Infinity;
      for (const row of window) {
        high = Math.max(high, row.high);
        low = Math.min(low, row.low);
      }
      const scale = Math.max(
        Math.abs(high),
        Math.abs(low),
        Math.abs(value.close),
      );
      if (scale === 0) {
        resetSmoothing();
        return Object.freeze({
          datum,
          sourceIndex,
          rawK: null,
          k: null,
          d: null,
        });
      }
      const scaledLow = low / scale;
      const scaledRange = high / scale - scaledLow;
      if (scaledRange === 0) {
        resetSmoothing();
        return Object.freeze({
          datum,
          sourceIndex,
          rawK: null,
          k: null,
          d: null,
        });
      }
      const rawK = ((value.close / scale - scaledLow) / scaledRange) * 100;
      if (!Number.isFinite(rawK))
        throw new RangeError("stochastic %K must be finite.");
      rollingPush(kValues, rawK, options.kPeriod);
      const k = kValues.length === options.kPeriod ? mean(kValues) : null;
      if (k === null)
        return Object.freeze({ datum, sourceIndex, rawK, k: null, d: null });
      rollingPush(dValues, k, options.dPeriod);
      const d = dValues.length === options.dPeriod ? mean(dValues) : null;
      return Object.freeze({ datum, sourceIndex, rawK, k, d });
    }),
  );
}
