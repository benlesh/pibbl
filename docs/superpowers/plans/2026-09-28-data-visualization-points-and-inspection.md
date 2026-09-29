# Visualization Points, Custom Plots, and Inspection Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for inline execution. If the user chooses delegation, use `superpowers:subagent-driven-development`, subject to the repository's limits and feedback checkpoint. Steps use checkboxes for tracking. Do not begin implementation until execution is approved.

**Goal:** Ship batched PointSeries dots, PlotSeries custom CRC marks, and pure nearest-data helpers, demonstrated together in a runnable Studio lesson.

**Architecture:** Both series consume existing allocation-relative Scale providers and core signals. PointSeries paints ordered circles with one union target; PlotSeries emits keyed translated subtrees whose returned elements retain normal CRC behavior. Lookup helpers operate on plain data and resolved linear-scale snapshots without owning reactive state.

**Tech Stack:** TypeScript, CRC JSX, Canvas 2D/Path2D, Vitest with Playwright Chromium, Node 24.15+ on Node 24 LTS, pnpm 11.21.0.

**Spec:** [Approved points, custom plots, and inspection design](../specs/2026-09-28-data-visualization-points-and-inspection-design.md).

## Global constraints

- Design is approved; this plan awaits execution approval. No production changes accompany planning.
- Preserve unrelated changes and untracked files, including concurrent responsive-style work. Do not create a worktree unless requested.
- No new runtime dependency, scale family, Chart container, scheduler, event system, or implicit clipping/sorting/domain inference.
- Preserve existing LineSeries, Axis, ScaleAdjust, scale signal ownership, and same-rendering-instance provider restriction.
- Public contracts need public-API evidence. Add failing focused tests before production changes; internal counters only supplement that evidence.
- PointSeries has bounded component/target counts. PlotSeries deliberately has per-row subtrees. Never implement PointSeries through PlotSeries.
- Deliver the runnable slice before broad hardening, documentation polish, or aggregate verification. Stop for experiential feedback at Task 4.
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

- [ ] Record `git status --short`, current revision, `node --version`, and `corepack pnpm@11.21.0 --version`; account for every pre-existing change.
- [ ] Inspect current core responsive exports and implementation, not merely the proposal or an untracked test. Record whether Task 6 is executable now. Do not take ownership of the concurrent implementation or duplicate it.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test --browser.headless --browser.ui=false`. Record fresh results as the focused baseline; investigate regressions before attributing them to new code.
- [ ] Confirm public point styles can use the current style mechanism and core target hooks without adding a new dispatcher. If the approved contract requires a missing core capability, name the concrete gap and resolve that design issue before production work; do not weaken the contract silently.

## Task 1: Batched dots through the public API

**Files:** Create point-types.ts, point-data.ts, point-geometry.ts, point-series.tsx and point-series.test.tsx; modify index.ts and type-tests/public.tsx.

**Interfaces:** Export `PointSeries<D>(props: PointSeriesProps<D>)` and the exact approved point types. Consume `useScale(id).get()` and shared core shallow signal resolution. Internal coordinate eligibility must be reusable by Tasks 2 and 3 without accessing render state.

- [ ] Add `maps valid dots and skips missing coordinates` using public nested scales with domain `[0, 10]`, x range `[0, 200]`, and reversed y range `[0, 100]`. Data `[{x:2,y:3},{x:4,y:null},{x:8,y:9}]` must paint/hit centers `(40,70)` and `(160,10)`, omit the middle mark, and leave `(100,50)` untargeted. Use a separate background target to distinguish misses.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/point-series.test.tsx --browser.headless --browser.ui=false`; confirm failure specifically due to missing PointSeries behavior/export.
- [ ] Implement point declarations verbatim from the approved spec and root exports. Normalize key/function accessors; resolve outer data once, read scale snapshots once, evaluate defined before coordinates and style. Keep rows opaque. Defaults: radius 3, fill `#2563eb`, no stroke, strokeWidth 1, opacity 1. Validate finite nonnegative widths/radii and opacity [0,1].
- [ ] Implement one series-owned paint/geometry boundary. Paint each valid circle's fill then stroke in source order; use core state isolation. Register one `useEventTarget` target only when participating. Build a fillable union hit path from disks and annuli: consistently wound outer contours, reverse inner contours, each contour a separate subpath. This permits heterogeneous stroke widths without filling ring holes. Do not redraw the union as paint or issue per-datum target hooks. Zero radius emits neither paint nor geometry; zero opacity preserves targeting.
- [ ] Add `preserves overlapping alpha and fill/stroke order`: compare a few interior pixels against an equivalent public Circle composition, avoiding antialias boundaries. Add `stroke-only holes miss`, `pointerEvents none passes through`, and callback call-count assertions (one per valid datum, zero for defined=false/invalid coordinates).
- [ ] Run the focused file and `corepack pnpm@11.21.0 exec tsc -p packages/viz/type-tests/tsconfig.json --noEmit`. Check JSX/createElement inference and reject nonnumeric coordinate property keys, invalid styles, and function-style nested signals. Record green results; leave broad matrices for Task 5.

## Task 2: Pure nearest-data queries

**Files:** Create nearest.ts and nearest.test.tsx; modify index.ts and type-tests/public.tsx; consume point-data.ts.

**Interfaces:** Export exactly `nearestDomainValue(values, rangeValue, scale): number | undefined` and `nearestPoint<D>(data, point, options): NearestPoint<D> | undefined`, with the approved parameter/result declarations. No signals, hooks, event registration, or persistent cache inside helpers.

- [ ] Add failing tests using public Scale/useScale snapshots: x domain `[0,10]` mapped to `[0,200]`; `nearestDomainValue([2,8],100,x)` returns `2` on a tie. For the Task 1 data, `nearestPoint(data,{x:43,y:74},options)` returns original datum/index 0, mapped x/y `(40,70)`, distance 5. `maxDistance:5` includes it; `4` returns undefined. Invalid rows retain original indices.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/nearest.test.tsx --browser.headless --browser.ui=false` and verify the intended red result.
- [ ] Implement unsorted O(n) scans, earliest-source tie breaking, empty/all-invalid undefined, shared defined/coordinate eligibility, and finite query/option validation. Use `Math.hypot` for 2D distance; diagnose unrepresentable derived distance rather than silently choosing an incorrect result. One-dimensional lookup compares mapped range distance without inversion, including collapsed ranges. Preserve input arrays/references; never invoke styles or PlotSeries renderers.
- [ ] Run the focused test and type consumer. Add an assertion that two calls perform two independent scans and create no scheduled work; do not build a spatial index or sorted-input fast path in this slice.

## Task 3: Keyed custom plotted subtrees

**Files:** Create plot-types.ts, plot-series.tsx, plot-series.test.tsx; modify index.ts and type-tests/public.tsx.

**Interfaces:** Export `PlotSeries<D>(props: PlotSeriesProps<D>)`, PlotSeriesProps, and PlotKeyAccessor exactly as approved. Consume Task 1 coordinate normalization/eligibility; return ordinary CRCNode subtrees. `render(datum,index,data): CRCNode` is required and opaque.

- [ ] Add `places custom elements and preserves keyed state`: use the Task 1 scale fixture and rows with IDs `a` and `b`; custom marks return a stateful component and a Rectangle at `(-5,-5)` with size 10×10. Verify positions `(40,70)` and `(160,10)`, datum-specific click handlers, and retained per-key state when input order reverses.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test/plot-series.test.tsx --browser.headless --browser.ui=false`; confirm failure from the absent API/behavior.
- [ ] Implement a structural parent using core propagation listeners and a stable module-level row component. The series computes eligibility, keys, and coordinates once per row; keyed Group translations establish local zero at the mapped point. Invoke render inside the row component beneath the translation, passing the original datum/index/array. Never define the row component type inside a render or use callback identity as its key.
- [ ] Normalize keys with core semantics; default to original source index, never valid-row ordinal. Returned descendant keys are local to that row. Preserve inherited allocation, no implicit centering/box/clipping. Do not forward data, render, or accessors to core drawing props; do not add series-level style or pointerEvents.
- [ ] Add focused assertions for invalid-row callback omission, null-return wrapper retention, cleanup on row removal, and a returned component calling hooks. Change the render callback identity without remounting the same returned component type. Explicit callback signal reads must belong to the row receiver; hooks belong in returned components, not the render callback.
- [ ] Run the focused test and type consumer, including errors for missing render, invalid key accessors, promise returns, and unsupported series style/pointerEvents. Verify Group-level handlers receive descendant bubbling while empty space creates no PlotSeries target.

## Task 4: Runnable learning slice and feedback checkpoint

**Files:** Create the lesson, lab, points-lab.test.ts; modify learning-catalog.ts, catalog.ts, scenario-sources.ts and studio.test.ts. Update generated catalog output only via the existing generator.

**Interfaces:** Lesson exports the standard `mount(canvas, fixture = {})` controller. Lab slug `viz-points-lab`; public lesson slug `viz-points-and-inspection`, category composition. Lab state exposes panel allocations, mapped anchors, selected datum ID/index, keyed mark state, and custom-click count. Actions: `reorder`, `remove-selected`, `reset`, `next`, `previous`.

- [ ] Add a failing headless lab test that mounts two unequal allocated panels, inspects/selects a known point, reorders custom marks, and resizes the Canvas while preserving selection and keyed mark state. Assert state and coordinates before adding screenshots.
- [ ] Implement a small self-contained dataset with missing values and overlapping dots. Compose scatter in one panel and line-plus-dots with selected custom annotations in the other. Include shared and callback styles, visible readout, click/tap selection, pointer inspection, and previous/next controls. Use public package imports only; keep exhaustive fixtures in the lab adapter.
- [ ] Compute inspection from the same rendered data/scale snapshots. In the translation-only lesson subtract the known plot origin from event.x/y. Keep custom clickable marks above the plot background; use bubbling or pointerEvents on decorations so an inspection overlay does not intercept their handlers. Do not claim general screen-space nearest behavior.
- [ ] Add the new root declarations to `playground/src/crc-editor-types.txt` so the runnable lesson has working editor types immediately. Register the catalogs/source adapter and run `corepack pnpm@11.21.0 scenarios:write-index`, then `corepack pnpm@11.21.0 scenarios:check`. Extend Studio tests to load exact editable source and accept new root imports while still rejecting private paths.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/viz/test --browser.headless --browser.ui=false` and the viz type consumer. Fix only failures required to demonstrate this slice and protect existing behavior.
- [ ] Reuse an existing Studio server if healthy, otherwise start `corepack pnpm@11.21.0 -C playground run playground:dev --host 127.0.0.1 --port 5173` and read its actual listening URL. Open the exact route `http://localhost:5173/#/examples/composition/viz-points-and-inspection` if port 5173 was selected; report the actual port if occupied. Inspect both panels, overlap appearance, hover/tap, custom clicks, reorder, removal, reset, and resizing.
- [ ] Create a focused milestone commit of owned files once checks pass, with message `feat(viz): add points custom plots and inspection slice`; preserve concurrent work.
- [ ] Report **slice ready for feedback**, exact working URL, actions to inspect, focused results, and any deferred responsive integration. Stop here for hands-on feedback. Do not start Tasks 5–7 merely because the focused tests passed.

## Task 5: Harden accepted geometry, identity, and ownership

**Files:** Extend point-series.test.tsx, plot-series.test.tsx, nearest.test.tsx; create points-ownership.test.tsx; change only affected production modules for failing regressions.

**Interfaces:** No new public APIs. Use existing deterministic core counters as supplemental evidence, with public mounts/events as the primary oracle.

- [ ] Incorporate accepted feedback first, adding a failing regression for changed observable behavior before each production fix.
- [ ] Add point geometry/paint cases: radius/stroke zero, zero opacity retaining hits, heterogeneous rings/disks, repeated centers, empty data, invalid runtime inputs, mapping overflow, defined short-circuit, source replacement, reversed/collapsed ranges, transforms and clips. Compare sensitive compositing against ordered core shapes, not a blindly rewritten baseline.
- [ ] Add PlotSeries cases: numeric/string normalized duplicate keys; invalid keys; source-index fallback with invalid rows; null to element transitions; key/type changes; arrays/fragments; source reorder/insertion/removal; eligible→invalid→eligible remount; changed callback identity; exceptions and unsupported foreign/async nodes; child capture/cursor and opt-in focus behavior through existing core policies.
- [ ] Add lookup cases: exact ties, reversed/collapsed scales, empty/all-invalid inputs, accessor exceptions, finite extremes/overflow, zero and invalid maxDistance, original datum/index preservation, null-rendered custom marks still eligible, and explicit inverse-transform conversion. Pin local-distance behavior under nonuniform scaling; do not reinterpret it as screen distance.
- [ ] Add ownership cases: callback branch dependency replacement, data read once, independent roots, same-instance Layer restrictions, failure teardown, removal/dispose followed by retained signal writes. Compare PointSeries node/target counts at 10 versus 10,000 rows: counts remain constant, with geometry permitted to grow. PlotSeries counts may grow; disposal returns all owned counters to baseline. Avoid wall-clock performance assertions.
- [ ] Run the complete focused viz suite and type consumer once after the matrix/fixes; record fresh results. Broaden only for identified core regressions or at Task 7.

## Task 6: Integrate responsive styles when core is ready

**Files:** Create `packages/viz/test/responsive-styles.test.tsx`; modify point-series.tsx and the shared style boundary only if needed. Axis/LineSeries changes are limited to adopting that same boundary when advertising their responsive support. Returned PlotSeries marks use core directly.

**Interfaces:** Consume core's actual published responsive input types and evaluator/provision behavior. No package-local query type, evaluator, listener, or deep resolver. Record this task as deferred, with an explicit reason, if core has not landed; do not hold the independent approved series APIs hostage or claim responsive integration passed.

- [ ] Reinspect core implementation and its fresh focused evidence. Confirm both width/height conditions, receiver ownership, and preinspection semantics against the current contract. Reconcile material drift before exposing types.
- [ ] If available, add a failing public test with shared PointSeries radius 3 and a minWidth 600 rule selecting radius 5. Exercise plot widths `599→600→601→599`, independent narrow/wide plots, and a height condition. Assert matching geometry/target updates and exact branch signal cleanup without adding observers.
- [ ] Route shared object styles through the real core primitive boundary once per series occurrence. Preserve incoming plot allocation and receiver dependency ownership. Callback styles stay opaque, returning plain PointMarkStyle values; reject returned query descriptors/nested signals as specified.
- [ ] Add two PlotSeries marks at different translated coordinates returning the same queried core element. They must match the same plot-size conditions; an explicitly allocated inner container changes only its descendants' basis. No changes to nearest helpers or scale arithmetic are needed.
- [ ] Run the new test plus affected core responsive tests and existing viz tests. Mark integrated only with fresh results; otherwise document the precise outstanding dependency and current supported style form.

## Task 7: Public delivery, review, and final verification

**Files:** Root/type exports, type consumer, packed verifier, Studio declarations/tests, README and public docs listed in the file map; relevant docs registry only. Preserve concurrent edits in shared verifier files.

**Interfaces:** Runtime root exports add exactly `PointSeries`, `PlotSeries`, `nearestDomainValue`, `nearestPoint`. Type-only exports match the approved declarations. No new subpath, visualization dependency, or JSX runtime.

- [ ] Add failing packed/type assertions for all four runtime names and new types. Cover both JSX and createElement, datum/key accessor inference, callback returns, and negative contracts. Keep packed import of root pure helpers safe without Canvas/DOM access at module evaluation.
- [ ] Update `tooling/verify-packed-viz.mjs`'s exact sorted export list and declaration probes. Preserve externalized core/core-internal identity, peer version matching, and rejection of private subpaths. Update the maintained `playground/src/crc-editor-types.txt` viz module and add the new lesson to `tooling/verify-studio-types.mjs` consumer inputs. Check new public types against source, built, and editor declarations rather than only testing that the root library exists.
- [ ] Document default dots versus custom subtrees; radius units; paint order; keyBy/state; callback versus returned-component hooks; local coordinate conversion; nearest-anchor semantics; ordinary per-element interaction; and the actual responsive support status. Public search includes only the lesson/public API pages, not lab metadata or this plan.
- [ ] Run `corepack pnpm@11.21.0 build`, `corepack pnpm@11.21.0 test:viz-package`, and `corepack pnpm@11.21.0 exec vitest run packages/viz/test --mode built --browser.headless --browser.ui=false`. Confirm source/built behavior and consumer coverage, fixing genuine failures before final review.
- [ ] Request one proportional review of the accepted implementation focusing on the five risks above; reuse the reviewer for changed code or unresolved material findings only. Add regression tests before fixing findings. Avoid overlapping reviews or model overrides.
- [ ] Run `corepack pnpm@11.21.0 trust` under the documented environment. Do not infer success from earlier counts. The previous slice recorded an unrelated WebGL label baseline gap; verify its current state rather than assuming it still exists or changing it automatically. Inspect expected/actual/diff for every intentional baseline change and record why it is correct.
- [ ] Record exact commands, environment, fresh results, and unresolved failures. If the aggregate gate fails, report that limit explicitly; do not label the gate green or the full feature verified. When accepted behavior is hardened/documented/reviewed and proportional final checks pass, report **feature complete**, specifying any separately deferred responsive integration.
- [ ] Commit owned final changes with a focused message and deliver the runnable URL, API/doc links, and verification summary. Do not push or merge without authorization.

## Plan self-review and handoff

Coverage: Tasks 1–2 cover dot rendering and pure helpers; Task 3 covers custom
subtrees; Task 4 proves their end-to-end composition and enforces the feedback
checkpoint; Task 5 covers errors/ownership/identity; Task 6 isolates the concurrent
responsive dependency; Task 7 covers package, editor, docs, review, and trust.
All new API signatures come from the approved spec. The performance distinction
between batched dots and custom trees remains explicit in both tests and copy.

Recommended execution is inline because the tasks share coordinate eligibility,
types, fixture data, and one evolving public example. This follows repository
delivery sequencing rather than the skill's default fresh-agent/review cycle.
The user has approved the design and requested this plan, not execution.
