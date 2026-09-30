import type {
  NumericDomain,
  ResolvedUtcScale,
  ScaleRange,
  UtcDomain,
} from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";

export const dateMinimum = -8_640_000_000_000_000;
export const dateMaximum = 8_640_000_000_000_000;

function utcValue(value: number, field: string, integer = false): number {
  if (
    !Number.isFinite(value) ||
    value < dateMinimum ||
    value > dateMaximum ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new RangeError(
      `UTC scale ${field} must be a ${integer ? "safe integer " : ""}epoch millisecond within the Date range.`,
    );
  return value;
}
function domain(input: UtcDomain): UtcDomain {
  if (!Array.isArray(input) || input.length !== 2)
    throw new RangeError("UTC scale domain requires two endpoints.");
  const result = Object.freeze([
    utcValue(input[0], "domain", true),
    utcValue(input[1], "domain", true),
  ]) as UtcDomain;
  if (result[0] === result[1])
    throw new RangeError("UTC scale domain endpoints must differ.");
  return result;
}
const fixed = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 15_000,
  30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000,
  7_200_000, 10_800_000, 21_600_000, 43_200_000, 86_400_000, 172_800_000,
  604_800_000,
] as const;
function monthOrdinal(value: number): number {
  const date = new Date(value);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}
function monthStart(ordinal: number): number {
  const year = Math.floor(ordinal / 12);
  const month = ordinal - year * 12;
  const date = new Date(0);
  date.setUTCFullYear(year, month, 1);
  date.setUTCHours(0, 0, 0, 0);
  const value = date.getTime();
  return utcValue(value, "calendar boundary", true);
}
function monthInteriorCount(lo: number, hi: number, step: number): number {
  const first = Math.floor(monthOrdinal(lo) / step) * step;
  let value = monthStart(first);
  const start = value <= lo ? first + step : first;
  const last = Math.floor(monthOrdinal(hi) / step) * step;
  value = monthStart(last);
  const end = value >= hi ? last - step : last;
  return end < start ? 0 : Math.floor((end - start) / step) + 1;
}
function calendarTicks(input: UtcDomain, count: number): readonly number[] {
  const ascending =
    input[0] < input[1] ? input : ([input[1], input[0]] as const);
  const [lo, hi] = ascending;
  if (count === 2)
    return Object.freeze(input[0] < input[1] ? [lo, hi] : [hi, lo]);
  const capacity = count - 2;
  let step: number | undefined;
  for (const candidate of fixed) {
    const first = Math.ceil(lo / candidate);
    const last = Math.floor(hi / candidate);
    const interior = Math.max(
      0,
      last -
        first +
        1 -
        (lo % candidate === 0 ? 1 : 0) -
        (hi % candidate === 0 ? 1 : 0),
    );
    if (interior > 0 && interior <= capacity) {
      step = candidate;
      break;
    }
  }
  const values = [lo];
  if (step !== undefined) {
    for (
      let value = Math.ceil(lo / step) * step;
      value < hi && values.length < count - 1;
      value += step
    )
      if (value > lo) values.push(value);
  } else {
    const monthSteps = [
      1, 2, 3, 6, 12, 24, 60, 120, 240, 600, 1_200, 2_400, 6_000, 12_000,
      24_000, 60_000, 120_000, 240_000, 600_000,
    ];
    const months = monthSteps.find((candidate) => {
      const interior = monthInteriorCount(lo, hi, candidate);
      return interior > 0 && interior <= capacity;
    });
    if (months !== undefined) {
      let ordinal = Math.floor(monthOrdinal(lo) / months) * months;
      if (monthStart(ordinal) <= lo) ordinal += months;
      for (
        let value = monthStart(ordinal);
        value < hi && values.length < count - 1;
      ) {
        values.push(value);
        ordinal += months;
        value = monthStart(ordinal);
      }
    }
  }
  values.push(hi);
  return Object.freeze(input[0] < input[1] ? values : values.reverse());
}
export function resolveUtcScale(
  input: UtcDomain,
  range: ScaleRange,
  reverse: boolean,
  width: number,
  height: number,
): ResolvedUtcScale {
  const resolved = domain(input);
  const linear = resolveLinearScale(resolved, range, reverse, width, height);
  return Object.freeze({
    ...linear,
    type: "utc" as const,
    map(value: number) {
      return linear.map(utcValue(value, "map input"));
    },
    ticks(count = 5) {
      if (!Number.isInteger(count) || count < 2 || count > 100)
        throw new RangeError(
          "UTC scale ticks count must be an integer from 2 to 100.",
        );
      return calendarTicks(resolved, count);
    },
    formatTick(value: number) {
      return new Date(utcValue(value, "tick")).toISOString();
    },
  });
}
export function extent<D>(
  data: readonly D[],
  value: (
    datum: D,
    index: number,
    data: readonly D[],
  ) => number | null | undefined,
): NumericDomain | undefined {
  let low = Infinity,
    high = -Infinity;
  for (let index = 0; index < data.length; index++) {
    const next = value(data[index]!, index, data);
    if (next == null) continue;
    if (typeof next !== "number" || !Number.isFinite(next))
      throw new RangeError("extent values must be finite numbers.");
    low = Math.min(low, next);
    high = Math.max(high, next);
  }
  return low === Infinity ? undefined : Object.freeze([low, high]);
}
export function niceDomain(
  domainInput: NumericDomain,
  options: { readonly type: "utc"; readonly count?: number },
): NumericDomain {
  if (options.type !== "utc")
    throw new TypeError("niceDomain supports type=utc.");
  const count = options.count ?? 5;
  if (!Number.isInteger(count) || count < 2 || count > 100)
    throw new RangeError("niceDomain count must be an integer from 2 to 100.");
  const [a, b] = domainInput;
  utcValue(a, "domain", true);
  utcValue(b, "domain", true);
  if (a === b) {
    if (a === dateMinimum) return Object.freeze([a, a + 2]);
    if (a === dateMaximum) return Object.freeze([a - 2, a]);
    return Object.freeze([a - 1, a + 1]);
  }
  // When count leaves no bounded calendar candidate, no implicit padding occurs.
  const ticks = calendarTicks([a, b], count);
  return Object.freeze([ticks[0]!, ticks[ticks.length - 1]!]);
}
