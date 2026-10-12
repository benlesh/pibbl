> **Historical status: Proposal and execution record for the October 8, 2026 financial-charting batch; the inspection shipping decision was updated after the October 9 pilot.**

# Plan 008 — Financial charting

Status: Batch 0 accepted, hardened and committed as `0ad33084`. Batches 1 and 2
are accepted and committed as `be31890a`. Batch 3 linked panes, UTC range controls,
fixed-base comparisons and adaptive navigation were accepted and committed as
`cf420e8c`. The follow-up range interpolation helper and animated navigation with
restored mouse/trackpad/touch interaction were accepted on 2026-10-12. Focused
verification is recorded below; no aggregate verification, push or publication is
claimed for these additions. Batch 4 SMA, EMA and Bollinger Bands were approved
on 2026-10-12, implemented and accepted after the band-fill contrast revision.
Batch 5 oscillator APIs were subsequently approved and are implemented as a
Momentum Desk slice accepted by the user on 2026-10-12. Batch 6 APIs were
approved and Execution Journal was accepted on 2026-10-12 after the entry
navigation correction. Focused verification passed; aggregate validation remains
blocked by the unrelated changes recorded below.

## Goal and baseline

Deliver composable financial visualization through supported Pibbl public APIs,
with attractive fintech examples and genuinely small learning examples. Start
with the two largest missing foundations: candlesticks and trading-time spacing.
Review approximately three implemented features at a time with the user before
starting the next batch.

At the original plan baseline, runtime exports included line/area/interval/point/custom-mark/categorical
bar series, dedicated scales, axes, reference lines/bands, hover queries/cards,
and bounded continuous pan/zoom. That baseline had no dedicated financial series,
trading-time scale, indicator calculations, or financial data pipeline. Batch 1
now implements financial series and trading time; indicators and a financial
data pipeline remain deferred.
Existing brush and linked-inspection recipes are useful evidence, not public
financial components. No new Chart container or second scheduler is implied.

Competitive references checked 2026-10-08:

- [TradingView Lightweight Charts series](https://tradingview.github.io/lightweight-charts/docs/series-types)
- [TradingView panes](https://tradingview.github.io/lightweight-charts/tutorials/how_to/panes)
- [Highcharts navigator](https://www.highcharts.com/docs/stock/navigator)
- [Highcharts data grouping](https://www.highcharts.com/docs/stock/data-grouping)
- [Highcharts indicators](https://www.highcharts.com/docs/stock/technical-indicator-series)
- [amCharts Stock](https://www.amcharts.com/docs/v5/charts/stock/)

The ordering is Pibbl-specific judgment, not a claim that every competitor ships
every proposed feature. This addresses the user-requested market-charting gap;
it does not depend on a strategy hypothesis authorizing implementation.

## Delivery and feedback agreement

Each numbered batch contains three user-visible capabilities. Documentation,
minimal demos, public types, package/editor integration, and tests are parts of
those capabilities, not extra features hidden outside the cap.

1. Resolve the design questions blocking that batch only. Before implementing
   any new feature, show the user proposed application code: a minimal public-API
   example and, where useful, its composition in the fintech showcase. Include
   proposed signatures/types and the important behavior illustrated by the code.
   Discuss and obtain acceptance of the authoring design before production
   implementation; do not treat examples shown after implementation as satisfying
   this checkpoint. Existing acceptance persists unless the proposed API changes
   materially, in which case show the revised code before implementing it.
2. Define an observable contract and add focused failing public-API evidence
   before production changes. Pure calculations also need hand-computed fixtures.
3. Implement complete slices sequentially; delegate independent work where useful.
4. Make each slice runnable promptly. At three features, stop implementation of
   additional features and present the batch for feedback.
5. Supply the actual running Studio origin and full URLs, minimal-demo locations,
   a short inspection checklist, known limitations, and fresh focused results.
   Proposed slugs below are targets, not currently available URLs.
6. Incorporate feedback, then broaden edge-case, ownership, docs, package, and
   visual verification. Record a dated field note before marking the batch done.
7. Start the next batch only after the user's feedback/authorization to continue.
   If they authorize several batches, still pause to show each set of three.

Milestones remain distinct: **slice ready for feedback**, **batch accepted**, and
**feature complete after hardening**. A screenshot or passing unit test alone
does not establish any entire financial subsystem as complete.

## Design discussion: decisions before Batch 1

### D1 — Public surface and ownership

Recommended starting point: existing `@pibbl/core/viz` entry and compositional
runtime. Use descriptive operations with stable return contracts. Proposed
`CandlestickSeries`, `TradingTimeScale`, and `useTradingTimeScale` are dedicated
APIs, not `FinancialSeries({ type })` or `useScale({ kind })`. Decide whether
financial calculations warrant a separate public subpath only when bundle and
discoverability evidence justify it; do not introduce a package now by default.
Application signals own selection, viewport, feed data, and drawings. Core owns
the existing scheduler, events, focus and disposal. Rendering must not compute
or mutate application state through side effects.

### D2 — Trading observations versus exchange calendars

Recommended first contract: caller supplies strictly increasing, unique numeric
UTC millisecond timestamps. Observations occupy consecutive logical slots.
This compresses absent observations; it does not assert why they are absent.
Support 24/7 and session markets through the same supplied-observation model.
Exchange holidays, DST sessions and early closes are a later explicit phase.

Resolve before code: visible logical range units; fractional navigation;
timestamp-to-slot lookup; exact versus nearest inversion; unknown timestamp
handling; empty/singleton input; future whitespace; reversed ranges; stable
viewport anchoring when earlier history is inserted. Timestamp lookup and slot
navigation need separately named operations if their return semantics differ.
UTC remains elapsed-time mapping and must not silently become gapless.

### D3 — Compatibility across existing marks and queries

Trading-time support must cover Axis, ScaleAdjust, candles, volume, LineSeries,
AreaSeries, IntervalBandSeries, PointSeries and PlotSeries where their contracts
apply. Audit private scale receivers and types before changing them. Area/band
currently require continuous mapping; point/line receivers and hover queries
also have distinct assumptions. Do not widen public numeric query contracts to
ambiguous unions. Define separate exact-bar lookup when necessary.
Batch 1 must demonstrate a line overlay and custom marker on the same x mapping;
subsequent consumers are integrated before they are used, not left as surprises.

### D4 — Candle data, geometry and interaction

Recommended input: ordinary caller-owned records with named accessors for time,
open, high, low and close; volume remains optional application data. No implicit
sorting or mutation. Establish whether missing fields skip the complete candle,
and whether malformed finite OHLC raises an actionable error. Enforce low <=
min(open, close) <= max(open, close) <= high for valid candles.
Choose up/down/equal semantics, independent body/wick/border paint, doji visibility,
width relative to slot spacing with a pixel cap, and tiny-scale behavior. Styling
callbacks remain plain and hook-free. Financial inspection is nearest recorded
bar, distinct from painted event targeting. Favor batched marks with bounded
event/component overhead rather than one mounted subtree per candle.

### D5 — Showcase audience and data

Planning default: a market-analysis workstation for fintech engineers and
investment research. User preference is pending. Use an attributed, versioned,
redistributable real OHLCV snapshot when available; verify source/license and
adjustment status before adding it. Deterministic simulation is appropriate for
streaming and execution examples and must be labeled. No live keys or network
feed is required to run a learning example. Aesthetics cannot imply predictive
value or turn simulated events into reported market facts.

## Status board

| Batch | Three capabilities                                                  | State                                 |
| ----- | ------------------------------------------------------------------- | ------------------------------------- |
| 0     | Typed inspection queries, lazy handler adapter, painted-mark lookup | Accepted; hardened, aggregate blocked |
| 1     | Trading time, candles, volume                                       | Retained; continuation authorized     |
| 2     | Inspection, price labels/formatting, price autoscaling              | Accepted; local commit authorized     |
| 3     | Linked panes, range controls, comparison returns                    | Accepted; committed as `cf420e8c`     |
| 4     | SMA, EMA, Bollinger Bands                                           | Accepted; focused verification passed |
| 5     | RSI, MACD, stochastic oscillator                                    | Accepted; focused verification passed |
| 6     | OHLC bars, baseline series, event markers                           | Accepted; focused verification passed |
| 7     | Live updates, OHLCV aggregation, session VWAP                       | Accepted; focused verification passed |
| 8     | Overview navigator, levels/zones, trend-line editing                | Queued                                |
| 9     | Channel tools, Fibonacci tools, drawing persistence                 | Queued                                |
| 10    | Exchange sessions, history loading, Heikin-Ashi                     | Later design                          |
| 11    | Volume profile, market depth, footprint                             | Optional specialist scope             |
| 12    | Renko, point-and-figure, replay                                     | Optional specialist scope             |

Batches 1–9 cover the main requested features and low-hanging fruit. Batches
10–12 make earlier discussed advanced work explicit, with a fresh scope decision
before implementation. Batch 10 exchange-session policy is a prerequisite for
calendar-aware bucket rules, not for the initial gapless scale.

## [DONE] Design checkpoint — inspection authoring

The user accepted the discussed standalone queries, optional lazy inspection,
painted lookup, and ownership contracts. Preserve the accepted candle and
trading-time authoring. Discuss remaining Batch 1 integration details only when
that batch becomes the next authorized work. Batch 0 is an explicit three-feature checkpoint,
not hidden prerequisite work inside Batch 1. Do not implement a broad data engine
or spatial index in advance of its first runnable slice.

### [DONE] Review the Batch 0 runnable inspection slices

The user approved the runnable batch on 2026-10-08. Proceed with inspection
hardening and verification before the remaining Batch 1 design checkpoint. The [accepted inspection proposal](./008-inspection-proposal.md)
records ownership, coordinates, cost, and the audit of existing series and pie.
Candlestick and trading-time authoring acceptance persists.

### [DONE] Harden and verify the accepted inspection batch

Characterize cached-Layer transforms, clipping, failed renders, unmount and
ref reuse; address actual failures with focused tests before production fixes.
Complete ownership/query boundary evidence and proportional aggregate checks.
Keep accepted authoring unchanged. Record current results and blockers, then
show only the unresolved Batch 1 integration designs before new implementation.

### [DONE] Review revised inspection lessons

The user accepted the revised order-time lookup, lazy-query execution counts,
and nearest-versus-painted overlap on 2026-10-08 and authorized a local commit.

### [DONE] Review remaining Batch 1 volume and inspection design

Review the [proposed application examples and public contracts](./008-volume-inspection-proposal.md)
for VolumeSeries and typed candle/volume inspection before implementing them.
CandlestickSeries authoring and TradingTimeScale remain accepted. Batch 0's
[dated hardening evidence](../testing/field-notes/2026-10-08-inspection-hardening.md)
records current tests, ownership fixes, runnable URLs and unrelated aggregate blockers.

### [DONE] Deliver Batch 1 trading-time, candle and volume slices

The user approved the remaining design on 2026-10-08. Deliver the approved three
capabilities through public examples; share first runnable slices promptly, then
stop after the batch for feedback. Volume starts on UTC while the dedicated
trading-time mapping is integrated. Keep financial inspection on Batch 0 ownership.

### [DONE] Review the Batch 1 runnable financial slices

The user authorized the next three financial inspection items on 2026-10-09.
Existing Batch 1 evidence remains dated and does not establish broader hardening.

### [DONE] Batch 2 authoring design checkpoint

The user approved the [inspection proposal](008-financial-inspection-proposal.md),
with the explicit requirement to use platform number formatting. Reuse the
existing `formatNumber` implementation backed by `Intl.NumberFormat`; add only
`visibleOhlcPriceExtent` and `padLinearDomain` as public helpers.

### [DONE] Review the Batch 2 runnable inspection slices

Inspect synchronized recorded-time crosshairs, pinning/keyboard inspection,
last-price/preceding-close guides, currency/compact volume labels and visible-window
autoscaling with manual override and linear/log presentation. Market Session and
three focused lessons are the public surfaces. Stop at these three capabilities;
collect experiential feedback before broader hardening or Batch 3.

### [DONE] Batch 3 authoring audit

The user approved the [coordinated analysis proposal](008-coordinated-analysis-proposal.md)
conditional on flexibility and agent understandability. Independent review found no
material API change necessary. Keep application-owned linked pane/navigation state;
add only `percentageReturns` and `indexTo100` with separate fixed return contracts.
Document cumulative simple return from an exact common base, not adjacent-period return.

### [NEXT] Review the Batch 3 runnable coordinated slices

Inspect [Relative Performance Desk](http://127.0.0.1:5196/#/examples/composition/financial-relative-performance),
[linked panes](http://127.0.0.1:5196/#/examples/composition/financial-linked-panes),
[UTC calendar controls](http://127.0.0.1:5196/#/examples/composition/financial-calendar-ranges)
and [normalized returns](http://127.0.0.1:5196/#/examples/composition/financial-normalized-returns).
Market Session also gains 1M/3M/YTD, bounded pan/zoom, fit and return-to-latest controls.
Check the fixed base across viewport changes, exact shared timestamp readouts, explicit
missing observation and unavailable-base status, and touch/keyboard use on a phone.
Stop after these three capabilities for feedback before hardening or Batch 4.

## Batch 0 — composable data-inspection foundation

User added this scope after auditing all current series. The aim is less repeated
application plumbing with no mandatory search, index, subscription, or inspection
bundle dependency for rendering-only consumers. Ordinary core events and their
targeting/propagation contract remain unchanged. The discussed inspection authoring was approved on 2026-10-08 before implementation.

1. **Typed standalone inspection contracts.** Reuse existing queries and result
   types where they fit; add separately named operations only for missing contracts.
   Distinguish nearest recorded observation by x, nearest recorded point in mapped
   geometry, and explicitly interpolated samples. Document domain/local/root
   coordinate units; avoid making another result with ambiguous x/y. Preserve
   original typed datum, source index, optional stable identity, anchor and
   distance/delta units. Results must retain both interval/range bounds and area
   baseline when those are relevant; categorical identity must not be coerced to
   numeric data. Start with one numeric line/point slice, then prove categorical
   bars and bands during post-feedback hardening. Existing APIs must not silently
   change coordinate semantics. A descriptor/typed query definition should share
   data/accessors with rendering where useful, without requiring a series registry.
2. **Optional lazy handler adapter.** Explicit import/definition connects an
   ordinary event handler to a typed inspection context. Compare a separate second
   callback argument against an opt-in event extension in the proposed code;
   favor the former unless the event extension proves clearer. No monkey-patching
   core events or global module augmentation. Query execution occurs only when
   requested, with memoization per dispatch/series/query/arguments, including no
   match. Integrate with handlers on plot geometry as well as series geometry so
   empty-space inspection works. Define how keyboard inspection is supplied an
   explicit position rather than inventing a pointer. No mandatory HoverData
   render cycle for a one-off click lookup. Standalone queries and reactive
   HoverData must continue to share algorithms rather than duplicate them.
3. **Painted-mark lookup.** A separately named operation identifies the original
   datum corresponding to a painted discrete mark, distinct from nearest-center
   or nearest-x selection. First prove overlapping points and categorical bars;
   PlotSeries and pie callbacks already expose original records and should use
   that information without adding unnecessary searches. Line/area/band geometry
   has no universal source datum at every painted position: document this rather
   than forcing every family into an ambiguous result. Candle/volume support joins
   in Batch 1 without becoming a fourth Batch 0 feature.

Snapshot and coordinate design: a lookup must use the data/accessor results,
transforms, clipping and scale geometry associated with the committed visual
generation being inspected. A handler writing a signal must not make a later
lookup in that dispatch observe unpainted data. Define synchronous context
lifetime and result ownership; retained original records are references, not
deeply immutable copies. Do not promise arbitrary deferred querying of an event.
Choose local versus root/screen distance explicitly under nonuniform transforms.
Painted lookup respects source paint order, actual fill/stroke, clipping and
omitted rows. Nearest queries need an explicit candidate/visibility policy and
must never be described as the Pibbl event target.

Performance evidence: zero query executions without a request; one execution for
repeated identical requests; no hidden signal subscriptions or per-datum event
objects; retained inspection state released on unmount/disposal. Rendering-only
packed bundles exclude inspection adapters and algorithms; a nearest-x consumer
does not pull in a spatial index or unrelated query family. Lazy search still has
its documented algorithmic cost. Sorted x optimization is opt-in or based on a
validated ordered definition; unsorted input cannot silently use binary search.
Do not add a spatial index until measured workload evidence calls for one.

Coverage matrix for completion: LineSeries, PointSeries, AreaSeries,
IntervalBandSeries, BarSeries (value/range/grouped), PlotSeries, PieLayout/PieSlice,
then CandlestickSeries/VolumeSeries. For each record supported query operations,
original fields/derived geometry, source index/key, gaps/filtering, tie policy,
coordinate frame, snapshot behavior, targeting differences and cost. An explicit
unsupported operation is preferable to a fabricated nearest datum.

Showcase: **Inspection Workbench**, target `viz-inspection-workbench`: useful
line/point comparison and categorical range bars, with recorded/interpolated
values clearly differentiated. A minimal example per feature demonstrates lazy
lookup, no-result handling, and an overlap where painted identity differs from
nearest center. Public JSDoc and tests explain the distinction. After review,
financial showcases reuse the same foundation rather than introduce another
financial-only event model.

## Batch 1 — credible price chart

1. **Trading-time scale.** Dedicated provider/hook with fixed return type,
   ordered timestamps, fractional viewport and timestamp-aware ticks. Public
   evidence: Friday/Monday observations have equal slot spacing; exact lookup,
   nearest selection, pan/zoom and prepend semantics are explicit. Prove minimum
   line/custom-mark interoperability without a private application import.
2. **Candlestick series.** Batched OHLC geometry, body/wick styling, dojis,
   missing/invalid input policy and signal updates. Public geometry fixtures
   cover rising/falling/equal candles, width, reversal and clipping. Visible
   price extent must use high/low, not only close. No smoothing of candle data.
3. **Time-aligned volume columns.** Use existing bars if the common x geometry
   genuinely fits; otherwise add a descriptive time-column primitive with shared
   implementation. Do not call categorical columns OHLC bars. Establish whether
   color means close versus open or versus previous close and show that meaning.
   Prove price/volume timestamps align with an independent y-scale.

Showcase: **Market Session**, target slug `financial-market-session`: recognizable
price and volume, readable date/price axes, asset/timeframe/source context, quiet
grid, clear rising/falling encodings and useful empty state. Integrate Batch 0
inspection with typed OHLC and original volume/application fields; the full
crosshair/touch/keyboard/pinning experience remains Batch 2. Minimal demos: 6–10 candles containing a
doji, a Friday/Monday scale, and five aligned volume records, each independent.
Review: spacing, candle readability, volume alignment, authoring ergonomics,
desktop and narrow portrait. This is the first runnable financial milestone.

## Batch 2 — trustworthy inspection and prices

1. **Snapping crosshair with OHLCV readout.** One recorded timestamp drives all
   fields. Hover, tap, keyboard step and pin/unpin have explicit states. Pointer
   inversion respects local coordinates; no interpolated OHLC. Readout remains
   available on touch and keyboard without requiring hover.
2. **Price guides and financial formatting.** Last price and previous close,
   data-anchored axis tags, currency/tick precision and compact volume. Compose
   ReferenceLine/ScaleAdjust/Text first. If a reusable formatter is needed,
   separate price and volume functions; settle rounding versus minimum tick.
3. **Visible-window price autoscaling.** Pure visible OHLC extent plus padding,
   flat/empty domain handling and manual override. Linear/log presentation is
   included here: nonpositive prices get an explicit unsupported-state policy;
   the toggle must retain the selected x window and inspection.

Showcase: Market Session becomes an inspection workstation. Minimal demos:
three-bar keyboard readout; one live price tag; offscreen extreme that does not
distort visible autoscaling. Review: snapped values, labels, log behavior, pin
and focus, and whether price changes feel stable.

## Batch 3 — coordinated analysis

1. **Linked panes.** Shared x viewport and inspection signal, independent y
   scales, identical plot boundaries. Start with a composed recipe; add public
   pane infrastructure only for demonstrated recurring allocation value. Pane
   resizing, minimum heights and focus preservation must be discussed first.
2. **Range controls.** Bounded drag/wheel/pinch or explicit equivalent controls,
   1M/3M/YTD/all presets, fit/reset and return-to-latest. Define elapsed calendar
   presets over compressed slots and dataset-edge behavior. Reuse existing pan/
   zoom where valid; do not overload them with unrelated operation selectors.
3. **Normalized comparison returns.** Compare instruments at an explicit common
   base timestamp using percentage returns or indexed-to-100 data helpers with
   separate contracts. Never silently choose a different base for each asset;
   nonoverlap, absent base and zero base policies are visible.

Showcase: **Relative Performance Desk**, target `financial-relative-performance`:
two or three assets, shared inspection, visible base date and readable direct
labels. Minimal demos: two linked plots; range buttons on a tiny dataset; two
five-point normalized series. Review alignment, navigation and honest comparison.

## Batch 4 — overlays suitable for independent implementation

1. **SMA.** Pure full-length aligned output with explicit warm-up missing values,
   positive integer period and input-gap policy; no mutation.
2. **EMA.** Same alignment discipline, explicit seed and smoothing convention,
   separately named operation and documented behavior after a gap.
3. **Bollinger Bands.** Mean plus upper/lower aligned output; lock population
   versus sample deviation and multiplier. Reuse IntervalBandSeries and lines.

Showcase: **Trend and Volatility**, target `financial-trend-volatility`: selectable
overlays, parameter labels, inspectable values and legible candle contrast.
Minimal demo per calculation: tiny hand-checkable input and resulting overlay.
Review numerical conventions and authoring. Pure helper implementations can be
delegated independently once their contracts are settled.

## Batch 5 — oscillator analysis

1. **RSI.** Explicit Wilder initialization/smoothing, constant series and zero
   gain/loss behavior; line pane with visible 30/70 guides.
2. **MACD.** Explicit fast/slow/signal periods and seeds; aligned MACD, signal and
   histogram outputs; signed histogram on the trading-time x mapping.
3. **Stochastic oscillator.** Rolling high/low, %K/%D conventions, smoothing and
   zero-range behavior; explicit output fields and warm-up lengths.

Showcase: **Momentum Desk**, target `financial-momentum-desk`: price plus one
selected oscillator or readable linked panes; avoid squeezing all studies into
phone portrait. Each minimal example proves values and thresholds. Discuss
study parameter editing and mobile pane order before implementation.

## Batch 6 — alternate marks and financial context

1. **OHLC bars.** Reuse private candle validation/geometry where appropriate;
   dedicated stable component contract. Open tick left, close tick right; widths
   and doji semantics verified at narrow zoom levels.
2. **Two-color baseline series.** Explicit reference value, gain/loss paint and
   correctly split intersections. Preserve missing runs; resolve step/linear
   support before adding curves. Two clipped ordinary areas are acceptable only
   if they establish the complete crossing contract.
3. **Event/trade markers.** Data-anchored glyph/text composition, exact timestamp
   and side, selection/readout; define offscreen and coincident marker policy.
   Earnings/dividend provenance versus simulated trade events stays explicit.

Showcase: **Execution Journal**, target `financial-execution-journal`: OHLC chart
and readable simulated fills with gain/loss context. Minimal demos: three OHLC
bars; one baseline crossing; three labeled markers. Review visual semantics.

## Batch 7 — evolving data

1. **Live-bar updates.** Explicit replace-current and append-next operations if
   public helpers are justified, otherwise a documented signal recipe. Define
   timestamp corrections, active inspection, follow-latest versus historical
   browsing, bounded retention and teardown. Use Pibbl scheduling, not another
   animation loop. Demonstration feed has explicit start/stop controls.
2. **OHLCV aggregation.** Pure named operation: first open, maximum high,
   minimum low, last close, summed volume. Discuss bucket anchors, partial bars,
   missing inputs and session policy. Preserve extremes; do not substitute line
   downsampling. Initial bucket rules can be explicit UTC or caller-supplied
   boundaries; exchange-aware rules wait for Batch 10.
3. **Session VWAP.** State whether input is actual trades or bar approximation,
   choose typical/close price explicitly, define session resets, zero volume,
   warm-up and partial sessions. Show approximation caveats next to the chart.

Showcase: **Live Market Monitor**, target `financial-live-monitor`: deterministic
replay feed, current candle/volume, feed status, timeframe aggregation and VWAP.
Minimal demos: two append steps; four bars aggregated into two; two VWAP sessions.
Review following versus browsing, correctness and update responsiveness.

## Batch 8 — navigation and first drawing interactions

1. **Overview navigator.** Full-history overview with a movable/resizable window,
   pointer capture and keyboard alternatives, synchronized with range controls.
   Selection uses domain coordinates; interaction draft/commit are explicit.
2. **Editable levels and zones.** Horizontal level, bounded price region, target/
   stop presentation; semantic domain values and edit handles. Reuse reference
   marks; cancel/delete/focus interactions need an approved state machine.
3. **Trend-line tool.** Two time/price anchors, select/edit/remove/cancel. Explicit
   arbitration between drawing, panning and inspection; log-scale behavior must
   be decided. No automatic trading/action integration.

Showcase: **Research Workspace**, target `financial-research-workspace`: navigator,
support/resistance levels and editable trend line. Minimal demos per tool; tests
drive public pointer/keyboard events and confirm domain anchors after zoom.

## Batch 9 — drawing family and persistence

1. **Channels.** Trend anchors plus offset; define parallelism in price or screen
   geometry, especially under log scales. Share private editing mechanics.
2. **Fibonacci tools.** Explicit levels and anchor direction, domain-based values,
   labels, visibility and edit behavior. Start with retracement; extensions only
   if separately approved rather than hidden inside this feature.
3. **Drawing persistence.** Versioned serializable data-space schema, explicit
   import validation, stable IDs, symbol/timeframe context and schema migration
   errors. Save/export and restore as separate stable operations. Demonstrate
   local persistence; application remains owner of backend/storage.

Showcase: Research Workspace round-trips a small analysis through reload/zoom.
Minimal demos: one channel; one retracement; one saved/restored trend line.
Discuss undo/redo requirements before this batch; do not silently add a fourth
feature. URL viewport state may be a recipe, not a public persistence service.

## Later batches: require a fresh scope/design decision

### Batch 10 — session semantics and historical representations

1. Exchange-calendar/session integration: explicit caller-supplied sessions or
   reviewed calendar dependency; timezone/DST/holiday/early-close fixtures.
2. Historical loading: request older data near the viewport boundary, stable
   timestamp anchoring after prepend, cancellation, empty/error/retry states.
3. Heikin-Ashi transform: recurrence and seed, distinction from actual prices,
   update/recompute rules and clearly labeled derived candles.

Showcase: **Session Explorer**. Minimum demos expose one early-close session,
one prepend without viewport movement and three hand-computed derived candles.

### Batch 11 — specialist market microstructure

1. Volume profile: actual trade distribution versus bar-based estimate, binning,
   price-axis histogram, viewport/session scope and source caveats.
2. Market depth: bid/ask cumulative curves or price ladders, book snapshots/deltas,
   crossed/empty/stale-book handling and bounded updates.
3. Footprint: bid/ask volume within price bins per bar, attribution policy,
   dense-cell legibility and aggregation/performance evidence.

Showcase: **Order Flow Lab** with explicitly simulated execution-level data.
These are not low-hanging fruit and must not be implemented as decorative heat
maps over OHLC data. Discuss data contracts and performance targets first.

### Batch 12 — specialized chart transforms and replay

1. Renko: brick sizing, reversal rule, gap policy, close-only versus intrabar
   inputs, and ambiguity of reconstructing movements from OHLC.
2. Point-and-figure: box size, reversal convention, column semantics and mapping.
3. Replay: deterministic cursor, seek/reset/speed, reuse of live update pathway,
   lifecycle ownership and derived-indicator consistency.

Showcase: **Price Structure Lab**. Minimal fixtures calculate every brick/column.
Both transforms need dedicated authoring and labeling; they do not imply that a
single timestamp scale can represent every synthetic mark without adaptation.

## Example and documentation contract for every feature

- A minimal public example demonstrates one concept with tiny readable data,
  no unrelated dashboard scaffolding, meaningful variable names, and explicit
  mounting/disposal. New APIs have executable TSX/non-JSX evidence where the
  existing authoring contract requires it. Recipes have minimal recipe pages.
- A polished showcase has an actual analytical task: price/volume inspection,
  relative returns, trend/volatility, momentum, fills, or evolving data. Do not
  make 36 almost-identical dashboards. Each family evolves across batches.
- Use quiet context, legible tabular numbers, direct labels, visible units,
  explicit source/adjustment/as-of information, and redundant rising/falling
  encodings. Default to truthful linear/step financial paths, not decorative
  smoothing or gradients that obscure data.
- Test desktop and phone portrait; at minimum use the established 1000x640,
  560x300, 360x300 and 320x260 allocations plus a narrow tall panel where useful.
  Essential values must survive without hover. Provide tap, keyboard and focus
  paths, clear hit areas and chart-adjacent text summaries; do not imply Canvas
  automatically creates a semantic accessibility tree.
- Showcase source imports only public entries. Test labs and stress fixtures are
  separate from learning metadata and public search. Record data source/license,
  snapshot and transformations; use offline deterministic datasets by default.
- Public JSDoc covers every exported member: purpose, units, accessors, defaults,
  invariants, missing/invalid input, return ownership/alignment, signal behavior,
  errors, complexity where material, and links/examples. Indicator docs specify
  formulas, seeds, gaps and warm-up. Drawing docs specify anchoring and ownership.
- Add/maintain API reference, financial authoring guide, minimal-demo registry,
  learning catalog, declarations visible to the Studio editor, source and packed
  exports. Keep plan prose out of public API documentation.

## Verification and completion

Before feedback: focused failing-then-passing public semantic/geometry tests,
hand-calculated numerical fixtures, runnable minimal/showcase examples and narrow
visual evidence where pixels add information. Headless drivers use the same
public scenarios. Avoid exhaustive edge matrices before the first observable
slice. Verify price/volume/inspection alignment semantically before screenshots.

After feedback: broaden only relevant input, geometry, responsiveness, focus,
signal update and disposal matrices. Inspect baseline diffs rather than rewriting
them to pass. Use deterministic resource/event counters for ownership. Check
source and built browser modes, declarations, Bundler/NodeNext and packed
consumers for new public APIs; pure helpers need tree-shaking/import evidence.
Run docs/JSDoc/catalog/type/lint checks appropriate to changes. Run the aggregate
`corepack pnpm@11.21.0 trust` at major integrated closeouts (Batch 3, Batch 6,
Batch 9, and final accepted scope) unless new risks justify earlier execution.
Record fresh environment/output; old Plan 007 blockers are not assumed current.
Document Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and Chromium actually used.

Each batch field note records contract decisions, user feedback, tests, visual
inspection, known limits and actual runnable URLs. Final completion requires
accepted behavior, proportional hardening, docs/public-surface parity, targeted
review and accurate aggregate status. No competitive-parity or performance claim
without explicit evidence and a measured workload.

## Delegation plan

Primary agent owns scale/series integration, shared files, showcase composition,
public contract decisions and feedback. At most one implementation subagent and
one independent reviewer per slice. Independent pure helpers (SMA/EMA/Bollinger,
formatters, normalization) are good assignments after contracts are locked;
later indicator batches can reuse that agent. Assign specific files and public
tests. The primary agent integrates exports/catalog/editor changes to prevent
shared-file collisions. Do not delegate scale-dependent volume integration until
the x-scale contract is settled. Review after a runnable slice, targeting changed
code and unresolved findings. Every delegated feature counts toward the same
three-feature cap. Subagents do not independently launch the next batch.

## Session log

- 2026-10-08: Continued the inspection design checkpoint. Inspected current public
  query/series code, event contracts, package exports and query test source;
  delegated a read-only all-series/pie audit. Recorded the proposed application
  authoring and ownership contracts in
  [008-inspection-proposal.md](./008-inspection-proposal.md). Design awaits user
  acceptance; no production changes, tests run or runnable slice claimed.
  Preserved unrelated working-tree changes. Single next step: review the proposal.

- 2026-10-08: User approved CandlestickSeries authoring and TradingTimeScale.
  Subsequent all-series audit confirmed lazy nearest-x data existed in
  ember-nf-graph, while Pibbl intentionally deferred event enrichment. User added
  improved data inspection to this body of work. Added explicit Batch 0 with three
  capabilities and made inspection code examples/design the next step. No
  inspection API or implementation has been approved or shipped.

- 2026-10-08: User requires proposed code examples before implementing new
  features. Added an explicit pre-implementation authoring-design checkpoint for
  every feature, including delegated work.

- 2026-10-08: User requested detailed phased planning, approximately three
  features per feedback checkpoint, independent low-hanging-fruit delegation,
  compelling fintech examples, minimal examples and JSDoc. Baseline inspected;
  unrelated untracked `output/` preserved. This document is a plan, not evidence
  of implemented capabilities. Audience/calendar preferences requested; design
  discussion remains next.

- 2026-10-08: User accepted the discussed inspection design. Naming revised to
  `RenderedSeries`/`rendered()`; optional `filter` replaces candidate string
  policies, and explicit resolver functions replace new duplicate-x policy
  strings. Initial public capture/query test added before production code.
  Implementation begins with the first numeric line/point slice.

## 2026-10-08 — Batch 0 slice evidence

Implemented the accepted optional `@pibbl/core/viz/inspection` entry: typed
committed numeric queries, lazy `withInspection`, and separate point/bar geometric
paint lookup. Line/point/bar capture is opt-in; original records and indices are
preserved. Context memoization is dispatch-owned, and borrowed records become
stale on a new successful root generation or disposal. Generation checks do not
clone geometry on each request. Capture installs no signal subscription.

Running Studio origin: `http://127.0.0.1:5176`.

- [Standalone minimal](http://127.0.0.1:5176/#/examples/composition/viz-recorded-inspection)
- [Lazy-handler minimal](http://127.0.0.1:5176/#/examples/composition/viz-lazy-inspection)
- [Painted-lookup minimal](http://127.0.0.1:5176/#/examples/composition/viz-painted-inspection)
- [Deterministic fintech showcase](http://127.0.0.1:5176/#/examples/composition/viz-inspection-workbench)

Fresh evidence on host Node **26.9.0**, pnpm **11.21.0**, Playwright Chromium:

- Focused Vitest run of six `inspection-*` test files: **12/12 passed**. Includes
  exact source rows/values, transformed clips, singular transforms, gaps/ties,
  duplicate resolution, memoized misses, signal-before-paint behavior, stale
  records, native click/keyboard showcase composition, and disposal.
- `node tooling/verify-inspection-studio.mjs`: all four Studio examples passed
  desktop click, mobile touch, keyboard repaint, compiler and clean runtime-error
  checks. Captures saved to `/tmp/pibbl-inspection-evidence/`; visual evidence
  followed semantic geometry verification. No baselines were rewritten.
- `node tooling/verify-inspection-bundles.mjs`: render-only excludes inspection
  modules; nearest-x-only is 832 minified bytes and excludes optional capture,
  adapter and painted-query code (structural evidence, not a timing benchmark).
- `node tooling/verify-packed-viz.mjs`: packed Bundler/NodeNext typed composition,
  runtime numeric/point/bar query smoke, identity and private boundary passed.
- Root TypeScript, core declaration emit, focused ESLint, public JSDoc, scenario
  catalog, Studio docs/search, and Studio source/built/editor parity passed.

Limitations for feedback: deterministic simulation rather than market data;
mobile Studio scales the broad showcase while the minimal lessons are sized for
mobile; searches are linear and no speculative spatial index exists. Painted
lookup is receiver-local geometric paint, without scene-wide occlusion or pixel
alpha analysis. Area/band baseline/bounds query authoring remains a future design
checkpoint; custom Plot/pie retain their existing datum callbacks. Candles/volume
join this same foundation in Batch 1. Cached-Layer failure/rebase edge cases and
broader aggregate verification remain post-feedback hardening. Node 24 LTS was
not available for this run; no aggregate trust result is claimed.

Milestone: **slice ready for feedback**, not **feature complete**. Stop adding
features and collect user feedback.

### 2026-10-08 — accepted inspection hardening

User accepted Batch 0 and authorized continued work. Test-first fixes cover cached
Layer rebase, keyed receiver replacement, failed-render teardown, five compact
allocations and stale keyboard pointer readouts. Final focused checks: 7 files,
25 tests passed on Node 24.19.0/pnpm 11.21.0/Chromium; final Studio desktop/touch
checks passed for all four examples. Public build, source/built Studio, packed
consumers, tree-shaking, lifecycle and structural performance passed. Aggregate
trust/browser/lint checks encounter unrelated brand working-tree files; no full
pass is claimed. See the [complete dated evidence](../testing/field-notes/2026-10-08-inspection-hardening.md).

Remaining Batch 1 volume/financial-inspection examples are proposed for acceptance;
no new financial APIs were implemented. Previously accepted candle authoring and
TradingTimeScale persist. The single next step is that design review.

### 2026-10-08 — inspection lesson feedback

User found the examples too minimal and the standalone confusing. Revise the
three existing learning lessons without adding capabilities or changing the
accepted inspection API. Standalone now presents simulated recorded quotes and
explicit order times, outlines the selected quote, and reports the time delta
without interpolation. Lazy and painted lessons label their marks and separate
results from instructions. Focused tests drive the same public lessons before
visual verification. See the [feedback field note](../testing/field-notes/2026-10-08-inspection-lesson-feedback.md).
The next step is feedback on these revisions; the volume design remains pending.

### 2026-10-08 — inspection examples accepted and commit authorized

User accepted the revised learning examples and requested “commit and continue.”
Commit the inspection foundation, examples, documentation, public packaging and
focused evidence as one batch; preserve unrelated working-tree changes. Batch 1
scale/candle acceptance persists. The remaining volume/financial-inspection
proposal is still recorded as pending acceptance; clarify whether the continuation
also accepts those contracts before new API implementation.

### 2026-10-08 — remaining financial design accepted

User approved the volume/financial-inspection design and requested continuation.
Batch 0 is committed locally as `0ad33084`; unrelated changes remain uncommitted.
Started focused failing tests for UTC-aligned volume inspection and gapless
trading-time line/custom-marker/axis composition. Delegated independent pure
geometry and timestamp/slot calculations, then minimal program support. The batch
remains limited to trading time, candles and volume.

### 2026-10-08 — Batch 1 slices ready for feedback

Implemented the approved TradingTimeScale, CandlestickSeries and VolumeSeries through
public exports, optional shared candle/volume inspection, minimal programs and Studio
editor declarations. Market Session shares one trading-time mapping across candles,
a closing line, a custom mark and independent volume y geometry. Simulation is labeled.
Geometry/query helpers and minimal support were delegated; primary retained integration.
Source-order batching splits conservatively on overlap, preserving translucent paint.
Focused failing tests preceded renderer, mapping and showcase implementation.
Fresh source visualization checks: 78 files/393 tests passed, 2 files/tests skipped;
built focused financial checks: 5 files/7 tests passed. Eight desktop/touch Studio cases,
root TypeScript, focused lint, public JSDoc, minimal coverage, package consumers and
inspection exclusion checks passed. See the dated field note for exact commands,
environment, limits and failed approaches. Stop at this three-feature milestone;
feedback is the single next step, not automatic work on Batch 2.

### 2026-10-08 — financial example presentation feedback

User found the first Batch 1 examples childish and requested professional polish,
with contemporary financial library references. Updated only presentation within
the same three-feature batch. Studied TradingView Lightweight Charts price/volume,
Highcharts two-pane candlestick/volume, and amCharts stock candlestick examples.
Adopted white surfaces, compact typography, numeric axes, restrained direction colors,
thinner marks and subtle grid/separator treatment. Preserve data semantics, public
APIs and existing touch/keyboard inspection; no Batch 2 functionality is introduced.
Focused public mount tests establish numeric market context and canvas label bounds
before visual review. Evidence is in the [presentation feedback note](../testing/field-notes/2026-10-08-financial-presentation-feedback.md).
The single next step remains user review of the revised Batch 1 examples.

### 2026-10-08 — interactive financial presentation feedback

User requested stronger visual polish and mouse interactions. Studied the actual
rendered TradingView Lightweight Charts showcase. The same four Batch 1 examples
now use responsive canvas allocation, restrained dark plots, denser simulated
windows and lazy native movement inspection. Candles and volume retain original
record selection, painted lookup and keyboard/touch behavior. No new public API or
Batch 2 feature is introduced. Responsive label/data geometry and public input
checks precede fresh screenshots. See the [interactive presentation field note](../testing/field-notes/2026-10-08-financial-interactive-presentation.md).
The single next step remains user review of these Batch 1 runnable slices.

### 2026-10-08 — light/dark example toggle feedback

User liked the responsive interactive revision and requested a light/dark toggle.
Added an ordinary focusable toggle to all four existing financial examples, with
dark as the initial palette. Each mount owns its palette signal; no public theme
API, registry, subscription, storage or new Batch 2 capability is introduced.
Click/tap and Enter/Space switch palette without changing data or selection.
Focused public test failed before implementation; final 3 files/4 tests pass.
Eight live Studio desktop/touch cases pass both palettes, keyboard switching,
existing inspection/navigation and editor checking. Root TypeScript and focused
lint pass. See the updated [interactive field note](../testing/field-notes/2026-10-08-financial-interactive-presentation.md).
The single next step remains user review of Batch 1 before broader hardening.

### 2026-10-09 — Batch 2 implementation and feedback checkpoint

The user approved the proposed APIs and requested platform number formatting.
Two reused implementation agents delivered pure autoscale helpers/public integration
and focused learning lessons; the primary integrated Market Session and browser QA.
Focused failing tests preceded new helper exports, workstation controls and missing
volume presentation. No financial formatter wrapper or crosshair framework was added.

Market Session now owns timestamp-based preview/pin state, synchronized price/volume
crosshairs, bounded responsive OHLCV readouts, last-price and preceding-close guides,
All/Recent/Earlier observation windows, Auto/Manual domains and Linear/Log providers.
A deliberate missing volume observation displays an em dash while retaining OHLC.
Manual holds the current domain; +/− while a plot is focused adjusts it. Window
buttons demonstrate autoscaling and do not introduce Batch 3 navigation semantics.

Three focused public lessons are `financial-crosshair`, `financial-price-guides`
and `financial-visible-autoscale`, with corresponding self-contained minimal sources.
The Studio origin is `http://127.0.0.1:5196`; a public-entry standalone preview at
`http://127.0.0.1:5197/?example=financial-market-session` keeps the slice reviewable
while unrelated concurrent texture documentation temporarily blocks Studio reloads.

Dated focused evidence: Node 24.15.0, pnpm 11.21.0 and Playwright Chromium.
Normal source configuration passed five files / fourteen tests before concurrent
texture documentation changed. Root typecheck then encountered unrelated texture
recipe/export errors. Subsequent normal browser collection and Studio reloads
encountered missing texture API coverage/heading errors. A temporary configuration
under /tmp excludes only the documentation-build plugin to exercise the unchanged
runtime/browser settings; this is runtime evidence, not a documentation gate pass.
The transformed/clipped inspection composition selects one exact timestamp and
keeps missing volume distinct from nearest available volume. Packed Viz consumers
and core package build passed for the helper surface. Fresh standalone desktop and
touch-phone checks exercise all four examples; screenshots are retained under
/tmp/pibbl-financial-batch2. Final focused results are reported with delivery.

This milestone is slice ready for feedback, not feature complete. Aggregate trust,
broader adversarial/ownership hardening and Batch 3 remain outside this checkpoint.

Final 2026-10-09 slice verification supersedes the temporary shared blockers above:
normal repository browser configuration passes seven files / eighteen tests. Root
TypeScript, focused ESLint, public JSDoc, Studio documentation/API/search checks,
catalog validation and all 119 minimal-source registry checks pass. Eight final
Studio cases (four examples, desktop and touch-phone) pass native interaction,
editor typechecking and zero runtime errors. Final screenshots use the
`studio-financial-*` prefix under /tmp/pibbl-financial-batch2. Studio is again
available at port 5196; the port 5197 preview remains a supplementary public-entry
surface. No aggregate trust or feature-complete claim is made at this checkpoint.

### 2026-10-09 — Batch 2 accepted; commit and continuation authorized

The user approved the runnable batch and requested “Commit, please. Then continue.”
Commit the approved Batch 1 foundations and Batch 2 additions together, retaining
unrelated texture, recording, repair-evaluation and brand work outside the commit.
The next authoring review covers Batch 3 linked panes, range controls and normalized
comparison returns. Existing API-first design acceptance remains required before
production work on that batch. No push or publication is requested.

### 2026-10-12 — Batch 3 API audit and runnable slice evidence

The user conditionally approved proceeding after an API flexibility/understandability
review. Independent comparison audit recommended the proposed contracts unchanged.
One implementation agent delivered the pure transforms; another delivered the independent
learning examples. Root integrated Relative Performance Desk and Market Session navigation.
Focused failing public tests preceded production changes. Comparison rows evaluate each
eligible accessor once, keep source order and null gaps, use exact positive common bases,
and preserve finite arithmetic for extreme and near-base values without rounding.

All editable lessons use supported public imports and remain self-contained. Local UTC
month subtraction uses platform Date operations with month-end/leap-year clamping.
Calendar membership is resolved before logical slot compression. Selected timestamps,
viewport and comparison base remain independent. Numeric labels use existing formatNumber
and Intl.NumberFormat. The desk provides dark/light palettes, direct end labels, a known
Northstar gap, and an unavailable asset missing the exact common base.

Fresh Node 24.15.0 / pnpm 11.21.0 evidence: core build, repository TypeScript, focused
ESLint, public JSDoc, Studio API/search manifest and packed viz Bundler/NodeNext consumers
pass. Eight native Studio cases (four new examples on desktop and touch phone) pass
editor typechecking and interaction with no runtime errors; screenshots are under
`/tmp/pibbl-financial-batch3`. The final focused browser results are recorded below.
The broad documentation verifier encounters an unrelated unclassified repair-evaluation
README; this is not a financial API/doc failure and no aggregate trust result is claimed.
This milestone is slice ready for feedback, not feature complete.

Final focused verification: normal source configuration passes seven files / 21 tests;
built public entries pass three files / 11 tests. Eight new Studio cases and eight
existing financial Studio cases pass native desktop/touch interactions, editor
checks and zero runtime errors. Node 24.15.0 and pnpm 11.21.0 were used throughout.

### 2026-10-12 — Financial audience presentation feedback

The user requested an explanation of every new API and found the examples too
simple to be compelling for financial/scientific readers. The public additions
remain two comparison operations and three associated types; linked panes and
calendar controls compose existing public APIs.

Updated all four Batch 3 examples with numeric USD/percentage/share axes, UTC
date ticks, named instruments and simulation notes. Daily series now have
irregular moves, volatility and discrete shocks. Percentage/indexed comparisons
identify price-only returns and excluded dividends. Linked marks size to supplied
session spacing; calendar windows display observation counts rather than internal
slot coordinates. Missing closes and unavailable common bases remain visible.
Native Studio verification passes eight desktop/touch cases, editor checking and
zero runtime errors. Final focused test evidence is recorded after this iteration.

Final presentation checks: eight focused tests across three files pass in the normal
Chromium configuration. Repository typecheck, focused ESLint and catalog validation
pass. Actual desktop/phone screenshots were inspected; date/footer collisions and
crowded fixed-width marks were corrected before delivery. These are example
presentation changes; the approved public transform contracts are unchanged.

### 2026-10-12 — Calendar ticks and shared gesture viewport feedback

Calendar Windows and Relative Performance Desk now derive date ticks from the
visible supplied sessions and chart width. Application-local UTC policy uses
month labels beyond 60 days, weekly session labels beyond 10 days, and individual
session labels below that, with a width-based label budget. No timestamps are
invented across gaps. `Axis.tickValues` and `Axis.tickFormat` carry this policy;
this does not change the public trading scale tick contract.

Preset highlights derive from viewport endpoint matching rather than remembering
the last button. All equivalent presets highlight; unmatched views report Custom.
The Desk uses the same viewport for cursor-anchored wheel zoom and captured touch
pan/pinch. Native touch-action ownership restores the prior canvas style on
teardown; gestures preserve the fixed comparison base and separate inspection pin,
handle cancellation, and distinguish dragging from tap-to-pin. These remain
self-contained application examples, not new public calendar-control or gesture
controller APIs.

Fresh focused verification under Node 24.15.0 / pnpm 11.21.0 / Chromium: four
financial example/navigation test files, 16 passing tests; typecheck and targeted
ESLint passed. Studio desktop and phone checks passed for all four coordinated
examples, including editor compilation and no page errors. Real Chromium wheel,
touch drag, pinch, subsequent tap-to-pin, and preset restoration also passed.
This is a feedback-ready slice; aggregate trust has not been rerun for this change.

### 2026-10-12 — Animated navigation and interaction accepted

The user accepted the `interpolateNumericRange` helper as composition over existing
`tween`, `keyframes`, and `useAnimatedValue`, with no animation runtime changes.
Calendar Windows and Performance Desk animate discrete navigation; the Desk uses
direct wheel zoom, horizontal/Shift-wheel pan, and captured mouse/touch pan/pinch.
Pending wheel events accumulate rather than repeatedly restarting navigation from
a stale displayed range. Drag does not accidentally pin an observation. Reduced
motion, gesture takeover, animation retargeting, and teardown retain focused public
coverage. The user accepted the result and requested a commit.

Fresh proportional verification: 16 tests across the range helper, financial axis
lessons and Desk suites; Node 24.15.0 typecheck, targeted ESLint, core build and
packed viz checks passed. Native desktop mouse drag, horizontal wheel pan, vertical
wheel zoom, click suppression and animated preset restoration passed. Native touch
pan/pinch and later pinning passed. Desktop/phone Studio editor and rendering checks
passed. Aggregate trust was not run; documentation classification is blocked by an
unrelated pre-existing strategy evidence README. Next planned feature batch is
SMA, EMA, and Bollinger Bands in the Trend and Volatility showcase, with API
review before implementation.

## Batch 4 runnable slice — 2026-10-12

The user approved the three pure indicator helpers and authorized implementation.
`simpleMovingAverage`, `exponentialMovingAverage`, and `bollingerBands` preserve
source order, original datum ownership, and full-length frozen aligned outputs.
Periods require positive safe integers; missing, excluded and nonfinite values
reset consecutive-window warmup. EMA uses an SMA seed and alpha `2/(period+1)`;
bands use population standard deviation and a finite nonnegative multiplier.

The self-contained `financial-trend-volatility` Studio lesson combines 180 seeded
synthetic weekday OHLC records, price/date axes, shared inspection, independently
toggled overlays, period and multiplier controls, animated calendar navigation,
and mouse/wheel/touch navigation. Named drift and volatility regimes include a
selloff, recovery and one missing close. Simulation and population σ labeling
remain visible. Indicators are calculated before windowing, so navigation never
changes their history. The public helpers require no new rendering component or
animation scheduler.

Focused Chromium tests cover indicator values, reset/warmup, frozen alignment,
accessors and extreme finite values, plus desktop and phone readouts and controls.
Native Studio checks cover desktop drag/wheel, phone rendering and gap selection;
final verification is recorded in the delivery response. The existing learning
source validator was corrected to accept direct `easing.easeOut` member access;
a focused regression still rejects aliasing of the imported easing object.

Milestone: **slice ready for feedback**, not user acceptance or aggregate trust.
Studio URL: `http://127.0.0.1:5196/#/examples/composition/financial-trend-volatility`.
No commit, push or publication is claimed for Batch 4.

Fresh slice verification used Node 24.15.0 and pnpm 11.21.0:

- Focused Vitest Chromium run for `financial-indicators.test.ts` and
  `financial-trend-volatility.test.tsx`: 2 files, 6 tests passed.
- `node --import tsx --test tooling/learning-source-animation.test.mjs`: 2 passed.
- `pnpm typecheck`, focused ESLint, `node tooling/verify-public-jsdoc.mjs`, core
  build, and `node tooling/verify-packed-viz.mjs`: passed. Packed verification
  covers Bundler, NodeNext, runtime exports and shared core identity.
- `node --import tsx tooling/scenario-catalog.ts --write`: registered 127 lessons;
  A subsequent catalog check was blocked by concurrent `material-overlay`
  source changes (inline-props/style-spread contract); the trend source validates.
- Native Playwright source Studio inspection: desktop 1018×658 and phone
  360×260 Canvas allocations, gap selection, editor declarations, desktop
  wheel/drag and phone touch pinch passed; no page errors. Screenshots were
  inspected for candle contrast, band boundaries, values and labeled axes.
- `pnpm docs:check` remains blocked by the unrelated unclassified
  `docs/strategy/agent-verification-evidence/public-inspection-pilot-2026-10-09/README.md`.
  No aggregate trust result is claimed.

### Batch 4 acceptance and band-fill correction

The user approved and requested a commit on 2026-10-12 after reviewing the slice.
The example's original alpha-bearing fill combined with the band component's
0.2 default opacity, leaving approximately 3% effective opacity. The example now
uses an opaque purple color with explicit 0.24 dark-theme / 0.18 light-theme
opacity. A focused regression failed before the correction and now passes in
both themes; the full showcase test file has 3 passing Chromium tests. Native
Studio checks passed in desktop and phone allocations, including both themes,
with screenshots inspected. This is an example-level presentation correction,
not a change to the IntervalBandSeries default or indicator APIs.

Batch 4 is accepted with proportional focused verification. Aggregate trust
remains unclaimed because of the previously recorded unrelated shared-tree
blockers. The next proposed batch is RSI, MACD and stochastic oscillator; review
initialization, warmup, flat/zero-range conventions and linked-pane authoring with
the user before implementation.

## Batch 5 runnable slice — 2026-10-12

The user approved the exact named calculation contracts and authorized execution.
Public `@pibbl/core/viz` exports now include `relativeStrengthIndex`,
`movingAverageConvergenceDivergence` and `stochasticOscillator`, plus separate
options and source-aligned point types. All three preserve original source order,
datum ownership and indices, freeze outputs, and expose nullable numeric fields
through warmup and gaps. RSI uses Wilder smoothing after `period` price changes;
MACD uses SMA-seeded price and signal EMAs; stochastic uses rolling high/low and
SMA smoothing. Flat RSI is 50; a zero stochastic range resets smoothing but keeps
its complete OHLC row in the rolling range. Invalid finite high/low/close rejects.

Momentum Desk uses 180 seeded synthetic weekday OHLC observations, with visible
simulation labeling, selloff/recovery regimes and a missing close. Price candles
and one selected oscillator share the same supplied trading-time mapping,
inspection timestamp and animated calendar viewport. RSI has 30/70 guides;
stochastic has 20/80 guides and color-matched %K/%D labels; MACD shows two labeled
lines and a signed histogram in USD. Both panes support inspection and native
mouse/wheel/touch navigation, with a compact phone layout. Calculations occur
before windowing, preserving history during navigation. No rendering component,
public hook or scheduler was added.

Focused public tests were added before helper and showcase implementation.
Node 24.15.0 / pnpm 11.21.0 focused Chromium tests cover hand-checkable seeds and
values, gap rewarm, `defined` ordering, frozen alignment, malformed finite rows,
non-array inputs and extreme finite stochastic ranges. Showcase tests cover study
selection, phone bounds, palettes and equal recorded-time inspection from either
pane. Native source Studio checks cover all studies at desktop 1018×721 and phone
360×260 allocations, gap readouts, declarations, theme rendering, mouse wheel/drag,
oscillator-pane selection and touch pinch. Screenshots were inspected.

Milestone: **slice ready for feedback**; Batch 5 user acceptance and aggregate
trust are not claimed. Full catalog validation remains blocked by concurrent
`material-overlay` inline-props/style-spread changes; the new source validates
independently and the index was regenerated without claiming global validation.
The previously recorded unrelated document classification blocker remains.
Studio URL: `http://127.0.0.1:5196/#/examples/composition/financial-momentum-desk`.
No commit, push or publication is claimed for Batch 5.

Fresh Batch 5 results: focused Vitest Chromium run passed 2 files / 8 tests;
`pnpm typecheck`, focused ESLint, public JSDoc verification, core build and packed
viz verification passed. Packed consumers cover Bundler, NodeNext, runtime exports,
shared core identity and private boundaries. Native source Studio checks passed
for all three studies and both themes, with desktop wheel/drag and phone pinch.
Read-only review confirmed units/shared viewport/inspection; an unexposed inherited
YTD match was removed so preset status only reports selectable calendar controls.

### Batch 5 acceptance — 2026-10-12

The user approved Momentum Desk and requested a commit after hands-on review.
The previously recorded 8 focused tests, typecheck, lint, JSDoc, core build,
packed consumer and native Studio checks remain the acceptance evidence.
Batch 6 is the next proposed work: OHLC bars, a two-color baseline series, and
financial event/trade markers in Execution Journal. Public APIs require authoring
review before implementation. No aggregate trust, push or publication is claimed.

## Batch 6 runnable slice — 2026-10-12

The user approved OHLC bars, a linear two-color baseline series and event/trade
markers composed through existing PlotSeries, then authorized implementation.
Public exports now include `OhlcBarSeries`, its style/props types, and independent
`useOhlcBarInspection`, `nearestRecordedOhlcBarX`, `paintedOhlcBarAt` contracts.
Bars paint high/low stems, open ticks left and close ticks right. Missing inputs
skip; malformed finite OHLC rejects. Committed queries preserve original records,
source indices and OHLC geometry; painted results distinguish stem/openTick/closeTick.

`BaselineSeries` uses an explicit finite data-space baseline, above/below line and
fill paints, separate fillOpacity and strokeWidth, linear y mapping and numeric
continuous x mappings including trading time. Linear segment crossings split
exactly, gaps remain gaps, equal values belong to the above stroke, and synthetic
crossings never become inspection observations. Sequential pieces preserve paint
order for overlapping or unsorted observations. A stable distance ratio handles
extreme finite crossings without overflowing the interpolation denominator.

Execution Journal composes 180 seeded simulated weekday OHLC records with two
closed simulated trade lots and one open lot. B1/B2/B3 select entry-price references;
per-share mark differences exclude fees and are not portfolio returns. Bars,
Baseline and Both views share inspection and existing animated navigation.
Keyed PlotSeries buy/sell arrows and a simulated earnings diamond show exact
recorded anchors; a coincident buy/earnings pair remains separately selectable
above/below the shared price. The application owns glyphs, focusable hit regions,
selection, source order and clipping. No public marker component was added.

Milestone: **slice ready for feedback**, not Batch 6 acceptance or aggregate trust.
Node 24.15.0 / pnpm 11.21.0 focused Chromium run passed 3 files / 8 tests:
OHLC geometry/inspection (3), baseline crossings/inspection (3), and responsive
Execution Journal behavior (2). Coverage includes missing/malformed data,
transforms, clip exclusion, overlap/doji precedence, opacity-zero nearest capture,
stale/disposed generations, finite extreme crossings and trading-time mapping.
Typecheck, focused ESLint, public JSDoc, core build and packed-viz verification
passed. Packed checks cover Bundler/NodeNext, runtime exports/shared core identity
and private boundaries. Native source Studio checks passed desktop 1018×658 and
phone 360×260 rendering, both themes, mouse/wheel/pinch navigation, entry changes,
independent coincident marker selection, all three views and editor declarations.
Screenshots were inspected. Read-only review found no blocking units, clip,
selection or source-paint drift.

Full catalog validation remains blocked by concurrent `material-overlay`
inline-props/style-spread changes. Execution Journal source validates independently;
the index was regenerated without claiming global validation. The previously
recorded unrelated document classification blocker remains. No commit, push or
publication is claimed for Batch 6.
Studio URL: `http://127.0.0.1:5196/#/examples/composition/financial-execution-journal`.

### Batch 6 entry navigation correction — 2026-10-12

User feedback found that selecting an offscreen B fill changed the price range
without revealing the fill. Selection now shifts the currently displayed time
window to center an offscreen fill, preserving its logical span and using the
existing animated navigation helper. Visible fills leave the window unchanged;
centering clamps at supplied-data boundaries. The y domain is derived only from
visible OHLC, so an offscreen baseline no longer forces unrelated price-range
expansion. Its reference line renders only when it falls inside that domain.
The desktop window readout includes the session width.

A public regression failed before the correction and now passes. The focused
Execution Journal Chromium file passes 3 tests, including B1/B2 centering,
unchanged session width and repeat selection. Native Studio verification checks
an intermediate animation frame and final centered B1 geometry at the same
24-session width, with no page errors. Typecheck and focused lint pass. No public
API or scheduler change was needed; Batch 6 remains awaiting acceptance.

### Batch 6 acceptance — 2026-10-12

The user approved the entry navigation correction and authorized committing
Batch 6. Acceptance includes the public OHLC and baseline APIs, Execution
Journal, and animated offscreen-fill centering at the existing zoom span.
The focused package and browser evidence above remains current. No aggregate
trust, push or publication is claimed. Batch 7 API design remains pending review.

Final acceptance rerun on Node 24.15.0 / pnpm 11.21.0: the combined OHLC,
baseline and Execution Journal Chromium suite passed 3 files / 9 tests.

## Batch 7 runnable slice — 2026-10-12

The user approved `aggregateOhlcv` and `sessionVwap`, with existing signals owning
live feed updates. Pure helpers are implemented through the supported viz entry.
Aggregation preserves OHLC extrema, volume and original contributing records;
VWAP is source aligned and resets on session changes, including excluded boundary
records. Caller-defined half-open buckets, price and session accessors make the
financial assumptions explicit. Session properties are also accepted alongside
callbacks, with one fixed return contract.

Live Market Monitor replays two deterministic simulated UTC intraday sessions,
including an opening volume burst, a selloff and recovery. Four partial updates
per minute reveal the current bar without future extrema; the last replay update
completes the final record. The application owns one cleanup-managed interval,
play/pause/step/reset and bounded two-session retention. It adds no animation loop.
One minute-based trading viewport persists across 1m/5m/15m aggregation. Direct
wheel/drag/pinch suspends follow; Follow animates back at the current span. VWAP
uses the full minute source before display aggregation, with its approximation
labeled. Price and volume share navigation; original aggregate sources remain
inspectable. Replay starts paused for intentional inspection.

Milestone: **slice ready for feedback**, pending hands-on acceptance and broader
hardening. Node 24.15.0 / pnpm 11.21.0 Chromium tests passed 2 files / 6 tests.
Typecheck, focused ESLint, public JSDoc, core build and packed-viz verification
passed. Packed evidence covers Bundler/NodeNext consumers, runtime exports,
shared identity and private boundaries. Public source validation passed.
Browser plugin was unavailable; native Playwright Chromium checked dark/light,
desktop 1018×658 and phone 360×300, timeframe/window preservation, native wheel,
drag and touch pinch, replay while browsing, animated Follow at the same span,
and no page errors. Screenshots were inspected. Public Studio declarations and
minimal examples include both APIs. No aggregate trust, commit, push or publication
is claimed.

Studio: `http://127.0.0.1:5196/#/examples/composition/financial-live-monitor`.

### Batch 7 replay visibility correction — 2026-10-12

User feedback found Play and Step visually imperceptible. Native inspection proved
the feed was advancing, but five-minute candles took fourteen seconds to append.
Play now advances thirty simulated seconds every 150ms (200× replay); Step pauses
and advances to the next displayed-candle boundary. A seconds-resolution replay
clock, explicit speed/Step labels, expanded VWAP explanation and latest-price
horizontal guide make progress visible. Viewport span, animated following and
native mouse/touch navigation remain unchanged.

The focused public regression failed before the correction and passes afterward;
the monitor file now has 3 passing tests. Native Chromium checks confirm wheel,
drag, pinch, replay while browsing, animated Follow at the same span, and both
palettes/phone layout. Focused lint passes. Fresh aggregate typecheck is temporarily
blocked by concurrent interval-series tests referring to unfinished public exports;
this work's timer-mock typing was corrected independently. No aggregate trust or
commit is claimed.

### Batch 7 animated replay and stable ticks — 2026-10-12

User feedback requested animated playing data and X-axis ticks that move with the
axis. The presented replay tick now uses existing numeric useAnimatedValue/tween
(linear, 150ms), and snapshot derives partial candle, volume, VWAP and price-guide
values from that interpolated position. Feed targets remain discrete; no new
public API or animation loop was added. Reset adopts the initial feed directly,
and reduced-motion preferences disable data tweening alongside navigation.
Clock-aligned ticks select a fixed interval from the visible span/label budget;
the same time stays attached to the same data coordinate as navigation scrolls.
The policy only changes granularity when span changes, not at each moving endpoint.

A stable-tick regression failed before implementation. Four focused Chromium
monitor tests pass, including fixed-time tick displacement and intermediate replay
samples with reduced motion disabled. Typecheck and focused lint pass. Native
Chromium navigation checks still pass for mouse/wheel/pinch, replay while browsing,
animated following, desktop/phone and both themes. Native intermediate-frame
checks verify the same clock tick travels with the axis and feed values animate.
No aggregate trust, commit or acceptance is claimed.

### Batch 7 tick flicker and direct volume — 2026-10-12

Native feedback identified flicker at tick-spacing boundaries. A focused mobile
30-minute-follow regression reproduced alternation between ten- and fifteen-minute
ticks from floating-point span subtraction. Interval selection now rounds tiny
spacing noise; explicit sparse clock ticks render without the Axis endpoint-priority
label suppression pass. Tick identities persist during translation; zoom can still
change granularity. No generic Axis behavior or public API changed.

The user also requested that volume bars stop animating from zero. Volume now
aggregates received feed snapshots directly, uses a matching direct extent/readout,
and shares only horizontal navigation with the price chart. Candles/VWAP/price
presentation continue to interpolate. A failing volume regression now passes,
checking received volume stays constant through intermediate price frames.
Five focused monitor tests, fresh typecheck and focused lint pass. Native mobile
replay sampling checks tick continuity without page errors. No commit or aggregate
trust is claimed.

The user requested a slightly slower simulation after these corrections. Replay
now advances thirty simulated seconds every 250ms (120×), with a matching 250ms
price tween. Volume remains direct and horizontal navigation retains its existing
180ms duration.

### Batch 7 acceptance — 2026-10-12

The user approved Live Market Monitor after replay cadence, animation, stable tick
and direct-volume refinements and requested a commit. The accepted replay cadence
is 250ms / thirty simulated seconds (120×), with 250ms price interpolation and
direct volume updates. Previous typecheck and packed/browser evidence remains
current; focused acceptance tests cover both data helpers and all monitor fixes.
Batch 8 is proposed next; its public editing/navigation APIs require user review.
No aggregate trust, push or publication is claimed.

Final acceptance rerun: Node 24.15.0 / pnpm 11.21.0 focused Chromium suite
passed 2 files / 9 tests. Read-only final review found no material contract,
lifecycle or numeric blocker.

## Batch 8 approved slice — 2026-10-12

The user approved controlled RangeNavigator, EditableReferenceLine,
EditableReferenceBand and EditableTrendLine APIs, including explicit draft/change,
commit and cancellation callbacks. Research Workspace composes the navigator over
full history and retains existing animated preset navigation and direct wheel,
drag and touch gestures. The application owns drawing creation, selection, Undo
and deletion. The first slice uses supplied trading-time observations for x and
linear USD price for y; trend endpoints snap to supplied observations.

Slice ready for feedback at `http://127.0.0.1:5196/#/examples/composition/financial-research-workspace`.
The user then requested integration of all this thread's visualization work into
main after completing the slice.

Fresh Node 24.15.0 / pnpm 11.21.0 Chromium checks pass: two focused files / fourteen
tests. Native browser checks cover drawing drag, Escape rollback, Undo, two-click
zone/trend creation, navigator move/resize, wheel zoom, chart pan and touch pinch.
Dark/light/phone renders were inspected. Core build, public JSDoc and scoped lint
pass; packed viz Bundler/NodeNext and runtime-boundary checks pass. Review-driven
regressions cover capture loss, second-pointer ownership, frozen mappings,
nonlinear mapped panning, minimum-span validation and weekend keyboard navigation.
Offscreen annotations retain their values through the Shock window; navigator
values alone are bounded by the full-history domain.

The merge is prepared separately from interleaved texture, branding and evaluation
work. Combined verification is recorded after integration; no push or publication
is claimed here.

### Main integration verification — 2026-10-12

The eight approved financial visualization batches were replayed onto main in an
isolated checkout, excluding interleaved texture, branding and evaluation work.
Integration reconciled the lesson catalog and completed compilable API/minimal
examples, including explicit public OHLC inspection and indicator-option coverage.

Fresh Node 24.15.0 / pnpm 11.21.0 / Chromium evidence: source and built visualization
suites each pass 100 files / 484 tests (two skipped); `trust:lifecycle` passes its
nine-file / 63-test ownership suite and six-file / 48-test structural performance
suite (four opt-in checks skipped). Typecheck, full lint, documentation checks
(including 100 compiler-checked API programs), packed visualization Bundler/NodeNext
consumers, Studio build and website build pass. Native Research Workspace editing,
rollback, Undo, navigator resizing and touch zoom also pass. The complete aggregate
trust command is not claimed: verification used these proportional checks after
repairing documentation and minimal-example failures discovered by its static gate.

The user authorized merging all visualization work in this thread into local main.
Main's unrelated recording changes are backed up and preserved during integration.
The broad browser run also exposed stale catalog inventories; the focused catalog
suite passes all 277 tests after adding the approved routes and public API tags.
The full browser gate was not rerun after that metadata correction.
No remote push or publication is included.
