# Plan 008 — Batch 2 financial inspection proposal

Date: 2026-10-09. Status: approved by the user on 2026-10-09; runnable implementation tracked in Plan 008.
Scope: snapping OHLCV inspection, price guides/formatting, visible-window autoscaling.
User requirement: number formatting must use platform tools; existing formatNumber uses Intl.NumberFormat.
Existing Batch 1 working-tree changes are preserved. No commit or publication is requested.

## 1. Snapping crosshair and OHLCV

Use existing public inspection, signals, ReferenceLine and ScaleAdjust. No new
crosshair component, selection hook or financial event type is proposed.

Example handler inside the mounted component, with `candles` created by
`useCandleInspection` and attached to CandlestickSeries:

```tsx
const hoveredTime = useSignal<number | undefined>(undefined);
const pinnedTime = useSignal<number | undefined>(undefined);

const inspect = withInspection((event: PibblLogicalMouseEvent, context) => {
  const rendered = context.rendered(candles);
  if (!rendered) return;
  const time = rendered.timeAtRoot({ x: event.x, y: event.y });
  if (time === undefined) return;
  const hit = context.request(nearestRecordedCandleX, rendered, { time });
  if (hit) hoveredTime.set(hit.time);
});

const activeTime = pinnedTime.get() ?? hoveredTime.get() ?? latestTime;
// Within the TradingTimeScale scope:
<ReferenceLine
  scale="session"
  direction="vertical"
  value={activeTime}
  span={[priceTop, volumeBottom]}
  style={{ stroke: colors.crosshair, strokeWidth: 1 }}
/>;
```

Both panes select the same recorded timestamp. Their existing committed mapping
handles root-to-local conversion; nearest selection is filtered to visible,
eligible candles. OHLC is never interpolated. Persist timestamps and UI state,
not borrowed inspection hits. Readouts derive from the current canonical
application data snapshot shared with the series. Missing volume at the exact
selected timestamp displays an em dash, never another timestamp's volume.

Mouse movement previews; mouse leave clears preview. Click/tap anywhere in a pane
pins its snapped timestamp; repeating the same selection unpins. A pin survives
pointer movement. Arrow keys step visible eligible observations without wrapping;
Home/End select endpoints, Escape unpins. Removing a selected record clears that
selection. A selection outside the viewport retains its timestamp but hides its
crosshair; a small status explains that it is outside the window. Decorative
guides do not capture input. A horizontal guide explicitly denotes selected Close.

## 2. Price guides and financial formatting

Compose existing ReferenceLine, ScaleAdjust, Text and shapes. No PriceGuide or
formatPrice/formatVolume wrappers. Price labels use explicit display precision;
they do not quantize data or imply executable tick rounding.

```tsx
const priceText = (value: number) =>
  formatNumber(value, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const volumeText = (value: number) =>
  formatNumber(value, {
    notation: "compact",
    maximumFractionDigits: 1,
    suffix: " shares",
  });

<ReferenceLine
  scale="price"
  direction="horizontal"
  value={latestClose}
  span={[plotLeft, plotRight]}
  style={{ stroke: colors.lastPrice }}
/>;
<ScaleAdjust yScale="price" y={latestClose}>
  <Text
    pointerEvents="none"
    style={{ left: plotRight + 8, font: "11px monospace", fill: colors.text }}
  >
    {priceText(latestClose)}
  </Text>
</ScaleAdjust>;
```

Latest price is the last supplied eligible observation, independent of hovered
selection and the visible window. Previous close is caller-supplied or explicitly
derived from the preceding supplied observation, not an inferred exchange session.
Label it accurately in simulated daily data. Guides outside the displayed domain
are hidden and explained in the summary, never clamped to a false price.
Overlapping axis tags prioritize last price; other values remain in the readout.

## 3. Visible-window autoscaling

Proposed additions to `@pibbl/core/viz`:

```ts
interface VisibleOhlcPriceExtentOptions<D> {
  time: LineAccessor<D>;
  open: LineAccessor<D>;
  high: LineAccessor<D>;
  low: LineAccessor<D>;
  close: LineAccessor<D>;
  positionAtTime: (time: number) => number | undefined;
  visibleRange: readonly [number, number];
  defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}
function visibleOhlcPriceExtent<D>(
  data: readonly D[],
  options: VisibleOhlcPriceExtentOptions<D>,
): readonly [number, number] | undefined;

interface PadLinearDomainOptions {
  padding?: number;
  minimumSpan?: number;
}
function padLinearDomain(
  domain: readonly [number, number],
  options?: PadLinearDomainOptions,
): readonly [number, number];
```

Application code within the trading-time scope:

```tsx
const timeScale = useTradingTimeScale("session").get();
const extent = visibleOhlcPriceExtent(bars, {
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  positionAtTime: (time) => timeScale.slotAtTime(time),
  visibleRange: timeScale.logicalRange,
});
const automaticDomain = extent
  ? padLinearDomain(extent, { padding: 0.08, minimumSpan: 0.02 })
  : undefined;
const domain = manualDomain.get() ?? automaticDomain;
// Render an explicit empty state when domain is undefined.
// Otherwise: <LinearScale id="price" domain={domain} ...>...</LinearScale>
```

`positionAtTime` puts visibility in one coherent caller-defined coordinate space: exact
trading slots or elapsed UTC timestamps. A record participates when its position
is inclusively within the sorted viewport endpoints. Fractional windows select
contained candle centers; overlapping wick/body pixels do not determine inclusion.
Undefined positions exclude records; nonfinite returned positions reject.
Endpoints must be finite. No sorting or data mutation occurs.

The extent is ascending low/high, or undefined for no eligible complete candles.
`defined` excludes a row before accessors. Nullish/nonfinite OHLC/time skips the
complete row; finite malformed eligible OHLC throws, matching CandlestickSeries.
Excluded out-of-window records do not contribute price extrema. Accessors are pure.

Padding defaults to 10% on each side, after expanding to minimumSpan when needed.
Explicit minimumSpan is positive; absent minimumSpan only expands flat domains,
using max(abs(value) * 0.02, 1). Finite endpoints and nonnegative finite padding
are required. Direction is preserved; output is frozen and finite with distinct
endpoints. Unrepresentable numeric bounds reject rather than silently collapse.

Manual override is caller-owned domain state, with explicit Auto/Manual controls.
Linear/log presentation selects the existing dedicated provider. Log uses positive
eligible data only and pads in logarithmic space with padLinearDomain, then
exponentiates with finite/positive checks. A nonpositive visible low produces a
clear unavailable state; no records are silently discarded to make log work.
Viewport and selected timestamp survive provider changes. Clip/filter visible
marks before log mapping so nonpositive offscreen data cannot break the view.
No linear/log selector is introduced into either helper.

## Example delivery and acceptance

Upgrade Market Session into a coherent price/volume workstation: aligned panes,
responsive OHLCV strip, thin crosshair and date/close tags, visible pinned state,
last-price and previous-close guides, Auto/Manual and Linear/Log controls, and
All/Recent/Earlier window buttons. Window controls demonstrate autoscaling;
advanced gestures and calendar presets remain Batch 3. Keep both light/dark
palettes, label simulation prominently, and preserve professional restrained paint.

Three focused learning examples: a three-candle keyboard/tap readout, one price
guide with currency/compact volume formatting, and a window excluding one extreme
price. Each teaches an observable behavior rather than presenting unexplained dots.

Before production edits, obtain user acceptance of this proposal. Then establish
focused failing public tests and hand-computed extent/padding fixtures; implement
each complete slice and present live Studio URLs promptly. Test transformed input,
pinning, exact missing volume, changed data, flat/empty windows, manual override,
log rejection, and retained selection. Review desktop and narrow touch layouts in
both palettes, with no clipped labels. Harden package/editor/docs/ownership and
aggregate verification after feedback. Stop at these three capabilities.
