# Financial interactive presentation feedback — 2026-10-08

> **Historical status: Dated financial visualization verification record; later approvals and current executable tests define the shipped state.**

User requested a more compelling, professional revision with mouse interaction,
after reviewing the first presentation pass. This revises the same four Batch 1
examples; public APIs and the three-feature limit are unchanged. Batch 2 remains
pending feedback.

## Reference and implementation

Inspected the actual rendered first financial chart on the official
[TradingView Lightweight Charts showcase](https://www.tradingview.com/lightweight-charts/),
including its dense candlestick window, restrained axes, dark surface and subtle
red/green direction encoding. The captured chart was 990×272 CSS pixels. This is
visual comparison and design judgment, not a measured popularity claim.

The former examples mounted small fixed canvases that Studio enlarged on desktop.
They now use the supported responsive viewport and layout allocation, keeping
text and marks at readable CSS sizes. Market Session supplies 56 deterministic
weekdays with several price regimes, aligned candle/closing-line/custom-mark and
volume geometry, independent price/volume axes, a shared selected-observation band
and compact OHLCV readouts. The standalone candle lesson supplies 48 observations;
its learning minimal program remains small.

Native movement executes optional lazy inspection and updates the readout.
Candles distinguish nearest observation selection from painted body/wick lookup;
Market Session clicks select painted marks. Touch selection and keyboard stepping
remain supported. Trading-time keeps the accepted explicit half-slot pan recipe.
There are no new public crosshair, tooltip, navigation or financial event APIs.
All observations are clearly labeled deterministic simulation.

## Evidence

Environment: Node 24.19.0, pnpm 11.21.0, Playwright Chromium. Browser plugin absent;
regular Playwright drives Studio. Focused public tests were updated red-first for
responsive geometry, live native inspection and no outstanding work after disposal.
Measured text bounds precede visual evidence. The candle fixture spans
98.02–110.80; its deliberately padded display domain is 96–112. Half-day UTC
padding keeps edge marks inside the plot. Trading-time has a compact 760×300
catalog allocation and a 100–105 price domain; the focused axis assertion failed
before that presentation change.

Fresh verification after the final changes:

- `corepack pnpm@11.21.0 exec vitest run packages/core/test/features/viz/financial-session.test.ts packages/core/test/features/viz/trading-time-lesson.test.ts packages/core/test/features/viz/financial-presentation.test.ts --browser.headless --browser.ui=false`: **3 files / 3 tests passed**.
- `node tooling/verify-financial-studio.mjs`: **8 cases passed**, native desktop
  hover and portrait touch, click/tap and keyboard selection/pan, no page errors
  and no Studio TypeScript issues. Actual canvases: 982×569 candles/volume,
  982×388 trading-time, 982×594 Market Session, and 360×260 portrait.
- `corepack pnpm@11.21.0 exec tsc --noEmit`: passed.
- Focused ESLint over all four examples, three focused tests and the verifier:
  passed. `node --import tsx tooling/scenario-catalog.ts --write`: 116 lessons,
  12 tutorial snapshots and 33 labs validated.
- One reused agent implemented independent candle/volume refinements and reviewed
  primary integration/verifier code; no material blockers remained. A transient
  test-harness failure came from replacing the realm's shared RAF with one map
  per concurrent mount; one shared frame map fixed the harness.
- Fresh desktop and portrait PNGs were inspected for all four examples. Wicks
  extending outside the old domain and clipped edge bars were corrected.

Running review links:

- http://127.0.0.1:5176/#/examples/composition/financial-market-session
- http://127.0.0.1:5176/#/examples/composition/financial-candles
- http://127.0.0.1:5176/#/examples/composition/financial-volume
- http://127.0.0.1:5176/#/examples/composition/financial-trading-time

No visual baseline was rewritten. Reference and example captures are outside the
repository under `/tmp/pibbl-financial-evidence/`. Unrelated work is preserved.
No commit, push or publication was performed.

Review the live readouts while moving across plots, candle body/wick clicks,
shared price/volume selection, half-slot pan, arrow keys and portrait layout.
This is **slice ready for feedback**, not feature complete. Full trust verification,
Safari/Firefox and mobile landscape are deferred until feedback.

## Light/dark feedback revision

The user liked the revised presentation and requested a light/dark toggle. Added
a top-right ordinary focusable Canvas target to all four lessons. Dark remains
the default; light uses a #f6f8fb outer surface, white plots, darker text and
direction colors, and a pale shared highlight. A mount-owned signal controls the
palette with no subscriptions or persistence. Original data, selections and
viewport state are retained. Each standalone Studio source includes its own
small palette; no relative helper imports are required.

Focused red-first evidence expected the toggle label and changed background
through the actual public mounts, then checked Enter restores dark. Final
`corepack pnpm@11.21.0 exec vitest run` for the same three financial files with
`--browser.headless --browser.ui=false`: **3 files / 4 tests passed**. The keyboard
fixture was corrected to use a cancelable native-shaped event so preventDefault
suppresses the focus manager's default activation instead of toggling twice.
`node tooling/verify-financial-studio.mjs`: **8 cases passed**, each exercising
both palettes and Space activation, existing desktop hover/mobile selection,
keyboard navigation and Studio editor types. Root `tsc --noEmit` and focused
ESLint passed. Light desktop/portrait captures were inspected for all four
examples. No visual baseline changes or commit/push/publish.

The palette choice resets when the example is remounted. This is a lesson-owned
control, not a Studio-wide theme preference. Browser coverage remains Chromium.
The single next step is feedback on the existing Batch 1 slices.
