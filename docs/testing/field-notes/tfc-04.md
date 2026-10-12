# TFC-04 field note — event order and logical targeting

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The cataloged Ordering and overlap laboratory drives Pibbl's existing eight mouse events through sibling routes, overlap, component ancestry, fill/stroke/combined geometry, transparent and non-hittable shapes, expanded interaction width, Canvas observers, handler replacement/removal, target removal, error isolation, activation, and cursor fallbacks. The primary risks were movement arriving before entry, every overlapping region firing, event and cursor selection disagreeing, handler changes losing stable identity, and pathless observers/default cursors accidentally becoming geometric targets.

The TFC-04 boundary is an untransformed root Canvas. CSS scaling, transforms, nested clips, and globally ordered offscreen layers remain explicit TFC-05 cases rather than implied coverage.

## Manual and headless method

The gallery and browser suite load the same public-API `interaction-trace-lab` scenario. Its fixed 480×240 scene exposes selectable fixtures, resettable traces, handler generation, target removal/reordering, visible cursor state, and documented expected routes.

Manual review used the in-app Chromium browser on macOS at a 900×700 page viewport. The Regions route produced `mouseover(left) → mousemove(left) → mousemove(left) → mouseout(left) → mouseover(right) → mousemove(right) → mouseout(right) → mouseover(left) → mousemove(left)`. Overlap selected only the later-painted target; reordering selected Lower, removal exposed Lower, and the pointer/crosshair cursor always agreed with the trace. Nested movement recorded ancestor-only movement, then child entry/movement without fan-out. Fill, stroke, combined fill/stroke, transparent fill, expanded-width, and no-hit positive/negative points matched their drawings. Handler generation 2 alone received activation after replacement; removal stayed silent. Observer replacement/removal appeared only after the queued rerender settled, a throwing observer was followed by its safe peer, and target-specific removal removed only Right after the current route while Left and the root runtime stayed live. Reset restored Regions, handler generation 1, and an empty trace.

The in-app pointer controller cannot separate press/release or synthesize double and secondary clicks. Those exact same-target, cross-target, leave/re-entry, double-click, and context-menu paths are driven by the shared raw-CDP helper in the scenario integration suite and reference native fixture. This is recorded as a manual-controller limitation, not missing contract evidence.

Headlessly, the contract validator, native reference fixture, shared scenario suite, and narrow live-dispatch tests assert order, target identity, observer order, activation, mutation, errors, and pixels. Twenty independent runs passed 23 tests each—460 assertions of the focused suite—with zero retries or failures.

## Visual strategy and stabilization

The scenario uses fixed Canvas dimensions, solid fixture colors, stable coordinates, an 800×600 headless browser viewport, and device-pixel ratio 1. Targeted interior, edge, overlap, and background pixel probes prove the tested hit geometry matches what was rendered. Trace/state assertions prove non-pixel behavior such as event order and cursor ownership. Manual review covered every fixture composition and its highlighted target/cursor state; no screenshot threshold was widened and no visual baseline was rewritten.

## Completed evidence

Under Node 24.19.0 and pnpm 11.21.0:

- the focused TFC-04 suite passed 20/20 independent runs, 23/23 tests per run;
- the complete Chromium suite passed 18 files, 120 tests, with 4 intentional skips;
- lint, TypeScript 7 typecheck, package build, strict Bundler/NodeNext/runtime package consumer, source gallery build, and built-package gallery build passed;
- source and built galleries include the same lazily loaded interaction laboratory;
- the TFC-01 performance characterization was narrowly adapted from an obsolete per-type click registry/bare click to the equivalent unified-region mouse-move miss scan, preserving exact `N` hit-test counts through 10,000 regions.

The only browser error observed manually was the scenario's deliberate `Deliberate ordering-lab observer failure`; its safe peer still ran.

## Platform evidence and decisions

Current Pointer Events, UI Events, CSSOM View, and DOM listener rules were cross-checked against Chrome for Testing 151.0.7922.34. Reference traces support one topmost target, exit before entry, transitions before movement, removal-aware listener snapshots, and exception isolation. Chromium also confirmed that leaving and re-entering A before release can still click A when down, up, and the generated click all resolve to the same live target. Reference macOS context order was secondary down → context menu → up, but Pibbl deliberately preserves the browser's native order instead of promising that sequence cross-platform.

The four historical failures were four geometry variants of the same move-before-entry defect, not four independent semantic disputes. The implemented fill, stroke, and expanded-width cases all require `mouseover → mousemove`.

Pibbl-specific decisions are:

- one event-type-independent logical region wins in reverse paint order;
- one component/path slot keeps identity across handler replacement;
- Pibbl does not imitate DOM propagation by firing every geometric hit;
- a no-path `useEvent` is a post-target Canvas observer and a no-path `useCursor` is a fallback, never a target;
- public rerenders requested during handlers settle on the next frame, while direct synchronous registry mutations obey the live-snapshot contract;
- global paint order and coordinate conversion across layers remain TFC-05 work.

## Surprises, flakes, and rejected approaches

- The first double-click driver used a high-level helper that inserted an extra movement event. Raw CDP press/release pairs with explicit click counts made the trace deterministic.
- A cursor fallback needs pointer-presence state separate from CSS ownership. Without it, disabling one default and enabling another in the same settled rerender left the Canvas temporarily blank until another movement.
- Removing a hovered cursorless target can still require fallback reconciliation; region removal and default replacement need the same ownership-aware path.
- Public rerender is animation-frame queued. Tests that described it as same-dispatch mutation were corrected; a narrow internal test proves the synchronous Set/region boundary without inventing a production API.
- A combined fill/stroke probe initially landed in fill-only space. It moved to a point covered by both the fill and the configured six-pixel stroke.
- Rejected all-hit dispatch because it conflicts with topmost user expectations and Pibbl has no event-path API.
- Rejected treating cursor-only/default hooks as independent targets; cursor and events must share one selected region, with Canvas defaults outside hit testing.
- Rejected weakening transition ordering or adding retries; the platform trace and 20-run gate were stable.

## Helper and tooling friction

The raw browser input helper must preserve press and release as distinct CDP events and translate through Vitest's scaled iframe. Contract cases also need phase labels so TFC-04 can be fully green while TFC-05 geometry remains visibly pending. Public scenarios correctly expose frame-queued updates, but direct registry-mutation semantics require a small internal adapter test.

Candidate tools:

1. a reusable raw-CDP mouse gesture driver with explicit button/click-count and root-Canvas coordinates;
2. a contract-route projector that compares native, approved Pibbl, and observed traces without circular table assertions;
3. a standard scenario pixel/target probe for positive, boundary, and negative geometry cells;
4. a cursor-state probe that distinguishes pointer presence, logical target, fallback winner, and exact CSS ownership.

## Decisions and follow-ups

- The implemented behavior is recorded in the [mouse interaction contract](../../design/mouse-interaction-contract.md).
- Stable logical regions unify handler and cursor selection on the root Canvas while pathless observers/defaults remain separate.
- TFC-05 must extend the same target and transition trace across CSS scaling, nested transforms, clip intersections/holes, groups, and one global layer paint order.
- TFC-06 should derive performance budgets from the unified-region dispatcher rather than the historical per-event handler Sets.
- TFC-07 should include pointer/cursor interaction state in whole-runtime teardown cycles.
