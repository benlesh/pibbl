# UTC scale contract (approved)

> **Historical status: Design proposal retained as work evidence; current code and public contracts define shipped behavior.**

> API correction approved 2026-10-05: **every scale family has a dedicated
> provider and hook**, with a fixed return type and no family-selector argument.
> Current families: `LinearScale` / `useLinearScale`, `BarScale` / `useBarScale`,
> `UTCScale` / `useUTCScale`. UTC nicening is `niceUTCDomain(domain, { count? })`.
> Generic `Scale`, `ScaleProps`, and `useScale` are removed, without aliases.
> Future log, symlog, power, square-root, point, ordinal, local-time, sequential,
> diverging, quantile, quantize, and threshold variations must follow this rule;
> listing them here does not claim implementation. Family modules must tree shake
> independently. This decision supersedes selector-based API examples below.

> **Historical status: Approved proposal record; it does not define current shipped behavior.**

Status: approved by the user on 2026-09-30. Implementation is authorized;
this contract is not yet shipped behavior.

## Current priority and presentation requirement — 2026-10-05

The [current visualization priorities](viz-charting-priorities.md) select this
as the first charting slice. Preserve the approved numeric/calendar contract
below. Its full-ISO default formatter is deterministic, but does not by itself
meet the new visual-quality bar: the first example needs compact calendar labels,
clear UTC context, units, deliberate gutters, and readable narrow layouts.
A reusable contextual formatter and label-density/collision policy are follow-up
presentation work, not silently approved changes to tick generation or
`formatTick`. Explicitly resolve endpoint crowding before claiming axis quality
is complete. No implementation or visual acceptance is claimed by this note.

## Approval summary

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
list, includes the original endpoints and as many aligned interior boundaries as
the selected cadence admits. Thus even a domain spanning the full Date range allocates at
most 100 tick values and Date objects.

Export two future-ready pure helpers. Generic numeric `extent` makes one
source-order pass, skips only `null`/`undefined`, and returns a frozen finite
extent or `undefined`; malformed values reject. `niceDomain` requires a
discriminant; this slice implements only `{ type: "utc" }`, which chooses the
bounded UTC cadence and expands to enclosing boundaries. It pads a singleton by
one millisecond on each side (or inward at Date limits). Helpers own neither
subscriptions nor caches; callers own invocation and invalidation.

The smallest runnable slice is UTC Scale plus Axis calendar labels, helpers,
focused boundary tests, and one editable UTC line example. Existing `linear`
and `band` behavior remains unchanged. Local-time/DST and positive-log behavior
remain future work, rather than being implied by this API.

## Public surface

```ts
export type NumericDomain = readonly [number, number];
export type UtcDomain = NumericDomain;

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
): NumericDomain | undefined;

export function niceDomain(
  domain: NumericDomain,
  options: { readonly type: "utc"; readonly count?: number },
): NumericDomain;
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

`formatTick(value)` returns the full UTC ISO timestamp using `toISOString()`;
it is deterministic and independent of previous `ticks()` calls. This preserves
non-aligned endpoint information without mutable tick-generation state. Display
precision is milliseconds: fractional input milliseconds use Date's truncation
toward zero, while the actual tick position retains the numeric value. Inputs
must be finite and within the Date range. Extended years use ISO's signed
six-digit form. Axis uses this default only when no formatter is supplied;
caller formatters receive the original numeric epoch and emitted index. The
editable example demonstrates a compact formatter for readable calendar labels.
No automatic label collision solver is introduced.

## Helpers and invalidation

`extent` invokes the accessor exactly once per source row in source order.
`null` and `undefined` are missing and skipped; any other non-number, `NaN`,
or infinity throws. It has no UTC Date-range or safe-integer policy: it returns
a generic frozen numeric extent, which may be a singleton `[t, t]` and may need
the target scale's own validation before use.

`niceDomain` requires `{ type: "utc" }` now, reserving `linear`, `time`, and
`log` discriminants for their approvals. UTC validates Date-range/safe-integer
endpoints. Its count defaults to 5 and accepts integers `2..100`. For unequal
endpoints it selects the cadence above and rounds outward to enclosing UTC
boundaries, preserving input direction. For `[t,t]` it returns `[t-1,t+1]`; at
the lower bound it returns `[min,min+2]`, and at the upper bound `[max-2,max]`.
These are the only implicit domain-padding rules.

Both helpers are pure snapshots: they resolve no `SignalValue`, create no
subscription themselves, copy no rows, and retain no cache. A caller may invoke
`extent` during a tracked component evaluation; signal reads in its accessor are
therefore owned by that caller context and participate in normal Pibbl dependency
tracking. Calling either helper outside evaluation has no hidden reactivity.
Replacing data/domain/range/reverse or any resolved UTC cadence input invalidates
ordinary mapping consumers; no automatic domain extension, mutation observation,
or history cache exists.

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
