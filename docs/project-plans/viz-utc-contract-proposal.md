# UTC scale contract proposal (unapproved)

## Approval summary (294 words)

Add one continuous scale kind, `type="utc"`, before local-time or logarithmic
scales. It accepts a finite epoch-millisecond domain and retains numeric
coordinates: lines, points, hover queries, and `map`/`invert` continue to use
numbers. This makes a useful time chart possible without changing every series
accessor to accept `Date`. `utc` differs from linear only in generated tick
selection and default formatting: ticks align to UTC calendar boundaries and
default labels are deterministic ISO-like UTC text. Browser-local `time`, IANA
zones, `Date` coordinate authoring, and log/symlog are deferred to their own
approval packets.

UTC domains use safe integer milliseconds inside the ECMAScript Date range
`[-8_640_000_000_000_000, 8_640_000_000_000_000]`; endpoints may descend but
may not be equal. Mapping extrapolates and invert does not clamp, preserving
linear behavior. A generated Axis count remains bounded at 100. Count zero
emits no ticks; count one emits the first domain endpoint. For larger counts,
the resolver chooses a UTC cadence without constructing an unbounded candidate
list, adds aligned interior boundaries, and uses the domain endpoints when no
boundary fits. Thus even a domain spanning the full Date range allocates at
most 100 tick values and Date objects.

Export two pure helpers. `extent` makes one source-order pass, skips only
`null`/`undefined`, and returns a frozen epoch extent or `undefined`; malformed
values reject. `niceDomain` chooses the same bounded UTC cadence and expands
to enclosing boundaries. It pads a singleton by one millisecond on each side
(or inward at Date limits), producing a valid scale domain. Neither helper
observes signals or caches data; callers own invocation and invalidation.

The smallest runnable slice is UTC Scale plus Axis calendar labels, helpers,
focused boundary tests, and one editable UTC line example. Existing `linear`
and `band` behavior remains unchanged. Local-time/DST and positive-log behavior
remain future work, rather than being implied by this API.

## Public surface

```ts
export type UtcDomain = readonly [number, number];

export interface UtcScaleProps extends Omit<
  LinearScaleProps,
  "type" | "domain"
> {
  readonly type: "utc";
  readonly domain: SignalValue<UtcDomain>;
}

export interface ResolvedUtcScale {
  readonly type: "utc";
  readonly domain: UtcDomain;
  readonly range: readonly [number, number];
  readonly frame: Readonly<LayoutBox>;
  map(value: number): number;
  invert(pixel: number): number;
  ticks(count?: number): readonly number[];
  formatTick(value: number): string;
}

export function extent<D>(
  data: readonly D[],
  value: (
    datum: D,
    index: number,
    data: readonly D[],
  ) => number | null | undefined,
): UtcDomain | undefined;

export function niceDomain(
  domain: UtcDomain,
  options?: { readonly count?: number },
): UtcDomain;
```

`UtcScaleProps` has the same `id`, `range`, `reverse`, `style`, and child
semantics as `LinearScaleProps`. Domains are safe integer epoch milliseconds,
not `Date`; `map` accepts any finite epoch value within the inclusive Date range,
including a fractional result returned by `invert`. Explicit `Axis.tickValues`
for UTC are epoch numbers and retain the current strict closed-domain,
caller-order, no-coercion rules.

`useScale(id)` remains the existing linear-only overload. Add
`useScale(id, "utc")` for `ResolvedUtcScale` and
`useScale(id, "continuous")` for `ResolvedLinearScale | ResolvedUtcScale`.
`LineSeries`, `PointSeries`, `PlotSeries`, `ScaleAdjust`, numeric Bar values,
and HoverData/query snapshots must use the continuous lookup. Existing callers
that explicitly require linear retain their current rejection of UTC scales.
Axis accepts either continuous kind.

## Validation, mapping, and ticks

Validate before allocating Date objects or tick arrays:

- Domain endpoints are safe integer milliseconds in Date range and differ.
  Descending domains preserve direction.
- Range/reverse, map, and invert retain current linear finite-value and
  collapsed-range behavior. There is no clamp option in this slice.
- `ResolvedUtcScale.ticks(count)` accepts integers `2..100`, matching existing
  `ResolvedLinearScale.ticks`. Axis owns its approved `0..100` handling and
  calls the resolver only for counts at least two.

For Axis count `>= 2`, work in ascending domain order then reverse the result
for a descending domain. Always include both original endpoints. Choose the
finest cadence whose computed interior-boundary count is at most `count - 2`.
If no cadence has an interior boundary, emit just the two endpoints. Count is a
bounded target, never a promise to fabricate calendar times.

Cadences are fixed UTC milliseconds `1, 2, 5, 10, 20, 50, 100, 200, 500 ms`;
`1, 2, 5, 10, 15, 30 s`; `1, 2, 5, 10, 15, 30 min`; `1, 2, 3, 6, 12 h`;
`1, 2 d`; and Monday-aligned `1 week`. Calendar cadences are first-of-month
`1, 2, 3, 6 months`, then first-of-year `1, 2, 5 × 10^n years` for the smallest
nonnegative `n` that fits the Date range and count. Fixed and weekly candidate
counts use floor/ceil arithmetic before construction. Month/year counts use
UTC month ordinals before construction. Only after selection may implementation
construct its at-most-98 interior timestamps; arithmetic or Date overflow
rejects rather than wrapping.

`formatTick` is deterministic UTC text: `YYYY` for year cadence, `YYYY-MM` for
month, `MM-DD` for day/week, `HH:mm` for minute/hour, `HH:mm:ss` for seconds,
and `HH:mm:ss.SSS` for milliseconds. Append `Z` to time-of-day forms. Axis uses
this default only when no `tickFormat` is supplied; supplied formatters receive
the numeric epoch and emitted index.

## Helpers and invalidation

`extent` invokes the accessor exactly once per source row in source order.
`null` and `undefined` are missing and skipped; any other non-number, unsafe
integer, out-of-Date-range value, `NaN`, or infinity throws. Its frozen result
may be a singleton `[t, t]`; that is not directly valid for Scale.

`niceDomain` validates Date-range/safe-integer endpoints. Its count defaults to
5 and accepts integers `2..100`. For unequal endpoints it selects the cadence above and rounds
outward to enclosing UTC boundaries, preserving input direction. For `[t,t]`
it returns `[t-1,t+1]`; at the lower bound it returns `[min,min+2]`, and at the
upper bound `[max-2,max]`. These are the only implicit domain-padding rules.

Both helpers are pure snapshots: they resolve no `SignalValue`, subscribe to no
signal, copy no rows, and retain no cache. A caller may invoke them during a
tracked component evaluation; signal reads performed by that caller-owned
accessor then follow normal CRC dependency tracking. Calling them outside an
evaluation has no hidden reactivity. Replacing data/domain/range/reverse or any
resolved UTC cadence input invalidates ordinary mapping consumers; no automatic
domain extension, mutation observation, or history cache exists.

## Evidence and deferred decisions

Focused public tests must cover sub-second domains, no-interior fallback,
count 0/1 through Axis, descending domains, Date extrema, singleton nice
padding, overflow rejection, and month/year boundaries. The editable example
uses UTC epoch rows and shows default labels plus a formatter override.
Structural evidence records at most 100 tick values/Date constructions and no
Date/Intl allocation on linear paths.

Deferred: browser-local/DST calendar policy, arbitrary time zones, Date-valued
coordinates, logarithmic/signed-log domains, clamping, automatic extension, and
nice behavior for linear or log scales. Those require separate contracts.
