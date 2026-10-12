/** Locale used for compact UTC tick text. See {@link utcTickLabels}. */
export interface UTCTickLabelOptions {
  /** BCP 47 locale, default en-US. Calendar is always Gregorian; time zone is UTC. */
  readonly locale?: string;
}
/**
 * Creates compact labels with calendar context retained on every tick.
 * @param values - At most 100 safe integer epoch milliseconds within Date range, in any order.
 * @param options - Explicit locale; default en-US.
 * @returns Frozen labels in input order. No geometry or scale state changes. See {@link UTCTickLabelOptions}.
 */
export function utcTickLabels(values: readonly number[], options: UTCTickLabelOptions = {}): readonly string[] {
  if (!Array.isArray(values) || values.length > 100 || values.some(v => !Number.isSafeInteger(v) || Math.abs(v) > 8_640_000_000_000_000))
    throw new RangeError("utcTickLabels requires at most 100 integer timestamps within Date range.");
  const dates = values.map(value => new Date(value));
  const midnight = (date: Date) => date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  const months = dates.every(date => midnight(date) && date.getUTCDate() === 1);
  const years = months && dates.every(date => date.getUTCMonth() === 0);
  const days = dates.every(midnight);
  const milliseconds = dates.some(date => date.getUTCMilliseconds() !== 0);
  const seconds = milliseconds || dates.some(date => date.getUTCSeconds() !== 0);
  const formatter = new Intl.DateTimeFormat(options.locale ?? "en-US", {
    timeZone: "UTC", calendar: "gregory", year: "numeric",
    ...(years ? {} : { month: "short" as const }),
    ...(months ? {} : { day: "numeric" as const }),
    ...(days ? {} : { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const }),
    ...(seconds ? { second: "2-digit" as const } : {}),
    ...(milliseconds ? { fractionalSecondDigits: 3 as const } : {}),
    ...(dates.some(date => date.getUTCFullYear() <= 0) ? { era: "short" as const } : {}),
  });
  return Object.freeze(dates.map(date => formatter.format(date)));
}
