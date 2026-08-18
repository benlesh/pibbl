# Project plan 003: First-class style and layout

## Purpose

Give CRC one explicit typed style language for every visual value and add
dedicated Canvas layout components without introducing a retained display list or
speculative render pass. The first release includes absolute, overlay, CRC-native
flow, a documented CSS-compatible Flexbox subset, and a documented
CSS-compatible explicit Grid subset.

This plan is approved for implementation. Its detailed executable steps live in
[`2026-08-17-style-and-layout-implementation.md`](../superpowers/plans/2026-08-17-style-and-layout-implementation.md).

## Locked contract

- Element descriptors own immutable specified `style` and canonical `key`
  separately from programmatic props.
- Style is the only public home for visual output, geometry, typography, path
  data, image source, transforms, cursor, and interaction geometry.
- CRC has no selectors, cascade, specificity, or implicit inheritance. Reuse is
  ordinary TypeScript composition and object spread.
- Only named layout components establish formatting contexts. Nested layout
  components participate directly as items; there is no public item wrapper.
- CSS names are used only for accepted cases that match CSS. CRC-native behavior
  uses `flow`, `overlay`, `fit`, `rotationDegrees`, and other distinct names.
- Layout uses declared boxes and pure opt-in measurement. It does not record all
  Canvas operations, render children to discover size, or add a retained scene
  graph.
- Parent-first painting, source paint order, reverse target order, keyed and
  per-type occurrence identity, transforms, clipping, layers, failure cleanup,
  and deterministic ownership remain authoritative.
- Root percentages resolve against intrinsic Canvas dimensions. The initial box
  model is content-box, numeric padding/gaps, no margin, and nonnegative layout
  allocations.
- Text has shared pure measurement. Layout images require explicit dimensions.
  Arbitrary custom components need declared size or a pure measurement
  capability.
- Initial Flex supports row/column, nowrap/wrap, grow/shrink with explicit main
  minimums, numeric gaps, distribution, item alignment, and `align-content`.
- Initial Grid requires nonempty explicit row/column tracks and explicit
  one-based placement for every child; fixed/percentage/`fr` tracks, spans,
  overlap, numeric gaps, and alignment are supported.

## Deliberate exclusions

CSS parsing, selectors, inheritance, margin, scrolling, reverse/reordered or
baseline Flex behavior, automatic CSS minimum sizes, Grid auto placement,
auto/content tracks, repeat/minmax, named areas, subgrid, natural image layout
measurement, DOM overlay/accessibility APIs, pointer/touch/keyboard input, and a
retained renderer are not part of this plan.

## Rapid execution policy

Each step uses a focused failing test and the smallest relevant static/browser
checks. Broad browser, package, lifecycle, visual, and build checks run only at
the named milestones. The aggregate `trust` gate runs during final closure, not
after each small commit. Every task commit receives an adversarial independent
review before the next task begins.

## Status board

| Step    | Queue state | Outcome                                                         |
| ------- | ----------- | --------------------------------------------------------------- |
| P003-01 | Done        | First-class descriptor style/key protocol.                      |
| P003-02 | Done        | Path, rectangle, and SVG path style migration.                  |
| P003-03 | Done        | Line-family style migration.                                    |
| P003-04 | Done        | Text style and shared text layout.                              |
| P003-05 | Done        | Image style migration.                                          |
| P003-06 | Done        | Group, clip, layer, and style-only closure.                     |
| P003-07 | Done        | Length, constraint, box, and item capabilities.                 |
| P003-08 | Done        | Style resolution, layout context, placement, and observation.   |
| P003-09 | Done        | Absolute and overlay layout.                                    |
| P003-10 | Done        | Pure measurement and CRC-native flow.                           |
| P003-11 | Done        | CSS-compatible Flexbox subset.                                  |
| P003-12 | Done        | CSS-compatible explicit Grid subset.                            |
| P003-13 | Done        | Learning examples, nested scenario, and Studio/public types.    |
| P003-14 | Next        | Composition, diagnostics, ownership, and performance hardening. |
| P003-15 | Queued      | Public contracts, evidence, and final trust closure.            |

## Execution steps

Each step below is governed by the identically numbered task in the detailed
implementation plan. Its file list, red/green command, milestone checks, and
commit message are part of this plan by reference.

### P003-01 [DONE] — Element style protocol

Done when specified style and canonical key are descriptor metadata, render
props cannot declare reserved names, style-only layer changes invalidate its
cache, key-sensitive callers are migrated, focused tests/typecheck pass, and the
commit has a clean adversarial review.

### P003-02 [DONE] — Path, rectangle, and SVG path styles

Done when the three primitives and all callers use required component-specific
styles, legacy top-level paint/geometry fails type checking, existing pixels and
interaction remain unchanged, and the commit is reviewed.

### P003-03 [DONE] — Line-family styles

Done when line coordinates, paint, pixel alignment, cursor, and interaction
width are style-only across all callers, focused behavior/type checks pass, and
the commit is reviewed.

### P003-04 [DONE] — Text styles and pure text layout

Done when text uses `width`/`height`/`wrap`/CRC-native `fit`, painting and pure
measurement share literal line layout, existing text/hit behavior is preserved,
and the commit is reviewed.

### P003-05 [DONE] — Image styles

Done when image source and visual geometry are style-only, existing asynchronous
ownership/race behavior is preserved, focused checks pass, and the commit is
reviewed.

### P003-06 [DONE] — Composition style closure

Done when group transforms use CRC-native degree names, clip/layer are
style-driven, layer comparison includes type/key/props/style, all legacy visual
mixins are removed, the style-migration milestone passes, and the commit is
reviewed.

### P003-07 [DONE] — Lengths, constraints, and boxes

Done when exact public value/box/item types and pure resolvers implement the
locked content-box and diagnostic policies, root and boundary fixtures pass, and
the commit is reviewed.

### P003-08 [DONE] — Resolution, context, and stable placement

Done when callbacks receive finite resolved style, root/nested/layer contexts
restore on success/failure, placement preserves keyed and unkeyed identity,
pixels/hit testing share transform/clip geometry, `crcLayoutBox` is local and
stable, lifecycle checks pass, and the commit is reviewed.

### P003-09 [DONE] — Absolute and overlay

Done when both pure algorithms and public components satisfy declared/default,
oversized-center, overflow, paint/target, resize, and nested behavior; focused
public evidence passes; and the commit is reviewed.

### P003-10 [DONE] — Measurement and flow

Done when measurement never invokes render or owns resources, unsupported size
is typed/actionable, text/custom/nested cases work, explicit-size images work,
flow's exact wrapping/alignment contract passes its milestone, and the commit is
reviewed.

### P003-11 [DONE] — Flexbox subset

Done when every accepted Flex behavior matches literal and hidden-DOM oracle
fixtures, every deferred behavior is rejected rather than approximated, public
integration/type checks pass, and the commit is reviewed.

### P003-12 [DONE] — Explicit Grid subset

Done when accepted track, `<1fr`, placement, span, overlap, gap, and alignment
behavior matches literal and hidden-DOM oracle fixtures, deferred behavior is
rejected, the algorithm milestone passes, and the commit is reviewed.

### P003-13 [DONE] — Public examples and integration

Done when four learner routes and the exhaustive nested public scenario are
type-clean, mountable/disposable, resize and preserve identity correctly, Studio
and packed consumers agree, generated indexes are current, and the commit is
reviewed.

### P003-14 [NEXT] — Hardening

Done when transforms, clips, layers, fractional offsets, failures, 1,000
reflows, visible-window structural counts, and deterministic diagnostics have
focused evidence; lifecycle/performance milestones pass; and the commit is
reviewed.

### P003-15 [TODO] — Contracts and final closure

Done when normative public contracts and migration guidance are published,
fresh final aggregate and controlled-reference checks pass, exact evidence is
recorded, all acceptance criteria map to current evidence, whole-branch review
is clean, and this plan has no active marker.

## Decision log

| Date       | Decision                                                                   | Rationale                                                                                                             |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-08-17 | Use one explicit local style namespace with no inheritance or cascade.     | It makes visual ownership inspectable and enables layout to inspect descriptors without invoking components.          |
| 2026-08-17 | Use dedicated layout components and direct nested participation.           | Formatting contexts stay visible without public item wrappers or hidden `display` behavior.                           |
| 2026-08-17 | Preserve immediate-mode rendering with pure opt-in measurement.            | Declared boxes solve layout without a costly scene-wide display list or double paint pass.                            |
| 2026-08-17 | Use CSS names only for verified compatible subsets.                        | Familiar but approximate behavior would create a more dangerous API than distinct CRC-native names.                   |
| 2026-08-17 | Optimize the development loop for focused checks and final holistic proof. | The implementation is broad; per-commit aggregate verification would slow feedback without improving local diagnosis. |

## Session log

- **2026-08-17 — Plan activated.** Approved the first-class style language,
  immediate-mode layout architecture, exact initial Flex/Grid boundaries, pure
  measurement policy, dependency-ordered 15-task implementation plan, focused
  verification cadence, and per-commit adversarial review. Next: **P003-01**.
- **2026-08-17 — P003-01 implementation review.** The initial implementation
  added descriptor-owned style/key metadata, the three-argument render
  protocol, and style-sensitive layer invalidation. Adversarial review found
  union-wide reserved-name and required-style gaps, a plain-props reference
  regression, overly broad style-shape acceptance, and premature plan
  advancement. P003-01 remains in progress while those findings are fixed and
  re-reviewed; see
  [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
- **2026-08-17 — P003-01 review fix round 2.** Replaced the finite
  non-plain-style blacklist with a positive requirement that every style schema
  explicitly extend or intersect `SystemStyle`. Resource/class schemas now fail
  structurally while declared styles retain ordinary object inputs and excess
  checks. P003-01 remains in progress pending re-review; P003-02 is still
  queued.
- **2026-08-17 — P003-01 complete after adversarial review.** Initial review
  found four Important issues plus the overly broad style-shape concern; the
  first re-review found one remaining Important blacklist issue; the final code
  re-review was clean. Focused evidence remained 28/28 browser tests plus clean
  workspace typecheck. P003-01 is done and the sole next step is **P003-02**;
  the same amended task commit receives one final status-only re-review.
- **2026-08-17 — P003-02 implementation pending review.** Added explicit
  paint/cursor/path/rectangle/SVG-path style capabilities, migrated the three
  primitives and every authored caller without a legacy adapter, and preserved
  zero-opacity and transparent-fill interaction behavior. Focused RED was 11
  failed and 3 passed browser tests plus the expected style-type errors. GREEN
  is 14/14 focused browser tests and clean workspace typecheck; changed-file
  lint, legacy-call audit, and diff hygiene are also clean. P003-02 remains in
  progress for adversarial review, and P003-03 remains TODO.
- **2026-08-17 — P003-02 adversarial review fix round 1.** Review found one
  Important runtime alias: an omitted style cursor allowed the shared event
  helper to fall back to an untyped top-level cursor. A browser regression
  reproduced the leak at 1 failed/2 passed path tests. The helper now requires
  an explicit cursor, while not-yet-migrated text and image callers pass their
  legacy cursor deliberately. The regression is green at 3/3; the combined
  path/rectangle/SVG-path/text/image suite is 47/47 and workspace typecheck is
  clean. P003-02 remains in progress pending re-review, and P003-03 remains
  TODO.
- **2026-08-17 — P003-02 complete after adversarial review.** Code re-review
  found the cursor-authority fix complete with no remaining findings. This
  status-only closure marks P003-02 done and advances P003-03 as the sole next
  step. No production or test file changed and no behavior check was rerun;
  the immediately preceding fresh evidence remains 47/47 focused browser tests
  plus clean workspace typecheck. The final amended task commit is sent for
  status-only review before P003-03 begins.
- **2026-08-17 — P003-03 implementation pending review.** Added closed public
  styles for the line family, moved all geometry/paint/cursor/interaction values
  into required style, reused the style-driven path renderer, and migrated every
  authored caller without a legacy adapter. Focused RED was 10 failed and 4
  passed tests plus the expected type errors. GREEN is 15/15 focused browser
  tests and clean workspace typecheck; changed-file lint, legacy-call audit, and
  diff hygiene are also clean. P003-03 remains in progress for adversarial
  review, and P003-04 remains TODO.
- **2026-08-17 — P003-03 adversarial review fix round 1.** Review found that
  object-rest forwarding let an untyped runtime `fill` key cross the closed
  line-style boundary into Path, producing polygon paint and fill-hit geometry.
  Focused RED reproduced both failures at 2 failed/9 passed. Line and both helper
  renderers now construct downstream styles from explicit allowed fields only;
  focused GREEN is 17/17 plus clean typecheck and changed-file hygiene. P003-03
  remains in progress pending re-review, and P003-04 remains TODO.
- **2026-08-17 — P003-03 complete after adversarial review.** Code re-review
  found the explicit runtime style boundary complete with no remaining findings.
  This status-only closure marks P003-03 done and advances P003-04 as the sole
  next step. No production or test file changed and no behavior check was rerun;
  the immediately preceding fresh evidence remains 17/17 focused browser tests
  plus clean workspace typecheck and changed-file hygiene. The final amended
  task commit is sent for status-only review before P003-04 begins.
- **2026-08-17 — P003-04 implementation pending review.** Added the closed
  public text style and pure shared line-layout utility, migrated every authored
  caller to `width`/`height`/`wrap`/CRC-native `fit`, and preserved paint,
  clipping, cursor, and measured hit geometry without a legacy adapter. Focused
  RED captured the absent utility/style behavior. GREEN is 23/23 focused tests
  plus clean workspace typecheck; P003-04 remains in progress for adversarial
  review, and P003-05 remains TODO. See
  [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
- **2026-08-17 — P003-04 adversarial review fix round 1.** Review found that
  text-local `fit: 'clip'` constrained pixels but not the measured interaction
  region. Focused RED reproduced cursor ownership outside the clip at 1 failed
  and 22 passed tests. Text and the existing clip component now share one
  internal Canvas/interaction clipping seam; focused text/layout/clip/dispatch
  GREEN is 38/38 plus clean typecheck. P003-04 remains in progress pending
  re-review, and P003-05 remains TODO.
- **2026-08-17 — P003-04 complete after adversarial review.** Code re-review
  found the shared Canvas/interaction clipping seam complete with no remaining
  findings. This status-only closure marks P003-04 done and advances P003-05 as
  the sole next step. No production or test file changed and no behavior check
  was rerun; the immediately preceding fresh evidence remains 38/38 focused
  browser tests plus clean workspace typecheck and changed-file hygiene. The
  final amended Task 4 commit is sent for status-only review before P003-05
  begins.
- **2026-08-17 — P003-05 implementation pending review.** Added the closed
  public image style, moved source/geometry/border/opacity/cursor/pixel alignment
  out of program props, and migrated every authored caller without a legacy
  adapter. Existing image-generation settlement, source-race, removal, and
  disposal ownership remain intact. Focused RED was 20 failed and 5 passed
  browser tests plus the expected type errors. GREEN is 27/27 focused browser
  tests and clean workspace typecheck; changed-file lint, legacy-call audit, and
  diff hygiene are also clean. P003-05 remains in progress for adversarial
  review, and P003-06 remains TODO. See
  [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
- **2026-08-17 — P003-05 and P003-06 style-only phase complete.** Task 5's
  independent adversarial code review was clean. Task 6 moved group transforms,
  clipping geometry, and layer dimensions into closed public styles, removed the
  obsolete visual-prop mixins, migrated all authored callers, and exported the
  complete style type surface from both public type entrypoints. Focused Task 6
  RED was 3 failed and 42 passed browser tests plus the expected missing-type
  errors; focused GREEN is 46/46. The planned style-migration milestone is clean:
  workspace typecheck and full ESLint exited 0, the browser suite passed 315
  tests with 2 skips across 37 files, and the packed consumer passed Bundler,
  NodeNext, runtime, and no-source checks. P003-05 and P003-06 are done; P003-07
  is the sole next step. See
  [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
- **2026-08-18 — P003-11 and P003-12 CSS algorithm phase complete.** Added the
  approved CSS-compatible Flex and explicit Grid subsets with hand-derived
  fixtures and independent Chromium DOM oracles. Flex includes the accepted
  grow/shrink, wrapping, gap, alignment, and restricted intrinsic matrix; Grid
  includes fixed, percentage, fractional, span, overlap, gap, and alignment
  behavior without implicit placement or tracks. Task 11's adversarial review
  is clean. Task 12 focused GREEN is 21/21 after review regressions. The planned
  algorithm milestone
  passed 126 tests across 13 files, workspace typecheck exited 0, and structural
  performance passed 3 tests with 2 controlled timing cases skipped. P003-11
  and P003-12 are done; P003-13 is the sole next step. See
  [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
- **2026-08-18 — P003-07 through P003-10 layout foundation complete.** Added
  finite length/box resolution, allocation-aware resolved styles, stable local
  placement and observation, public absolute/overlay contexts, pure opt-in
  measurement, and CRC-native flow without a retained display list or
  speculative render. Adversarial reviews for Tasks 7-9 are clean; Task 10's
  implementation and batched phase evidence form its review unit. The planned
  milestone passed 62 layout/scenario tests across 7 files, clean typecheck,
  9 lifecycle tests across 2 files, and 3 structural performance tests with 2
  controlled timing cases skipped. P003-07 through P003-10 are done; P003-11 is
  the sole next step. See
  [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
- **2026-08-18 — P003-13 public integration complete.** Added four canonical
  learner routes for absolute/overlay, Flow, Flex, and Grid; expanded the
  cataloged layout laboratory to prove nested Flex→Grid→Overlay reflow,
  clipping, topmost targeting, keyed state, pure text measurement, explicit
  image sizing, and exact `crcLayoutBox` observations; synchronized Studio and
  strict packed-consumer declarations with the current public API. The generated
  index now covers 28 lessons and 14 test labs. Source and built Studio builds,
  workspace typecheck, packed Bundler/NodeNext/runtime/no-source consumers, and
  48 focused browser tests are clean. P003-13 is done; P003-14 is the sole next
  step. See [`p003-style-layout.md`](../testing/field-notes/p003-style-layout.md).
