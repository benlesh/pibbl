# Visualization priorities and visual-quality bar

> **Historical status: Planning and implementation work record; current code and public contracts define shipped behavior.**

> API correction approved 2026-10-05: **every scale family has a dedicated
> provider and hook**, with a fixed return type and no family-selector argument.
> Current families: `LinearScale` / `useLinearScale`, `BarScale` / `useBarScale`,
> `UTCScale` / `useUTCScale`, `LogScale` / `useLogScale`,
> `SymlogScale` / `useSymlogScale`, `PointScale` / `usePointScale`. UTC nicening is `niceUTCDomain(domain, { count? })`.
> Generic `Scale`, `ScaleProps`, and `useScale` are removed, without aliases.
> Future power, square-root, ordinal, local-time, sequential,
> diverging, quantile, quantize, and threshold variations must follow this rule;
> listing them here does not claim implementation. Family modules must tree shake
> independently. This decision supersedes selector-based API examples below.

Date: 2026-10-06.
Status: user-directed priorities; implementation is tracked in
[Plan 007](007-visualization-charting.md). The responsive NOAA UTC slice was accepted and merged into local main.
Numeric/UTC/category axis presentation, log/symlog/point families and scale-based furniture are implemented and accepted; final verification remains.
The [detailed next execution plan](viz-foundations-next-execution.md) specifies marks, exploration and encodings. Proposed names are illustrative, not new public APIs.

## Direction and authority

The user wants extremely rich visualization support, with basic charting first:
time axes, updated/new scales, chart furniture, and visuals as good as or better
than leading alternatives. This supersedes the delivery order in the
[remaining visualization roadmap](remaining-viz-roadmap.md), not its historical
approvals, evidence, or shipped contracts. It also supersedes the initial
research recommendation to start with graph ports/connectors.

This is the current visualization prioritization source. It does not replace
the active numbered project plan or authorize unrelated runtime changes. Carry
the selected slice into execution planning when implementation is requested.
Keep public docs descriptive of shipped behavior. Earlier UTC and custom pie
label approvals remain recorded in their linked proposals; prioritization does
not silently amend their semantics.

## Baseline and gaps

Source inspection on 2026-10-05: the public entry is
`packages/core/src/features/viz/index.ts`, implementations are under
`packages/core/src/features/viz/lib/`, and authoring guidance is
`docs/site/learn/guides/data-visualization.md`. Old `packages/viz` paths in prior
records predate package consolidation. This is source evidence, not a fresh
runtime verification result.

Available: dedicated linear, bar, and UTC scales with family-specific hooks, axes on all four edges with categorical labels
and explicit bounded ticks, straight lines with missing-data gaps, point/custom
mark series, horizontal/vertical value and range bars, grouping and threshold
fills, pie/donut geometry with coordinated string labels, nearest-data queries,
hover cards, and anchored layout. Stacking is an explicit data transform.

Now also exported: log/symlog/point scales, GridLines, ReferenceLine, ReferenceBand,
AxisTitle, readable numeric tick/nicening helpers and contextual UTC labels.

Not yet exported: local-calendar time scales, general area/band series, data-derived
legends, reusable brush/zoom/linked selection, graph/hierarchy
layouts, or geographic components. The line explorer's brush and the diagram
editor's connections are application examples, not reusable public APIs. Core
responsive styles and logical focus do not establish responsive viz marks or
screen-reader semantics.

## Priority order

### Pharmaceutical and scientific research additions (2026-10-12)

User-directed priority: deliver the full scientific/medical visualization suite
eventually, with pharmaceutical research determining the order of additions.
General statistics and clinical studies are the initial anchors. This section
supersedes the undifferentiated P1 ordering below for these additions. Bring
forward only the foundation work needed by each research slice; unrelated
foundation polish is not a prerequisite for starting these slices. It does not
change shipped contracts or authorize unspecified public API signatures.

The order is a product recommendation, not a regulatory checklist. It balances
reuse, pharmaceutical research value, and the shortest path to a working public
example. Clinical and laboratory/assay workflows both remain in scope.

| Order | Capability and pharmaceutical use                                                                                                                                            | First observable slice                                                                                                                                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **Estimates and uncertainty:** horizontal/vertical point-and-interval marks, asymmetric error bars, weighted symbols, summary diamonds, forest/subgroup and estimation plots | A forest plot of externally supplied treatment effects and intervals, with explicit effect measure, null value, analysis population, study/subgroup labels, and aligned numerical results. Distinguish subgroup estimates from evidence of interaction.                                                                              |
| 2     | **Dose/exposure-response and pharmacokinetics:** assay concentration-response, efficacy/toxicity by dose or exposure, concentration-time plots                               | Observations plus an externally fitted curve and labelled interval band; preserve dose versus exposure units, distinguish observations from predictions, and explicitly handle zero/control doses and below-quantification records on logarithmic axes. Reuse existing points, lines, log scales, and bands.                         |
| 3     | **Paired and longitudinal outcomes:** before/after values, participant trajectories, change from baseline, visit-level summaries                                             | Participant-linked observations and an externally supplied group summary. Keep subject identity, actual time versus scheduled visit, baseline definition, and missing visits explicit; no automatic imputation.                                                                                                                      |
| 4     | **Safety and tolerability:** adverse-event incidence comparisons, laboratory/vital-sign distributions, baseline-to-follow-up shift matrices, event timelines                 | Adverse-event comparison with visible n/N, analysis population, observation window, and supplied effect intervals. Distinguish participants with an event from event counts; exposure-adjusted rates require explicit denominators and units. Heatmap and interval-lane foundations move forward when their safety slice needs them. |
| 5     | **Time-to-event:** survival curves, censoring marks, interval bands, risk tables; later cumulative-incidence views                                                           | Externally supplied survival steps and censoring records with an aligned number-at-risk table and explicit time units. Define table timing conventions. Do not treat competing events as ordinary censoring by default. Move this family directly after order 1 for oncology or another program centered on time-to-event endpoints. |
| 6     | **General distributions:** strip plots, histograms, ECDFs, box plots, then density/violin/beeswarm and composed raincloud views                                              | Raw assay or biomarker observations with a box summary and sample counts, then explicit histogram binning and ECDFs. Specify quantiles, whiskers, kernel/bandwidth, normalization, and deterministic displacement as applicable; distinguish biological from technical replicates.                                                   |
| 7     | **Model and measurement diagnostics:** residual, Q-Q, observed-versus-predicted, Bland-Altman, funnel and influence plots, simulation-based predictive checks                | Observed-versus-predicted and residual views from supplied analysis outputs. Follow with agreement plots whose supplied limits and assumptions are labelled. Render predictive checks from supplied simulation summaries before considering simulation or estimation helpers.                                                        |
| 8     | **Diagnostic and biomarker performance:** ROC, precision-recall, calibration, threshold tradeoffs                                                                            | Externally supplied curves with threshold inspection and visible cohort/context. Keep positive-class definition, prevalence context, validation split, and supplied uncertainty explicit.                                                                                                                                            |
| 9     | **Matrices and broader life sciences:** general heatmaps, correlation/missingness/expression matrices, volcano plots, other multivariate and spatial scientific views        | Heatmap with an explicit color domain, units, missing-cell treatment, and stable row/column ordering; then a volcano example with supplied effect sizes and adjusted significance values. Distinguish transformed data from raw data and do not silently cluster or adjust p-values.                                                 |

All families from the initial discussion remain included: individual observations,
distributions, uncertainty, treatment effects, longitudinal outcomes,
time-to-event outcomes, diagnostic performance, measurement agreement, matrices,
and model diagnostics. Earlier delivery of a shared mark does not establish that
every dependent research composition is complete.

#### API and delivery boundaries

- Keep drawing components, pure data/layout helpers, and research compositions
  distinct. Names in the discussion are proposals, not committed exports.
- Accept analysis outputs from R, Python, SAS, and other systems without requiring
  Pibbl-owned estimation. Rendering must not select an inferential method, fit a
  model, pool studies, choose a confidence method, or perform significance tests.
- Add small deterministic transforms alongside the slice that needs them.
  Statistical estimators need separately specified assumptions, method-specific
  fixed return contracts, trusted reference fixtures, and public evidence.
- Label units, observational units, sample sizes/denominators, interval meaning,
  population, and relevant analysis provenance. Distinguish SD, SE, confidence,
  credible, and prediction intervals even when their drawing geometry is shared.
- Use explicit operations and typed definitions under the repository's public API
  rules; no generic chart/statistics selector with changing return contracts.
- Every slice needs a supported public API example, one focused failing contract
  test before production changes, semantic geometry evidence, and an exact Studio
  URL for hands-on feedback. Harden after feedback rather than building all
  statistical infrastructure first.
- Carry keyboard/tap inspection, host-owned HTML summaries/tables, non-color
  encodings, and responsive composition into each applicable example. Canvas
  drawing does not establish semantic DOM accessibility.
- Plan reproducible publication output, dimensions, fonts, panel labels, captions,
  and provenance alongside the first slice. Vector export requires a separate
  renderer/export contract and is not an implied current capability.

#### Research grounding

These sources inform the emphasis; they do not prescribe this API or priority order:

- [ICH E9 and E9(R1), EMA](https://www.ema.europa.eu/en/scientific-guidelines/ich-e9-statistical-principles-clinical-trials): statistical principles, estimands, and sensitivity analysis in clinical trials.
- [FDA exposure-response guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/exposure-response-relationships-study-design-data-analysis-and-regulatory-applications): dose/concentration-response information in drug development and dose selection.
- [Cochrane Handbook, Chapter 10](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-10): effect measures, meta-analysis assumptions, heterogeneity, and prediction intervals.
- [Nature Progress Brain Health statistical guidelines](https://www.nature.com/natprogbrainhealth/submission-guidelines/statistical-guidelines): labelled variability, sample counts, and visibility of distributions and individual observations.

### Proposed scientific public APIs (2026-10-12)

Saved at the user's request before implementing the first estimate-and-interval
slice. This is an API proposal, not a declaration that every API is shipped.
Exact signatures are resolved in the slice that introduces them. Existing
`PointSeries`, `LineSeries`, `IntervalBandSeries`, scales, axes, reference lines,
and inspection remain the foundation. Research compositions initially live in
editable examples rather than a generic chart factory.

| Priority | Family                               | Proposed public additions                                                                                                                                                                   | Research compositions                                                                     |
| -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1        | Estimates and uncertainty            | `HorizontalIntervalSeries`, `VerticalIntervalSeries`, `WeightedPointSeries`, `IntervalDiamondSeries`                                                                                        | Forest/subgroup plots, estimation plots, asymmetric error bars                            |
| 2        | Dose/exposure-response and PK/PD     | `CensoredPointSeries`; reuse existing points, lines, and bands                                                                                                                              | Concentration-time, dose-response, exposure-response, assay curves                        |
| 3        | Paired and longitudinal outcomes     | `PairedSeries`, `TrajectorySeries`, `changeFromBaseline`                                                                                                                                    | Before/after comparisons, participant trajectories, baseline-adjusted outcomes            |
| 4        | Safety and tolerability              | `IntervalLaneSeries`, `HeatmapSeries`, `ColorLegend`                                                                                                                                        | Adverse-event comparisons, laboratory shift matrices, event timelines                     |
| 5        | Time-to-event                        | `SurvivalSeries`, `CensorSeries`, `RiskTable`                                                                                                                                               | Survival curves, censoring, uncertainty bands, numbers at risk                            |
| 6        | Distributions                        | `StripSeries`, `BeeswarmSeries`, `HistogramSeries`, `BoxPlotSeries`, `DensitySeries`, `ViolinSeries`, `ECDFSeries`; `binValues`, `summarizeBoxPlot`, `estimateKernelDensity`, `computeECDF` | Assay/biomarker distributions and raincloud compositions                                  |
| 7        | Model and measurement diagnostics    | `QQSeries`; `computeMeanDifferencePairs`, `computeResiduals`, `computeQQPoints`                                                                                                             | Bland-Altman, residual, Q-Q, observed-versus-predicted, funnel and predictive-check views |
| 8        | Diagnostic and biomarker performance | No specialized new marks initially; reuse existing lines, points, bands, and references                                                                                                     | ROC, precision-recall, calibration, threshold tradeoffs                                   |
| 9        | Matrices and broader life sciences   | Reuse `HeatmapSeries`/`ColorLegend`; later `ContourSeries`, `HexbinSeries`, `hexbinPoints`                                                                                                  | Correlation/expression/missingness matrices, volcano plots, spatial density               |

#### Concise authoring sketches

All snippets assume the referenced scale providers are declared around them.
New API shapes below are proposals; existing APIs retain their current required
props. Intervals and fitted/model results are externally supplied.

Treatment effects and asymmetric uncertainty:

```tsx
<HorizontalIntervalSeries
  data={effects}
  category="study" estimate="effect" lower="ciLower" upper="ciUpper"
  categoryScale="studies" valueScale="effect"
/>
<ReferenceLine scale="effect" value={1} direction="vertical" span={[0, 300]} />
```

Dose/exposure-response uses existing marks:

```tsx
<PointSeries data={observations} x="dose" y="response" xScale="dose" yScale="response" />
<LineSeries data={predictions} x="dose" y="estimate" xScale="dose" yScale="response" />
<IntervalBandSeries data={predictions} x="dose" lower="lower" upper="upper"
  xScale="dose" yScale="response" />
```

Paired and longitudinal observations:

```tsx
<PairedSeries data={participants} before="baseline" after="followUp"
  category="treatment" categoryScale="treatments" valueScale="outcome" />
<TrajectorySeries data={visits} groupBy="participantId" x="day" y="outcome"
  xScale="day" yScale="outcome" />
```

Safety timelines and shift matrices:

```tsx
<IntervalLaneSeries data={events} lane="participantId" start="startDay" end="endDay"
  laneScale="participants" timeScale="day" />
<HeatmapSeries data={shifts} column="baselineGrade" row="followUpGrade" value="count"
  columnScale="baseline" rowScale="followUp" colorScale="count" />
```

Externally calculated survival results:

```tsx
<SurvivalSeries data={survival} time="time" survival="estimate"
  timeScale="time" probabilityScale="survival" />
<CensorSeries data={censors} time="time" survival="estimate"
  timeScale="time" probabilityScale="survival" />
<RiskTable data={riskCounts} group="arm" time="time" count="atRisk"
  timeScale="time" groupScale="arms" />
```

Explicit distribution transforms:

```tsx
const bins = binValues(samples, {
  value: "concentration", boundaries: [0, 5, 10, 20, 40],
});
const ecdf = computeECDF(samples, { value: "concentration" });

<HistogramSeries data={bins} lower="lower" upper="upper" value="count"
  xScale="concentration" yScale="count" />
<ECDFSeries data={ecdf} value="value" probability="probability"
  xScale="concentration" yScale="probability" />
```

Measurement agreement coordinates, without estimating agreement limits:

```tsx
const differences = computeMeanDifferencePairs(measurements, {
  first: "reference",
  second: "candidate",
});
<PointSeries
  data={differences}
  x="mean"
  y="difference"
  xScale="mean"
  yScale="difference"
/>;
```

Diagnostic performance from supplied curve points:

```tsx
<LineSeries
  data={roc}
  x="falsePositiveRate"
  y="truePositiveRate"
  xScale="falsePositiveRate"
  yScale="truePositiveRate"
/>
```

Volcano composition from supplied effect sizes and adjusted significance:

```tsx
<PointSeries
  data={genes}
  x="log2FoldChange"
  y="negativeLog10AdjustedP"
  xScale="effect"
  yScale="significance"
/>
```

#### Public API summary

Drawing components render observations, summaries, intervals, trajectories,
matrices, and fields. Pure helpers perform explicitly named transformations
with fixed return contracts. Research examples compose these APIs into complete
figures. Do not initially add `ForestPlot`, `VolcanoPlot`, or `ResearchChart`:
actual repeated compositions will establish whether a reusable component is
needed. Statistical fitting, hypothesis testing, meta-analysis, and clinical
estimators are separate design work.

Box summaries must specify quantile/whisker definitions; density calculation
must specify kernel/bandwidth. Weighted symbols encode weight by area, not by
radius. Censored measurement marks show supplied bounds rather than invented
exact values. Paired/trajectory marks preserve participant identity and missing
observations. No helper silently imputes, clusters, normalizes, adjusts p-values,
or changes the supplied analysis population.

#### First slice implementation (2026-10-12)

The estimate-and-interval slice adds `HorizontalIntervalSeries` and
`VerticalIntervalSeries` to `@pibbl/core/viz`, with shared `IntervalSeriesStyle`
and props types. The public clinical forest example uses supplied synthetic
risk ratios/95% intervals, a logarithmic axis, null value 1, row inspection,
effect ordering, and an application-owned HTML results table. Phone presentation
stacks row labels and values and uses ordinary host scrolling.

The focused public browser test was added first and failed on the absent export
before production implementation. It establishes independent asymmetric-bound
mapping in both orientations, missing-row omission, and scheduled geometry
replacement. A separate headless example test drives ordering and table-based
inspection through the same supported example mount.

`WeightedPointSeries` and `IntervalDiamondSeries` remain proposed follow-ups;
this slice uses equal-size estimate circles and supplies no pooled result.
Status is **slice ready for feedback**, not feature complete; broader edge-case
hardening and aggregate verification follow experiential feedback.

Studio route: `#/examples/composition/viz-clinical-forest`.

Fresh verification used Node 24.15.0, pnpm 11.21.0, and Playwright Chromium:
the two focused Vitest browser tests passed in source and built modes;
`tsc --noEmit`, the core build, packed viz verification (Bundler/NodeNext and
runtime exports), Studio declaration parity, scenario catalog validation,
targeted ESLint, and public JSDoc checks passed. Desktop (1440 x 1000) and phone
(390 x 844) Studio checks exercised sorting, row selection, and the HTML table;
desktop also exercised Enter activation. No relevant browser console/runtime
errors were observed. The aggregate trust gate was not run at this feedback
milestone. The broader `docs:check` remains blocked by an unrelated existing
unclassified evidence README under
`docs/strategy/agent-verification-evidence/public-inspection-pilot-2026-10-09/`.

#### Accepted forest slice: hardening (2026-10-12)

Following hands-on acceptance, the interval API and forest example now have 25
focused public browser checks (22 interval checks and 3 example checks). Tests
cover missing/nonfinite coordinates, unknown categories, numeric category IDs,
asymmetric/equal bounds, estimates outside bounds, reversed domains/ranges,
logarithmic values, malformed data/styles, categorical scale requirements,
callback inputs and exclusion, reactive geometry/style removal, widened target
strokes, transforms, clipping, decorative participation, forbidden hooks/writes,
and signal teardown. Type evidence includes JSX/createElement, signals,
callbacks, mandatory bounds, numeric field keys, and closed styles.

Regression tests failed before fixes for unknown-category omission and example
ownership. Unknown categories now omit the row before bounds validation. The
forest mount disposes its previous application-owned lifetime before remounting;
repeated disposal cannot restore stale host styles or dispose a replacement.
Accessor hook diagnostics identify the prohibited operation.

Fresh verification on Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium:

- The isolated source visualization suite passed 496 tests, with 2 skipped,
  excluding the concurrently developed financial workspace and editable-chart
  tests. A temporary configuration removed only Studio documentation generation.
- All 26 focused checks (including the new dose-response check below) passed
  against built public packages, with the built-resolution assertion enabled.
- Independent packed interval consumers passed Bundler and NodeNext, runtime
  exports, JSX/createElement, signals, and negative type cases. The standard
  packed-viz gate is blocked by unrelated editable-chart export-list drift.
- The core build and repository typecheck passed before later unrelated texture
  changes. The final runtime bundle rebuild passed. Targeted ESLint passed.
- Catalog generation passed: 134 lessons, 12 tutorial snapshots, 33 labs.
- Desktop (960 x 900) and phone (390 x 844) render/interaction checks passed in
  an isolated preview using the same public example mounts. Forest checks include
  keyboard sorting, touch, table inspection, live desktop/phone resizing, and
  teardown. Both figures were visually inspected; no page errors were observed.
  Regular Playwright was used because the Browser plugin is not available.

`corepack pnpm@11.21.0 trust` was attempted and stopped during browser discovery
because unrelated editable-chart exports lack API documentation. Standard Studio
verification also encountered unrelated `geometric-patterns.ts` type errors.
The full visualization run identified failures in the concurrently developed
financial workspace (duplicate keys) and editable-chart test (`settled()` is not
part of the controller contract). These changes were preserved. Status:
**accepted behavior hardened and independently verified; aggregate feature
completion remains pending the shared-checkout blockers**.

#### Next slice: dose-response composition (2026-10-12)

The next pharmaceutical priority has a runnable `viz-dose-response` learning
example. It composes existing `PointSeries`, `LineSeries`, `IntervalBandSeries`,
`LogScale`, and `LinearScale`: observations use outlined circles, supplied model
predictions use a line, and supplied 95% confidence bounds for mean response use
a separately toggleable band. All values are invented teaching data. There is
no curve fitting, interval calculation, or clinical inference.

The zero-dose control is displayed separately and included in the HTML data
table; only positive doses enter the log scale. Dose units and response units
remain visible, and observations and supplied predictions are exposed below
Canvas. The focused test was added first and failed on the absent example. It
then passed with semantic labels, band paint/removal, native control behavior,
complete observed data, and subscription/HTML teardown. Desktop and phone
render/interaction checks also passed.

Studio route: `#/examples/composition/viz-dose-response`. While unrelated Studio
compilation is blocked, the isolated built-package previews are available at
`http://127.0.0.1:5186/research-qa?dose` and
`http://127.0.0.1:5186/research-qa?forest`.

Status: **slice ready for feedback in the isolated preview; Studio readiness
pending unrelated compilation errors**. `CensoredPointSeries` and explicit
below-quantification handling remain the next API work in this family. This
example does not claim that those APIs or a complete PK/PD suite have shipped.

### Earlier general visualization tiers

Order within each tier follows dependencies and concrete example needs. Deliver
one runnable vertical slice at a time; do not build every foundation before
showing a chart. P0 is the first product milestone. Do not displace unfinished
P0 quality work with a more novel chart family without explicit reprioritization.

| Priority | Capability                                              | Why it matters / intended result                                                                                                                                                               |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1     | UTC calendar scale and excellent time-axis presentation | A truthful, readable time chart from subsecond to multiyear spans; use the approved UTC contract as the first slice                                                                            |
| P0.2     | Numeric/categorical scale and axis finish               | Useful numeric ticks/nice-domain helpers, formatting, spacing, band/point positions, log and symlog; consistent units and explicit domain policies                                             |
| P0.3     | Chart furniture and visual defaults                     | Grid lines, baselines, titles/subtitles, axis titles/units, legends, color/size keys, reference lines/bands, source/caveat text, and deliberate empty states                                   |
| P0.4     | Complete everyday marks                                 | Area and interval bands, step/monotone curves, categorical coordinates, symbol/size encoding, segment styling, stacked/normalized compositions; finish current bars and pie/donut presentation |
| P0.5     | Everyday exploration and responsive composition         | Crosshair, hover/tap/focus inspection, pinning, brush/overview, pan/zoom, shared selection, and responsive small multiples with shared or independent domains                                  |
| P1       | Statistics, matrix data, and advanced encodings         | Histogram/bin helpers, interval/error bars, box plots and summaries, density/violin/beeswarm, heatmaps, calendar layouts, sequential/diverging/threshold/quantile/quantize encodings           |
| P2       | Connected diagrams and scheduling                       | Nodes, ports, connectors, labels, routing, manual/layered layout, groups, process swim lanes, interval lanes, milestones, and timeline dependencies                                            |
| P3       | Hierarchies and quantitative flows                      | Tree/cluster/pack/treemap/partition, Sankey, chord/ribbons, arc diagrams, network layouts and drill-down                                                                                       |
| P4       | Geography and specialist/dense views                    | Projections, geographic marks/routes, contours, hexbin/raster fields, specialized financial and multivariate recipes                                                                           |

Responsiveness, accessibility, correctness, ownership, and workload-appropriate
performance are acceptance dimensions in every tier, not work postponed to P4.
Indexing, aggregation, and decimation move forward when a selected slice needs
them. Do not require speculative large-data infrastructure for a small chart.

The full scale roadmap retains local-calendar time with explicit DST/time-zone
semantics, power/sqrt, ordinal, and color/size encodings. UTC and the most useful
numeric scales come first. A color or size encoder need not pretend to be a
positional scale. Decide the extension boundary through actual mark consumers.

## P0 slices and observable acceptance

### 1. Time-series chart

Start from the [approved UTC proposal](viz-utc-contract-proposal.md). Provide one
editable public example with UTC observations, gaps, resize, and inspection.
Prove calendar-aligned geometry with a focused failing public test before
production code, then deliver the exact running Studio URL for feedback.

The first visible chart must have concise labels, clearly identified UTC time,
units, deliberate gutters and restrained grid lines. An example-level compact
formatter is an acceptable first slice under the existing contract; it is not
completion of the reusable presentation feature.

After feedback, resolve the reusable presentation contract: contextual calendar
labels, repeated-date context, year/month transitions, density and collision
policy, label priorities, locale, and precision. Preserve the approved stateless
full-ISO `formatTick` behavior unless a specific amendment is approved. Always
including original endpoints can crowd aligned interior ticks: decide label
visibility separately from tick geometry, or explicitly amend the tick policy.
Never silently move a date to make a label fit.

### 2. Scale and axis quality

Prove a compact numeric chart, a long-label categorical chart, and a log/symlog
example. Define readable numeric steps, precision, SI/currency/percent/unit
formatting, domain niceness, optional clamping, zero/baseline treatment,
ascending/descending domains, and unknown/missing/invalid behavior. Preserve
existing linear behavior until an explicit change contract and migration exist.
Log must reject or explicitly handle nonpositive input; symlog needs an explicit
constant and inversion contract. Area-based size encoding must not accidentally
encode values as radii.

Axis presentation must cover all four edges, major/minor grid hierarchy where
useful, axis titles, measured gutters, overlap handling, and crisp strokes at
supported pixel ratios. Narrow charts reduce density or change presentation
without hiding units or critical context. Full ISO strings and arbitrary label
rotation are not acceptable universal defaults.

### 3. Furniture and everyday composition

Develop one coherent style vocabulary for typography, spacing, rules, palettes,
legend swatches, labels, annotations, and interaction states. Initial components
may be `GridLines`, `Legend`, `ColorLegend`, `SizeLegend`, `ReferenceLine`, and
`ReferenceBand`; title/source blocks can remain ordinary composed content when
that is sufficient. A mandatory chart container is not required.

Demonstrate line/area, grouped/stacked bars, scatter/bubbles, and pie/donut using
the same visual system. Legends must wrap or rearrange, show selected/disabled
states, and preserve category order. Continuous keys need meaningful ticks and
units. Palette defaults should support categorical, sequential, and diverging
roles with non-color alternatives. Preserve customization without forcing users
to reproduce layout math or internal rendering code.

Build area/band geometry, curves, and pure stack transforms as needed by those
examples. Define curve overshoot, gaps, order, uncertainty bounds, signed stacks,
and inspection semantics before expanding variants. The existing custom pie
label approval remains valid, but it does not outrank missing time axes and
shared furniture. Label fit must not distort wedge area or data geometry.

### 4. Shared exploration and small multiples

Extract reusable behavior from demonstrated brush/inspection patterns. Keep
hover, pinned datum, selection, focus, and viewport distinct. Share record IDs
or domain ranges across views through caller-owned signals. Support keyboard
inspection, tap-to-pin, cancellation, touch targets, and alternatives to drag.
Fit compact and wide layouts; synchronize an application-owned HTML summary or
table rather than claiming Canvas focus supplies an accessibility tree.

State should be serializable for application-owned URLs/bookmarks; do not add
router ownership to visualization primitives. Expensive preprocessing belongs
outside pointer-move handlers. Nearest-data lookup and topmost painted hit tests
remain distinct. Test both stable-data interactions and changed-data updates.

## What “S-tier” means for acceptance

“S-tier” is the target, not a claim established by this document. Visual quality
is a completion gate alongside semantic correctness. Attractive screenshots of
one hand-tuned dataset do not establish a high-quality component.

| Dimension                 | Required evidence before feature completion                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default composition       | An ordinary documented configuration produces a polished chart without per-datum pixel fixes; typography, spacing, colors, and furniture form a consistent family                    |
| Typography and layout     | No unintended overlap, clipping, truncated units, or illegible labels in supported sizes; declared wrapping/omission policies retain essential context and accessible values         |
| Truthful encoding         | Missing differs from zero; units/domains/baselines are clear; stacks, sizes, curves, and uncertainty preserve their declared meaning                                                 |
| Responsive behavior       | Inspect at 360px and 390px phone widths, 768px, and a wide desktop allocation; test different aspect ratios, DPR 1/2, long labels, and zoomed text where supported                   |
| Color and states          | Inspect light/dark surfaces, grayscale/color-vision resilience, categorical crowding, hover, focus, selected, muted, empty, and invalid-data states                                  |
| Interaction               | Pointer, keyboard and touch paths communicate the same essential values; overlays stay bounded and do not obscure the datum being explained; motion has a reduced/static alternative |
| Customization             | Typical brand typography, palette, density, formatting, and custom marks do not require private imports or replacing the entire component                                            |
| Performance and stability | Record representative workloads and environment, interaction/update cost, layout stability, caching/invalidation, and exact teardown; avoid universal frame-rate claims              |
| Competitive review        | Dated side-by-side comparison on matched datasets and dimensions; document specific wins, deficits, and user acceptance rather than declaring blanket superiority                    |

For competitive review, choose relevant current examples from D3/Observable
Plot, Vega-Lite, Apache ECharts, and Highcharts; add specialist diagram or map
references only when their tier is selected. These are comparison candidates,
not claims about their current capabilities. Record exact source URLs, library
versions/date, configuration, font, dataset, viewport, and screenshots when the
review is performed. Compare both ordinary defaults and reasonably configured
results; do not handicap the reference or copy its visual identity.

Compare readability, density, layout, interaction clarity, responsive behavior,
and customization. A visually weaker result keeps that slice open with concrete
fixes or an explicitly accepted limitation. No competitive benchmark or visual
superiority has been verified in this planning update.

## Delivery and verification

1. Resolve only decisions blocking the selected public slice. Add the minimum
   meaningful failing public-API test before production changes.
2. Build the runnable slice and perform focused semantic/geometry checks and
   visual inspection. Give the exact Studio URL and what to inspect promptly.
3. Mark **slice ready for feedback**, not feature complete. A local comparison
   or visual inspection needed to make this slice credible belongs here; a
   catalog-wide benchmark does not.
4. Incorporate feedback, then harden supported sizes, edge cases, accessibility,
   ownership, docs, visual regression evidence, and matched competitor review.
5. Mark **feature complete** only after accepted behavior and proportional final
   checks pass. New APIs must agree across exports/declarations, packed Bundler
   and NodeNext consumers, Studio, and source/built browser modes. Run aggregate
   trust at the integration milestone, not repeatedly during early exploration.

Use the same public scenario manually and headlessly. Assert data/geometry first;
add screenshots where they establish appearance. Inspect expected/actual/diff
before intentional baseline changes. Record environment and fresh results; old
roadmap test totals do not certify current work. Required visual review is not
permission for overlapping agent reviews or delaying hands-on feedback.

## Advanced coverage retained

The D3 catalog review informs breadth; its 174 entries are not 174 required
components. Prefer marks, pure transforms, layout outputs, and polished recipes.

- Statistical recipes: waterfall, lollipop, dumbbell, bullet, cumulative and Q–Q
  plots, ridgelines, horizon charts, scatterplot matrices, parallel coordinates,
  candlesticks/OHLC, and financial bands. Promote a recipe only when repeated
  semantic work warrants a public component.
- Diagrams: separate layout geometry, edge routing, and ordinary Pibbl rendering.
  Support custom content, named ports, endpoint markers, hit tolerance, self-loops,
  parallel edges, groups, pinned nodes and stable updates. Evaluate an optional
  ELK adapter for ports/nesting. Process lanes, timed interval lanes, and sequence
  diagrams need different semantics even if they share rendering pieces.
- Hierarchies/flow: reuse topology across radial/Cartesian layouts and partition
  geometry across sunburst/icicle. Sankey flow conservation/acyclic limitations
  need an explicit contract; generic connectors are not a Sankey implementation.
- Geography/dense views: define projection, clipping, geographic hit testing,
  contours, aggregation and provenance. Tiles and vector export need deliberate
  ownership/readiness contracts, not blanket promises.
- All families retain one Pibbl scheduler, public composition and explicit
  resource ownership. Reuse pure D3 geometry where appropriate; do not import
  a competing DOM renderer, event system, or automatic animation loop.

## Research and decision log

Research inputs: [D3 gallery](https://observablehq.com/@d3/gallery),
[D3 shapes](https://d3js.org/d3-shape),
[D3 hierarchy](https://d3js.org/d3-hierarchy),
[D3 Sankey](https://github.com/d3/d3-sankey), and
[ELK](https://eclipse.dev/elk/). The preceding catalog review covered all 174
listed entries at the family level, not a source audit of every notebook.

2026-10-05: User prioritizes chart basics and exceptional visual quality ahead of
connected diagrams. Added P0-first delivery, concrete visual acceptance,
competitive evidence requirements, and retained advanced breadth. No production
code, shipped public contract, visual baseline, or implementation status changed.
This historical next-step note is superseded by the accepted UTC/NOAA slice.
Current order: excellent numeric/time/category labels, dedicated log/symlog/point
scales, then composable chart furniture. Track runnable versus hardened status
in Plan 007.

2026-10-05 delivery update: numeric and contextual UTC/category label slices are
committed. The accepted logarithmic slice, including preservation of compact
category labels, is committed as `7eb70568`. Dedicated symlog and point providers
and hooks now have a runnable Census composition, focused source/built tests,
documentation, and packed/tree-shaking evidence. This is a feedback-ready slice,
not a declaration of complete hardening. Chart furniture remains next; Plan 007
records exact evidence and outstanding verification.

Furniture progress: accepted symlog/point slice committed as `ac035d33`.
Grid/reference lines now have a runnable Census composition with focused geometry,
responsive interaction, and package checks. Feedback-ready, not fully hardened;
reference bands and text/legend furniture remain next.

Reference-band slice is now runnable in the Census chart: a shaded loss region,
explicitly described in its source note. Grid/reference lines are accepted and
committed (`7b7c2f6f`); the band is feedback-ready and uncommitted. Text furniture
and legends remain outstanding.

Reference bands accepted and committed (`3f03540e`). A composable `LegendItem`
slice now shows gain/loss swatches in the Census chart with caller-owned layout;
focused geometry, cleanup, and compact interaction checks pass. Feedback-ready,
uncommitted; text furniture and broader hardening remain pending.

Legend items accepted and committed (`2421411d`). Axis titles/units are now a
feedback-ready slice in the Census composition, with explicit caller-owned margins
and compact unit labeling. Title/caption/source-note composition and cross-slice
hardening remain outstanding.

Axis titles accepted and committed (`6a0da53c`). Titles, captions, and source notes
reuse core Text's existing wrapping/fitting capabilities. The redundant proposed
ChartText API was removed before commit. Cross-slice hardening remains next.

API audit correction: removed LegendItem as redundant core shape/text composition;
ChartText remains withdrawn. Retained only added scale/data/numeric/calendar or
axis-geometry behavior. Hardening now includes localized negative-zero formatting
and complete source/built visualization contract runs; see Plan 007 for evidence.

### Research mark delivery update (2026-10-12)

The estimate-and-interval slice now includes `CensoredPointSeries`,
`WeightedPointSeries`, and `IntervalDiamondSeries`, exported from
`@pibbl/core/viz` with their props/style/accessor types. Censor markers preserve
supplied reporting limits and domain direction. Weighted circles use an explicit
zero-based weight domain and area proportional to supplied weights. Summary
diamonds require the estimate to lie inside supplied bounds. These marks perform
no inference or pooling.

Public examples: `viz-censored-assay`, `viz-weighted-evidence`, and
`viz-evidence-synthesis`. The evidence synthesis uses the published metadat BCG
teaching dataset, supplied REML output, and a separate prediction-interval toggle.
API pages and complete minimal programs accompany every new export.

Fresh verification: Node 24.15.0 / pnpm 11.21.0; 41 focused source tests passed;
the complete built visualization suite passed 525 tests with two skipped.
Packed Bundler/NodeNext consumers, runtime identity/private boundaries, Studio
source/built/editor export parity, and repository TypeScript checks passed.
Integration verification and the commit are recorded at delivery.

Next pharmaceutical slice: repeated-measure and longitudinal series, with explicit
participant grouping and missing-visit gaps; then safety/event views and
time-to-event outcomes. Audit existing line and point composition before adding
public APIs.

### Paired and longitudinal slice proposal (2026-10-12)

Previous research marks landed in main through PR 15 (`da947d78`). The next
slice adds `TrajectorySeries` (grouped long-form participant paths) and
`PairedSeries` (complete wide-record endpoint connectors) to `@pibbl/core/viz`.
Both use existing scales, shared signal styles and ordinary series events; no
core runtime change is required. Source order remains explicit, and supplied
missing visit rows break individual trajectories. The example will show a
clearly labelled synthetic Phase II repeated-measures study with accessible
controls, units, denominators and missingness.

`changeFromBaseline` remains deferred until baseline selection, duplicate
baselines and missing-baseline policies have a separate concrete contract.
Applications supply changes in this slice; summary lines and uncertainty remain
existing `LineSeries`/`IntervalBandSeries` composition with supplied data.

Paired/longitudinal slice implementation: `TrajectorySeries`, `PairedSeries`,
their props/style types and `TrajectoryGroupAccessor` are implemented. Public
source tests failed first on absent exports before the production implementation.
The synthetic `viz-phase-ii-trajectories` example supplies 16 participants and
scheduled visit rows, preserves missed assessments and discontinuation, and
provides paired endpoints, native controls and an accessible table. Numeric
outcomes, identities, source ordering, gap boundaries, accessor guards and
reactive paint have focused public evidence. API pages, complete minimal
programs, packed consumers and Studio editor declarations accompany the slice.

Fresh verification (Node 24.15.0 / pnpm 11.21.0): the built visualization suite
passed 533 tests with two existing skips before the final additional omission
and mobile-label checks. The final focused mark suite passed eight tests and the clinical example passed
two tests; the learning catalog passed 288 tests. Repository typecheck, docs/JSDoc checks,
packed Bundler/NodeNext and runtime boundary checks, production Studio and
website builds passed. Desktop/phone browser QA exercised native controls and
explicit missingness. This slice has not run the full aggregate `trust` gate;
previous merged work passed it in PR 15. Studio feedback remains the next
milestone before landing this new branch.
