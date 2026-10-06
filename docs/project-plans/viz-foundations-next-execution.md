# Chart APIs — detailed execution plan

> **Historical status: Planning and implementation work record; current code and public contracts define shipped behavior.**

Date: 2026-10-06. Owner: Plan 007. Status: approved direction, queued slices;
proposed API names below are design candidates, not shipped contracts.

This plan covers the remaining scope discussed with the user: foundation
verification, everyday marks, reusable exploration, and data-driven encodings.
It does not authorize the later statistics, graph, hierarchy, or geography tiers.
Plan 007 owns the single next-step marker and current execution status.

## 1. Baseline and rules

Current public code includes dedicated Linear/Bar/UTC/Log/Symlog/Point scale
providers and hooks; numeric and UTC tick helpers; Axis and AxisTitle;
LineSeries, PointSeries, PlotSeries, BarSeries; pie geometry/components;
nearest-data and hover queries/cards; GridLines, ReferenceLine, ReferenceBand.
Core Text, shapes, layout, signals, events, focus, clipping and transforms are
available without another chart wrapper. Straight lines already handle missing
values. PointSeries already has radius/paint style resolvers; PlotSeries supplies
custom marks. Bar ranges and explicit precomputed stacking already exist.

ChartText and LegendItem were withdrawn/removed because they duplicated core
components. Do not resurrect them under different names. AxisTitle is retained
because it follows scale range/frame geometry and composes beside Axis.

Every proposed API must answer:

1. What scale/data operation is missing from the current supported surface?
2. Why is ordinary core composition or an existing viz API insufficient?
3. What is its one fixed return contract? No family-selecting magic strings,
   public argument-dependent return types, or disguised union wrappers.
4. What is its ownership, signal, validation, and geometry contract?
5. What minimal runnable example proves a practical improvement?

Use explicit family providers/hooks for any new scales. Share algorithms
privately; use named strategy objects/functions when algorithms share a return
contract. Do not create a generic chart container, global chart registry,
second scheduler, hidden data fetching, or inferred application state.

## 2. Delivery sequence and dependencies

| ID  | Slice                                | Depends on                                              | Runnable outcome                                                          |
| --- | ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| F0  | Foundation verification closeout     | Existing accepted work                                  | Documented gate results and trustworthy current API inventory             |
| M1  | Area series                          | F0, or isolated evidence if an unrelated gate blocks F0 | Real time series filled to an explicit baseline                           |
| M2  | Interval-band series                 | M1 geometry review                                      | Two observed bounds forming a filled ribbon                               |
| M3  | Step curves                          | M1/M2 contracts                                         | Observations rendered with explicit before/after/mid transition semantics |
| M4  | Monotone curves                      | M3 strategy contract                                    | Smooth ordered series without invented extrema                            |
| M5  | Categorical series coordinates       | PointScale and marks audit                              | Category-domain marks/lines without manual pixel mapping                  |
| M6  | Segment styling and stacking recipes | M1–M5 as needed                                         | Threshold-colored runs and explicit stacked/normalized data               |
| I1  | Unified inspection and crosshair     | Existing hover/query APIs                               | Same selected datum from pointer, touch and keyboard                      |
| I2  | Pinning and shared selection         | I1                                                      | Stable selection linked across two plots                                  |
| I3  | One-dimensional brush/overview       | I2                                                      | Select a domain window with pointer/touch/keyboard                        |
| I4  | Pan/zoom                             | I3 domain constraints                                   | Controlled domain changes around a stable data anchor                     |
| I5  | Small-multiple composition           | I2, I4 if needed                                        | Shared and independent domains with explicit layout                       |
| E1  | Size/symbol encoding                 | Existing point/custom-mark audit                        | Truthful size mapping and reusable shape definitions only if needed       |
| E2  | Sequential/diverging color scales    | E1 audit; independent of gestures                       | Data-to-color mappings with fixed family hooks/providers                  |
| E3  | Discrete color mappings and keys     | E2                                                      | Explicit boundaries/categories and scale-derived keys                     |
| V0  | Integrated closeout                  | All accepted slices                                     | Complete public evidence and final plan reconciliation                    |

Do not run these as parallel horizontal projects. For each row: one focused
failing public test, a complete runnable composition, exact Studio URL, feedback,
then its edge matrix/docs/package checks. Existing accepted functionality can
continue being hardened while a new slice awaits feedback. No commits, merges,
or pushes without user authorization for those changes.

## 3. F0 — verify what already exists

Actions:

- Reconcile Plan 007 and priorities against current exports, not historical logs.
- Review new APIs for retained value and confirm removed APIs are absent from
  source, built output, declarations, Studio, documentation and packed consumers.
- Run source and built viz tests. Cover numeric precision, UTC context, category
  identity, reverse/collapsed domains, typed hook mismatch, signal replacement,
  nested provider shadowing and disposal.
- Audit meaningful integration, not just successful rendering: inspect mark
  coordinates through log/symlog mappings; compare query hits to painted positions;
  verify point inversion ties and stable category ordering.
- Run minimal demos through the real Studio editor and executable documentation
  registry. Verify no internal imports, stale symbols or declaration-only exports.
- Recheck source/built/packed family isolation and inert unused imports. Record
  bundle contents, not only byte sizes.
- Run documentation, public JSDoc, catalog, typecheck, focused lint/build, packed
  Bundler/NodeNext consumers, and the repository aggregate trust gate.
- Record each external failure with command, observed error, and scope. Do not
  label an aggregate failure as passing or rewrite unrelated tests to bypass it.

Last known chart-specific evidence is 221 built-browser tests passing, 2 skipped;
that is dated evidence, not a fresh result. Reconcile why tests are skipped.

Done when: chart-specific checks pass, source/built/editor/packed contracts agree,
examples remain accepted at all required allocations, and aggregate status is
explicit. If unrelated gate failures persist, foundation closeout remains
incomplete; a standalone marks slice may proceed with documented focused evidence.

## 4. M1 — area series, the first new API slice

Candidate `AreaSeries<D>`: fill between one measured series and an explicit
numeric baseline using two named scales. Start with x-progressing geometry and
continuous x/y scales, including UTC x and log/symlog where valid. Do not ship an
orientation selector that changes the return type or required accessor shape.

Decisions to settle before the first test:

- Accessors follow existing LineSeries field/callback and signal conventions.
- Require an explicit baseline; never silently assume zero on a log scale.
- Preserve authored order; no hidden sorting. Missing/nonfinite policies must
  match the current series contract and split runs rather than bridge gaps.
- Define empty, one-point, duplicate-x and baseline-crossing geometry. Prefer
  no filled area for a single isolated point; test it before implementation.
- Resolve baseline in data space before scale mapping. Range reversal and
  negative values must not change semantic closure.
- Default fill/opacity should be modest and deliberate. Avoid ambiguous outline
  behavior: compose LineSeries for the observed boundary unless there is a
  demonstrated reason to include a separate outline API.
- Define decorative default vs event participation consistently with existing
  marks. Query/inspection must refer to observations, not pretend a fill is an
  additional data series. Explicit Clip remains caller-owned.

First demo: reuse the checked-in NOAA monthly CO₂ snapshot, preserving gaps,
units, dates and attribution. Use an explicitly labeled reference baseline, not
zero, and state that area represents distance above that reference rather than
cumulative emissions. If the truncated baseline suggests a misleading comparison,
choose an attributed nonnegative dataset with a meaningful zero instead.

Planned example route: `#/examples/composition/viz-area-basics` (not yet live).
A separate minimal runnable public example must isolate baseline and gap behavior.

Focused test first: known trapezoid coordinates from independent expected
arithmetic plus a missing-data split. Runnable acceptance: changing baseline and
resizing moves the correct closed geometry while inspection still selects the
original values. After feedback: all scales, descending ranges, clipping, empty
runs, signal updates, large-offset precision, hit geometry and teardown.

## 5. M2 — interval bands

Candidate `IntervalBandSeries<D>`: x, lower and upper numeric accessors plus
named scales. Distinct from ReferenceBand: the bounds vary per datum.

- Decide bound-crossing policy explicitly. Default should reject lower > upper
  with actionable context rather than silently swapping semantic fields.
- A missing bound breaks the ribbon; do not join across absent intervals.
- Form upper and lower boundaries from matching observations in reverse traversal
  to close each run; preserve index/identity for inspection.
- Equal bounds produce zero area. Do not invent an average/center line.
- Keep semantics honest: min/max ranges, forecast intervals and uncertainty
  estimates are not interchangeable labels.

Data: select a source-published interval dataset with both bounds and explicit
method/date/unit metadata. NOAA daily/monthly observed ranges are acceptable if
actually provided by the source; never manufacture uncertainty from current CO₂
points. Check in a small attributed snapshot and provenance note before rendering.

Test first: known upper/lower polygon and missing-bound gap. Demo inspection must
show both bounds and their definition. Harden band ordering, nonlinear scales,
range reversal, clipping, empty input, updates and cleanup.

## 6. M3/M4 — curves with shared geometry/inspection semantics

Current `LineSeries` accepts only `curve="linear"`; do not casually add more magic
strings. Design a named curve strategy with one stable geometry contract, or
explicit operations if differing capabilities demand them. Keep linear behavior
unchanged and document any migration before removing the old property.

Step slice: distinct named before/after/mid definitions, same return shape. State
exact jump location and interpolation semantics; use real dated measurements
where a held value is meaningful. Query at a discontinuity needs a deterministic
side rule. Do not silently change `interpolateX`'s current linear semantics.

Monotone slice: require monotonic independent coordinates, choose a clear duplicate
coordinate policy, and test local extrema/overshoot against independent fixtures.
Compute/render/inspect with compatible semantics. Missing values split runs.
If exact curved inspection is not supported, expose nearest observed values and
label them honestly; do not claim interpolation along a differently drawn curve.

Apply accepted strategies to area/band boundaries only after ensuring they cannot
cross/invert an interval unexpectedly. Bundle only selected strategies. Minimal
examples show the same points with each explicit algorithm and include a clear
warning that interpolation is not an extra measurement.

## 7. M5/M6 — categorical marks, segment styling, stacks

Categorical support: audit PointSeries/PlotSeries/LineSeries and ScaleAdjust first.
Current custom point marks already work. Prefer extending coherent accessor input
contracts without changing component return types, if public types can validate
scale/category use clearly. Otherwise use a dedicated operation; no family-string
hook or union-return shortcut. Preserve number vs string categories, unknown-value
errors, order, missing rows, reverse ranges, signal updates and query identity.
Test at least one long-label dataset and one mixed string/numeric category domain.

Segment styling: determine whether per-datum resolvers and multiple LineSeries
already suffice. Add an API only for a real missing requirement such as correctly
splitting a threshold crossing in domain space. Define boundary ownership and
zero-length runs; color changes must not move values or create hit-test seams.

Stacking/normalization: initially publish explicit data recipes using existing
range bars and area/band marks. New pure transforms need repeated evidence of
value. If introduced, define series order, missing values, positive/negative
accumulation, all-zero totals, percentage denominators and source identity.
Never hide aggregation or normalization inside a renderer. Validate against
independent sums and explain units in the public composition.

## 8. I1/I2 — inspection, pinning and shared selection

Inventory existing HoverData, defineSeries, closestPoint, closestX, interpolateX,
nearestDomainValue, nearestPoint, HoverCard and application examples before adding
anything. Favor composition over competing selection state managers.

I1 first slice: one time chart with a shared selected-data signal; pointer movement,
tap and keyboard arrows produce the same datum/readout. Escape clears; Home/End
select endpoints. Decide navigation order explicitly. Draw crosshair/reference
geometry from the selected scale values using existing components where possible.
Add a Crosshair API only if it removes genuine multi-scale coordination logic.
Keep pointer coordinates root-logical until the established transform boundary.

I2: a pinned observation survives pointer leave; unpin/reset rules are visible.
Separate transient hover from committed selection. Define selection by stable
application-owned keys or domain values, not transient array indexes. A second
chart consumes the signal without changing ownership. Data replacement either
preserves a surviving key or clears predictably; specify it before testing.

Accessibility: focusable controls, meaningful keyboard behavior, visible focus
and optional application-owned DOM descriptions. Canvas paint does not imply
an accessibility tree. Touch targets use adequate logical hit geometry without
making marks visually oversized. Cleanup covers unmount during active gestures,
focus movement, signal replacement and multiple roots.

## 9. I3/I4 — brush, overview, pan and zoom

Start with a one-dimensional continuous domain brush and a linked overview;
box/lasso selection is deferred. Establish explicit controlled domain endpoints
and separate transient drag from committed selection. Handle reversal, minimum
span, empty selection, clamping, resize and external updates during drag.

Interaction design must be written before coding: hit regions, handles, tap-to-
reposition, keyboard step sizes, cancellation, pointer capture/loss, touch movement,
and whether browser scrolling is prevented. Use native input characterization
where the repository requires it; do not install global handlers casually.
No document-global selected-chart owner or second animation loop.

Pan/zoom builds on the same domain constraints. Zoom anchors to the data value
under the interaction point; linear/time, log and symlog must transform correctly.
Test zoom-in/out reversibility, hard bounds, finite endpoints, collapsed spans,
wheel normalization, and touch cancellation. Provide explicit reset and keyboard
controls. Decide categorical viewport behavior separately; do not invent numeric
inversion for bar domains. Animations, if needed, use existing core animation.

## 10. I5 — responsive small multiples

Compose two then several plots with shared or independent domain signals using
core layout. Show titles/units on each plot and make shared-selection behavior
explicit. Reflow columns to rows with width and height allocation queries;
reserve controls/readout space and preserve all categorical identities.

Do not add a SmallMultiples container unless the example reveals recurring
scale/data coordination that core layout cannot express cleanly. Test domain
sharing without accidental feedback cycles, selection mapping between datasets,
unequal series lengths, missing data and exact teardown.

## 11. E1–E3 — encodings and only meaningful keys

E1 size: existing per-point radius resolver already supports basic encoding.
Start with a documented composition converting values to symbol area (radius is
proportional to the square root for circles). Reject negative area inputs and
state whether zero hides a mark. Introduce a size scale only if domain/range,
clamping, inverse/legend requirements justify a reusable mapping. Any provider/
hook is dedicated with a fixed return type.

E1 symbols: use PlotSeries and core shapes first. If reusable definitions are
needed, require consistent bounds, hit geometry and size semantics. No separate
component for each decorative shape absent scale/data value.

E2 color: dedicated sequential and diverging families, never `useScale(...,
"color")`. Define domain validation, clamping/extrapolation, nonfinite values,
color-space interpolation, midpoint meaning, reversed and degenerate domains,
and signal behavior. Do not promise numeric inversion where many values map to
indistinguishable colors. Choose perceptually appropriate defaults only after
checking source/license and testing contrast on the actual background.

E3 discrete mappings: implement only the demonstrated family first. Ordinal keys,
threshold boundaries, equal-width quantization and distribution quantiles are
different operations and need separate fixed contracts. Test exact boundary
ownership, ties, empty domains, duplicate thresholds, data replacement and color
count errors. Each family must independently tree shake.

Scale-derived keys/legends may now earn an API: read the same scale, display its
actual stops/boundaries/units, and track domain/color changes. Continuous ramps,
threshold keys, and size keys are distinct geometry needs; no generic magic-role
wrapper. Simple categorical swatches still use core shapes/Text. Test that keys
encode the same values as marks, not merely matching paint swatches.

## 12. Data and demo discipline

Reuse checked-in NOAA, Census and NASA snapshots where their semantics fit. For
new sources, verify primary-source attribution, date/version, units, license and
transformations when selecting the dataset; source choice is not finalized here.
Check data into the repository with provenance and keep demos offline/runnable.

Every public API gets a minimal executable demo in the current documentation
registry, complete signatures/options/defaults/errors/signals documentation,
Studio editor declarations, public type/runtime evidence, and one realistic
composition. If a slice adds no API, document a recipe rather than an abstraction.
Proposed routes are plans; provide exact working URLs only after verifying them.

Minimum allocation matrix: 1000×640, 560×300, 360×300, 320×260, and a narrow taller
panel. Include data extremes, long labels, selected state and controls together.
Use allocation-relative width AND height queries. Prefer reflow, concise explicit
labels and increased plot space over dropping category identities. Where content
cannot fit, specify an honest minimum size/alternative view instead of claiming
universal readability or silently losing information.

## 13. Verification and completion gates

For each slice record two milestones:

- Runnable/feedback-ready: focused public contract passes; same example works
  manually; geometry and essential labels verified; exact Studio URL supplied.
- Feature complete: feedback incorporated; error/edge matrix, signals/cleanup,
  interactions and visual checks pass; docs/exports/editor/source/built/packed
  evidence agrees; scope-specific tree shaking passes; gate status recorded.

Assert semantic coordinates, values, selected IDs and resource counts first.
Inspect screenshots for overlap, clipping, hierarchy, focus and visual density;
do not replace baselines simply to make tests pass. Use deterministic ownership
counters; avoid GC/heap guesses. Verify no resources survive unmount/failure.
Test public imports through actual package boundaries, not private shortcuts.

Aggregate commands use Node 24.15+ on the Node 24 line, pnpm 11.21.0 and Chromium.
The final gate is `corepack pnpm@11.21.0 trust`. Record failures and rerun only
changed/unresolved work during iteration; batch broad checks after feedback.
Performance evidence should follow a demonstrated workload: no speculative
index/cache/downsampling infrastructure. If introduced later, test that visible
geometry, missing-data gaps and inspection remain truthful.

## 14. Stop rules and unresolved decisions

- Stop API expansion when core composition already provides the behavior.
- Do not start M2–E3 infrastructure to make M1 appear architecturally complete.
- Resolve curve strategy migration, categorical accessor typing, controlled
  gesture cancellation, and color inversion semantics in their own slices.
- Do not equate a source-published interval with statistical confidence.
- Do not add a data-fetch layer, automatic aggregation, semantic DOM framework,
  multi-axis chart container, universal tooltip, or theme system in this plan.
- Do not attach calendar-local/DST, statistics, networks or geographic work to
  this queue without a new priority decision.

Success is a small set of composable, well-tested scale/data operations with
convincing public examples, not the number of exported component names.

## Execution update — 2026-10-06

F0, M1–M6, I1–I5 and E1–E3 are implemented, hardened and verified. V0 is closed
with explicit aggregate-gate evidence: the unrelated auxiliary-output design draft
fails the historical-banner and formatting rules. All unaffected stages passed
independently, including all 26 browser batches. Final source and built chart
suites each passed 348 tests with two opt-in diagnostics skipped.

See the [walkthrough](../testing/field-notes/2026-10-06-chart-api-walkthrough.md)
and [execution note](../testing/field-notes/2026-10-06-chart-api-execution.md).
No chart implementation step remains open, no next scope is selected, and the
aggregate gate is not misrepresented as green. Earlier baseline results remain
dated evidence. No commit, merge, push or publication occurred.
