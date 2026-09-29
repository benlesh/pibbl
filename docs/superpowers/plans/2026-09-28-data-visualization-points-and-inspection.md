# Visualization Points, Custom Plots, and Inspection Implementation Plan

> **Historical status: Approved design and active implementation evidence; verification is recorded in the plan.**

> **For agentic workers:** Use `superpowers:executing-plans` for inline execution. If the user chooses delegation, use `superpowers:subagent-driven-development`, subject to the repository's limits and feedback checkpoint. Steps use checkboxes for tracking. Base execution approved in an isolated worktree. The user subsequently requested the full continuation. Final execution outcomes below supersede the original feedback pauses.

**Goal:** Ship batched PointSeries dots, PlotSeries custom CRC marks, pure nearest-data helpers, function-based HoverData queries, and anchor-protecting HoverCard placement; demonstrate single and multi-line inspection in runnable Studio lessons.

**Architecture:** Both series consume existing allocation-relative Scale providers and core signals. PointSeries paints ordered circles with one union target; PlotSeries emits keyed translated subtrees whose returned elements retain normal CRC behavior. Lookup helpers operate on plain data and resolved linear-scale snapshots without owning reactive state. HoverData receives ordinary query functions and owns their render-time signal reads; HoverCard independently handles declared-box placement.

**Tech Stack:** TypeScript, CRC JSX, Canvas 2D/Path2D, Vitest with Playwright Chromium, Node 24.15+ on Node 24 LTS, pnpm 11.21.0.

**Spec:** [Approved points, custom plots, and inspection design](../specs/2026-09-28-data-visualization-points-and-inspection-design.md).

## Global constraints

- Design and execution are approved. Implementation is isolated on `codex/viz-points`.
- Preserve unrelated changes and untracked files, including concurrent responsive-style work. Do not create a worktree unless requested.
- No new runtime dependency, scale family, Chart container, scheduler, event system, or implicit clipping/sorting/domain inference.
- Preserve existing LineSeries, Axis, ScaleAdjust, scale signal ownership, and same-rendering-instance provider restriction.
- Public contracts need public-API evidence. Add failing focused tests before production changes; internal counters only supplement that evidence.
- PointSeries has bounded component/target counts. PlotSeries deliberately has per-row subtrees. Never implement PointSeries through PlotSeries.
- Deliver the runnable slice before broad hardening, documentation polish, or aggregate verification. The initial Task 4 checkpoint is complete; the later full-continuation request authorizes H1–H5 and hardening without another approval pause.
- Use native inline execution by default; tasks share implementation context. At most one implementation agent and one reused review agent if delegation is chosen. Do not override configured model defaults.
- Stage only explicitly owned files for milestone commits. Do not bundle the concurrent responsive specification, tests, strategy edits, or verifier changes. No push/merge is implied.

## Review focus

1. Overlapping translucent fill/stroke must preserve per-row paint order, not compound-fill or style-grouped output (Tasks 1 and 5).
2. Keyed custom marks must retain state on reorder but clean up on invalidation/removal; numeric/string keys follow core normalization (Tasks 3 and 5).
3. Event coordinates are root-logical while lookup uses local scale coordinates; transformed queries must never silently mix spaces (Tasks 2, 4, and 5).
4. Branch-dependent callback signal reads and failed renders must not retain consumers or wake disposed owners (Tasks 3 and 5).
5. Responsive rules query plot allocation, not point position/bounds; advertised types must correspond to a real core evaluator (Tasks 0 and 6).

## File map

Create these focused units; private modules remain unexported:

| File                                                                                | Responsibility                                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/viz/src/lib/point-types.ts`                                               | Approved PointAccessor, PointMarkStyle, PointSeriesStyle, PointStyleResolver, PointSeriesProps declarations |
| `packages/viz/src/lib/plot-types.ts`                                                | Approved PlotKeyAccessor and PlotSeriesProps declarations                                                   |
| `packages/viz/src/lib/point-data.ts`                                                | Shared pure key/function accessor normalization and finite-coordinate eligibility; no hooks or DOM          |
| `packages/viz/src/lib/point-series.tsx`                                             | Data/scale/style receiver, ordered dot paint, one core event target                                         |
| `packages/viz/src/lib/point-geometry.ts`                                            | Circle paint paths and nonzero-winding union hit geometry                                                   |
| `packages/viz/src/lib/plot-series.tsx`                                              | Structural listener parent, keyed translation wrappers, stable internal row component                       |
| `packages/viz/src/lib/nearest.ts`                                                   | nearestDomainValue, nearestPoint, NearestPointOptions, NearestPoint                                         |
| `packages/viz/test/point-series.test.tsx`                                           | Public dot geometry, compositing, events, updates                                                           |
| `packages/viz/test/plot-series.test.tsx`                                            | Public custom-node placement, state/keys, events                                                            |
| `packages/viz/test/nearest.test.tsx`                                                | Helpers using scale snapshots captured through public Scale/useScale                                        |
| `packages/viz/test/points-lab.test.ts`                                              | Headless public scenario driver                                                                             |
| `packages/viz/test/points-ownership.test.tsx`                                       | Post-feedback deterministic ownership and structural performance                                            |
| `packages/scenarios/src/learning/composition/viz-points-and-inspection.example.tsx` | Standalone editable public lesson, optional fixture input                                                   |
| `packages/scenarios/src/viz-points-lab.ts`                                          | Deterministic lab adapter/actions/state                                                                     |

Modify `packages/viz/src/index.ts` for root exports and
`packages/viz/type-tests/public.tsx` for positive/negative public consumers.
Keep existing `types.ts` names available; do not restructure unrelated types or
LineSeries merely to share a few lines. PointAccessor remains compatible with
the approved LineAccessor alias.

Register the example/lab in `packages/scenarios/src/learning-catalog.ts` and
`packages/scenarios/src/catalog.ts`; update `playground/src/scenario-sources.ts`
for the lab source adapter, and regenerate the catalog index with its existing
command. Extend `packages/viz/test/studio.test.ts` for editable source and new
exports. Existing aliases/package setup already support @crc/viz.

After feedback, update `tooling/verify-packed-viz.mjs`,
`playground/src/crc-editor-types.txt` and
`tooling/verify-studio-types.mjs` for the maintained editor declarations and
source/built/Studio consumer checks, `packages/viz/README.md`, `docs/site/learn/guides/data-visualization.md`,
and create `docs/site/api/components/point-series.md`,
`docs/site/api/components/plot-series.md`, and
`docs/site/api/functions/nearest-point.md` plus
`docs/site/api/functions/nearest-domain-value.md`. Register all pages through the existing metadata/checker, never a parallel index.

## Task 0: Reconcile execution prerequisites

**Files:** Read `AGENTS.md`, the approved spec, current core style/layout/events/hooks contracts, `packages/viz/src/lib/{scale,scale-context,scale-adjust,paint}.ts`, and the responsive specification/current tests. No production edits.

**Interfaces:** Consume existing Scale/useScale/SignalValue/CRCNode and public `useEventTarget`, `useEventListener`, `useCanvasContext`, `Group`. Use core's version-coupled friend entry only where the current package already legitimately needs it.

- [x] Record `git status --short`, current revision, `node --version`, and `corepack pnpm@11.21.0 --version`; account for every pre-existing change.
- [x] Inspect current core responsive exports and implementation, not merely the proposal or an untracked test. Record whether Task 6 is executable now. Do not take ownership of the concurrent implementation or duplicate it.
- [x] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test --browser.headless --browser.ui=false`. Record fresh results as the focused baseline; investigate regressions before attributing them to new code.
- [x] Confirm public point styles can use the current style mechanism and core target hooks without adding a new dispatcher. If the approved contract requires a missing core capability, name the concrete gap and resolve that design issue before production work; do not weaken the contract silently.

## Task 1: Batched dots through the public API

**Files:** Create point-types.ts, point-data.ts, point-geometry.ts, point-series.tsx and point-series.test.tsx; modify index.ts and type-tests/public.tsx.

**Interfaces:** Export `PointSeries<D>(props: PointSeriesProps<D>)` and the exact approved point types. Consume `useScale(id).get()` and shared core shallow signal resolution. Internal coordinate eligibility must be reusable by Tasks 2 and 3 without accessing render state.

- [x] Add `maps valid dots and skips missing coordinates` using public nested scales with domain `[0, 10]`, x range `[0, 200]`, and reversed y range `[0, 100]`. Data `[{x:2,y:3},{x:4,y:null},{x:8,y:9}]` must paint/hit centers `(40,70)` and `(160,10)`, omit the middle mark, and leave `(100,50)` untargeted. Use a separate background target to distinguish misses.
- [x] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/point-series.test.tsx --browser.headless --browser.ui=false`; confirm failure specifically due to missing PointSeries behavior/export.
- [x] Implement point declarations verbatim from the approved spec and root exports. Normalize key/function accessors; resolve outer data once, read scale snapshots once, evaluate defined before coordinates and style. Keep rows opaque. Defaults: radius 3, fill `#2563eb`, no stroke, strokeWidth 1, opacity 1. Validate finite nonnegative widths/radii and opacity [0,1].
- [x] Implement one series-owned paint/geometry boundary. Paint each valid circle's fill then stroke in source order; use core state isolation. Register one `useEventTarget` target only when participating. Build a fillable union hit path from disks and annuli: consistently wound outer contours, reverse inner contours, each contour a separate subpath. This permits heterogeneous stroke widths without filling ring holes. Do not redraw the union as paint or issue per-datum target hooks. Zero radius emits neither paint nor geometry; zero opacity preserves targeting.
- [x] Add `preserves overlapping alpha and fill/stroke order`: compare a few interior pixels against an equivalent public Circle composition, avoiding antialias boundaries. Add `stroke-only holes miss`, `pointerEvents none passes through`, and callback call-count assertions (one per valid datum, zero for defined=false/invalid coordinates).
- [x] Run the focused file and `corepack pnpm@11.21.0 exec tsc -p packages/viz/type-tests/tsconfig.json --noEmit`. Check JSX/createElement inference and reject nonnumeric coordinate property keys, invalid styles, and function-style nested signals. Record green results; leave broad matrices for Task 5.

## Task 2: Pure nearest-data queries

**Files:** Create nearest.ts and nearest.test.tsx; modify index.ts and type-tests/public.tsx; consume point-data.ts.

**Interfaces:** Export exactly `nearestDomainValue(values, rangeValue, scale): number | undefined` and `nearestPoint<D>(data, point, options): NearestPoint<D> | undefined`, with the approved parameter/result declarations. No signals, hooks, event registration, or persistent cache inside helpers.

- [x] Add failing tests using public Scale/useScale snapshots: x domain `[0,10]` mapped to `[0,200]`; `nearestDomainValue([2,8],100,x)` returns `2` on a tie. For the Task 1 data, `nearestPoint(data,{x:43,y:74},options)` returns original datum/index 0, mapped x/y `(40,70)`, distance 5. `maxDistance:5` includes it; `4` returns undefined. Invalid rows retain original indices.
- [x] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/nearest.test.tsx --browser.headless --browser.ui=false` and verify the intended red result.
- [x] Implement unsorted O(n) scans, earliest-source tie breaking, empty/all-invalid undefined, shared defined/coordinate eligibility, and finite query/option validation. Use `Math.hypot` for 2D distance; diagnose unrepresentable derived distance rather than silently choosing an incorrect result. One-dimensional lookup compares mapped range distance without inversion, including collapsed ranges. Preserve input arrays/references; never invoke styles or PlotSeries renderers.
- [x] Run the focused test and type consumer. Add an assertion that two calls perform two independent scans and create no scheduled work; do not build a spatial index or sorted-input fast path in this slice.

## Task 3: Keyed custom plotted subtrees

**Files:** Create plot-types.ts, plot-series.tsx, plot-series.test.tsx; modify index.ts and type-tests/public.tsx.

**Interfaces:** Export `PlotSeries<D>(props: PlotSeriesProps<D>)`, PlotSeriesProps, and PlotKeyAccessor exactly as approved. Consume Task 1 coordinate normalization/eligibility; return ordinary CRCNode subtrees. `render(datum,index,data): CRCNode` is required and opaque.

- [x] Add `places custom elements and preserves keyed state`: use the Task 1 scale fixture and rows with IDs `a` and `b`; custom marks return a stateful component and a Rectangle at `(-5,-5)` with size 10×10. Verify positions `(40,70)` and `(160,10)`, datum-specific click handlers, and retained per-key state when input order reverses.
- [x] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/plot-series.test.tsx --browser.headless --browser.ui=false`; confirm failure from the absent API/behavior.
- [x] Implement a structural parent using core propagation listeners and a stable module-level row component. The series computes eligibility, keys, and coordinates once per row; keyed Group translations establish local zero at the mapped point. Invoke render inside the row component beneath the translation, passing the original datum/index/array. Never define the row component type inside a render or use callback identity as its key.
- [x] Normalize keys with core semantics; default to original source index, never valid-row ordinal. Returned descendant keys are local to that row. Preserve inherited allocation, no implicit centering/box/clipping. Do not forward data, render, or accessors to core drawing props; do not add series-level style or pointerEvents.
- [x] Add focused assertions for invalid-row callback omission, null-return wrapper retention, cleanup on row removal, and a returned component calling hooks. Change the render callback identity without remounting the same returned component type. Explicit callback signal reads must belong to the row receiver; hooks belong in returned components, not the render callback.
- [x] Run the focused test and type consumer, including errors for missing render, invalid key accessors, promise returns, and unsupported series style/pointerEvents. Verify Group-level handlers receive descendant bubbling while empty space creates no PlotSeries target.

## Task 4: Runnable learning slice and feedback checkpoint

**Files:** Create the lesson, lab, points-lab.test.ts; modify learning-catalog.ts, catalog.ts, scenario-sources.ts and studio.test.ts. Update generated catalog output only via the existing generator.

**Interfaces:** Lesson exports the standard `mount(canvas, fixture = {})` controller. Lab slug `viz-points-lab`; public lesson slug `viz-points-and-inspection`, category composition. Lab state exposes panel allocations, mapped anchors, selected datum ID/index, keyed mark state, and custom-click count. Actions: `reorder`, `remove-selected`, `reset`, `next`, `previous`.

- [x] Add a failing headless lab test that mounts two unequal allocated panels, inspects/selects a known point, reorders custom marks, and resizes the Canvas while preserving selection and keyed mark state. Assert state and coordinates before adding screenshots.
- [x] Implement a small self-contained dataset with missing values and overlapping dots. Compose scatter in one panel and line-plus-dots with selected custom annotations in the other. Include shared and callback styles, visible readout, click/tap selection, pointer inspection, and previous/next controls. Use public package imports only; keep exhaustive fixtures in the lab adapter.
- [x] Compute inspection from the same rendered data/scale snapshots. In the translation-only lesson subtract the known plot origin from event.x/y. Keep custom clickable marks above the plot background; use bubbling or pointerEvents on decorations so an inspection overlay does not intercept their handlers. Do not claim general screen-space nearest behavior.
- [x] Add the new root declarations to `playground/src/crc-editor-types.txt` so the runnable lesson has working editor types immediately. Register the catalogs/source adapter and run `corepack pnpm@11.21.0 scenarios:write-index`, then `corepack pnpm@11.21.0 scenarios:check`. Extend Studio tests to load exact editable source and accept new root imports while still rejecting private paths.
- [x] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test --browser.headless --browser.ui=false` and the viz type consumer. Fix only failures required to demonstrate this slice and protect existing behavior.
- [x] Reuse an existing Studio server if healthy, otherwise start `corepack pnpm@11.21.0 -C playground run playground:dev --host 127.0.0.1 --port 5173` and read its actual listening URL. Open the exact route `http://localhost:5173/#/examples/composition/viz-points-and-inspection` if port 5173 was selected; report the actual port if occupied. Inspect both panels, overlap appearance, hover/tap, custom clicks, reorder, removal, reset, and resizing.
- [x] Create a focused milestone commit of owned files once checks pass, with message `feat(viz): add points custom plots and inspection slice`; preserve concurrent work.
- [x] Report **slice ready for feedback**, exact working URL, actions to inspect, focused results, and any deferred responsive integration. Stop here for hands-on feedback. Do not start Tasks 5–7 merely because the focused tests passed.

## Approved continuation: hover queries and protected cards

The user approved the function-query design and requested this plan update.
These tasks describe the approved continuation; see the final execution record for implementation and evidence. Run H1–H3 as the next vertical slice before
Tasks 5–7; then H4 supplies the multi-line slice and its own feedback checkpoint.
Only after that feedback, run H5 and the expanded Tasks 5–7. Preserve the completed
Tasks 0–4 and current worktree. No new worktree, public Plot/PlotPointer wrapper,
query AST, sampling string, or general core coordinate API is implied.

### Extension file map

| File                                                                           | Responsibility                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `packages/viz/src/lib/hover-types.ts`                                          | Query/context/props, structural series, keyed hit union, exact/interpolated sample, helper option types |
| `packages/viz/src/lib/hover-data.tsx`                                          | Stable query receiver, scoped snapshot access, callback invocation                                      |
| `packages/viz/src/lib/hover-queries.ts`                                        | defineSeries, closestPoint, closestX, interpolateX, linearInterpolation factories                       |
| `packages/viz/src/lib/hover-card.tsx`                                          | Core-owned style/box resolution, background and allocated content                                       |
| `packages/viz/src/lib/hover-placement.ts`                                      | Pure candidate placement and protected-anchor exclusion                                                 |
| `packages/viz/test/hover-data.test.tsx`                                        | Public callback results, reactivity, inference/identity runtime evidence                                |
| `packages/viz/test/hover-queries.test.tsx`                                     | Numerical query contracts through captured public scale snapshots                                       |
| `packages/viz/test/hover-card.test.tsx`                                        | Public geometry, boundary exclusion, paint, pointer pass-through                                        |
| `packages/viz/test/hover-ownership.test.tsx`                                   | Post-feedback ownership/failure cleanup                                                                 |
| `packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx` | Complete editable two-line real-data inspection lesson                                                  |
| `packages/scenarios/src/viz-hover-lab.ts`                                      | Deterministic adapter for the three query modes and dragged inspection line                             |
| `packages/viz/test/hover-lab.test.ts`                                          | Public scenario semantic/interaction evidence                                                           |

Also modify index.ts, type-tests/public.tsx, the existing penguin lesson and its
test, catalogs/source adapter, Studio declarations/test, and final delivery files
already named in Task 7. Create public component pages `hover-data.md` and
`hover-card.md` under `docs/site/api/components/`; function pages `define-series.md`,
`closest-point.md`, `closest-x.md`, `interpolate-x.md`, `linear-interpolation.md`
under `docs/site/api/functions/`. Minimal export coverage docs move with each
export if required to start browser tests; full documentation follows feedback.

### H1: Function query receiver and first nearest-point helper

**Interfaces:** Implement HoverQueryContext, HoverQuery<T>, HoverDataProps<T>, and
HoverData<T> exactly as specified. Export structural HoverSeries<D> and
`defineSeries<D>(options: HoverSeries<D>): HoverSeries<D>`; export
`closestPoint<S>(options: ClosestPointOptions<S>): HoverQuery<ClosestPointHit<S>>`.
S preserves each string record key and its descriptor datum type; ClosestPointHit
is the mapped discriminated union described in the spec. Context accepts current
ScaleId and returns ResolvedLinearScale. Options use SignalValue for position and
descriptor data, ordinary scale IDs, and optional numeric maxDistance.

- Add failing public tests: a custom query reads a cursor signal and named
  scale and returns `{label,anchor}`; children receives inferred data or undefined
  exactly once per evaluation. Change the cursor and see new output. Replace the
  query/callback functions while preserving a stateful same-type/key returned
  component. Assert an async query is rejected rather than passed as data.
- Add a nearest fixture with scales mapping x `[0,10]→[0,100]`, y
  `[0,10]→[100,0]`; series A has `(2,3)` and B `(8,9)`. Query local `(23,74)`
  returns A, original index 0, anchor `(20,70)`, distance 5, domain `(2,3)`.
  maxDistance 5 includes it; 4 omits it. Null position returns undefined. Assert
  factory creation does not read signals or accessors.
- Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/hover-data.test.tsx packages/viz/test/hover-queries.test.tsx --browser.headless --browser.ui=false`;
  confirm missing-feature failures before production code.
- Implement the stable ordinary receiver and invocation-scoped context;
  inspect existing scale-context internals before using the official friend seam.
  Query scale resolution must not introduce query hooks or retain contexts. Reuse
  coordinate eligibility/nearest arithmetic without changing existing helpers.
  Factories return unbranded functions; shallow-freeze descriptor configuration,
  not user arrays or records. Add source exports, minimal docs, and editor types.
- Add public type consumers for inline custom queries, composed objects,
  heterogeneous series-key narrowing, signal data, JSX and createElement; reject
  Promise results and unsupported coordinate keys. Run focused tests plus
  `corepack pnpm@11.21.0 exec tsc -p packages/viz/type-tests/tsconfig.json --noEmit`.
  Commit owned H1 files when green.

### H2: HoverCard and the never-cover-anchor rule

**Interfaces:** Export HoverCardProps, HoverCardStyle, and HoverCard(props).
Consume the exact anchor/bounds/style/default rules from the design. Internal
`placeHoverCard({anchor,anchorRadius,gap,bounds,width,height,strokeWidth,placement})`
returns local `{x,y}`; it allocates no resources and is not a public export.

- Add failing public mounts at four edges/corners and center of a 100×100
  allocation. A 40×24 card with radius 6, gap 8, strokeWidth 2 must keep its
  outer stroked rectangle at least 14 units from the anchor. Include a 150×120
  oversized card: overflow is permitted; intersection is not. Assert preferred
  side/auto order, tangential sliding, radius/gap updates, and allocation resize.
- Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/hover-card.test.tsx --browser.headless --browser.ui=false` and confirm red.
- Implement pure side selection and core-owned declared-box/style resolution.
  Use current core layout semantics for content padding and percentage dimensions;
  do not invent recursive pointerEvents or copy responsive evaluation. Background
  has pointerEvents=none; decorations in examples explicitly opt out. Reject
  nonfinite geometry, negative dimensions, and unsupported transforms/filters.
- Assert underlying mark still receives hover/click through the background
  and decorative content; explicitly interactive children retain ordinary targets.
  Check rounded translucent paint with narrow pixel evidence against public core
  primitives; semantic exclusion geometry remains the main oracle. Re-run focused
  test and type consumer; commit owned H2 files when green.

### H3: Penguin query/card slice and feedback

**Files:** Existing penguin lesson, penguins-example.test.ts, points-lab.test.ts,
lab adapter if state evidence needs extension, Studio declarations and test.

- Add a failing public scenario regression that moves inspection to a boundary
  anchor, checks the rendered label box is disjoint from its protected circle,
  and still receives pointer selection under the card. Check both panels after
  resize and reorder. Keep exact source data and existing keyed-mark state tests.
- Replace manual nearest/readout positioning with a plain custom query or
  closestPoint function and HoverCard. Keep the real static dataset, selection
  controls, local-coordinate conversion, credits, and separate synthetic lab.
  Draw cards after series and at plot origin; do not translate their anchor twice.
- Run the new/affected hover, penguin, points-lab, and Studio tests plus type
  consumers and `corepack pnpm@11.21.0 scenarios:check`. Inspect the actual existing
  Studio URL at wide/narrow sizes and all plot edges; verify text contrast,
  exclusion, pass-through selection, and no TypeScript/page errors.
- Commit owned files and report **hover/card slice ready for feedback** with
  exact live URL and focused results. Pause implementation for hands-on feedback
  before broad matrices or aggregate trust. Preserve H4–H5 as outstanding work.

### H4: Two-line nearest and interpolated inspection slice

**Interfaces:** Export `closestX<D>(options: ClosestXOptions<D>): HoverQuery<ClosestXHit<D>>`,
`interpolateX<D>(options: InterpolateXOptions<D>): HoverQuery<HoverSample<D>>`,
`linearInterpolation(): HoverInterpolation`, and
`HoverInterpolation = (beforeY:number, afterY:number, fraction:number) => number`.
Option/result fields and duplicate/gap policies are exactly those in the design.
Reuse H1 descriptors/context and H2 cards; introduce no second interaction system.

- Add failing numerical tests: rows `(0,10),(10,30)`, queried x=5, return
  first original row for closestX on a tie, but interpolation returns x=5,y=20,
  fraction .5, both original endpoints, and the mapped anchor. Exact x=10 returns
  kind exact and the original row. maxDelta 5 includes nearest; 4 omits it.
  maxGap 10 permits interpolation; 9 omits it; exact matches still succeed.
  A custom interpolator returning beforeY yields 10, proving ordinary function use.
- Add the contract-establishing gap/order cases: null-y row between endpoints
  forbids interpolation, outside-domain x yields undefined, decreasing finite x
  throws, duplicates error by default and follow explicit first/last policies.
  Validate the complete source rather than returning before an invalid tail.
- Run focused query tests to confirm red; implement the two factories and
  linear function with per-invocation signal reads, source indices, eligibility,
  and finite arithmetic checks. Add exports, editor/types, and minimal API docs;
  re-run query and type consumers green before constructing the lesson.
- Add a failing public lab test for modes `closest-point`, `nearest-per-line`,
  and `interpolated-x`, with unequal source timestamps and known expected results.
  State reports mode, domain inspection x, result kind/data/anchors, and card bounds;
  actions select mode, set inspection time, and reset. Drive ordinary pointer
  events to move and drag the guide, release capture, and leave the plot.
- Implement the standalone lesson and adapter using a credited static real
  two-line dataset with compatible units. Verify the chosen source and embed its
  provenance/missing-value policy before use; keep synthetic exact-value fixtures
  in the lab. Preserve the existing accepted CO₂ example. Show complete event to
  local to domain conversion, ordinary Line/Group/Circle guide/highlights, one
  result across lines, two nearest recorded results, two samples at shared x,
  and an inline custom query combining helper outputs into one comparison record.
  Guard collapsed-range inversion; use no unimplemented placeholder components.
- Register route `#/examples/composition/viz-hover-comparison`, lab
  `viz-hover-lab`, source adapter, and Studio consumers. Regenerate/check catalogs,
  run focused lab/query/Studio/type checks, inspect all modes and dragging at wide
  and narrow allocations, commit, and report **multi-line slice ready for feedback**
  with the actual live URL. Pause for feedback before H5/final hardening.

### H5: Harden approved hover behavior and extend final delivery

- Extend query tests for heterogeneous keyed inference, arbitrary custom return
  objects, ties, empty/all-invalid inputs, original indices, independent scopes,
  reversed/collapsed ranges, missing providers, overflow, nonfinite query/options/
  interpolator output, gaps with unknown x, duplicates at segment boundaries, and
  first/last policies. Prove custom callbacks and composed helper queries preserve
  the same receiver-owned signal dependencies; no rendering/styles during lookup.
- Add hover-ownership.test.tsx for dynamic branch cleanup, callback/query
  exceptions, illegal writes, removal/disposal, independent roots, Layer boundary
  errors, and retained source writes after disposal requesting no work. Assert
  query function replacement preserves returned-component identity and undefined
  transitions unmount normally. Factory creation owns zero observers/resources.
- Extend card tests for zero/tiny/oversized bounds, anchors outside bounds,
  borders, every preference, explicit bounds, percentage sizing/padding, transforms
  of the containing plot, clips, responsive allocation changes, and invalid styles.
  Test exclusion in the common local frame; document limits for overflowing child
  paint and multiple cards. Re-review only changed code or unresolved findings.
- Fold all seven new runtime exports (`HoverData`, `HoverCard`, `defineSeries`,
  `closestPoint`, `closestX`, `interpolateX`, `linearInterpolation`) and their public
  types into Task 7's exact packed exports, Bundler/NodeNext, source/built/Studio
  consumers and public API docs. Keep existing nearest helpers compatible. Explain
  data-space interpolation, units, pass-through authoring, source paint order,
  function ownership, and all three runnable patterns in the visualization guide.
- Run the expanded focused suite/type consumer once, then complete Tasks 5–7,
  including current responsive dependency inspection and proportional final review/
  trust gate. Never mark these pending tasks complete using the old 30-test record.

## Task 5: Harden accepted geometry, identity, and ownership

**Files:** Extend point-series.test.tsx, plot-series.test.tsx, nearest.test.tsx; create points-ownership.test.tsx; change only affected production modules for failing regressions.

**Interfaces:** No new public APIs. Use existing deterministic core counters as supplemental evidence, with public mounts/events as the primary oracle.

- Incorporate accepted feedback first, adding a failing regression for changed observable behavior before each production fix.
- Add point geometry/paint cases: radius/stroke zero, zero opacity retaining hits, heterogeneous rings/disks, repeated centers, empty data, invalid runtime inputs, mapping overflow, defined short-circuit, source replacement, reversed/collapsed ranges, transforms and clips. Compare sensitive compositing against ordered core shapes, not a blindly rewritten baseline.
- Add PlotSeries cases: numeric/string normalized duplicate keys; invalid keys; source-index fallback with invalid rows; null to element transitions; key/type changes; arrays/fragments; source reorder/insertion/removal; eligible→invalid→eligible remount; changed callback identity; exceptions and unsupported foreign/async nodes; child capture/cursor and opt-in focus behavior through existing core policies.
- Add lookup cases: exact ties, reversed/collapsed scales, empty/all-invalid inputs, accessor exceptions, finite extremes/overflow, zero and invalid maxDistance, original datum/index preservation, null-rendered custom marks still eligible, and explicit inverse-transform conversion. Pin local-distance behavior under nonuniform scaling; do not reinterpret it as screen distance.
- Add ownership cases: callback branch dependency replacement, data read once, independent roots, same-instance Layer restrictions, failure teardown, removal/dispose followed by retained signal writes. Compare PointSeries node/target counts at 10 versus 10,000 rows: counts remain constant, with geometry permitted to grow. PlotSeries counts may grow; disposal returns all owned counters to baseline. Avoid wall-clock performance assertions.
- Run the complete focused viz suite and type consumer once after the matrix/fixes; record fresh results. Broaden only for identified core regressions or at Task 7.

## Task 6: Integrate responsive styles when core is ready

**Files:** Create `packages/viz/test/responsive-styles.test.tsx`; modify point-series.tsx and the shared style boundary only if needed. Axis/LineSeries changes are limited to adopting that same boundary when advertising their responsive support. Returned PlotSeries marks use core directly.

**Interfaces:** Consume core's actual published responsive input types and evaluator/provision behavior. No package-local query type, evaluator, listener, or deep resolver. Record this task as deferred, with an explicit reason, if core has not landed; do not hold the independent approved series APIs hostage or claim responsive integration passed.

- Reinspect core implementation and its fresh focused evidence. Confirm both width/height conditions, receiver ownership, and preinspection semantics against the current contract. Reconcile material drift before exposing types.
- If available, add a failing public test with shared PointSeries radius 3 and a minWidth 600 rule selecting radius 5. Exercise plot widths `599→600→601→599`, independent narrow/wide plots, and a height condition. Assert matching geometry/target updates and exact branch signal cleanup without adding observers.
- Route shared object styles through the real core primitive boundary once per series occurrence. Preserve incoming plot allocation and receiver dependency ownership. Callback styles stay opaque, returning plain PointMarkStyle values; reject returned query descriptors/nested signals as specified.
- Add two PlotSeries marks at different translated coordinates returning the same queried core element. They must match the same plot-size conditions; an explicitly allocated inner container changes only its descendants' basis. No changes to nearest helpers or scale arithmetic are needed.
- Run the new test plus affected core responsive tests and existing viz tests. Mark integrated only with fresh results; otherwise document the precise outstanding dependency and current supported style form.

## Task 7: Public delivery, review, and final verification

**Files:** Root/type exports, type consumer, packed verifier, Studio declarations/tests, README and public docs listed in the file map; relevant docs registry only. Preserve concurrent edits in shared verifier files.

**Interfaces:** Base runtime root exports add `PointSeries`, `PlotSeries`, `nearestDomainValue`, `nearestPoint`; H5 adds exactly the seven approved hover runtime exports. Type-only exports match the approved declarations. No new subpath, visualization dependency, or JSX runtime.

- Add failing packed/type assertions for all eleven added runtime names and new types. Cover both JSX and createElement, datum/key accessor inference, callback returns, and negative contracts. Keep packed import of root pure helpers safe without Canvas/DOM access at module evaluation.
- Update `tooling/verify-packed-viz.mjs`'s exact sorted export list and declaration probes. Preserve externalized core/core-internal identity, peer version matching, and rejection of private subpaths. Update the maintained `playground/src/crc-editor-types.txt` viz module and add the new lesson to `tooling/verify-studio-types.mjs` consumer inputs. Check new public types against source, built, and editor declarations rather than only testing that the root library exists.
- Document default dots versus custom subtrees; radius units; paint order; keyBy/state; callback versus returned-component hooks; local coordinate conversion; nearest-anchor semantics; ordinary per-element interaction; and the actual responsive support status. Public search includes only the lesson/public API pages, not lab metadata or this plan.
- Run `corepack pnpm@11.21.0 build`, `corepack pnpm@11.21.0 test:viz-package`, and `corepack pnpm@11.21.0 exec vitest run packages/viz/test --mode built --browser.headless --browser.ui=false`. Confirm source/built behavior and consumer coverage, fixing genuine failures before final review.
- Request one proportional review of the accepted implementation focusing on the five risks above; reuse the reviewer for changed code or unresolved material findings only. Add regression tests before fixing findings. Avoid overlapping reviews or model overrides.
- Run `corepack pnpm@11.21.0 trust` under the documented environment. Do not infer success from earlier counts. The previous slice recorded an unrelated WebGL label baseline gap; verify its current state rather than assuming it still exists or changing it automatically. Inspect expected/actual/diff for every intentional baseline change and record why it is correct.
- Record exact commands, environment, fresh results, and unresolved failures. If the aggregate gate fails, report that limit explicitly; do not label the gate green or the full feature verified. When accepted behavior is hardened/documented/reviewed and proportional final checks pass, report **feature complete**, specifying any separately deferred responsive integration.
- Commit owned final changes with a focused message and deliver the runnable URL, API/doc links, and verification summary. Do not push or merge without authorization.

## Plan self-review and handoff

Coverage: Tasks 1–2 cover dot rendering and pure helpers; Task 3 covers custom
subtrees; Task 4 proves their end-to-end composition and enforces the feedback
checkpoint; Task 5 covers errors/ownership/identity; Task 6 isolates the concurrent
responsive dependency; Task 7 covers package, editor, docs, review, and trust.
H1–H3 cover function queries, the first helper, and protected cards in the penguin lesson; H4 covers independent nearest and synchronized interpolation with a full two-line lesson; H5 extends ownership, numerical, placement, and delivery evidence. All new API signatures come from the approved spec. The performance distinction
between batched dots and custom trees remains explicit in both tests and copy.

Recommended execution is inline because the tasks share coordinate eligibility,
types, fixture data, and one evolving public example. This follows repository
delivery sequencing rather than the skill's default fresh-agent/review cycle.
The user subsequently approved implementation in an isolated worktree.

## Execution record — slice ready for feedback

Implemented in `/Users/benlesh/.codex/worktrees/viz-points/crc` on
`codex/viz-points`, starting from `4717dc9`. Tasks 0–4 are complete; Tasks 5–7
remain outstanding. The subsequently approved H1–H5 continuation is planned above, not implemented. No merge or push performed.

Fresh evidence under Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium:

- `corepack pnpm@11.21.0 exec vitest run packages/viz/test --browser.headless --browser.ui=false`: 30 tests across 8 files passed.
- `corepack pnpm@11.21.0 exec tsc --noEmit`: passed.
- `corepack pnpm@11.21.0 exec tsc -p packages/viz/type-tests/tsconfig.json --noEmit`: passed.
- `corepack pnpm@11.21.0 scenarios:check`: 74 lessons, 12 tutorial snapshots, 28 labs validated.
- `corepack pnpm@11.21.0 -C packages/viz run build`: passed.
- Focused implementation lint and whitespace checks passed.
- Live Studio: no TypeScript issues or page errors; custom GAMMA click count
  remained 1 after reorder. Narrow host scrolling moved 430 CSS pixels and
  exposed the lower plot. The lesson restores modified host styles on disposal.
- Dot counts at 10 and 10,000 retain identical component counts and one target;
  disposing releases both and later retained data writes request no frame.

Preview: <http://127.0.0.1:5180/#/examples/composition/viz-points-and-inspection>.
The Browser skill/plugin was unavailable, so live visual QA used the installed
Playwright runtime in addition to the repository's public scenario tests.

Implementation rulings:

- A transparent core Path owns the one union target rather than a direct
  useEventTarget call, preserving built-in pointerEvents teardown without a
  new core seam. Paint remains ordered direct Canvas operations; node count is
  constant. Risk to revisit: future primitive responsive integration.
- Minimal API documentation moved ahead of hardening because Vite's mandatory
  public-export coverage blocks test startup otherwise. This adds no behavior.
- The new lesson supplies a minimum canvas height and native host scrolling,
  restoring both on disposal. It avoids changing global Studio layout or core
  responsive APIs. Broader touch/accessibility evaluation remains future work.

Core responsive queries were not implemented at the isolated base. Shared
styles use today's signal contract; returned custom elements use current core
styles. No conditional-style support or aggregate trust result is claimed.

## Design-update record — function-based hover continuation

The user approved query functions after considering target-only presentation,
string sampling, and descriptor queries. The design and H1–H5 now capture ordinary
custom/helper function composition, typed results, receiver ownership, precise
nearest/interpolation contracts, and HoverCard placement that cannot cover its
protected anchor. Illustration-only Plot/PlotPointer/InspectionLine components
are not added to the public scope. No extension runtime work is claimed here.

Feedback already implemented before this update: the penguin dataset replacement
(commit `678ca87`) and readable rounded foreground labels (`0cc4efb`), after the
initial slice (`941558b`). The label currently uses manual clamping; it does not
yet implement the approved never-cover contract and will be replaced in H3.
Historical test counts above describe the initial slice only.

## Full-continuation execution record — 2026-09-28

The user authorized implementation of everything after approving the function-query
contract. H1–H5 and Task 5 are implemented. Task 6 is explicitly deferred: this
isolated core has responsive viewport configuration but no conditional style
input/evaluator. No concurrent responsive work was copied. Task 7 verification
is recorded below. Original detailed steps above remain the planned
approach; the outcomes here supersede intermediate pause and not-implemented notes.

Implemented public APIs: PointSeries, PlotSeries, nearestPoint,
nearestDomainValue, HoverData, HoverCard, defineSeries, closestPoint, closestX,
interpolateX, and linearInterpolation. Hover queries remain ordinary synchronous
functions; card placement protects its declared outer stroked box even when it
must overflow bounds. The guarantee excludes arbitrary child paint overflow and
does not resolve collisions between separate cards.

The penguin lesson now uses HoverData/HoverCard. The new comparison lesson embeds
24 NOAA monthly mean/deseasonalized pairs from 2020–2021, selected from the unchanged
accepted CO₂ snapshot. It demonstrates one closest point, independent nearest
records, and interpolated values at one draggable time. Its deterministic lab
uses unequal synthetic timestamps and ordinary pointer capture events.

Validation was grouped by observable contract: public HoverCard mounts measure
edge/corner/oversized/zero-bound exclusion, preferred sides, changing radius/gap,
percentage content sizing, and pointer pass-through; scenario tests cover wiring,
selection, reorder, resizing, and dragging. This replaces duplicating card bounds
in the example fixture state. Existing core event/focus/capture evidence covers
inherited custom-element behavior. Only the inspected API sidebar baseline was updated for the added closestPoint/closestX links; the unrelated WebGL baseline was preserved.

One independent source review found no actionable correctness issues. Package
checks prompted two integration corrections: exact export/catalog inventories
include the new APIs/examples, and HoverCard imports the already-public resolveBox
and resolveLength directly. Only withHooksForbidden and pushLayoutBox were added
to the version-coupled internal entry. Explicit createElement authoring specializes
HoverData's result type; JSX infers it automatically.

Live previews (wide and narrow checked with no page/Studio type errors):

- <http://127.0.0.1:5180/#/examples/composition/viz-points-and-inspection>
- <http://127.0.0.1:5180/#/examples/composition/viz-hover-comparison>

### Verification and delivery outcome

Environment: Node 24.15.0, pnpm 11.21.0, Playwright Chromium, 2026-09-28.

- `corepack pnpm@11.21.0 trust:static` passed, including documentation,
  catalogs, lint/format, types, workspace build, and source/built Studio builds.
- `corepack pnpm@11.21.0 test:ci`: 3,802 tests passed, 4 skipped, across
  317 passing files.
- Built visualization suite: 75 tests across 15 files passed.
- Corrected learning/scenario catalog suite: 365 tests across 2 files passed.
- Packed package gate passed, including viz Bundler/NodeNext consumers, exact
  runtime exports, blocked private paths, and shared core identity.
- Lifecycle gate: 55 tests passed. Structural performance: 64 passed, 4 skipped.
- Studio documentation navigation/search, visual safeguard, and built smoke
  (4 tests) passed. The diagram-editor teaser matched with zero differing pixels.
- Global TypeScript, focused final lint, and staged whitespace checks passed.

The aggregate `corepack pnpm@11.21.0 trust` was run; its inventory failures were
fixed and affected gates rerun. It is **not green**: Studio visuals stop at the
unchanged WebGL lighting baseline, which says `crcOrbitCamera` while current code
says `useOrbitCamera`. The 110 differing pixels are confined to x=490–510,
y=416–423. Expected, actual, and diff were inspected; this unrelated baseline
was not updated. The API crc baseline was intentionally updated after inspection:
all 23,549 changed pixels were within the left navigation (x=24–268, y=496–893),
where the new closestPoint/closestX pages appear; the article was unchanged.

Implementation, documentation, and proportional verification are complete with
the separately deferred responsive dependency and aggregate visual limitation
above. No push or merge is authorized or performed.

## Accepted AnchoredLayout follow-up

The user observed overlapping independently placed cards, approved a generic
AnchoredLayout API, accepted the runnable comparison slice (`b078af0e`), and
requested final hardening. The component lives in @crc/viz but has no query or
scale dependency. Its keyed declared outer boxes pack along one axis; a shared
column/row sits beyond all supplied protected anchors. It tries the opposite
side when that fits, otherwise preserves exclusion by allowing overflow.
Parent-local bounds and returned placements support authored connector lines.

The accepted example uses the layout for both line readouts, and the public API
page includes an independent annotation example. No automatic background,
portal, retained scene, global collision registry, or responsive-style evaluator
was added. Arbitrary overflowing child paint remains outside the box guarantee.

Hardening covers geometry validation and arithmetic overflow before callbacks,
normalized duplicate keys, frozen inputs/source paint order, callback signal
branch cleanup, keyed removal/disposal, callback exceptions/illegal hooks/writes/
async output, and transformed/clipped percentage-sized interactive content.
The independent reviewer found one core consistency issue: numeric keys had an
unnecessary finite-value restriction. A failing public NaN/Infinity/-Infinity
regression established it, the guard was removed, and the reviewer confirmed
resolution. Core String(key) normalization and duplicate detection are preserved.

Fresh source and built visualization runs each pass 91 tests across 17 files.
Static and packed package gates pass, including public/Studio type parity and
Bundler/NodeNext consumers. Lifecycle checks pass 55 tests, structural performance
passes 64 with 4 skipped, and built smoke passes 4 tests. Full-browser and Studio
visual results are recorded in the final delivery note below.

Final delivery note: the fresh aggregate run passed 3,818 browser tests with
4 skipped across 319 passing files, Studio documentation navigation/search,
and the visual safeguard. The diagram teaser matched exactly. It then stopped
at the same unrelated 110-pixel WebGL label mismatch documented above; the
aggregate gate is not green. No new visual baseline was changed for this follow-up.
The accepted AnchoredLayout feature is hardened, documented, reviewed, and
verified proportionally; no push or merge was performed.

### Shipping integration

Before delivery, main advanced to f36a0a23 with core responsive styles. The
isolated branch merged that commit, preserving both catalogs and all Studio
consumer probes. Core conditional styles now work on returned CRC elements;
a public regression verifies an AnchoredLayout child changes at its own declared
width threshold. Direct conditional styles on viz-owned marks remain deferred.
The merged result passed trust:static and the full browser suite: 3,876 passed,
4 skipped, across 326 passing files. The user explicitly accepted the unrelated
WebGL visual limitation and requested direct merge to main and push.
