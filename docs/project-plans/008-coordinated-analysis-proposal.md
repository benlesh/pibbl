# Plan 008 — Batch 3 coordinated analysis proposal

Date: 2026-10-09. Authoring accepted and independently audited on 2026-10-12;
Batch 3 runnable slices are in implementation. Public signatures remain as proposed.
Previous accepted slices are committed locally as `be31890a`.

Scope: linked panes, calendar range controls and normalized comparison returns.
Continue the existing three-capability feedback cadence. The user's API-first
review requirement persists. Proposed names below are not exported contracts.

## 1. Linked panes through existing composition

No Pane component, financial chart container, selection store or second scheduler.
One application-owned viewport signal and selected UTC timestamp drive one
TradingTimeScale; sibling y-scales remain independent. Both panes use identical
horizontal plot boundaries and the same selected timestamp. Root-logical pointer
input is inverted through the existing committed inspection mapping.

Authoring excerpt inside the mounted component; `records` are supplied canonical
OHLCV observations and `left/right` are shared local plot edges:

```tsx
const viewport = useSignal<readonly [number, number]>([
  -0.5,
  records.length - 0.5,
]);
const selectedTime = useSignal(records.at(-1)!.time);

return (
  <TradingTimeScale
    id="time"
    timestamps={records.map((row) => row.time)}
    logicalRange={viewport}
    range={[left, right]}
  >
    <LinearScale
      id="price"
      domain={priceDomain}
      range={[priceBottom, priceTop]}
    >
      <CandlestickSeries
        data={records}
        time="time"
        open="open"
        high="high"
        low="low"
        close="close"
        xScale="time"
        yScale="price"
      />
    </LinearScale>
    <LinearScale
      id="volume"
      domain={[0, maximumVolume]}
      range={[volumeBottom, volumeTop]}
    >
      <VolumeSeries
        data={records}
        time="time"
        volume="volume"
        xScale="time"
        yScale="volume"
      />
    </LinearScale>
    <ReferenceLine
      scale="time"
      direction="vertical"
      value={selectedTime}
      span={[priceTop, volumeBottom]}
    />
  </TradingTimeScale>
);
```

The complete example clips/filters marks to the selected window, attaches typed
inspection refs, and routes input from either pane to the shared timestamp. Pin,
preview and viewport remain distinct application state. Selection outside the
window retains its timestamp and gets a visible explanation; no guide paints at
a clamped false location. Data replacement reconciles timestamps explicitly.

Start with a composed desktop price/volume recipe and a focused two-pane lesson.
On narrow allocations retain one clear price pane plus a compact, aligned volume
pane and readable OHLCV summary. Pane resizing is deferred pending a concrete
allocation/focus design; it is not required to establish linked geometry.

## 2. Calendar range controls with bounded navigation

Use existing signals, focusable controls and TradingTimeScale.logicalRange. No
public preset selector, exchange calendar or trading navigation factory. Existing
panDomain/zoomDomain accept continuous scales; do not pass a TradingTimeScale to
them or widen that contract.

Proposed application code uses local named operations:

```tsx
// In application handlers, after calendar membership is resolved:
function selectUtcPeriod({
  startTime,
  endTime,
}: {
  startTime: number;
  endTime: number;
}) {
  const first = timestamps.findIndex(
    (time) => time >= startTime && time <= endTime,
  );
  const last = timestamps.findLastIndex(
    (time) => time >= startTime && time <= endTime,
  );
  if (first < 0) return; // The control is disabled and an empty-period message is shown.
  viewport.set([first - 0.5, last + 0.5]);
}

// Application-local calendarMonthsBefore uses platform Date UTC operations,
// clamps the day to the destination month's final day, and retains UTC time.
const oneMonth = () =>
  selectUtcPeriod({
    startTime: calendarMonthsBefore(asOfTime, 1),
    endTime: asOfTime,
  });
const threeMonths = () =>
  selectUtcPeriod({
    startTime: calendarMonthsBefore(asOfTime, 3),
    endTime: asOfTime,
  });
const yearToDate = () =>
  selectUtcPeriod({
    startTime: Date.UTC(new Date(asOfTime).getUTCFullYear(), 0, 1),
    endTime: asOfTime,
  });
const showAll = () => viewport.set([-0.5, timestamps.length - 0.5]);
```

Controls: 1M, 3M, YTD, All, Earlier, Later, Zoom in/out, Fit and Latest. These are
ordinary labels invoking named operations; they do not select public return types.
Earlier/Later shift the logical window; zoom scales its span about its midpoint.
Hard bounds are the supplied observation slots and the minimum span is two slots
or the whole dataset if smaller. Latest preserves the current span and anchors
its right edge at the last supplied observation. Fit shows all supplied records.
No streaming, calendar-based exchange sessions or hidden fetching is introduced.

Resolve UTC period membership before compression: 31 March minus one calendar
month lands on 28/29 February at the same UTC time, not 30 days earlier. YTD starts
at 00:00 UTC on 1 January. Include supplied observations whose timestamp is
within both endpoints. Select only records actually present; weekends, holidays
and missing observations do not receive invented timestamps. Dataset edges clip
the result. Empty periods have a disabled control and an explicit message.

`asOfTime` is caller-supplied (the showcase uses the latest supplied record), and
is displayed. Presets do not silently reset the selected timestamp or comparison
base. Keyboard activation is Enter/Space, controls retain focus on rerender, and
pointer/touch use the same handlers. Explicit controls provide an alternative to
drag gestures. Gestures and generic reusable calendar helpers can be proposed
later if repeated applications establish their value.

## 3. Two pure comparison transforms

Proposed new exports from `@pibbl/core/viz`:

```ts
interface ComparisonBaseOptions<D> {
  readonly time: LineAccessor<D>;
  readonly value: LineAccessor<D>;
  readonly baseTime: number;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}
interface PercentageReturnPoint<D> {
  readonly datum: D;
  readonly sourceIndex: number;
  readonly time: number | null;
  readonly returnPercent: number | null;
}
interface IndexedValuePoint<D> {
  readonly datum: D;
  readonly sourceIndex: number;
  readonly time: number | null;
  readonly indexValue: number | null;
}
function percentageReturns<D>(
  data: readonly D[],
  options: ComparisonBaseOptions<D>,
): readonly PercentageReturnPoint<D>[] | undefined;
function indexTo100<D>(
  data: readonly D[],
  options: ComparisonBaseOptions<D>,
): readonly IndexedValuePoint<D>[] | undefined;
```

Application code uses the same explicit base for every instrument:

```tsx
const baseTime = Date.UTC(2026, 0, 2, 16);
const northstar = percentageReturns(northstarPrices, {
  time: "time",
  value: "close",
  baseTime,
});
const benchmark = percentageReturns(benchmarkPrices, {
  time: "time",
  value: "close",
  baseTime,
});

// Undefined means an unavailable exact base; render an explicit asset status.
// Both available series can share one y-scale and one named x-scale.
<LineSeries
  data={northstar!}
  x="time"
  y="returnPercent"
  xScale="time"
  yScale="returns"
/>;

// Separate operation and named quantity; no normalize({ mode }) selector:
const indexed = indexTo100(northstarPrices, {
  time: "time",
  value: "close",
  baseTime,
});
<LineSeries
  data={indexed!}
  x="time"
  y="indexValue"
  xScale="time"
  yScale="index"
/>;
```

Percentage return is `(value - baseValue) / baseValue * 100`; indexed value is
`value / baseValue * 100`. Exact base data maps to 0% or 100. Helpers never round
observations; use existing formatNumber/Intl for labels. The returned field names
make units explicit. There is no return object with both operations or a selector
that changes the result shape.

Require a finite safe UTC-millisecond baseTime. It must match an eligible complete
supplied record exactly; no nearest-date or first-available fallback. Missing exact
base returns undefined, including empty data. Multiple eligible complete records
at the base reject as ambiguous. A zero or negative base rejects explicitly;
this financial comparison contract requires a positive reference price. Finite
later negative prices remain actual observations and produce their stated return.
Unrepresentable derived values reject rather than manufacturing gaps or infinity.

Preserve original source order and source indices; no sorting, mutation, fetching
or inferred calendar. `defined` excludes a row before accessors and yields a gap
in the output. Missing/nonfinite input time or value produces a gap with null
derived value; missing/nonfinite time is normalized to null. Return frozen arrays
and point objects while retaining caller-owned original datum references.

The transform does not infer missing dates. Known expected-but-missing observations
must be supplied as explicit null-value records so LineSeries splits its runs.
The showcase supplies one declared observation calendar with explicit gaps, and
shares that timestamp list across instruments. Crosshair readouts match exact
timestamps across instruments; absent values display em dashes. Changing the
viewport never silently rebases a comparison.

## Compelling examples and evidence

Upgrade Market Session to coordinated navigation without another container API.
Add **Relative Performance Desk**: three clearly simulated instruments, one
visible common base date, direct end labels, shared inspection, calendar controls,
and an explicit unavailable instrument missing the common base. A deliberate
null observation proves the gap policy. Keep both accepted light/dark palettes.
At phone widths prioritize one readable return plot and persistent base/readout
rather than squeezing several tiny charts into the allocation.

Focused lessons: financial-linked-panes (two y scales), financial-calendar-ranges
(Friday/Monday dates and month-end), financial-normalized-returns (two five-point
series and exact common base). Show percentage and indexed units without a public
mode switch. Examples teach their behavior, with no unlabeled toy marks.

After user authoring acceptance: focused failing public tests and hand-computed
return fixtures, then complete runnable slices. Test identical x geometry across
panes; exact-time inspection; month-end/leap-year/YTD membership; empty controls;
keyboard/touch; fixed common base; missing/duplicate/nonpositive base; explicit
gaps; and immutable source order. Verify real Studio editor and source/built/
packed consumers. Present each slice promptly and stop after these three for
feedback before broader hardening or Batch 4.
