# Plan 007 — Visualization charting

> **Historical status: Planning and implementation work record; current code and public contracts define shipped behavior.**

> API correction approved 2026-10-05: **every scale family has a dedicated
> provider and hook**, with a fixed return type and no family-selector argument.
> Current families: `LinearScale` / `useLinearScale`, `BarScale` / `useBarScale`,
> `UTCScale` / `useUTCScale`. UTC nicening is `niceUTCDomain(domain, { count? })`.
> Generic `Scale`, `ScaleProps`, and `useScale` are removed, without aliases.
> Future log, symlog, power, square-root, point, ordinal, local-time, sequential,
> diverging, quantile, quantize, and threshold variations must follow this rule;
> listing them here does not claim implementation. Family modules must tree shake
> independently. This decision supersedes selector-based API examples below.

Status: active, 2026-10-05. User requests planning and implementation of the
[visualization roadmap](viz-charting-priorities.md), complete API explanations,
minimal demos for each public feature, and compelling real-data examples.

## Baseline and scope

Preserve unrelated animation/machines, game, package, and Studio edits in this
shared checkout. The charting priorities document supplies ordering and visual
acceptance; its advanced families remain in scope after basic charting. Existing
UTC and pie-label approvals remain authoritative. New contracts are resolved
only as needed for each slice. No commit or push is requested.

## Status board

| Step                                             | State                            |
| ------------------------------------------------ | -------------------------------- |
| UTC scales, helpers, minimal demo and NOAA chart | Accepted; merged into local main |
| Numeric/categorical scales and axis presentation | Next                             |
| Chart furniture and shared visual defaults       | Queued                           |
| Everyday marks, curves, areas and bands          | Queued                           |
| Responsive exploration and shared selection      | Queued                           |
| Statistics, diagrams, hierarchies, geography     | Queued                           |
| Accepted-slice hardening and integration         | Per slice                        |

## [ACCEPTED] UTC scale vertical slice

Implement the approved epoch-number UTC scale, continuous lookup, pure extent
and UTC nice-domain helpers. Preserve linear/band compatibility. Add a focused
failing public test, minimal API demo, and a real NOAA CO2 example using the
attributed checked-in snapshot. Verify the same example headlessly and visually.
Done for feedback when focused checks pass and the exact Studio URL is supplied.
Broader edge cases, competitor review and package evidence follow feedback.

## [IN PROGRESS] Numeric/categorical scales and axis presentation

Resolve domain/tick policies, implement focused examples for numeric niceness,
log/symlog, point/category coordinates and label-density presentation. Include
minimal demos and public API docs for each addition. Keep existing semantics
unless a change is explicitly designed and documented.

## Queued slices

Follow P0.3–P4 in the priorities document. Every new public API gets a minimal
runnable demo, documented signatures/options/defaults/errors and one realistic
composition showing why it exists. Reuse attributed snapshots, record units,
dates, source and transformations; never present synthetic values as measured.

## Integration and visual test contract

Use supported public imports and the same scenarios manually/headlessly. Assert
semantic values and geometry before screenshots. Inspect desktop and phone
allocations and interaction states. Preserve one scheduler and exact ownership.
Provide runnable feedback before broad hardening. Feature completion requires
accepted appearance, docs/declarations, packed Bundler/NodeNext consumers, Studio
source/built evidence, proportional checks and final integrated trust. Do not
claim all roadmap features complete after one slice.

## Session log

- 2026-10-05: Activated at user request. Prior Plan 004 retains its unfinished
  status and evidence; it is not marked complete by this switch. Source audit
  confirms only linear/band scales are currently exported. Node 24.15 is available.

- UTC boundary clarification during implementation: two-tick output is always
  the original endpoints. If no epoch-aligned cadence avoids an interior
  boundary when count=2, niceDomain preserves already integral millisecond
  bounds rather than seeking overflowing years. This previously unspecified
  year-zero case is explicit in API docs and a regression assertion.

- First slice is ready for experiential feedback at
  http://127.0.0.1:5192/#/examples/composition/viz-utc-climate and
  http://127.0.0.1:5192/#/examples/composition/viz-utc-basics. Minimal website
  source, complete UTC API reference, and Studio declarations are updated.
  [Fresh verification and findings](../testing/field-notes/2026-10-05-viz-utc-slice.md)
  record passing latest focused results and remaining hardening. Await visual
  feedback before broader hardening; the implementation step remains in progress
  until acceptance. No full-roadmap completion or competitive-quality claim.

### 2026-10-05 continuation — reconciled baseline

The user confirms the dedicated linear/bar/UTC APIs and responsive NOAA chart
were accepted and merged into local main. Earlier “only linear/band” and
“awaiting UTC feedback” statements above are dated history, superseded here.

Delivery order for this continuation:

1. Readable numeric ticks, explicit nicening, formatting, and collision-aware
   axes in NOAA; present a runnable slice before broad hardening.
2. Compact contextual UTC labels and explicit long-category wrap/truncate/skip
   policies, keeping label visibility separate from tick/data geometry.
3. Dedicated LogScale/useLogScale, SymlogScale/useSymlogScale, and
   PointScale/usePointScale, each with fixed return types, minimal demos,
   attributed data, domain/inversion/tick contracts, and family tree shaking.
4. Composable grid/reference lines/bands, axis titles, legends, titles/captions/
   source notes with explicit layout ownership.

First numeric slice implements pure `linearTicks`, `niceLinearDomain`, and
`formatNumber`, plus opt-in `Axis.labelOverlap` and `labelGap`. Existing linear
`scale.ticks()` remains unchanged. NOAA derives numeric density from plot height,
retains width/height `style.when` presentation, and hides colliding time labels
without deleting tick geometry. New API docs and Studio declarations are included.
Focused Chromium run: 16 tests passed on Node 24.15.0 / pnpm 11.21.0.
Preview: http://127.0.0.1:5195/#/examples/composition/viz-utc-climate.
Status: first numeric slice accepted by the user; broader feature verification remains pending.
Packed consumers, additional scale families, tree shaking expansion, full
interaction/cleanup evidence, and aggregate trust remain pending. No commit,
merge, or push in this continuation.

The minimal runnable numeric demo is also available at
http://127.0.0.1:5195/#/examples/composition/viz-numeric-axis.
Focused ESLint passed. A whole-repository typecheck encountered concurrent,
unrelated sprite-demo errors in `docs/site/minimal/sprites/atlas.tsx`; this is
not a passing aggregate check. Preserve concurrent website/minimal-demo edits.

Studio visual inspection: NOAA and minimal numeric demo render at desktop and
narrow/shallow allocations, with no page errors in the inspected source-mode
sessions. The minimal demo's canonical `PibblController` mount annotation is
required by the Studio source loader and has been verified in the live editor.

2026-10-05: User accepted the numeric-axis slice and requested its commit, then
continued work in priority order. This authorizes the slice commit only; no
merge or push was requested.

### 2026-10-05 — contextual UTC and long-label slice

Accepted numeric slice committed as `01afbb81`. The following slice remains
uncommitted and ready for visual feedback, not fully hardened:

- `utcTickLabels(values, { locale? })` returns fixed-type frozen strings with
  standalone calendar context at year/month/day/sub-day precision. Full-ISO
  scale formatting remains unchanged.
- Axis adds signal-capable `labelOverflow`, `labelMaxWidth`, `labelMaxLines`,
  and `labelLineHeight`. Wrapping and grapheme-safe ellipsis are measured in the
  actual font on all four edges. Collision checks use the final multiline box;
  tick and mark geometry never changes.
- The real NOAA long-label example compares wrap/truncate, preserves a full
  selected-value readout, and responds to both allocation width and height.
  Public docs and Studio declarations cover options, defaults, errors, and
  signals. UTC basics provides the runnable date-label demo.
- Native keyboard tests exposed the missing FocusManagement policy in NOAA and
  the new demo. Both now opt in explicitly; Tab and arrow-key inspection pass.

Preview URLs:

- http://127.0.0.1:5195/#/examples/composition/viz-long-labels
- http://127.0.0.1:5195/#/examples/composition/viz-utc-basics

Fresh focused verification: Node 24.15.0, pnpm 11.21.0, Chromium; 27 tests across
axis-labels, long-labels-example, axis-runtime, numeric-axis, and utc-example.
Typecheck passed. Source Studio visual inspection covered desktop and a narrow,
shallow panel with no page errors. Long-label bounds/control/touch/native keyboard
checks cover 360×300, 560×300, and 900×640. Signal-policy disposal is checked.
No broad packed/built/aggregate verification claim is made for this slice.

Next: dedicated log, symlog, and point scales with independent hooks/modules,
explicit domain/inversion/tick contracts, meaningful logarithmic real data, and
family-isolation evidence; then reusable furniture. Contextual labels and
long-label policies await visual feedback before broader hardening.

2026-10-05: User accepted the contextual UTC/long-label slice and authorized its
commit. Dedicated scales are the next active slice. Broader package and
integration verification remains pending; no merge or push is authorized.

### 2026-10-05 — dedicated logarithmic scale slice

Accepted label slice committed as `bd8bbb7d`. The next runnable slice adds
`LogScale` / `useLogScale` with a fixed `Signal<ResolvedLogScale>` contract and
independent implementation/hook modules. Positive finite ascending/descending
domains map equal ratios to equal distances; nonpositive values reject, inverse
coordinates extrapolate, and collapsed ranges reject inversion. Tick output
includes original endpoints plus bounded integer powers of an explicit base
(default 10). Nicening/clamping is not implicit. Close/unrepresentable floating
point cases and all options/errors/signals are documented in the public API.

The minimal provider/hook demo exercises mapping, inversion, and ticks. The NASA
composition checks in the ten mass values from the Planetary Fact Sheet dated
18 March 2025 (verified against the primary NASA source on 5 October 2026).
It uses equal-size PointSeries dots, public nearestPoint inspection, explicit
units, an Earth-relative unit toggle, and width/height `style.when` queries.

- http://127.0.0.1:5195/#/examples/composition/viz-log-basics
- http://127.0.0.1:5195/#/examples/composition/viz-log-masses

Focused Chromium checks: 7 tests pass (log-scale and log-example) on Node 24.15.0,
pnpm 11.21.0. Geometry tests cover ratios, inversion, ticks, descending domains,
existing marks, signal updates, and disposal. The example is tested at 360×300,
560×300, and 1000×660 with text bounds, unit control, native Tab/arrow navigation,
and touch selection. Source Studio visual inspection covers desktop and narrow
shallow allocation with no page errors. Four source scale families independently
tree shake; packed export expectations and consumer type evidence are extended.

Status: logarithmic slice ready for visual feedback, uncommitted, not feature
complete. SymlogScale/useSymlogScale and PointScale/usePointScale remain next,
then reusable furniture. Broad integration/aggregate trust remains pending.

Additional log-slice package evidence: core build, repository typecheck, and
focused ESLint passed. The same 7 focused tests passed in built browser mode.
`node tooling/verify-viz-scale-tree-shaking.mjs` confirms four independent
families in source and built bundles. `node tooling/verify-packed-viz.mjs` passed
packed Bundler/NodeNext consumers, exact runtime exports, shared core identity,
private boundaries, and packed family-isolation checks. The offline consumer
install required access to the local pnpm store outside the sandbox; its retry
passed. This is proportional package evidence, not an aggregate trust result.

Log-slice visual feedback: user rejected category-label omission in shallow
allocations. The NASA chart now preserves all ten body names and reallocates
space from the editorial header to the plot. Width/height queries retain the
unit control, selected-value readout, instructions, and source. Regression tests
assert every body name is present and names do not overlap, in addition to bounds
and touch/keyboard behavior, down to 320×260. Numeric tick density remains a
separate policy. Public axis guidance records why categorical identities must
not be silently removed as a responsive strategy. No new commit was requested.

2026-10-05: User accepted the logarithmic slice after the compact-label fix and
authorized its commit. Symlog and point scales are next.

### 2026-10-05 — signed and categorical point slice

Accepted logarithmic work committed as `7eb70568`, including the compact
category-label correction. No merge or push.

New runnable slice: dedicated `SymlogScale`/`useSymlogScale` and
`PointScale`/`usePointScale`, each with fixed return types and signal inputs.
Symlog supports signed domains, a positive explicit constant, inversion, and
readable data-space ticks. Point supports unique ordered categories, padding,
nearest-category inversion, reversed ranges, and empty/singleton domains.
Axes accept both; continuous marks accept symlog; `ScaleAdjust` accepts point
categories for custom marks. Numeric series/inspection remain numeric APIs.

Public Studio: `http://127.0.0.1:5195/#/examples/composition/viz-signed-population`.
Checked-in Census population changes demonstrate gains/losses and compression;
all six state identities remain visible in narrow/shallow layouts. The API page
includes a minimal runnable composition and signatures, defaults, errors, and
signal behavior. Editor declarations and packed type probes include both families.

Fresh evidence on Node 24.15.0 / pnpm 11.21.0: eight focused Chromium tests passed
in source and built modes (mapping, signals, degeneracy, cleanup, touch/keyboard,
and label bounds/nonoverlap at 320×260, 360×300, 560×300, 1000×640). Core build,
repository typecheck, focused ESLint, packed Bundler/NodeNext/runtime exports,
and six-family source/built/packed tree-shaking passed. Studio desktop and compact
renders inspected; successful preview reported no page errors. Documentation
metadata validation passed. No aggregate trust claim.

Status: **slice ready for feedback**, uncommitted; not fully hardened or feature
complete. Await experiential feedback before expanding edge-case/integration
coverage. Reusable chart furniture follows these scale foundations.

Documentation gate limitation: the full Studio docs check continued beyond metadata
and API coverage, then failed the unrelated `canvas-runtime` alphabetical type-heading
assertion (`PibblAnimatedValueOptions` / `PibblAnimationTarget`). Concurrent website
and documentation work was preserved; the complete docs gate is not passing.

Visual feedback incorporated: Census composition now uses vertical stems with
population change on the vertical axis. States run left to right from greatest
gain to greatest loss. Compact layouts show all six standard postal abbreviations;
inspection retains full state names and exact counts. Wide layouts retain full
names. Four responsive browser contracts pass, including horizontal category
nonoverlap and left/right keyboard plus touch inspection. No commit requested.

### 2026-10-05 — first chart furniture slice

User accepted the vertical, population-change-sorted symlog/point composition;
committed as `ac035d33`. No merge or push.

`GridLines` and `ReferenceLine` now provide decorative scale-aligned guides with
explicit caller-owned spans and paint. Shared private tick selection keeps Axis
and grid geometry consistent without tying guides to label visibility. All scale
families are supported, including categorical band centers and point positions.
The Census example replaces its manual zero line and adds faint horizontal guides.
Studio URL remains `http://127.0.0.1:5195/#/examples/composition/viz-signed-population`.

Fresh Node 24.15.0 / pnpm 11.21.0 evidence: five focused Chromium tests pass
(reactive guide geometry/cleanup and four responsive touch/keyboard allocations).
Typecheck, core build, focused lint, packed runtime exports, Bundler/NodeNext
consumers and family-isolation checks pass. Desktop/compact Studio renders were
inspected; refreshed runtime reports no page errors. Documentation includes a
minimal runnable composition, options/defaults/errors/signals; editor declarations
include both components. A cached Studio runtime required a dev-server refresh
for the newly added exports. No aggregate trust claim.

Status: **slice ready for feedback**, uncommitted. Reference bands, axis titles and
units, composable legends/title/caption/source furniture, and broader furniture
hardening remain outstanding. Composition continues to own layout and paint order.

### 2026-10-05 — reference-band slice

Accepted grid/reference-line slice committed as `7b7c2f6f`; no merge or push.
`ReferenceBand` adds a dedicated continuous interval operation with signal-valued
numeric endpoints, caller-owned pixel span, direction, fill, and opacity. It
supports reversed intervals/ranges, rejects categorical scales and out-of-domain
values, and owns no layout, labels, or hit geometry. Census composition shades
the loss region, with explicit explanatory text and all categories preserved.

Runnable: `http://127.0.0.1:5195/#/examples/composition/viz-signed-population`.
Fresh Node 24.15.0 / pnpm 11.21.0 evidence: six focused source Chromium tests pass;
core build, repository typecheck and focused lint pass. Studio desktop/compact
renders inspected with no page errors. API documentation includes signature,
defaults/errors/signals and minimal runnable example; editor/type probes updated.
Status: **slice ready for feedback**, uncommitted; broader band edge-case/built
browser verification and aggregate gate remain pending. Text furniture and legends
remain next. Concurrent minimal-viz documentation work was preserved unstaged.
Packed ReferenceBand verification also passed: Bundler/NodeNext type consumers,
exact runtime exports, core identity/private boundaries, and scale-family isolation.

### 2026-10-05 — composable legend-item slice

Reference bands accepted and committed as `3f03540e`. No merge or push.
`LegendItem` provides a signal-aware square swatch and single-line label, with
explicit swatch size/gap and label paint. It is decorative and allocates no layout;
caller-owned core Groups/layouts arrange entries and reserve plot space. This
keeps interactive series controls separate and avoids a monolithic chart wrapper.
Census composition now includes Gain/Loss entries, preserving all category labels
and source notes at narrow/shallow sizes down to 320×260.

Runnable at `http://127.0.0.1:5195/#/examples/composition/viz-signed-population`.
Fresh Node 24.15.0 / pnpm 11.21.0 evidence: five focused source Chromium tests pass
(label geometry/signals/cleanup and four responsive touch/keyboard layouts).
Core build, repository typecheck and focused lint pass. Desktop/compact Studio
renders inspected, no page errors. API page includes defaults, errors, signals,
explicit layout limitations, and runnable demo; editor declarations/type probes
updated. Status: **slice ready for feedback**, uncommitted; no aggregate trust
claim. Axis titles/units and title/caption/source-note composition remain next;
legend hardening and built-browser coverage remain pending.
Packed LegendItem checks also passed: Bundler/NodeNext consumers, exact exports,
shared core identity/private boundaries, and scale-family isolation.

### 2026-10-05 — axis title and units slice

Accepted legend items committed as `2421411d`; no merge or push.
`AxisTitle` adds scale-range-centered text at an explicit plot edge and offset,
with optional signal-valued units. Vertical titles rotate along the axis. The
caller owns the margin; title placement changes neither ticks nor mark geometry.
Census composition reserves a wider left margin and retains a compact People
label when its editorial heading is hidden.

Runnable: `http://127.0.0.1:5195/#/examples/composition/viz-signed-population`.
Fresh Node 24.15.0 / pnpm 11.21.0 evidence: five focused source Chromium tests pass
(range-centered text, unit signals, cleanup, four responsive interaction sizes).
Core build, repository typecheck and focused lint pass. Desktop/compact Studio
renders inspected with no page errors. Public documentation includes signatures,
defaults/errors/signals, placement ownership, and a runnable minimal demo;
editor declarations and public type probes include AxisTitle.

Status: **slice ready for feedback**, uncommitted. Chart title/caption/source-note
composition and final cross-slice hardening remain outstanding. No aggregate gate
claim; full edge/rotation/error matrix and built-browser coverage remain pending.
Packed AxisTitle checks passed: Bundler/NodeNext consumers, exact runtime exports,
shared core identity/private boundaries, and scale-family isolation.

### 2026-10-05 — reuse core Text for chart prose

Accepted axis titles committed as `6a0da53c`. The proposed ChartText wrapper was
removed before commit after user review identified duplication: core Text already
supports measured wrapping, lineHeight, width/height, and fitting. The composition
uses core Text directly for titles, captions, and source notes. No additional
chart-prose API is needed. Earlier ChartText test/package results describe the
withdrawn implementation and are not evidence for a shipped capability.
Cross-slice hardening and final verification remain outstanding.

### 2026-10-05 — public API value audit and hardening

User requested removal of abstractions without meaningful added value.
Reviewed numeric/UTC tick helpers, axis label policies, dedicated scale families,
scale-based furniture, and text/legend additions against core capabilities.

- Removed LegendItem/LegendItemProps, editor declarations, runtime exports, wrapper
  test, and API page. It merely assembled a rectangle and text; the Census legend
  now uses those core primitives directly and retains both labels/interaction.
- ChartText was already removed before commit: core Text owns measured wrapping,
  fitting, line height and signal-aware text. Documentation now shows core prose
  composition rather than proposing another component.
- Retained linearTicks/niceLinearDomain/formatNumber/utcTickLabels: numerical and
  calendar tick/label operations, distinct from text rendering.
- Retained Axis label policies: measured allocation/collision decisions preserve
  scale positions and tick geometry, with explicit category-label policies.
- Retained Log/Symlog/Point providers/hooks: dedicated mappings, inverses, ticks,
  validation, and fixed return types.
- Retained GridLines/ReferenceLine/ReferenceBand: map ticks/domain intervals into
  geometry and follow signal/allocation changes without taking layout ownership.
- Retained AxisTitle: derives midpoint and edge/rotation from scale range/frame.
  Generic chart headings, captions, attribution and simple legends remain core
  composition. A future legend API needs actual data/scale behavior to justify it.

Moved on to hardening: a failing public regression exposed formatNumber's Latin-
digit-only rounded-negative-zero test. It now detects the formatter's own zero
symbol and preserves signs for nonzero values. Regression covers Arabic, Persian,
Bengali digits and scientific zero. No new public API or commit.

Fresh audit verification (Node 24.15.0 / pnpm 11.21.0): full viz browser suite
passed in both source and built modes, each 201 passed / 2 skipped across 42 files.
Core build, repository typecheck, focused lint, packed exact exports and Bundler/
NodeNext consumers, shared runtime identity and scale-family isolation passed.
Full docs check validates metadata/API coverage but still fails the unrelated
canvas-runtime alphabetical type-heading assertion; no aggregate-green claim.
Removed APIs remain absent from runtime exports and Studio declarations. Cleanup
and localized-number fix remain uncommitted; unrelated minimal-demo edits preserved.

### 2026-10-05 — AxisTitle companion audit and geometry hardening

Cleanup/localized-zero fix committed as `f838297f`, excluding unrelated minimal
example edits. User requested specific scrutiny of AxisTitle's composition value.
Retained it because it derives midpoint, plot edge and rotation from a named
scale and allocation; it is a sibling companion to Axis, not a generic Text alias.
Public tests now prove all four edges with descending ranges, title/Axis alignment
under a parent transform, reactive width/height reallocation, unchanged mapping,
and cleanup. Explicit margins/offsets remain caller-owned; no automatic collision
or margin-reservation promise. Companion usage and limits documented.

Additional hardening covers categorical grid placement at band centers vs point
positions, vertical logarithmic reference-band geometry, reversed pixel spans,
and rejection of out-of-domain/nonfinite/overflowing band inputs. Thirteen focused
source-browser tests passed. No runtime API or implementation changes were needed.
New tests/docs remain uncommitted; final aggregate gate still pending.
Fresh expanded built-browser viz run: 211 passed, 2 skipped across 42 files on
Node 24.15.0 / pnpm 11.21.0. Repository typecheck and focused test lint passed.

### 2026-10-05 — scale precision and documentation hardening

Added public tests for symlog round trips with constants 1e-300, 1, and 1e300,
overflowing raw ratios with tiny constants, normalized zero, invalid point domains
and padding, descending-range tie priority, clamped categorical inspection, and
nonfinite inspection/count errors. Invalid provider tests explicitly consume the
lazy scale signal; documented that validation boundary. Fourteen focused source
tests pass; expanded full built viz suite passes 221 tests, 2 skipped in 42 files.
No additional runtime behavior/API was introduced.

Broader gate work corrected existing canvas-runtime heading/symbol ordering
without changing section content, added missing public JSDoc on scale furniture,
classified the new viz API documentation, fixed TypeScript signature/return
snippets, and corrected Studio example links. Public JSDoc passes (48 entries,
1104 declarations); typecheck and focused lint pass. Studio documentation gate
now passes after the ordering correction.

Fresh `corepack pnpm@11.21.0 trust` on Node 24.15.0 stopped in scenarios:check at
the unrelated state-machines example's direct-core-import requirement (log:
/private/tmp/pibbl-viz-trust.log). Separate docs:check now passes viz snippet/link
validation but remains blocked by unclassified machine/sprite documentation.
These are not chart-feature failures and no aggregate-green claim is made.
Unrelated concurrent minimal-example/website edits remain preserved. This
hardening batch remains uncommitted; no merge/push. Remaining verification includes
completion of repository-wide gates once their external blockers are resolved.
