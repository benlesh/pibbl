# Remaining visualization roadmap

> **Historical status: Approved roadmap record; it does not define current shipped behavior.**

Status: roadmap, semantic BarSeries replacement, and complete label-fit/tick/invalidation resolution packet approved. First bars/axes and donut slices accepted; hardening and integrated verification underway.
Audit date: 2026-09-30. Audited and fetched main: `d9c28931da2dc659314baed6c0c79c13ab14e48a`.
Objective source: `/Users/benlesh/.codex/attachments/31d3419b-d22d-4d2f-9276-a048e890465a/goal-objective.md`.

## Ownership and preservation

Coordinator: this chat, branch `codex/viz-roadmap`, managed worktree `/Users/benlesh/.codex/worktrees/viz-roadmap/pibbl`.
Read-only audits: `audit_series` (series), `audit_interaction` (scales, interaction, accessibility, performance). Reuse agents for approved implementation and later independent reviews.
No artifacts were attached initially. Other worktrees are owned by other chats; none is assumed free. The original `codex/physics-2d-quality` checkout has substantial tracked and untracked work and is untouched.
Each concurrent implementation gets its own managed worktree and codex branch. The coordinator alone owns shared exports, shared scale types/contracts, Studio declarations, catalogs, documentation indexes, and integration. Agents request shared changes through the coordinator.

## Audit and capability checklist

Current public exports: `packages/viz/src/index.ts`. Current behavior: `packages/viz/src/lib/`; public evidence: `packages/viz/test/`; public guide: `docs/site/learn/guides/data-visualization.md`.

| Area                                 | Shipped evidence                                                                                                  | Remaining deliverables                                                                                                                                                 | Dependencies                                                        | State    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Bars                                 | Vertical values/ranges, thresholds, grouping via nested band scales; bar-series, grouped-bars, stacked-bars tests | Horizontal value/range bars; grouped-stacked editable example; equivalent styling, thresholds, inspection, grouping in both orientations                               | Orientation contract                                                | Proposed |
| Axes                                 | Linear bottom/left; types.ts and axis.tsx                                                                         | Band ticks/labels; top/right; bounded tick selection, formatting and domain behavior                                                                                   | Tick contract, later continuous scale work                          | Proposed |
| Scales                               | Linear/band; finite explicit domains; evenly spaced numeric ticks; scale tests                                    | Time/UTC/log; domain helpers; nice domains/ticks; validation, unknown/missing, clamping, timezone/calendar and extension rules                                         | Coordinator cross-cutting design                                    | Proposed |
| Lines                                | Numeric straight lines, gaps, source order, one path; Point/Plot series                                           | Step and smooth curves; segment styling; categorical line/point coordinates; matching hit geometry                                                                     | Scale capability and curve/style decisions                          | Proposed |
| Pie                                  | pieSlices, PieLayout/PieSlice/PieLabel; identity, coordinated labels and inspection                               | Donuts; custom label content with explicit measurement and bounded placement                                                                                           | Ring geometry and label measurement contracts                       | Proposed |
| Responsive interaction/accessibility | Core responsive styles/events/focus; example brush/pan; point touch target test                                   | Viz-owned responsive styles; phone/touch evaluation; keyboard exploration; synced host-owned semantic summary/table; reusable selection, brush, pan/zoom, linked views | Scale inversion; responsive resolution; explicit interaction design | Proposed |
| Additional series                    | None of requested families exported                                                                               | Area; HighLowSeries, OHLCSeries, CandlestickSeries; BoxPlotSeries + pure boxPlotSummary; histograms; heatmaps                                                          | Scale/line foundation; statistics and bin contracts                 | Proposed |
| Large data                           | Batched line/point targets; nearest and hover linear scans; bars have per-row Rectangles                          | Sampling/decimation; nearest indexing and efficient picking; small/stress examples; accuracy/update/memory/ownership guarantees                                        | Data revision and geometry contracts                                | Proposed |

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
<>
  <BarSeries
    orientation="horizontal"
    data={rows}
    category="category"
    value="value"
    baseline={0}
    categoryScale="category"
    valueScale="value"
  />
  <BarSeries
    orientation="horizontal"
    data={ranges}
    category="category"
    valueStart="start"
    valueEnd="end"
    categoryScale="category"
    valueScale="value"
    group="group"
    groupScale="group"
  />
  <Axis scale="category" position="left" />
  <Axis scale="value" position="top" />
</>
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
- Pie labels: custom Pibbl content with explicit finite measured box or caller-supplied dimensions; measurement cache invalidation; no unbounded iterative layout.
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
- The revision promise covers mutable datum fields, same-array additions/removals/reorder, ordinary captured variables, external mutable lookup tables, and mutable option contents. Replacing the accessor/options or changing revision is required for nonreactive changes. Setting a data signal to the same array may be equality-suppressed; an independently changed revision signal schedules work. Plain mutation alone never schedules Pibbl.
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

Alternative: require immutable rows and pure callbacks everywhere. Recommendation is safe default plus explicit revision-based reuse, retaining Pibbl signal tracking and supporting mutable/streaming callers without pretending mutations are observable automatically.

## First-wave implementation ledger

- Coordinator owns shared types/exports, Studio declarations, packed consumer, catalogs and integration in codex/viz-roadmap.
- audit_series owns codex/viz-semantic-bars at /Users/benlesh/.codex/worktrees/viz-semantic-bars/pibbl: bar/axis implementation, focused tests, bar example sources.
- audit_interaction owns codex/viz-donuts at /Users/benlesh/.codex/worktrees/viz-donuts/pibbl: pie geometry/layout/revision, focused tests, pie example source.
- Coordinator baseline on Node v24.15.0, pnpm 11.21.0: locked install, workspace build, and tsc --noEmit passed.
- Focused public Axis type evidence added first: tsc failed with TS2322 for right/top positions before type changes. Runtime implementation remains agent-owned.
- No experiential feedback, independent implementation review, main integration or push yet.

## Integrated first-slice feedback ledger

- Integrated preview branch: donut `4824e4a4` (agent source `5527aa17`), bars/axes `e20e537a` (agent source `35581ea8`). Main is unchanged.
- Combined `tsc --noEmit` passed. Focused Chromium integration: bar-series, grouped-bars, stacked-bars, bars-example, pie-layout, pie-example, composition — 7 files / 41 tests passed (Node 24.15.0, pnpm 11.21.0). No timing comparison is claimed.
- Preview: http://127.0.0.1:5187/ (coordinator checkout). Runtime bundling requires restarting this preview after implementation commits; restart performed after integration.
- Donut Studio toggle exercised in Chromium, no runtime errors and no TypeScript issues. Hole pixel matches background; ring pixel remains colored. Visual inspection completed. Slice ready for feedback at http://127.0.0.1:5187/#/examples/composition/viz-pie-composition . User feedback requested; independent review/hardening pending.
- Horizontal bars Studio toggle works and displays categorical left/top numeric axes, but visual inspection found threshold gradient still oriented vertically. Agent assigned focused fix before declaring bars ready.
- Source/build/package completion, controlled performance comparison, broader hardening and main merges remain pending experiential feedback.

- Follow-up bars correction integrated as `7f1dcae8` (agent source `aee5ef47`): horizontal normal/reversed threshold gradients, singleton category selection, mutually exclusive tick runtime validation and early tick validation. Affected Chromium rerun: 3 files / 8 tests passed. Combined tsc subsequently passed after removing unused test-spy parameters.
- Fresh Studio runtime restarted after that correction. Horizontal toggle exercised with no TypeScript issues/runtime errors; screenshot inspected and confirms red fill begins at the 300k rule. Bars/axes slice now ready for feedback: http://127.0.0.1:5187/#/examples/composition/viz-band-bars . Inspect orientation, categorical labels/top ticks, signed baseline, threshold fill, hover/tap and reverse/spacing/resize controls.
- Both first slices await experiential feedback. No independent review/hardening or main merge yet. Preview remains running on port 5187; preserve its coordinator checkout. All three managed worktrees remain active for follow-up.
- Next custom-label design researched only: prefer explicit finite box allocation and reuse PieLabel composition, with the same approved whole-box containment. No custom-label public contract approved or implemented yet.

## Acceptance and hardening checkpoint

User accepted both first slices: “Approved. Very cool.” Independent cross-reviews
completed by the agent who did not implement each slice. No material runtime
findings in those initial reviews; documentation prop-name typos were found and
corrected. Donut hardening integrated as 87149968; bars/axes as 2a247e3b.
Latest origin/main path-playground changes were merged into the integration
branch before final verification. Original working checkout remains untouched.

Public docs now describe semantic bar props, explicit categorical/four-sided
ticks, full-box donut label containment and revision caching. Docs verification
and all 979 mutation probes pass after source snippets and file classification
were corrected.

Controlled first performance pair uses an identical opt-in public fixture,
Chromium 151.0.7922.34 on macOS arm64, Node 24.15.0 and pnpm 11.21.0. Baseline
is d9c28931 in a separate managed checkout. No other agent browser work ran
during the pair. Warmed medians use two warmups and seven observations; cold
mount time is descriptive only. Bar results show no clear slowdown. Dense solid
pie redraw measured 29.4 ms versus 25.6 ms (+14.8%); this is under investigation,
not accepted or omitted. Preserve original solid Wedge behavior if the optional
donut path changes inactive cost or focus bounds.

Grouped-stacked editable example is assigned to audit_series as a separate
approved-API feedback slice. Custom-label finite-box/PieLabel-children contract
was proposed asynchronously; awaiting explicit user approval before code.

## Accepted-tree verification, 2026-09-30

- Integrated current main 1a664bb6 and preserved all upstream path-algorithm work.
- Donut focus correction 0ee84b7d restores original Wedge behavior for solid pies;
  b54e80f4 bounds annular sweep work even for huge finite angles. Independent
  review cleared both fixes. 341bb003 removes zero-hole distance work; focused
  PieLayout suite: 19 passed; independent changed-code review cleared it.
- Full `corepack pnpm@11.21.0 trust` passed on the combined production tree at
  341bb003 using Node 24.15.0, pnpm 11.21.0, Playwright Chromium 151.0.7922.34.
  Main browser suite: 290 files passed, one opt-in file skipped; 3,210 tests
  passed, five skipped. Packed consumers, Bundler/NodeNext, Studio source/built
  declaration parity, visual safeguard/Studio visuals, built smoke, lifecycle
  (43 passed), and structural performance (49 passed, four skipped) all passed.
  No visual baselines changed. Fresh logs: /tmp/pibbl-viz-trust.log.
- Performance baseline/candidate/repeated/corrected raw records and investigation
  are in docs/testing/field-notes/2026-09-30-viz-first-wave-performance.{md,json}.
  No arbitrary percent tolerance was accepted; timing variation is reported.
- Grouped-stacked next slice is a separate example commit, not yet accepted.
  Custom label composition and UTC scale contracts remain unapproved; no
  production implementation for either has begun.

## Incremental main delivery

- Accepted bars/axes/donut work pushed to remote main at
  `6d02d20d577be2d9cd0d0dfec4b2c46151617362`; remote ref verified.
- Final full trust passed on that exact committed tree (log
  /tmp/pibbl-viz-trust-final.log): main browser suite 3,210 passed / six skipped,
  including two opt-in diagnostic files; all other aggregate phases passed.
- Identical baseline/candidate structural probes matched all target, paint,
  fill, label and pointer-hit counts at 100/1,000 solid slices, before/after
  data replacement. Both raw outputs are retained with timing evidence.
- Main's unrelated changes and all unrelated working checkouts were preserved.
- Grouped-stacked example is integrated only on the preview branch for the next
  experiential slice. Catalog authoring validation is being resolved before
  declaring it ready; focused mount test and typecheck pass.
- UTC-only scale contract was sent for explicit approval. Generic numeric extent
  and explicitly typed UTC niceDomain helpers are proposed; implementation
  remains blocked on that design decision. Local time/log remain in scope.

## Grouped-stacked feedback checkpoint

- Registered editable example at
  http://127.0.0.1:5187/#/examples/composition/viz-grouped-stacked-bars .
- Focused mount/inspection test passed; typecheck passed; learning-source
  validation passed. Catalog now includes 69 lessons.
- Fresh Studio browser check toggled horizontal orientation and inspected
  Q1 / North / Products / $160k. No runtime errors or editor TypeScript issues.
  Screenshot inspected; component legend and top ticks have separate rows.
- Slice ready for feedback, not feature complete or pushed to main. Await
  experiential feedback before broader hardening and independent review.
- Preview remains on port 5187; preserve coordinator checkout/server.

## Pending design sources

- [UTC scale proposal](viz-utc-contract-proposal.md): approval pending. Includes
  exact numeric/helper/tick boundaries and a stateless full-ISO default formatter
  so generated and explicit endpoint labels do not depend on prior tick calls.
- [Custom pie labels](viz-pie-label-contract-proposal.md): preserves the earlier
  explicit-box/PieLabel-children proposal; approval pending.
- Grouped-stacked experiential feedback remains pending. This boundary blocks
  broad hardening, review, and main integration of that example.
- The preceding goal turn made concrete progress: accepted slices were pushed
  after exact-tree trust and the next runnable example was delivered. No
  additional contract or feedback approval has arrived in this continuation.

## Next-wave approval, 2026-09-30

User approved the grouped-stacked feedback slice and both pending UTC/custom
pie-label designs, and requested commit, merge, push, then continued data-viz
work. Grouped-stacked independent review and final exact-tree trust precede the
push. UTC and custom label implementation starts after that integration.
Prior pending statuses above are historical checkpoints, superseded here.
The full roadmap remains in scope; local-time/log and later capabilities still
require their own concrete contract approvals.

Grouped-stacked hardening: independent review found no runtime/public-surface
defect. The identified horizontal-inspection evidence gap is covered by fresh
readout assertions for horizontal North/Products and South/Payroll, plus a
vertical negative Payroll segment; focused Chromium test passes. This example
adds no library runtime path: 32 prepared ranges use the already measured
BarSeries, and inspection scans those 32 rows with no retained index or new
scheduler. Broad large-data claims are not made for this teaching example.
