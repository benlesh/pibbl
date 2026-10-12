import type { UTCScale } from "./utc-scale-component.js";
import type { LinearDomain, ResolvedUtcScale, ScaleRange } from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";
const LIMIT = 8_640_000_000_000_000;
const DAY = 86_400_000;

function timestamp(value: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > LIMIT || (integer && !Number.isSafeInteger(value)))
    throw new RangeError("UTC timestamps must be finite milliseconds within Date range; domain endpoints must be safe integers.");
  return value;
}
function validateDomain(domain: LinearDomain): void {
  if (!Array.isArray(domain) || domain.length !== 2)
    throw new RangeError("UTC domain requires two endpoints.");
  timestamp(domain[0], true);
  timestamp(domain[1], true);
}
interface Cadence {
  first: number;
  last: number;
  at(index: number): number;
}
function monthAt(ordinal: number): number {
  const date = new Date(0);
  date.setUTCFullYear(Math.floor(ordinal / 12), ((ordinal % 12) + 12) % 12, 1);
  return date.getTime();
}
const fixedSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500,
  ...[1, 2, 5, 10, 15, 30].map(n => n * 1000),
  ...[1, 2, 5, 10, 15, 30].map(n => n * 60_000),
  ...[1, 2, 3, 6, 12].map(n => n * 3_600_000), DAY, 2 * DAY];
function selectCadence(lo: number, hi: number, count: number): Cadence {
  for (const step of [...fixedSteps, 7 * DAY]) {
    const offset = step === 7 * DAY ? -3 * DAY : 0;
    const first = Math.floor((lo - offset) / step) + 1;
    const last = Math.ceil((hi - offset) / step) - 1;
    if (Math.max(0, last - first + 1) <= count - 2)
      return { first, last, at: index => index * step + offset };
  }
  // Two Date objects for endpoint ordinals; candidate counting is arithmetic.
  const start = new Date(lo), stop = new Date(hi);
  const lowMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const highMonth = stop.getUTCFullYear() * 12 + stop.getUTCMonth();
  const highBoundary = stop.getUTCDate() === 1 && stop.getUTCHours() === 0 &&
    stop.getUTCMinutes() === 0 && stop.getUTCSeconds() === 0 && stop.getUTCMilliseconds() === 0;
  const steps = [1, 2, 3, 6,
    ...Array.from({ length: 7 }, (_, exponent) => [1, 2, 5].map(n => 12 * n * 10 ** exponent)).flat()];
  for (const step of steps) {
    const first = Math.floor(lowMonth / step) + 1;
    const last = Math.floor(highMonth / step) - (highBoundary && highMonth % step === 0 ? 1 : 0);
    if (Math.max(0, last - first + 1) <= count - 2)
      return { first, last, at: index => monthAt(index * step) };
  }
  // Every epoch-aligned cadence crosses year zero for a straddling domain.
  // Two-tick output is endpoints-only; keep already integral millisecond bounds
  // rather than overflow Date trying ever coarser calendar boundaries.
  if (count === 2) return { first: lo + 1, last: hi - 1, at: index => index };
  throw new RangeError("UTC could not select a bounded cadence.");
}
function tickCount(count: number): void {
  if (!Number.isInteger(count) || count < 2 || count > 100)
    throw new RangeError("UTC ticks count must be an integer from 2 to 100.");
}
function utcTicks(domain: LinearDomain, count: number): readonly number[] {
  tickCount(count);
  if (count === 2) return Object.freeze([...domain]);
  const lo = Math.min(...domain), hi = Math.max(...domain);
  const cadence = selectCadence(lo, hi, count);
  const ticks = [lo];
  for (let i = cadence.first; i <= cadence.last; i++) {
    const value = cadence.at(i);
    if (value > lo && value < hi) ticks.push(timestamp(value, true));
  }
  ticks.push(hi);
  return Object.freeze(domain[0] > domain[1] ? ticks.reverse() : ticks);
}
export function resolveUtcScale(domain: LinearDomain, range: ScaleRange, reverse: boolean, width: number, height: number): ResolvedUtcScale {
  validateDomain(domain);
  const linear = resolveLinearScale(domain, range, reverse, width, height);
  return Object.freeze({
    ...linear,
    type: "utc",
    map: (value: number) => linear.map(timestamp(value)),
    ticks: (count = 5) => utcTicks(linear.domain, count),
    formatTick: (value: number) => new Date(timestamp(value)).toISOString(),
  });
}

/**
 * Expands a numeric timestamp domain to enclosing UTC calendar boundaries.
 * @param domain - Safe integer epoch-millisecond endpoints, possibly equal or descending.
 * @param options - Optional bounded target tick count (default 5).
 * @returns A frozen outward-rounded domain preserving its direction. See {@link LinearDomain}.
 * @see {@link UTCScale}
 */
export function niceUTCDomain(domain: LinearDomain, options: { readonly count?: number } = {}): LinearDomain {
  validateDomain(domain);
  const count = options.count ?? 5;
  tickCount(count);
  if (domain[0] === domain[1]) {
    const lo = Math.max(-LIMIT, Math.min(LIMIT - 2, domain[0] - 1));
    return Object.freeze([lo, lo + 2]);
  }
  const lo = Math.min(...domain), hi = Math.max(...domain);
  const cadence = selectCadence(lo, hi, count);
  const start = timestamp(cadence.at(cadence.first - 1), true);
  const stop = timestamp(cadence.at(cadence.last + 1), true);
  return Object.freeze(domain[0] > domain[1] ? [stop, start] : [start, stop]);
}

/**
 * Computes a finite numeric extent in source order, skipping only null and undefined.
 * @param data - Source rows, which are never sorted or mutated.
 * @param value - Accessor called once per row with its index and original array.
 * @returns A frozen minimum/maximum pair, or undefined when every row is missing.
 * @see {@link niceUTCDomain}
 */
export function extent<D>(data: readonly D[], value: (datum: D, index: number, data: readonly D[]) => number | null | undefined): LinearDomain | undefined {
  if (!Array.isArray(data) || typeof value !== "function") throw new TypeError("extent requires an array and accessor.");
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = value(data[i], i, data);
    if (v === null || v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) throw new TypeError("extent values must be finite numbers or missing.");
    min = Math.min(min, v); max = Math.max(max, v);
  }
  return min === Infinity ? undefined : Object.freeze([min, max]);
}
