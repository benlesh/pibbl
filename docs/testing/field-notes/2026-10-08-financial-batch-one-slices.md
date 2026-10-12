# Financial Batch 1 — runnable slices, 2026-10-08

> **Historical status: Dated financial visualization verification record; later approvals and current executable tests define the shipped state.**

Milestone: **slice ready for feedback**, not feature complete. Approved designs:
TradingTimeScale, named candle body/wick authoring, time-aligned VolumeSeries and
optional typed candle/volume capture on the existing inspection foundation.
Batch 0 was committed as `0ad33084`; Batch 1 remains uncommitted. Unrelated brand
and agent-verification work is preserved.

## Running Studio and review procedure

Source Studio is running at `http://127.0.0.1:5176/`.

- [Market Session](http://127.0.0.1:5176/#/examples/composition/financial-market-session):
  labeled deterministic OHLCV in USD/shares, high/low price extent, candles, closing
  line, custom marker and aligned volume on one trading-time mapping. Tap a candle
  body or wick for captured OHLC; tap a volume column for its original row. Focus
  volume and use left/right arrows. Inspect portrait readability and date endpoints.
- [Candles](http://127.0.0.1:5176/#/examples/composition/financial-candles):
  rising/falling candles and two dojis. Tap body/wick/gap; focus the plot and press
  Enter to select the first recorded candle without pointer synthesis.
- [Trading time](http://127.0.0.1:5176/#/examples/composition/financial-trading-time):
  Friday/Monday/Tuesday remain equally spaced despite elapsed UTC gaps. Pan by
  half a slot with click/tap or right arrow; plot clipping is application composition.
- [Volume](http://127.0.0.1:5176/#/examples/composition/financial-volume):
  five labeled deterministic volumes on elapsed UTC time, with an explicit zero baseline.

Complete minimal programs are registered under `docs/site/minimal/viz/`:
`financial-candles.tsx`, `financial-candle-inspection.tsx`,
`financial-trading-time.tsx`, `financial-volume.tsx`, and
`financial-volume-inspection.tsx`. Public API documentation is
`docs/site/api/functions/financial-series.md`; Studio declarations include every
new runtime export and public type.

## Observable contracts and implementation evidence

Focused red tests preceded pure geometry, trading mapping, candle and volume
production. The shared showcase test initially failed on its missing OHLC/equal
slot presentation, then passed after integration. Calculations were delegated
independently; primary retained public integration and showcase ownership.

Trading timestamps are copied, strictly increasing unique safe-integer UTC
milliseconds. Exact unknown timestamp mapping rejects; exact slot/time misses
return undefined. Physical inversion exposes fractional slots or separately named
nearest supplied time, ties earlier, clamped at endpoints. A controlled fractional
viewport implements pan/zoom; adding the inserted observation count to endpoints
preserves an application-selected anchor when prepending. There is no inferred
calendar, interpolated UTC timestamp, hidden viewport state or subscription.

Renderers preserve source order and original data, skip missing/nonfinite complete
marks, reject finite malformed OHLC and negative volume, and evaluate accessors
once per row. Dojis have one local logical unit of height. Financial paint uses
ordinary Path/Group events; renderer imports of inspection are erased type imports.
Equal styles batch only when horizontal paint extents are disjoint. Duplicate or
overlapping translucent marks split batches; a focused pixel assertion established
source-over accumulation before the batching fix. Conservative interval bounds
avoid a spatial index and keep traversal linear.

Optional captures preserve source indices, original typed records, evaluated OHLC
or volume and local/root bounds/anchors. Existing generation ownership, world
transforms, clipping and handler memoization are reused. Query results expire on
replacement/disposal; source mutation alone does not rewrite captured values.
Nearest selection and reverse-source painted coverage remain distinct. Body paints
after wick; zero-length wick and zero-height volume have no painted coverage.
Review of the changed batching and lookup paths found no remaining material issue.

## Fresh verification

Environment: Node **24.19.0**, pnpm **11.21.0**, Playwright Chromium. Prefix commands
with the configured Node 24 runtime directory on this machine. The Browser plugin
is unavailable, so regular Playwright drives the actual Studio examples.

- `pnpm exec vitest run packages/core/test/features/viz --browser.headless --browser.ui=false`:
  **78 files / 393 tests passed; 2 files / 2 tests skipped**.
- Built public entries: `vitest run` for candle renderer/inspection, volume renderer,
  trading provider and market showcase, with `--mode built --browser.headless --browser.ui=false`:
  **5 files / 7 tests passed**, including signal replacement, stale generations and disposal.
- Final changed examples/viewport/signals: candle renderer, trading provider and
  trading/market lessons in source mode: **4 files / 5 tests passed**. The final
  endpoint-caption geometry check passed **1 file / 1 test**.
- `node tooling/verify-financial-studio.mjs`: **8 cases passed** — all four URLs on
  desktop and touch portrait, native inputs, semantic readouts, no page errors and
  no TypeScript editor issues. Canvas PNGs under `/tmp/pibbl-financial-evidence/`
  were inspected after geometry assertions. They are evidence, not rewritten baselines.
- Core package build, root `tsc --noEmit`, focused ESLint: passed.
- `node tooling/verify-studio-pivot.mjs`: exact source/built/editor public export
  parity and runtime integration passed.
- `node tooling/verify-packed-viz.mjs`: actual packed exports, private boundaries,
  shared core identity and all five financial programs in Bundler/NodeNext passed.
- `node tooling/verify-inspection-bundles.mjs`: rendering, including candle/volume/
  trading exports, excludes inspection implementation modules; standalone nearest-x
  remains 832 bytes and excludes optional capture/handler/painted-query capabilities.
- `node tooling/verify-public-jsdoc.mjs`: passed (50 entries, 1203 declarations).
- Minimal registry plus strict website coverage/program compilation: **4 tests passed**.
- Catalog source validation/write: **116 lessons**, 12 tutorial snapshots and 33 labs.

## Failed approaches and limits

A numeric nearest-query view initially lacked an anchor conversion; replacing it
with captured time/value mapping fixed volume selection. Compound rectangle paths
initially merged overlapping translucent columns; focused source-over evidence
required overlap-aware batch boundaries. A module-level native Path2D broke the
Node catalog importer; mount-owned `useConst` now creates the clip lazily. Studio
bundles needed restart after new public renderers; the current running origin has
all three. Screenshotting the scrolled canvas included Studio's sticky chrome;
exporting the actual canvas pixels avoids that overlay without altering pixels.

These are feedback slices. Full crosshair/pinning, financial price formatting,
visible-window autoscaling, exchange-calendar policies and gesture navigation are
later batches. Logical viewport zoom/prepend are explicitly tested; the lesson
exposes a half-slot pan control. Legacy HoverData retains numeric continuous scale
semantics; trading inspection uses explicit captured APIs. The broader reversed/
clipped/cached-Layer financial edge matrix and aggregate trust gate await feedback.
Historical unrelated aggregate blockers are not claimed as a fresh trust result.
A current whole-tree whitespace check also encounters the unrelated brand PDF;
that file is preserved. No visual baselines were changed.

Single next step: review this three-feature batch and incorporate user feedback
before broader hardening or proposing Batch 2's blocking designs.
