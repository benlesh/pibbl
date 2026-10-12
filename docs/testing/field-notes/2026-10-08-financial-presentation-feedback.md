# Financial presentation feedback — 2026-10-08

> **Historical status: Dated financial visualization verification record; later approvals and current executable tests define the shipped state.**

User feedback: the first financial examples looked unprofessional/childish.
Requested contemporary-library reference research, revisions and visible results.
This pass changes only the four existing Batch 1 learning examples and focused
presentation evidence. Public financial APIs, deterministic source-record semantics, ownership and
inspection contracts are retained; no Batch 2 features are introduced.

## References and visual decisions

Reviewed official examples:

- [TradingView Lightweight Charts price/volume](https://tradingview.github.io/lightweight-charts/tutorials/how_to/price-and-volume)
- [Highcharts two-pane candlestick/volume](https://www.highcharts.com/demo/stock/candlestick-and-volume)
- [amCharts candlesticks/volume](https://www.amcharts.com/demos/stock-chart-candlesticks/)

Inspected the rendered TradingView example in its iframe, including its actual
canvas axes, narrow histogram and neutral background. Highcharts' surrounding page
and documentation were accessible, but its direct live demo did not render chart
content in the reference browser; no visual comparison to that live chart is claimed.

Adopted compact typography, white plots, restrained green/red direction encoding,
neutral-blue standalone volume, thin grid/separator lines, monospaced numeric axes,
small independent volume/price labels and narrower marks. Context remains explicitly
simulated. Market Session retains the closing line/custom marker alignment proof and expands
its deterministic window to forty supplied weekdays, with four-local-unit candles
and volume columns. Existing original-row click/keyboard evidence is updated to
assert the new explicit positions before the data-window change.
Trading-time uses an understated pan control and avoids orphaned offscreen label
fragments. Plot reading and teaching goals remain independent in each lesson.

Reference mismatch ledger: the original warm backgrounds, oversized headings,
heavy columns and sparse isolated price labels were removed. The reference contains
many historical records and full chart interaction features; these lessons preserve
their small deterministic fixtures and existing supported APIs rather than imply
unimplemented trading functionality.

## Fresh evidence

Environment: Node 24.19.0, pnpm 11.21.0, Playwright Chromium. Browser plugin absent;
regular Playwright drives the actual Studio sandbox. The data-visualization and
frontend-testing skills informed the work; repository thin-slice sequencing takes
precedence over a separate concept-approval ceremony for the requested example polish.

- Focused red-first public showcase assertions failed on missing numeric price
  ticks and instrument/timeframe context, then passed after presentation changes.
- Delegated volume/candle presentation test uses the actual public mount functions.
  A measured-label-bound assertion failed on a volume tick at x=-3.32; moving numeric
  labels to right gutters fixed the clipping. Every label in both lessons is checked
  against transformed canvas bounds.
- Visual review found a white interactive target covering the candle grid. A focused
  pixel assertion failed first, then passed after making that target transparent.
  This preserves its ordinary event geometry and source paint order.
- `pnpm exec vitest run` for `financial-session.test.ts`,
  `trading-time-lesson.test.ts` and `financial-presentation.test.ts`, with
  `--browser.headless --browser.ui=false`: **3 files / 3 tests passed**.
- `node tooling/verify-financial-studio.mjs`: **8 cases passed**, all four examples
  at desktop 1400×1000 and touch portrait 390×844; native click/tap, arrow and Enter
  update real readouts, TypeScript editor reports no issues, no page errors.
- Root `tsc --noEmit`, focused ESLint and catalog validation passed. Catalog remains
  116 lessons, 12 tutorial snapshots and 33 labs.
- Fresh rendered PNGs are outside the repo at `/tmp/pibbl-financial-evidence/`.
  Semantic/geometry evidence precedes visual inspection; no visual baselines changed.

## Review links

- http://127.0.0.1:5176/#/examples/composition/financial-market-session
- http://127.0.0.1:5176/#/examples/composition/financial-volume
- http://127.0.0.1:5176/#/examples/composition/financial-candles
- http://127.0.0.1:5176/#/examples/composition/financial-trading-time

Verify restrained hierarchy, readable numeric axes, thin marks, price/volume
alignment, candle body/wick/gap readouts, volume keyboard stepping and half-slot
pan without clipped label fragments. Safari/Firefox and mobile landscape were not
rechecked for this presentation pass. Full financial hardening and aggregate trust
are not claimed. Unrelated changes are preserved; no commit/push/publish performed.

Single next step: user feedback on this revised three-feature batch.
