import type { NumericDomain } from "./types.js";

/** Readable linear tick density. See {@link linearTicks}. */
export interface LinearTickOptions {
  /** Target number of intervals, from 2 to 100; defaults to 5. */
  readonly count?: number;
}
function parameters(domain: NumericDomain, options: LinearTickOptions) {
  const count = options.count ?? 5;
  if (!Number.isInteger(count) || count < 2 || count > 100)
    throw new RangeError("Linear tick count must be an integer from 2 to 100.");
  if (!Array.isArray(domain) || domain.length !== 2 || !domain.every(Number.isFinite))
    throw new RangeError("Linear tick domain requires two finite endpoints.");
  const lo = Math.min(...domain), hi = Math.max(...domain);
  const span = hi - lo;
  if (!Number.isFinite(span) || span === 0)
    throw new RangeError("Linear tick domain must have a finite nonzero span.");
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  let step = power * (error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1);
  if (!Number.isFinite(step) || step === 0 || !Number.isSafeInteger(Math.floor(lo / step)) || !Number.isSafeInteger(Math.ceil(hi / step)))
    throw new RangeError("Linear tick spacing exceeds numeric precision.");
  if (Math.floor(hi / step) - Math.ceil(lo / step) + 1 > 100) {
    const magnitude = 10 ** Math.floor(Math.log10(step));
    const factor = step / magnitude;
    step = magnitude * (factor < 1.5 ? 2 : factor < 3 ? 5 : 10);
  }
  return { lo, hi, step };
}
function clean(value: number) { return Number(value.toPrecision(15)) || 0; }
/**
 * Generates bounded ticks at readable 1, 2, or 5 × powers-of-ten intervals.
 * Endpoints are included only when aligned. Does not change scale geometry.
 * @param domain - Distinct finite endpoints, ascending or descending.
 * @param options - Target density; defaults to five intervals.
 * @returns Frozen ticks in domain order. See {@link niceLinearDomain}.
 */
export function linearTicks(domain: NumericDomain, options: LinearTickOptions = {}): readonly number[] {
  const { lo, hi, step } = parameters(domain, options);
  const start = Math.ceil(lo / step), end = Math.floor(hi / step);
  const values = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => clean((start + i) * step)).filter(v => v >= lo && v <= hi);
  return Object.freeze(domain[0] > domain[1] ? values.reverse() : values);
}
/**
 * Expands a linear domain to readable tick boundaries, preserving direction.
 * @param domain - Distinct finite numeric endpoints; never mutated.
 * @param options - Target density; defaults to five intervals.
 * @returns Frozen expanded endpoints. See {@link linearTicks}.
 */
export function niceLinearDomain(domain: NumericDomain, options: LinearTickOptions = {}): NumericDomain {
  const { lo, hi, step } = parameters(domain, options);
  const a = clean(Math.floor(lo / step) * step), b = clean(Math.ceil(hi / step) * step);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new RangeError("Nice linear domain exceeds finite numeric bounds.");
  return Object.freeze(domain[0] > domain[1] ? [b, a] : [a, b]);
}
/** Number formatting with explicit locale and literal unit affixes. See {@link formatNumber}. */
export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  /** Locale for formatting; defaults to en-US. */
  readonly locale?: string;
  /** Literal prefix; defaults to empty. */
  readonly prefix?: string;
  /** Literal suffix, including any desired space; defaults to empty. */
  readonly suffix?: string;
}
/**
 * Formats a finite number with Intl precision, currency, percent, or unit options.
 * Rounded negative zero is displayed as positive zero.
 * @param value - Finite numeric value.
 * @param options - Intl options plus locale and literal affixes; default maximum fraction digits is 3.
 * @returns Formatted text. Invalid Intl options retain native errors. See {@link NumberFormatOptions}.
 */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  if (!Number.isFinite(value)) throw new RangeError("formatNumber value must be finite.");
  const { locale = "en-US", prefix = "", suffix = "", ...intl } = options;
  const formatter = new Intl.NumberFormat(locale, intl);
  const parts = formatter.formatToParts(value);
  const zero = parts.filter(p => p.type === "integer" || p.type === "fraction").every(p => /^0+$/.test(p.value));
  return prefix + formatter.format(zero ? 0 : value) + suffix;
}
