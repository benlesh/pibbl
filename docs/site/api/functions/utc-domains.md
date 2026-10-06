---
id: api-function-utc-domains
title: UTC domains
summary: Compute numeric extents and calendar-aligned UTC domains for time charts.
kind: api
slug: utc-domains
apiCategory: function
symbols:
  [
    utcTickLabels,
    UTCTickLabelOptions,
    extent,
    niceUTCDomain,
    NumericDomain,
    UtcDomain,
    UTCScaleProps,
    ResolvedUtcScale,
    ResolvedContinuousScale,
  ]
keywords: [visualization, time, utc, extent, domain, calendar]
---

# UTC domains

Import from `@pibbl/core/viz`. UTC positions are numeric epoch milliseconds, not
`Date` objects. No runtime data fetching is required.

```ts
declare function extent<D>(data: readonly D[], value: (datum: D, index: number, data: readonly D[]) => number | null | undefined): NumericDomain | undefined;
declare function niceUTCDomain(domain: NumericDomain, options?: { count?: number }): NumericDomain;
```

`extent` calls the accessor once per row, skips null/undefined, rejects other
nonfinite or nonnumeric results, and returns a frozen minimum/maximum pair.
Empty/all-missing data returns undefined. Singleton data returns equal endpoints.
It never sorts, mutates, subscribes, or caches.

`niceUTCDomain` expands epoch endpoints to enclosing UTC boundaries. Count defaults
to 5 and must be an integer 2–100. It preserves descending direction. A singleton
gets one millisecond padding on each side, or inward padding at Date limits.
Outward rounding beyond Date range throws; it never wraps a date. With count 2,
if no cadence can avoid an interior boundary (a domain straddling year zero),
niceness keeps the original integral-millisecond bounds.

## UTC Scale

`UTCScaleProps` shares `id`, `domain`, `range`, `reverse`, `style`, and `children`
with the linear scale and is provided by `UTCScale`. `NumericDomain` and `UtcDomain` are
readonly numeric pairs. UTC domain endpoints must be distinct safe integer
milliseconds inside ±8,640,000,000,000,000. Domain/range/reverse accept signals.

```tsx
<UTCScale id="date" domain={domain} range="width">
  <Axis
    scale="date"
    position="bottom"
    tickCount={5}
    tickFormat={(value) => new Date(Number(value)).toISOString().slice(0, 10)}
  />
</UTCScale>
```

`useUTCScale(id)` returns `Signal<ResolvedUtcScale>`.
Snapshots are frozen; signal identity survives data/allocation changes.

UTC `map`/`invert` use linear arithmetic with no clamp. Mapping accepts finite
fractional milliseconds inside Date range. A collapsed range cannot invert.
`ticks(count = 5)` accepts 2–100 and returns original endpoints plus aligned UTC
interior boundaries, using a cadence that fits the count. Axis handles counts
0 and 1. Month/year lengths are calendar-aware; weeks start Monday. The result
may have fewer ticks than requested and preserves descending order.

`formatTick(value)` returns deterministic full ISO UTC text, independent of prior
tick calls. Fractional milliseconds truncate toward zero for display only.
Use an Axis formatter for compact presentation; no automatic collision solver
or locale/time-zone selection is implied. Explicit Axis ticks remain numeric,
bounded, unique, in-domain, and in caller order.

Lines, points, custom plots, bar value scales, ScaleAdjust and numeric hover
queries accept either continuous kind. Missing-data gaps keep their existing
semantics. UTC is not browser-local calendar time; DST, IANA time zones, log
scales and automatic domain mutation remain separate work.

## Compact UTC labels

`utcTickLabels(values: readonly number[], options?: UTCTickLabelOptions): readonly string[]`
returns frozen labels in the same order, without modifying timestamps. `locale`
defaults to `"en-US"`; the calendar is Gregorian and the time zone is always UTC.
Use the returned array in `Axis.tickFormat={(_, index) => labels[index]}` with the
same `tickValues` array. Existing `useUTCScale(id).get().formatTick(value)` keeps
its full-ISO contract.

The complete set determines precision: January 1 midnight ticks use years;
first-of-month midnight ticks use month/year; other midnight ticks use
month/day/year; sub-day ticks also include 24-hour hour/minute, adding seconds
and three millisecond digits when present. Every label keeps its year and any
necessary date, so collision skipping never removes essential calendar context.
An era is included for all labels when any input is in year zero or earlier.
UTC should still be identified in the composition's title or units.

Empty input returns a frozen empty array. At most 100 safe-integer epoch
millisecond values within the JavaScript Date range are accepted; invalid input
throws `RangeError`. Duplicates and descending/arbitrary order are preserved.
Invalid locale options retain native Intl errors; punctuation follows host Intl
data. The helper accepts plain values, not signals. Read signal `.get()` in a
component/computed value to recompute; it acquires no resources or subscriptions.

```tsx
function DateAxis() {
const ticks = useUTCScale("date").get().ticks(5);
const labels = utcTickLabels(ticks);
return (
  <Axis
    scale="date"
    position="bottom"
    tickValues={ticks}
    tickFormat={(_, index) => labels[index]}
    labelOverlap="skip"
  />
);
}
```

The [minimal UTC demo](#/examples/composition/viz-utc-basics) is runnable and
editable with these labels.
