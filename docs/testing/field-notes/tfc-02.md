# TFC-02 field note — mouse interaction contract

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The mouse interaction contract explorer renders the approved native evidence and CRC projection from one executable oracle. The main risk was treating Canvas overlap as DOM propagation, or preserving current handler-set order because it happened to exist before platform expectations were measured.

## Manual and headless method

The manual explorer was exercised in the in-app Chromium browser. Entry, move, switch, Canvas-background leave, root exit, geometry, activation, mutation, exception, coordinate, and context-policy cases all updated their diagram and native/CRC sequence fields. Reset restored Enter a region. Browser output contained only Vite connection debug messages.

Headlessly, the explorer loads through its catalog entry, drives every action, validates the oracle independently, asserts fixed representative traces, and probes the public-API diagrams whose current runtime behavior is not intentionally deferred. Nested clip intersection, the interaction-width miss, and the two removal schematics remain contract-only until TFC-04/TFC-05. The TFC-01 native fixture consumes the approved oracle for analogous movement and activation traces while independently driving the native gesture, so expected data and observed behavior cannot pass through the same unchecked projection.

## Visual strategy and stabilization

The explorer uses a fixed 480×240 Canvas and public `g`, `clip`, `layer`, `line`, `rect`, and pathless `useEvent` APIs to draw case-specific diagrams. Red probe markers stay away from text and geometry boundaries. The manual pass observed `top`, `child`, transformed `a`, `layer`, stroked `a`, widened-line `a`, and `canvas-wide-observer` at their documented probes. The state panel labels logical related targets as diagnostic routes and labels context ordering as browser-dependent. The existing browser environment fixes viewport, DPR, locale, time zone, color scheme, color profile, and reduced motion.

## Surprising findings and browser differences

- Current Pointer Events Level 4 now includes Mouse and Wheel Events material that used to be read primarily through UI Events; the older UI Events algorithms still provide useful explicit transition ordering.
- DOM's nearest-common-inclusive-ancestor click rule has no honest CRC equivalent without a propagation tree, so cross-target release intentionally produces no CRC region click.
- The executable CDP-driven native fixture clicks after leaving and re-entering the original live target before release. Pointer Events leaves hysteresis to implementations while describing a no-boundary-crossing sequence as the general case. The contract follows measured reference Chromium when down, up, and the generated click all resolve to the same live target.
- Reference Chromium/macOS emits secondary `mousedown → contextmenu → mouseup`, but the specification leaves high-level context-menu order browser-dependent.
- Browser boundary events after target removal can depend on layout timing and feature flags. The contract specifies stable postconditions and the next explicit movement rather than one exact task boundary.

## Flakes and stabilization

The oracle test does not synthesize unimplemented CRC behavior. It verifies shared data/rendering, while the native fixture verifies only analogous browser traces. Canvas-specific contract cases stay green as approved expectations until TFC-04/TFC-05 make runtime conformance assertions.

Manual actions await their scenario frame, and headless target pixels avoid glyph antialiasing and overlap edges. No retry or widened visual threshold was added.

## Failed or rejected approaches

- Rejected all-hit dispatch for overlaps; it is geometric fan-out, not DOM bubbling.
- Rejected adding capture/bubble/stopPropagation merely to imitate DOM terminology.
- Rejected using `originalEvent.relatedTarget` for logical regions because it only describes DOM targets around the Canvas.
- Rejected release-only click targeting; down/up identity and the browser-generated click target determine region activation.
- Rejected promising one cross-browser context-menu order.
- Rejected presenting the logical related target as public event data; it is diagnostic route metadata until the public event type changes.
- Rejected treating public no-path `useEvent` hooks as geometric regions; they remain Canvas-wide observers after target-bound callbacks.
- Rejected changing runtime behavior in the design step; the current mismatch remains visible until TFC-04.

## Helper and tooling friction

- Native targets use DOM fixture names while reusable contract cases use symbolic A/B; a small projection adapter keeps the oracle independent of fixture labels.
- Scenario state fields are readable for individual cases but long sequence strings need deliberate wrapping in compact panels.
- Canvas-only geometry needs explicit labels instead of misleading native parity claims.

Candidate tools:

1. a typed trace-projection adapter for symbolic targets, fixture targets, and logical related targets;
2. an oracle linter that checks every public mouse event appears in at least one approved case;
3. a contract-conformance driver that can run one gesture against current CRC and produce an actionable expected/actual trace diff.

## Decisions and follow-ups

- The approved contract is [the mouse interaction contract](../../design/mouse-interaction-contract.md).
- `MOUSE_CONTRACT_CASES` is the executable trace source for explorer and tests, backed by independent structural and representative-trace assertions.
- Topmost reverse-paint-order target selection, transition-before-move, same-target click identity, mutation postconditions, cursor parity, and root-coordinate conversion are approved.
- TFC-03 implements safe ownership/mutation behavior; TFC-04 implements event order/targeting; TFC-05 completes geometry conformance.
- The absent historical `use-event.test.ts` is replaced by fill, stroke, and interaction-width entry cases that cover the one transition-order defect reported across its four failing geometry variants.
