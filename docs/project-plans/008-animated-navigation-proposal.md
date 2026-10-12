# Plan 008 — Animated chart navigation proposal

Date: 2026-10-12. Status: helper approach accepted by the user; runnable slice implemented.
Approved coordinated financial work is committed as `cf420e8c`.

## Smallest composable public addition

Export one pure function from `@pibbl/core/viz`:

```ts
function interpolateNumericRange(
  from: NumericDomain,
  to: NumericDomain,
  progress: number,
): NumericDomain;
```

The signature matches the existing `PibblInterpolator<NumericDomain>` contract.
Both finite endpoints interpolate together in one immutable tuple. Endpoint-linear
interpolation is predictable for pans and zooms and supports ascending, descending,
and flat pairs. For progress within [0, 1], orientation and endpoint bounds are
preserved. Custom easing may overshoot; the interpolator extrapolates like numeric
tweening and does not silently clamp. Finite input/result validation is required.
Receiving scales retain their own domain rules and navigation retains bounds and
minimum-span normalization.

Reuse existing `tween`, `keyframes`, and `useAnimatedValue`; add no controller,
animation clock, magic operation selector, or duplicated duration/easing options.

## Authoring through existing animation

```tsx
const intent = useSignal<NumericDomain>(bounds);
const direct = useSignal(false);
const shown = useAnimatedValue(intent, {
  animation: tween<NumericDomain>({
    duration: direct.get() || reducedMotion.get() ? 0 : 180,
    easing: easing.easeOut,
    interpolate: interpolateNumericRange,
  }),
});

// Preset and discrete navigation targets are normalized before assignment.
function navigateTo(range: NumericDomain) {
  direct.set(false);
  intent.set(range);
}

// Take control from the actual displayed position, including mid-animation.
function beginGesture() {
  direct.set(true);
  intent.set(shown.get());
}

function updateGesture(range: NumericDomain) {
  intent.set(range);
}

return <TradingTimeScale logicalRange={shown} /* existing inputs */ />;
```

`shown` is the sole presented viewport; `intent` is its requested destination.
The intent signal retains its tuple identity across unrelated renders. The examples
deliberately publish a fresh tuple when a motion-policy change needs to adopt a
new duration for the same destination; endpoint equality alone would suppress
that retarget. Applications may use endpoint equality when they do not need
this forced policy adoption. A new destination retargets from the last committed displayed value.
Gesture start must assign the displayed range, not merely switch the duration:
option-only changes do not restart an equal target. Zero-duration transitions
publish through the next normal scheduler transaction, matching event-driven
visual update timing. Gesture calculations use the displayed range or a captured
gesture-start range, never an unseen destination.

Ticks, inspection mappings, and preset matching use the displayed range. During
motion an unmatched range reads Custom; arrival restores the matching preset(s).
Comparison base and pinned observation stay independent. Application owns reduced
motion; the example can read the browser preference and choose zero duration.
Use a non-overshooting easing by default so normalized ranges stay bounded.

## Observable slice

Add one focused public test before production code. Demonstrate animated calendar
presets, Earlier/Later, Zoom and Latest in Calendar Windows and Performance Desk.
Verify midpoint geometry, exact destination, interruption from displayed position,
rapid retargeting, gesture takeover, unchanged inspection/base state, reduced
motion, and teardown on the existing scheduler. Provide the Studio URLs for
feedback before expanding package/documentation evidence and broader hardening.

Implemented evidence: one pure viz export, editor declaration, API documentation,
standalone minimal example, and packed consumer coverage. Calendar Windows and
Performance Desk use existing `tween` and `useAnimatedValue`, with no animation
runtime changes. Buttons animate; wheel zoom, horizontal/Shift-wheel pan, and captured mouse/touch drag/pinch use
zero duration to stay attached to the fingers. The live browser reduced-motion
preference listener can retarget a running transition at zero duration and is
removed on teardown.

Fresh Node 24.15.0 / pnpm 11.21.0 / Chromium evidence: the three focused range and
example test files passed 14 tests, including midpoint navigation, retargeting,
gesture takeover, live reduced motion and cleanup. Typecheck, targeted ESLint,
core build and packed viz verification passed. Real native wheel, touch pan,
pinch, subsequent pinning and preset restoration passed in Studio. Slice ready
for feedback; no aggregate trust result is claimed.

Follow-up interaction fix: desktop dragging now uses the same captured pointer
navigation as touch, horizontal trackpad/Shift-wheel pans, and wheel input
accumulates pending deltas through the direct zero-duration path. Discrete buttons
retain their 180ms transitions. Tests establish mouse drag click suppression,
horizontal wheel navigation, and six wheel zoom events applied before the next
frame, with motion enabled.
