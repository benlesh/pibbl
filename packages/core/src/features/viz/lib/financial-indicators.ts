import type { LineAccessor } from "./types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";

/**
 * Inputs shared by source-aligned moving-average indicators.
 *
 * @see {@link MovingAveragePoint}
 * @see {@link LineAccessor}
 */
export interface MovingAverageOptions<D> {
  /**
   * Numeric property or callback that supplies each observation.
   *
   * @see {@link LineAccessor}
   */
  readonly value: LineAccessor<D>;
  /**
   * Required number of consecutive complete observations in each window.
   *
   * @see {@link MovingAveragePoint}
   */
  readonly period: number;
  /**
   * Excludes a row before its value accessor runs and resets the current window.
   *
   * @param datum - Source observation under consideration.
   * @param index - Zero-based source index.
   * @param data - Complete caller-supplied source data.
   * @returns Whether the observation participates in the current consecutive window.
   * @see {@link LineAccessor}
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/**
 * Inputs for source-aligned population-standard-deviation Bollinger bands.
 *
 * @see {@link MovingAverageOptions}
 * @see {@link BollingerBandPoint}
 */
export interface BollingerBandsOptions<D> extends MovingAverageOptions<D> {
  /**
   * Number of population standard deviations from the mean; defaults to 2.
   *
   * @see {@link BollingerBandPoint}
   */
  readonly multiplier?: number;
}

/**
 * One source-aligned simple or exponential moving-average observation.
 *
 * @see {@link MovingAverageOptions}
 */
export interface MovingAveragePoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original source index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Average after a complete consecutive window, or null during warmup/a gap. */
  readonly average: number | null;
}

/**
 * One source-aligned population-standard-deviation Bollinger-band observation.
 *
 * @see {@link BollingerBandsOptions}
 */
export interface BollingerBandPoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original source index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Window mean, or null during warmup/a gap. */
  readonly mean: number | null;
  /** Mean minus multiplier population standard deviations, or null during warmup/a gap. */
  readonly lower: number | null;
  /** Mean plus multiplier population standard deviations, or null during warmup/a gap. */
  readonly upper: number | null;
}

function validatePeriod(period: number): void {
  if (!Number.isSafeInteger(period) || period <= 0)
    throw new RangeError(
      "moving-average period must be a positive safe integer.",
    );
}

function validateMultiplier(multiplier: number): void {
  if (!Number.isFinite(multiplier) || multiplier < 0)
    throw new RangeError(
      "Bollinger multiplier must be finite and non-negative.",
    );
}

function values<D>(
  data: readonly D[],
  options: MovingAverageOptions<D>,
): readonly (number | null)[] {
  const rows = pointData(data, "moving average");
  validatePeriod(options.period);
  const value = pointAccessor(options.value);
  return Object.freeze(
    rows.map((datum, index) => {
      if (!(options.defined?.(datum, index, rows) ?? true)) return null;
      const observed = value(datum, index, rows);
      return finiteCoordinate(observed) ? observed : null;
    }),
  );
}

function summary(window: readonly number[]): readonly [number, number] {
  let scale = 0;
  for (const value of window) scale = Math.max(scale, Math.abs(value));
  if (scale === 0) return [0, 0];
  let normalizedSum = 0;
  for (const value of window) normalizedSum += value / scale;
  const meanNormalized = normalizedSum / window.length;
  let squaredDifferenceSum = 0;
  for (const value of window) {
    const difference = value / scale - meanNormalized;
    squaredDifferenceSum += difference * difference;
  }
  const varianceNormalized = squaredDifferenceSum / window.length;
  const mean = meanNormalized * scale;
  const deviation = Math.sqrt(varianceNormalized) * scale;
  if (!Number.isFinite(mean) || !Number.isFinite(deviation))
    throw new RangeError("moving-average derived value must be finite.");
  return [mean, deviation];
}

function weighted(previous: number, next: number, alpha: number): number {
  const scale = Math.max(Math.abs(previous), Math.abs(next));
  if (scale === 0) return 0;
  const result =
    ((previous / scale) * (1 - alpha) + (next / scale) * alpha) * scale;
  if (!Number.isFinite(result))
    throw new RangeError("moving-average derived value must be finite.");
  return result;
}

/**
 * Derives a source-aligned simple moving average from consecutive finite observations.
 *
 * Missing, nonfinite, and excluded observations produce null and reset warmup. Results are
 * population-neutral arithmetic means; no timestamps are inferred or changed.
 *
 * @param data - Source observations, retained in their original order.
 * @param options - Value accessor, consecutive period, and optional participation callback.
 * @returns Frozen source-aligned average observations, with null during warmup and gaps.
 * @see {@link MovingAverageOptions}
 * @see {@link MovingAveragePoint}
 */
export function simpleMovingAverage<D>(
  data: readonly D[],
  options: MovingAverageOptions<D>,
): readonly MovingAveragePoint<D>[] {
  const observed = values(data, options);
  const window: number[] = [];
  return Object.freeze(
    data.map((datum, sourceIndex) => {
      const value = observed[sourceIndex];
      if (value === null) {
        window.length = 0;
        return Object.freeze({ datum, sourceIndex, average: null });
      }
      window.push(value);
      if (window.length > options.period) window.shift();
      const average =
        window.length === options.period ? summary(window)[0] : null;
      return Object.freeze({ datum, sourceIndex, average });
    }),
  );
}

/**
 * Derives a source-aligned exponential moving average seeded by the first complete SMA window.
 *
 * Its smoothing factor is `2 / (period + 1)`. Missing, nonfinite, and excluded observations
 * produce null and reset the seed window.
 *
 * @param data - Source observations, retained in their original order.
 * @param options - Value accessor, consecutive seed period, and optional participation callback.
 * @returns Frozen source-aligned average observations, with null during warmup and gaps.
 * @see {@link MovingAverageOptions}
 * @see {@link MovingAveragePoint}
 */
export function exponentialMovingAverage<D>(
  data: readonly D[],
  options: MovingAverageOptions<D>,
): readonly MovingAveragePoint<D>[] {
  const observed = values(data, options);
  const seed: number[] = [];
  const alpha = 2 / (options.period + 1);
  let average: number | undefined;
  return Object.freeze(
    data.map((datum, sourceIndex) => {
      const value = observed[sourceIndex];
      if (value === null) {
        seed.length = 0;
        average = undefined;
        return Object.freeze({ datum, sourceIndex, average: null });
      }
      if (average === undefined) {
        seed.push(value);
        if (seed.length < options.period)
          return Object.freeze({ datum, sourceIndex, average: null });
        average = summary(seed)[0];
      } else average = weighted(average, value, alpha);
      return Object.freeze({ datum, sourceIndex, average });
    }),
  );
}

/**
 * Derives source-aligned Bollinger bands from trailing consecutive population-standard-deviation windows.
 *
 * Missing, nonfinite, and excluded observations produce null bands and reset warmup. The multiplier
 * defaults to 2; caller-owned data are neither sorted nor mutated.
 *
 * @param data - Source observations, retained in their original order.
 * @param options - Value accessor, period, participation callback, and optional band multiplier.
 * @returns Frozen source-aligned population-standard-deviation band observations.
 * @see {@link BollingerBandsOptions}
 * @see {@link BollingerBandPoint}
 */
export function bollingerBands<D>(
  data: readonly D[],
  options: BollingerBandsOptions<D>,
): readonly BollingerBandPoint<D>[] {
  const multiplier = options.multiplier ?? 2;
  validateMultiplier(multiplier);
  const observed = values(data, options);
  const window: number[] = [];
  return Object.freeze(
    data.map((datum, sourceIndex) => {
      const value = observed[sourceIndex];
      if (value === null) {
        window.length = 0;
        return Object.freeze({
          datum,
          sourceIndex,
          mean: null,
          lower: null,
          upper: null,
        });
      }
      window.push(value);
      if (window.length > options.period) window.shift();
      if (window.length < options.period)
        return Object.freeze({
          datum,
          sourceIndex,
          mean: null,
          lower: null,
          upper: null,
        });
      const [mean, deviation] = summary(window);
      const lower = mean - multiplier * deviation;
      const upper = mean + multiplier * deviation;
      if (!Number.isFinite(lower) || !Number.isFinite(upper))
        throw new RangeError("Bollinger derived value must be finite.");
      return Object.freeze({ datum, sourceIndex, mean, lower, upper });
    }),
  );
}
