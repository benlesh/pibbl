---
id: api-function-utc-domains
title: UTC domains
summary: Compute numeric extents and calendar-aligned UTC domains for time charts.
kind: api
slug: utc-domains
apiCategory: function
symbols:
  [
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
extent<D>(data: readonly D[], value: (datum: D, index: number, data: readonly D[]) => number | null | undefined): NumericDomain | undefined;
niceUTCDomain(domain: NumericDomain, options?: { count?: number }): NumericDomain;
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
