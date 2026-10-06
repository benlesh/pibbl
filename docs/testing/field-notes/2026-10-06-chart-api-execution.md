# Chart API execution evidence — 2026-10-06

> **Historical status: Dated implementation and verification evidence; current code and public contracts define shipped behavior.**

Owner: [Plan 007](../../project-plans/007-visualization-charting.md).
This is a running evidence record, not a completion claim.

## Baseline and environment

Started from clean shared checkout at `f724a56e`. No commits, merges, pushes,
or publishing are authorized. Runtime verification uses Node 24.15.0 from the
installed fnm distribution, pnpm 11.21.0, and Playwright Chromium. The default
shell uses Node 26.9.0, so verification commands explicitly prepend the Node 24
installation to PATH.

Initial sandboxed checks failed before tests because localhost/IPC listeners
were denied (`EPERM`). Retried through approved execution outside the sandbox;
this is an environment restriction, not a product failure.

## F0 foundation verification

- Fresh source: `corepack pnpm@11.21.0 exec vitest run packages/core/test/features/viz --browser.headless --browser.ui=false`: 221 passed, 2 skipped.
- Fresh built: the same command with `--mode built`: 221 passed, 2 skipped.
- Skips: opt-in `VITE_PIBBL_VIZ_STRUCTURE` pie structural comparison and
  `VITE_PIBBL_VIZ_PERF` timing workloads. No functional test is skipped.
- Baseline aggregate `corepack pnpm@11.21.0 trust` passed (exit 0), including
  static, packed consumers, 25 browser shards, Studio docs, visual safeguards,
  website/minimal demos, lifecycle, performance, and native reproducibility.
  This certifies the starting implementation, not subsequent chart additions.
- Read-only audit confirmed removed ChartText/LegendItem/generic hooks are absent
  from production, built output, Studio declarations, minimal demos, and public
  docs. Updated stale scale inventories to include all six shipped families.
- Real Studio editor previews run on `http://127.0.0.1:5198`. Browser plugin is
  unavailable; repository Playwright is used. Preview content is in a sandboxed
  iframe; editor canvases are not chart evidence.
- Inspected Census, NASA, NOAA climate, and long-label examples across
  1000×640, 560×300, 360×300, 320×260, and 360×640 allocations. Initial wide
  captures clipped against the Studio host at a 1280px viewport; use 1800px
  viewport for wide captures. No chart runtime errors were reported.
- Found a real acceptance gap: long-label chart hides intermediate month labels
  at narrow/shallow sizes. The test-first correction now passes five allocation
  cases, retaining all six concise month identities, full selected readouts,
  attribution, and measured category/source nonoverlap.

## M1 design decision and red evidence

`AreaSeries` adds missing scale-derived baseline closure. It requires an explicit
finite numeric baseline, uses continuous x/y scales, preserves authored order,
and splits missing/nonfinite/excluded rows into runs. Runs of one observation
produce no area. The baseline is mapped in data space; there is no assumed log
zero. One core Path owns normal events; callers opt out with pointerEvents and
own clipping. Compose LineSeries for the observed outline.

Focused public test failed before implementation because `AreaSeries` is not
exported. It specifies independent trapezoid coordinates, a missing-data split,
isolated-point omission, signal baseline updates, and disposal. The first demo
uses archived NOAA 1980 monthly means and explicitly explains that the fill is
distance above a chosen reference, not cumulative emissions. A June-omission
control is labeled as a demonstration filter, never a missing NOAA observation.

## M1 hardened evidence

- Source: 6 geometry/edge tests plus 5 real-example tests pass.
- Built: area geometry, example, and corrected long-label suite: 16 passed.
- Cases cover UTC/log/symlog, reversal, crossings/duplicates/empty runs, signal
  replacement, transformed Clip/hit gaps, invalid-input cleanup, native keyboard,
  touch, and text bounds. Review found no material issue.
- Packed Bundler/NodeNext consumers and Studio source/built/editor parity pass;
  documentation and public JSDoc checks pass. Public type probes require the
  baseline and reject string coordinate fields. Minimal website demo registered.
- Actual Studio preview inspected at five allocations; June omission exercised
  and screenshot inspected. Provisional visual acceptance by this agent.

## M2 observed-range decisions and data

NOAA/NCEI daily-summaries metric endpoint was retrieved and all twelve TMIN/TMAX
pairs independently checked on 2026-10-06. Station USW00094728 is NY City Central
Park per [NCEI station metadata](https://www.ncei.noaa.gov/cdo-web/datasets/GHCND/stations/GHCND%3AUSW00094728/detail).
Daily minima/maxima describe observed temperature extremes, never confidence or
prediction. Metric endpoint values require no conversion. All temperature flags
are `,,W`: blank measurement/quality flags, WBAN source. Inline offline snapshots
and exact query URL live in the editable example and minimal source. NCEI's
[open-data policy](https://www.ncei.noaa.gov/sites/default/files/2023-12/NCEI%20PD-10-2-02%20-%20Open%20Data%20Policy%20Signed.pdf)
describes federal environmental data as public domain in the US; credit NOAA/NCEI.

IntervalBandSeries has explicit x/lower/upper accessors, one fixed return contract,
continuous scales, paired missingness, >=2-point runs, and indexed errors for
lower > upper. It shares AreaSeriesStyle without adding a redundant style API.
A missing-export red test preceded implementation; independent upper/lower polygon
coordinates now pass. Five responsive real-example interaction checks pass.
Studio requires a restart after adding a public runtime export; hot-reloading the
catalog alone left a stale bundle and produced an undefined-component weak-map
error. This was observed in the real editor and is not counted as successful QA.

M2 source hardening now passes six tests plus five real-example cases. Read-only
review found no material issue. After refreshing Studio's runtime bundle, all
five actual preview allocations render the complete chart with no page errors.
Public types, documentation/JSDoc, packed consumers, and editor parity pass.

## M3 curve contract decision

Keep the existing omitted/`"linear"` behavior. Add named immutable definitions
`stepBefore()`, `stepAfter()`, and `stepMidpoint()`, all returning one opaque
`SeriesCurve` type; no family-selector strings or argument-dependent returns.
Line, area, and band accept these definitions in their existing/new `curve`
property. Definitions build geometry, not observations. Numeric `interpolateX`
retains its existing linear-estimate semantics; demos inspect observed rows.

For interval fills the lower boundary reverses the generated forward geometry,
not the input rows before applying a strategy. This keeps both step boundaries'
jump locations aligned. Before jumps at the prior x, after at the next x, and
midpoint halfway between. Missing rows still break runs; authored order remains.

The first step demo uses Federal Reserve 2022 target-range policy changes, with
published next-day effective calendar dates. UTC positions represent days, not
intraday announcements. Only stepAfter depicts the held policy; before/midpoint
are explicitly labeled geometry illustrations. Source:
[Federal Reserve 2022 policy record](https://www.federalreserve.gov/publications/2022-ar-record-of-policy-actions-of-the-board-of-governors.htm).
A focused missing-export red test establishes exact mapped jump coordinates.

## M2/M3 hardened evidence

Built interval/step geometry and real demos: 23 tests passed. Source step hardening
passes seven tests, including authored duplicates/descending coordinates, missing
runs, forged definitions, reactive replacement, and teardown. Actual policy Studio
preview inspected at all five allocations without page errors. Source and built
bundles exclude unused step algorithms, including all steps from plain marks.
Editor export parity and typecheck pass. Review found and corrected a stale guide
claim that curves were linear-only; no material step runtime defect was found.

Shared checkout advanced independently to `c321a83c` (Brick Climb website work);
that unrelated commit is preserved. This task has made no commit.

## M4 decision and red evidence

`monotoneX()` uses the same opaque definition contract. Strict mapped x ordering
is required per contiguous run, ascending or descending; duplicates and direction
changes reject. A public missing-export red test specifies cubic endpoint geometry,
zero slope at a local extremum, and no overshoot. Inspection remains nearest
observed data. For interval bands, analytical cubic-difference extrema validation
will reject an interior crossing rather than sampling, clipping, or adjusting it.

## M4/M5 hardened evidence

Source M4 has six tests including independent bound-crossing fixture, descending
and nonlinear mapping, flats/gaps, equal bounds and reactive cleanup. Tests caught
a tiny-range root-degeneracy defect; difference controls are now normalized before
solving derivative roots, with stable quadratic roots and documented relative
tangency tolerance. Review accepted this correction.

M5 extends existing Line/Point/Plot props through SeriesAccessor without widening
numeric LineAccessor/PointAccessor query contracts. PointScale preserves number
versus string identity, rejects unknown categories, and maps nested/reversed
positions. Six focused tests pass; five responsive real-example tests pass.
Source series regression batch passed 15 tests. M4/M5 built geometry plus examples
passed 22. Packed Bundler/NodeNext, editor parity, typecheck, and public JSDoc pass.
Source/built curve tree shaking independently excludes unused step/monotone code.
Actual Studio previews of both examples were inspected at all five allocations.

M6 begins with explicit recipes rather than another renderer or hidden transform.
Existing illustrative cash-flow stacks remain labeled illustrations; this task
adds an attributed measured-data composition and tests its arithmetic separately.

## M6 explicit recipes

Existing signed cash-flow examples already demonstrate independent positive and
negative accumulation but are illustrative and desktop-oriented. Added a measured
Census three-state example rather than relabeling that data. Independently checked
Vintage 2023 Table 1 values and dates: 2020 is estimates base, not a Census count.
Totals CA+TX+FL are 90,221,887 / 91,315,985 / 92,079,220 for 2020/2022/2023.
Normalization uses exactly those denominators; negative/nonfinite rows reject.
The local threshold recipe splits NOAA linear geometry at shared crossing vertices
while inspection remains tied to original observations. No new library API is needed.

Actual Studio inspection caught a module-boundary issue: lessons permit exactly
one default mount export, so exporting app-local helpers for tests prevents the
preview from compiling. The recipes now test via default mount and observations
rather than expanding the supported lesson module shape.

## I3 interaction design before implementation

The first controlled brush is a UTC overview composition, not a new public brush
or selection manager. The scene owns committed domain endpoints; an active drag
owns a separate draft and starting domain. Pointer-up commits; Escape, cancellation,
native capture loss, resize, or an external committed-domain change discards the
draft. Target removal/disposal releases native capture through core ownership.
A single focusable overview hit region chooses the nearest endpoint within 22px,
otherwise moves the selected span or recenters it on an outside tap. Endpoint
hit regions may overlap; nearest distance wins with the start endpoint winning ties.

Endpoints clamp to the full data extent and retain at least 30 UTC days. Dragging
past the opposite endpoint clamps, never swaps roles. Keyboard Left/Right pans
by 30 days, Shift+Left/Right adjusts the end, Home resets to full extent, and Escape
cancels. Visible text states committed versus draft dates. Touch uses native
pointer capture; the owned Canvas uses touch-action:none and restores its prior
value on disposal. There are no document-global handlers or extra frame loops.

## M6 / I1 preview and focused evidence

M6 default-mount tests: population arithmetic and responsive/input cases 7 passed;
threshold recipe arithmetic plus responsive/input cases 6 passed. Real Studio
previews for both rendered at all five allocations without errors. Threshold's
mount configuration also had to use a named type to satisfy the existing source
adapter; the signature now follows the canonical lesson contract. No adapter
capability was changed to accommodate these lessons.

I1 first slice passed six focused checks (including five allocations and data
replacement). Real Studio preview inspected at all five allocations. Pinning and
second-plot coordination are subsequent I2 work, not claimed by that first slice.

I3 native test caught fractional-millisecond endpoints and press-to-focus
suppression: gesture results now round UTC endpoints, and pointer-down retains
normal focus admission. Seven focused checks passed after a test-first correction
for a drag that continues from an outside-tap recenter. Review required consistent
external-domain validation and broader native cancellation/teardown evidence.
Compact visual inspection also found axis/overview text overlap; detail height
was reduced by 10px to preserve the required annotation gap.

## I4 proposed coordinate operations

The brush composition keeps application-owned gesture state. Pan/zoom adds two
pure named operations, `panDomain` and `zoomDomain`, because bounded navigation
must perform the same mapping/inversion correctly for UTC, linear, log, and
symlog scales. They return one fixed readonly domain pair, never a controller or
family-selected capability. Constraints require explicit hard domain bounds and
an optional minimum span as a fraction of the mapped bounds (default 1%).
Positive pan pixels move content right; zoom factor >1 magnifies around the
supplied logical pixel. Bounds may limit anchor preservation. Invalid/collapsed
inputs reject. UTC outputs round to integer milliseconds. No state or scheduler
is owned by these functions; the existing controlled brush remains the consumer.

## I1–I5 final interaction and layout evidence

Linked inspection now shares observed timestamp keys across actual ppm and the
explicit ppm-minus-330 transformation. Hover, committed, and pinned keys have
separate ownership. Removed keys retire and do not resurrect automatically after
data replacement. Native keyboard, touch, focus, and signal replacement have
public-scenario coverage. The independent review found no remaining material
state/cancellation defect.

Brush evidence covers native capture, pointer cancel/loss, Escape, resize,
external domain replacement, invalid controlled domains, disposal, restoration of
touch-action, and native wheel navigation. The public navigation helpers preserve
mapped span under extreme pans and round UTC outputs; a test-first correction
rejects fractional UTC hard bounds before rounding could cross them.

Small multiples use four ordinary layout/scale compositions. Shared selection is
ordinal month-of-quarter, explicitly not calendar identity. Missing observations
occupy null slots so lines do not bridge missing months. Shared and independent y
domains remain explicit. Manual screenshots caught an axis/footer overlap that
text-in-canvas assertions missed; a larger footer reserve fixes it. Public tests
exercise five allocations, all twelve labels, real focused Home/End/Escape, and
unequal/empty signal replacement. Narrow panels use concise numeric ticks, not
removed month identities.

## E1–E3 mapping decisions and evidence

E1 needs no new public API: PlotSeries plus core Circle/Rectangle supplies
proportional area and equal-area sign shapes. The checked-in Census Vintage 2023
snapshot describes July 2022–July 2023 changes, not 2023–2024. Negative changes
retain their sign for the symlog y position and inspection. Glyph area is
1100 × absolute change / largest absolute change; radius is sqrt(area/pi), square
side sqrt(area). Zero hides; nonfinite values reject. The source labels, all six
state identities, native inputs, independent area calculations and cleanup pass
across all five allocations. Manual inspection added explicit y-range padding to
keep the largest glyph clear of annotations.

E2 adds dedicated SequentialColorScale/useSequentialColorScale and
DivergingColorScale/useDivergingColorScale. E3 implements only the demonstrated
ThresholdColorScale/useThresholdColorScale family. Each returns a fixed resolved
mapping signal; there is no family selector. Palettes are explicit six-digit hex
sRGB, output canonical lowercase, interpolation per encoded channel with integer
rounding. Continuous maps clamp; sequential equal domains use the color midpoint;
diverging centers are authored, strictly monotonic and may be asymmetric.
Threshold equality belongs to the upper bucket; empty thresholds with one color
are a constant mapping. No quantile, quantize, ordinal, inversion, hidden
aggregation, palette default, or generic legend API was added.

Resolved immutable stops/bands make truthful keys possible using core shapes and
Text. The NOAA color example prints exact values on all twelve cells, draws keys
from the same mapping, changes domain/boundaries explicitly, and supports focus,
keyboard and touch. Its explicit palettes are not represented as perceptually
uniform; text uses computed luminance for black/white contrast. Providers own no
layout, target, resource surface, or separate scheduler. Dedicated color scope is
separate from positional IDs and rejects cross-Layer lookup. Public tests include
failure restoration into subsequent roots and a valid local Layer provider.

Integrated package build, packed Bundler/NodeNext probes, exact runtime export
allowlist, Studio declaration parity, and unused color/curve family exclusion
passed. Minimal-example validation caught missing type imports and was corrected;
formatting negative type probes moved error locations, so these probes now retain
explicit one-line formatting and typed callback parameters. No runtime contract
was loosened to make those checks pass.

## Final closeout

The durable [walkthrough](2026-10-06-chart-api-walkthrough.md) contains the API
inventory, exact Studio tour, limitations, and final verification ledger. The
foundation trust run earlier in this note is baseline evidence only. The final
aggregate result is recorded in the walkthrough after execution.

### V0 integration corrections and gate boundary

The exact public lesson catalog tests still expected 96 lessons and the old API
inventory. They now explicitly enumerate 108 lessons, correct source order, and
new curve/mark/navigation/color coverage; no dynamic expected-equals-actual
shortcut replaced those assertions. The corrected browser batch passed 375 tests.

Sparse JavaScript arrays exposed a validation hole in all three color providers:
Array.map skips absent slots. New failing public tests established the bug; dense
Array.from validation now rejects missing domain/threshold/color entries. Fourteen
focused public color tests pass. Final source and built chart suites each pass
348 tests with the two opt-in viz diagnostics skipped. Packed and editor checks
were refreshed after the correction.

The aggregate gate was actually attempted. Chart documentation/export/snippet
checks complete, but the shared auxiliary-output design draft lacks the historical
banner required by the repository and also fails formatting. The draft is outside
this chart task and was preserved. All unaffected gate stages were run separately;
the walkthrough records final outcomes and does not claim a green aggregate.
The alpha-publishing operations guide was added to the verifier's operational
classification; the release workflow and its contents were not changed by this
task. An optional attempt to remove incidental verifier formatting by restoring
from Git was rejected by automatic approval review because it could discard
shared changes; no such restoration was performed.
