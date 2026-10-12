import type { LineAccessor } from "./types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";

/** Inputs for a fixed-base financial comparison. See {@link percentageReturns}. */
export interface ComparisonBaseOptions<D> {
  /** UTC-millisecond property or callback that identifies the common base observation. */
  readonly time: LineAccessor<D>;
  /** Numeric property or callback that supplies each instrument's observed value. */
  readonly value: LineAccessor<D>;
  /** Safe UTC-millisecond timestamp that must match exactly one eligible complete observation. */
  readonly baseTime: number;
  /**
   * Excludes a row before either accessor runs and produces a derived gap.
   * @param datum - Original source observation.
   * @param index - Original source index.
   * @param data - Complete original source array.
   * @returns Whether this observation is eligible for the base and derived points.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}

/** One source-ordered cumulative simple-return observation. See {@link percentageReturns}. */
export interface PercentageReturnPoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Evaluated finite timestamp, or null for a missing, invalid, or excluded row. */
  readonly time: number | null;
  /** Percentage change from the common base, or null for a gap. */
  readonly returnPercent: number | null;
}

/** One source-ordered base-100 indexed observation. See {@link indexTo100}. */
export interface IndexedValuePoint<D> {
  /** Caller-owned original observation. */
  readonly datum: D;
  /** Original index, including rows that become gaps. */
  readonly sourceIndex: number;
  /** Evaluated finite timestamp, or null for a missing, invalid, or excluded row. */
  readonly time: number | null;
  /** Value indexed to 100 at the common base, or null for a gap. */
  readonly indexValue: number | null;
}

const DATE_LIMIT = 8_640_000_000_000_000;

function validBaseTime(value: number): void {
  if (!Number.isSafeInteger(value) || Math.abs(value) > DATE_LIMIT)
    throw new RangeError(
      "comparison baseTime must be a safe integer UTC millisecond within Date range.",
    );
}

function percentageOf(value: number, base: number): number {
  // Multiplying first preserves tiny finite indexed values; dividing first preserves
  // large finite ratios whose multiplication would otherwise overflow unnecessarily.
  return Math.abs(value) <= Number.MAX_VALUE / 100
    ? (value * 100) / base
    : (value / base) * 100;
}

function returnPercent(value: number, base: number): number {
  if (value === base) return 0;
  const difference = value - base;
  return Number.isFinite(difference)
    ? (difference / base) * 100
    : percentageOf(value, base) - 100;
}

interface EvaluatedComparisonRow {
  readonly eligible: boolean;
  readonly time: number | null;
  readonly value: number | null;
}

function comparisonBase(
  rows: readonly EvaluatedComparisonRow[],
  baseTime: number,
): number | undefined {
  let matches = 0;
  let baseValue: number | undefined;
  for (const row of rows) {
    if (!row.eligible || row.time !== baseTime || row.value === null) continue;
    matches++;
    baseValue = row.value;
  }
  if (matches === 0) return undefined;
  if (matches > 1)
    throw new RangeError(
      "comparison baseTime matches multiple eligible complete observations and is ambiguous.",
    );
  if (baseValue! <= 0)
    throw new RangeError("comparison base observation must be positive.");
  return baseValue;
}

function comparisonPoints<D, P>(
  data: readonly D[],
  options: ComparisonBaseOptions<D>,
  derived: (value: number, base: number) => number,
  point: (datum: D, sourceIndex: number, time: number | null, value: number | null) => P,
): readonly P[] | undefined {
  const rows = pointData(data, "comparison");
  validBaseTime(options.baseTime);
  const time = pointAccessor(options.time);
  const value = pointAccessor(options.value);
  const evaluated = rows.map((datum, index): EvaluatedComparisonRow => {
    const eligible = options.defined?.(datum, index, rows) ?? true;
    if (!eligible) return Object.freeze({ eligible, time: null, value: null });
    const timestamp = time(datum, index, rows);
    if (!finiteCoordinate(timestamp))
      return Object.freeze({ eligible, time: null, value: null });
    const observed = value(datum, index, rows);
    return Object.freeze({
      eligible,
      time: timestamp,
      value: finiteCoordinate(observed) ? observed : null,
    });
  });
  const base = comparisonBase(evaluated, options.baseTime);
  if (base === undefined) return undefined;
  return Object.freeze(rows.map((datum, sourceIndex) => {
    const row = evaluated[sourceIndex]!;
    if (!row.eligible || row.time === null)
      return Object.freeze(point(datum, sourceIndex, null, null));
    if (row.value === null)
      return Object.freeze(point(datum, sourceIndex, row.time, null));
    const result = derived(row.value, base);
    if (!Number.isFinite(result))
      throw new RangeError(
        `comparison derived value at source index ${sourceIndex} must be finite.`,
      );
    return Object.freeze(point(datum, sourceIndex, row.time, result));
  }));
}

/**
 * Derives source-ordered cumulative simple percentage returns from one exact positive base.
 *
 * Each defined finite observation becomes `(value / baseValue - 1) * 100`, expressed in
 * percentage points. This is a fixed-base return series, not a period-over-period return.
 * Missing/nonfinite values become explicit gaps; a missing exact base returns undefined.
 * @param data - Caller-owned source observations in presentation order.
 * @param options - Time/value accessors, exact common base, and optional eligibility predicate.
 * @returns Frozen points, or undefined when no eligible complete exact base exists.
 * @see {@link ComparisonBaseOptions}
 */
export function percentageReturns<D>(
  data: readonly D[],
  options: ComparisonBaseOptions<D>,
): readonly PercentageReturnPoint<D>[] | undefined {
  return comparisonPoints(
    data,
    options,
    returnPercent,
    (datum, sourceIndex, time, returnPercent) => ({
      datum,
      sourceIndex,
      time,
      returnPercent,
    }),
  );
}

/**
 * Derives source-ordered values indexed to 100 at one exact positive base observation.
 *
 * Missing/nonfinite values become explicit gaps; a missing exact base returns undefined.
 * @param data - Caller-owned source observations in presentation order.
 * @param options - Time/value accessors, exact common base, and optional eligibility predicate.
 * @returns Frozen points, or undefined when no eligible complete exact base exists.
 * @see {@link ComparisonBaseOptions}
 */
export function indexTo100<D>(
  data: readonly D[],
  options: ComparisonBaseOptions<D>,
): readonly IndexedValuePoint<D>[] | undefined {
  return comparisonPoints(
    data,
    options,
    (value, base) => value === base ? 100 : percentageOf(value, base),
    (datum, sourceIndex, time, indexValue) => ({
      datum,
      sourceIndex,
      time,
      indexValue,
    }),
  );
}
