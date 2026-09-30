# Remaining visualization roadmap

Status: roadmap, semantic BarSeries replacement, and complete label-fit/tick/invalidation resolution packet approved. First bars/axes and donut slices in implementation.
Audit date: 2026-09-30. Audited and fetched main: `d9c28931da2dc659314baed6c0c79c13ab14e48a`.
Objective source: `/Users/benlesh/.codex/attachments/31d3419b-d22d-4d2f-9276-a048e890465a/goal-objective.md`.

## Ownership and preservation

Coordinator: this chat, branch `codex/viz-roadmap`, managed worktree `/Users/benlesh/.codex/worktrees/viz-roadmap/crc`.
Read-only audits: `audit_series` (series), `audit_interaction` (scales, interaction, accessibility, performance). Reuse agents for approved implementation and later independent reviews.
No artifacts were attached initially. Other worktrees are owned by other chats; none is assumed free. The original `codex/physics-2d-quality` checkout has substantial tracked and untracked work and is untouched.
Each concurrent implementation gets its own managed worktree and codex branch. The coordinator alone owns shared exports, shared scale types/contracts, Studio declarations, catalogs, documentation indexes, and integration. Agents request shared changes through the coordinator.

## Audit and capability checklist

Current public exports: `packages/viz/src/index.ts`. Current behavior: `packages/viz/src/lib/`; public evidence: `packages/viz/test/`; public guide: `docs/site/learn/guides/data-visualization.md`.

| Area | Shipped evidence | Remaining deliverables | Dependencies | State |
| --- | --- | --- | --- | --- |
| Bars | Vertical values/ranges, thresholds, grouping via nested band scales; bar-series, grouped-bars, stacked-bars tests | Horizontal value/range bars; grouped-stacked editable example; equivalent styling, thresholds, inspection, grouping in both orientations | Orientation contract | Proposed |
| Axes | Linear bottom/left; types.ts and axis.tsx | Band ticks/labels; top/right; bounded tick selection, formatting and domain behavior | Tick contract, later continuous scale work | Proposed |
| Scales | Linear/band; finite explicit domains; evenly spaced numeric ticks; scale tests | Time/UTC/log; domain helpers; nice domains/ticks; validation, unknown/missing, clamping, timezone/calendar and extension rules | Coordinator cross-cutting design | Proposed |
| Lines | Numeric straight lines, gaps, source order, one path; Point/Plot series | Step and smooth curves; segment styling; categorical line/point coordinates; matching hit geometry | Scale capability and curve/style decisions | Proposed |
| Pie | pieSlices, PieLayout/PieSlice/PieLabel; identity, coordinated labels and inspection | Donuts; custom label content with explicit measurement and bounded placement | Ring geometry and label measurement contracts | Proposed |
| Responsive interaction/accessibility | Core responsive styles/events/focus; example brush/pan; point touch target test | Viz-owned responsive styles; phone/touch evaluation; keyboard exploration; synced host-owned semantic summary/table; reusable selection, brush, pan/zoom, linked views | Scale inversion; responsive resolution; explicit interaction design | Proposed |
| Additional series | None of requested families exported | Area; HighLowSeries, OHLCSeries, CandlestickSeries; BoxPlotSeries + pure boxPlotSummary; histograms; heatmaps | Scale/line foundation; statistics and bin contracts | Proposed |
| Large data | Batched line/point targets; nearest and hover linear scans; bars have per-row Rectangles | Sampling/decimation; nearest indexing and efficient picking; small/stress examples; accuracy/update/memory/ownership guarantees | Data revision and geometry contracts | Proposed |

Grouped-stacked behavior already has composition evidence; dedicated presentation and orientation coverage remain. Core responsive support does not imply viz marks accept responsive rules. Canvas focus does not provide semantic accessibility.

## Proposed delivery order and parallel work

1. First wave: one agent handles horizontal bars plus categorical/four-sided axes; another handles donuts. These touch separate implementation files; shared publication files stay coordinator-owned. Each is delivered as a small slice, not held for completion of the wave.
2. While first slices await feedback, coordinator presents continuous-scale contract (time/UTC/log, helpers, validation, ticks, clamping, extension boundary). Implement only after approval. Custom pie labels can proceed independently once their sizing contract is approved.
3. After scale contracts settle: one stream handles categorical coordinates, curves, segment styles and area; another handles responsive marks, keyboard/touch and composable interaction. Define large-data identity/invalidation/accuracy contracts here before adding caches.
4. Additional families in separate feedback slices: HighLow/OHLC/candlesticks; box plots and pure summary; histogram bins/rendering; heatmaps. Parallelize independent families only with separate files/worktrees and coordinator-owned shared publication.
5. Large-data helpers, indexing/picking, sampling and representative stress examples; profile each relevant path before modifying it. This is not permission to postpone performance acceptance of earlier slices.
6. Incremental accepted merges throughout; final verification on the fetched, integrated main tree, full trust gate, push and remote verification.

Roadmap approval approves sequencing and scope, not unspecified public APIs. Each contract gets a concrete example, alternatives, recommendation, performance implications and smallest slice before implementation.

## First contract batch for approval

### Horizontal bars and categorical axes

Approved semantic bar API (breaking replacement, no aliases):

```tsx
<BarSeries orientation="horizontal" data={rows}
  category="category" value="value" baseline={0}
  categoryScale="category" valueScale="value" />
<BarSeries orientation="horizontal" data={ranges}
  category="category" valueStart="start" valueEnd="end"
  categoryScale="category" valueScale="value"
  group="group" groupScale="group" />
<Axis scale="category" position="left" />
<Axis scale="value" position="top" />
```

Replace old x/y/xStart/xEnd/yStart/yEnd/xScale/yScale bar vocabulary outright. Value bars take value and optional baseline; ranges require both valueStart/valueEnd and forbid value/baseline. Category, categoryScale, valueScale are required. Keep orientation (default vertical), group/groupScale as a paired input. Lines/points keep x/y. Orientation determines physical dimensions; callers supply matching scale ranges and axis positions. Threshold fills follow the value axis. Nested group offsets follow the categorical axis. Migrate all source examples, public docs, declarations, consumers and tests; historical records remain historical.

Axis positions are bottom/left/top/right, with categorical centers. Complete tick rules are in the resolution packet below; the numeric/string formatter is approved in principle.

Smallest slice: horizontal values + left categorical labels, editable Studio example and focused public geometry evidence. Follow with ranges/grouped-stacked/threshold inspection and top/right axes. Existing bars are O(n) with per-bar Rectangle ownership; this is not a batching claim.

### Donuts (independent first-wave contract)

Recommend `PieLayout style={{ radius: 100, innerRadius: 55 }}` with default innerRadius zero, finite `0 <= innerRadius < radius` (zero-radius empty allocations need explicit handling). Each computed slice carries the shared inner radius. PieSlice draws and targets the same ring-sector geometry via existing Path composition; the hole does not hit. Preserve ordinary keyed slices, label coordination and inspection. Alternative: extend core Wedge with innerRadius; defer that broader core API decision unless composition proves inadequate.

Smallest slice: existing editable pie example with a donut toggle and hit-through-hole evidence. Radius zero must preserve existing empty-layout behavior. No custom-label API is implied by donut approval.

## Later decision packets (all scope retained)

- Scales: epoch numbers versus Date authoring; UTC versus browser-local calendar ticks and DST; negative/zero log domains; missing values versus malformed values; clamping defaults; explicit extent/nice helpers; scale extension protocol. Preserve current linear default behavior unless explicitly approved otherwise.
- Lines/area: step-before/after/mid variants; bounded smooth interpolation choice, overshoot and non-monotonic x; segment style callback and boundary ownership; band-center mapping; curve-aware inspection and hit tolerance; stacked/range area scope.
- Pie labels: custom CRC content with explicit finite measured box or caller-supplied dimensions; measurement cache invalidation; no unbounded iterative layout.
- Interaction: pure/state helpers versus hooks; caller-owned targets/signals; pointer identity/capture/cancel, wheel anchor and units, touch policy, domain clamping; keyboard parity and linked-view ownership. No new scheduler, event system or chart container.
- Accessibility: keyboard exploration plus host-owned semantic summary/table sharing selection state; manual assistive-technology evaluation and tested phone portrait/landscape interactions. Do not claim Canvas logical focus exposes screen-reader semantics.
- Statistics/families: quantile definition, whiskers/outliers, missing/invalid data, sorting/copying/mutation and empty/singleton summaries; histogram boundaries, under/overflow and density; heatmap sparse/missing cells and color domain. Specify these before helper APIs.
- Large data: immutable identity or explicit revision, exact nearest tie rules, sorted/unsorted behavior, transformed pixel geometry, approximation error and source provenance, gap preservation, cache ownership and eviction.

## Performance acceptance proposal

Establish reproducible baseline per relevant hot path before changing production code. Record revision, Node/browser/device, dataset seed/size, warmup/repetitions, static redraw, changed-data/streaming update and interaction timings. Use 100, 10,000 and 100,000 records where appropriate, with both small and stress examples. No fresh timing baseline exists yet; do not claim no regression.

Deterministic budgets: preserve one line path/target for default linear rendering and one PointSeries target; zero optional index/decimation resources/subscriptions when unused; zero index/sampling rebuilds for unchanged data and unchanged relevant scales/options; no full-data preprocessing inside pointer-move callbacks; exact teardown. Preserve bars' existing per-row cost until a separately justified change.

Proposed sorted-x nearest: O(n) preprocessing and O(log n) query, with source-order ties and a documented unsorted fallback; general 2D nearest requires its own exact index contract, not a sorted-x claim. Proposed extrema sampling: O(n) preprocessing and O(pixel columns + gap segments) emitted geometry; a gap-free 100,000-point monotone-x input at 1,000 columns should emit at most 2,002 vertices. Gap preservation must not be sacrificed to the gap-free bound. Inspection retains original data and indices. All algorithm proposals remain subject to design approval.

Timing budgets will be fixed from measured baselines before each change, with measurement noise disclosed. Material regression must be removed or explicitly accepted by user; changing workloads or baselines to hide regressions is forbidden.

## Per-slice completion and evidence ledger

For every row above, record: approved contract/date; owner/branch/worktree and file ownership; focused failing public test; baseline; focused pass; exact editable Studio URL and interactions; user feedback; hardened edge cases/docs/types/ownership/performance; independent review and findings; package/Studio/source+built verification; integrated commit; push/remote revision.

Slice ready for feedback = runnable public behavior + focused checks + editable example/headless evidence. Stop that slice's broader hardening until experiential feedback. Independent approved work may continue.

Feature complete = accepted behavior + hardening/docs/performance + independent review resolved + proportional public/package/browser verification + merged and pushed. Overall complete requires all eight scope rows, full `corepack pnpm@11.21.0 trust` on actual combined tree, measured results, accepted limitations, remote status and preservation confirmation.

## Verification and approval log

- Audit: source inspection only; no tests or benchmarks run yet.
- Remote main fetched and matched audit revision.
- Shell default Node v26.9.0 is unsuitable for required verification. Verified installed `/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin/node` reports v24.15.0. pnpm reports 11.21.0. Managed checkout still needs dependency provisioning and Chromium validation.
- Initial roadmap and delivery order: approved by user on 2026-09-30.
- Semantic BarSeries replacement: explicitly approved; no compatibility aliases. Numeric/string tick formatter compatibility is not a blocker. Remaining first-batch details approved by user ("I approve").
- All slice feedback/reviews/merges/pushes: pending.


## Contract resolution packet — approved

### 1. Donut containment and fallback

Use `innerRadius` in PieLayout style and resulting slice geometry. It defaults to zero. Require finite `0 <= innerRadius < radius` for a nonempty radial allocation. For radius zero, permit innerRadius zero only and preserve empty-layout behavior. Reject a positive zero-thickness or inverted ring instead of silently rendering it.

Keep one deterministic inside candidate on the angular bisector at `innerRadius + 0.65 * (radius - innerRadius)`. This preserves the solid-pie candidate at innerRadius zero. Center the complete measured axis-aligned label box there.

The whole box must lie within allocation bounds and the slice's conservative angular region, every corner must be within the outer disk, and the shortest distance from the pie center to the entire box must be at least innerRadius. Compute that distance by independently clamping the center into the box's x/y intervals. Checking only corners against the hole is insufficient. Tangency counts as fitting. Use the existing conservative angular half-angle `min(sliceSpan/2, pi/2)`; this is a convex wedge/half-plane, so corner checks prove full box containment. This may omit a box that a more expensive placement search could fit in a wide sector; there is no search/relaxation loop.

Empty label text, zero angular span, or zero outer radius stays hidden with reason `empty`. Otherwise placement inside hides a failed box with `inside-fit`; auto tries the same outside lane placement as outside, and hides with `space` if it cannot fit there. Outside leaders anchor to the outer radius. No moving labels into the hole and no label clipping as a substitute for fitting.

Use existing Path composition for an annular sector with identical paint/hit geometry; no core Wedge API change is implied. Custom labels later must declare a complete finite box and obey the same containment rules; their authoring/measurement API remains a separate approval.

Work budget: O(1) candidate containment per label; existing outside layout at most O(n log n) sort plus linear sweeps. Regression cases include an edge crossing the hole despite all corners being outside, a box containing the center, thin rings, tangencies, sector boundaries, inside hiding, auto fallback and exhausted outside space.

### 2. Explicit and generated ticks

Proposed Axis API: `tickValues?: SignalValue<readonly (number | string)[]>`, mutually exclusive with explicitly supplied tickCount (including an empty tickValues list). `tickFormat(value: number | string, index: number): string` receives the actual emitted value and its emitted order index. Time types remain a later contract.

Explicit ticks:

- Require an actual array of at most 100 values; reject oversized input before copying, formatting or building any tick nodes/paths. Empty means baseline only.
- Numeric scales require finite numbers within the inclusive closed domain extent, including descending domains. No coercion, clamping or silent out-of-domain filtering.
- Band scales require known string/finite-number categories. Number 1 and string "1" are distinct. Unknown categories are errors.
- Reject duplicates using SameValueZero (0 and -0 duplicate); compare values, not formatted strings. Repeated formatted text is permitted.
- Preserve caller order for tick nodes, formatting and paint; positions always come from scale mapping. Never sort or deduplicate explicit ticks.
- Validate the whole bounded list before calling tickFormat. A formatter must return a string. Baseline is independent of selection.

Generated ticks:

- Axis tickCount defaults to 5 and must be an integer 0..100. This Axis behavior does not implicitly alter resolvedScale.ticks until that scale contract is approved.
- Count 0 gives no ticks/labels; count 1 gives the first domain endpoint/category. Empty band domains give no ticks; a singleton gives one for any positive count.
- For band count >=2, let m=min(count, domain.length). Emit domain indices round(i*(n-1)/(m-1)) for i=0..m-1 when m>=2. These are unique, ordered and include both endpoints. Selection is O(m), with no extra full-domain copy or traversal; existing scale construction still validates the domain in O(n).
- Linear counts >=2 retain evenly spaced endpoints for this slice. Nice/time/log tick selection comes with the scale design.
- Band tick coordinates are map(value)+bandwidth/2 even for reversed ranges. All four Axis placements use the caller's scale direction. Label count is bounded at 100; no implicit collision solver or text measurement is added.

Alternatives: silently drop invalid explicit ticks or silently deduplicate/sort. Recommendation is strict validation and preserved order so configuration mistakes and geometry remain observable.

### 3. Cache, sampling and index invalidation

Stable array/callback identities are not proof of stable results. Separate correctness from optional reuse:

- Default evaluation: whenever a consuming component evaluates, reevaluate relevant data/accessors/predicates/labels in its tracked evaluation context. Compare resolved semantic snapshots if reusing geometry or label measurements. This may require O(n) accessor work; do not advertise constant-time unchanged-data checks without an explicit contract.
- Opt-in persistent preprocessing: propose `revision?: SignalValue<number>` on consumers that offer cached preprocessing, starting with PieLayout. Supplying a finite nonnegative safe integer opts into the caller's revision promise; change it whenever in-place data or nonreactive accessor/label dependency changes. Omission uses the default above. This is not a mandatory prop on every series.
- Data replacement, accessor/value/key/defined/label callback replacement, revision changes, and signal reads that invalidate during tracked evaluation all invalidate their dependent preprocessing. Signal reads inside stable callbacks remain real dynamic dependencies; successful reevaluation replaces those edges. New data identity invalidates even if values appear equal. No deep freeze, deep hash, global cache, or reliance on callback identity alone.
- The revision promise covers mutable datum fields, same-array additions/removals/reorder, ordinary captured variables, external mutable lookup tables, and mutable option contents. Replacing the accessor/options or changing revision is required for nonreactive changes. Setting a data signal to the same array may be equality-suppressed; an independently changed revision signal schedules work. Plain mutation alone never schedules CRC.
- Mapping-dependent geometry/index/sampling invalidates for resolved scale kind/domain/order/range/direction, band spacing/bandwidth, relevant allocation, and future log/time/clamp options. Equivalent resolved mappings may reuse work despite wrapper object replacement. Domain-only indexes can survive unrelated pixel changes; any query maps results using the current committed scale, and pixel-distance/approximation decisions must not use stale mapping.
- Algorithm, accuracy, ordering, tolerance, gap policy and output-budget changes invalidate affected preprocessing. Pie layout additionally depends on center/radii/bounds/font/label sizing/placement/gap. Paint-only selection changes do not invalidate geometry unless an accessor actually depends on that selection. Font-resource changes affecting measured text require explicit revision until an owned font-resource signal exists.
- Pure preprocessing helpers build an explicit snapshot on each call, with copied coordinates and source index/key references; no hidden cross-call cache. Retained datum references are provenance, not live coordinate promises. Exact helper APIs remain a later approval. Caller-owned snapshots are released by callers; mounted caches by the mount. All persistent storage is bounded to current generations, not a history of revision values.
- Build outside pointer-query handlers in scheduled tracked work. Publish geometry, sampling/index and source metadata together only after successful completion. A failure cannot publish partial or mismatched state; retry invalidated work. Queries refer to one coherent committed generation, never mix live datum mutations with old projected coordinates. Tear down subscriptions/cache references exactly on removal/disposal.

Performance implication: O(n) safe accessor evaluation versus opt-in unchanged-input reuse is explicit. Cached selection-only PieLayout examples will supply revision and retain their zero-remeasurement expectation. Verify same-identity mutation plus changed revision, changed nonreactive closure plus revision, stable callback signal dependency changes, accessor replacement, reorder, scale resize/reverse/domain, option changes, equal-mapping reuse, failed rebuild/recovery, no optional allocations, and disposal. The first slice gets focused evidence; broader matrix waits for feedback.

Example of the proposed opt-in contract:

```tsx
const revision = signal(0);
// Supply revision to the cached consumer. After mutating rows or a plain
// captured multiplier, increment revision outside render to schedule rebuilding.
<PieLayout data={rows} revision={revision} value={valueOf} label={labelOf}>
  {renderSlice}
</PieLayout>;
```

Alternative: require immutable rows and pure callbacks everywhere. Recommendation is safe default plus explicit revision-based reuse, retaining CRC signal tracking and supporting mutable/streaming callers without pretending mutations are observable automatically.


## First-wave implementation ledger

- Coordinator owns shared types/exports, Studio declarations, packed consumer, catalogs and integration in codex/viz-roadmap.
- audit_series owns codex/viz-semantic-bars at /Users/benlesh/.codex/worktrees/viz-semantic-bars/crc: bar/axis implementation, focused tests, bar example sources.
- audit_interaction owns codex/viz-donuts at /Users/benlesh/.codex/worktrees/viz-donuts/crc: pie geometry/layout/revision, focused tests, pie example source.
- Coordinator baseline on Node v24.15.0, pnpm 11.21.0: locked install, workspace build, and tsc --noEmit passed.
- Focused public Axis type evidence added first: tsc failed with TS2322 for right/top positions before type changes. Runtime implementation remains agent-owned.
- No experiential feedback, independent implementation review, main integration or push yet.
