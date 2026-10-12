/** Application-local navigation for supplied observation slots. */
export type LogicalRange = readonly [number, number];

export function utcPeriodRange(
  timestamps: readonly number[],
  { startTime, endTime }: { startTime: number; endTime: number },
): LogicalRange | undefined {
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime > endTime
  )
    throw new Error("utcPeriodRange requires ordered finite UTC times");
  const first = timestamps.findIndex(
    (time) => time >= startTime && time <= endTime,
  );
  if (first < 0) return undefined;
  let last = first;
  for (let index = first + 1; index < timestamps.length; index += 1)
    if (timestamps[index]! >= startTime && timestamps[index]! <= endTime)
      last = index;
  return Object.freeze([first - 0.5, last + 0.5]) as LogicalRange;
}

export function calendarMonthsBefore(asOfTime: number, months: number): number {
  if (
    !Number.isSafeInteger(asOfTime) ||
    !Number.isInteger(months) ||
    months < 0
  )
    throw new Error(
      "calendarMonthsBefore requires a safe UTC time and whole non-negative months",
    );
  const source = new Date(asOfTime);
  const targetMonth = source.getUTCMonth() - months;
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  return Date.UTC(
    targetYear,
    normalizedMonth,
    Math.min(source.getUTCDate(), lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  );
}

function normalized(
  range: LogicalRange,
  bounds: LogicalRange,
  minimumSpan: number,
): LogicalRange {
  const low = Math.min(...bounds),
    high = Math.max(...bounds);
  const maxSpan = high - low;
  const span = Math.min(
    maxSpan,
    Math.max(minimumSpan, Math.abs(range[1] - range[0])),
  );
  let start = Math.min(...range);
  start = Math.max(low, Math.min(high - span, start));
  return Object.freeze([start, start + span]) as LogicalRange;
}

export function shiftLogicalRange(
  range: LogicalRange,
  {
    delta,
    bounds,
    minimumSpan,
  }: { delta: number; bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  if (!Number.isFinite(delta))
    throw new Error("shiftLogicalRange delta must be finite");
  return normalized([range[0] + delta, range[1] + delta], bounds, minimumSpan);
}

export function zoomLogicalRange(
  range: LogicalRange,
  {
    factor,
    bounds,
    minimumSpan,
  }: { factor: number; bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error("zoomLogicalRange factor must be positive");
  const midpoint = (range[0] + range[1]) / 2;
  const half =
    Math.max(minimumSpan, Math.abs(range[1] - range[0]) * factor) / 2;
  return normalized([midpoint - half, midpoint + half], bounds, minimumSpan);
}

export function latestLogicalRange(
  range: LogicalRange,
  { bounds, minimumSpan }: { bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  const span = Math.max(minimumSpan, Math.abs(range[1] - range[0]));
  return normalized(
    [Math.max(...bounds) - span, Math.max(...bounds)],
    bounds,
    minimumSpan,
  );
}

/** Calendar-aligned ticks drawn only from supplied visible sessions. */
export function calendarAxisTicks(
  timestamps: readonly number[],
  {
    logicalRange,
    width,
  }: { logicalRange: readonly [number, number]; width: number },
): { values: readonly number[]; format: (time: number) => string } {
  const visible = timestamps.slice(
    Math.max(0, Math.ceil(logicalRange[0])),
    Math.floor(logicalRange[1]) + 1,
  );
  const elapsedDays = visible.length
    ? (visible.at(-1)! - visible[0]!) / 86_400_000
    : 0;
  const monthly = elapsedDays > 60,
    weekly = elapsedDays > 10 && !monthly;
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    monthly
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "2-digit", month: "short", timeZone: "UTC" },
  );
  const candidates: number[] = [];
  let previousBucket: number | undefined;
  for (const time of visible) {
    const date = new Date(time);
    const bucket = monthly
      ? date.getUTCFullYear() * 12 + date.getUTCMonth()
      : weekly
        ? Math.floor(
            (time - ((date.getUTCDay() + 6) % 7) * 86_400_000) /
              (7 * 86_400_000),
          )
        : Math.floor(time / 86_400_000);
    if (bucket !== previousBucket) candidates.push(time);
    previousBucket = bucket;
  }
  const budget = Math.max(2, Math.floor(width / 80));
  const values =
    candidates.length <= budget
      ? candidates
      : Array.from(
          { length: budget },
          (_, i) =>
            candidates[
              Math.round((i * (candidates.length - 1)) / (budget - 1))
            ]!,
        );
  return { values, format: (time) => formatter.format(time) };
}
