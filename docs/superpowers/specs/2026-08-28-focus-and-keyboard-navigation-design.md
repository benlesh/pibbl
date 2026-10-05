# Pibbl focus and keyboard-navigation design

> **Historical status: IMPLEMENTED DESIGN RECORD.** Original proposal or approval wording below is preserved; current behavior lives in `docs/design/`.

Status: proposed

Date: 2026-08-28

Depends on:
[`2026-08-28-dom-aligned-user-events-design.md`](./2026-08-28-dom-aligned-user-events-design.md)

## Summary

Pibbl will provide optional internal focus management and keyboard navigation for
explicit event targets. The HTML Canvas remains the single native DOM focus
host. Pibbl tracks which one of its logical targets is currently focused and uses
the shared event dispatcher for logical focus, keyboard, pointer, and click
behavior.

The feature is additive. Nothing changes until an application explicitly adds
`withFocusManagement`. Directional arrow navigation is a separate nested policy
added with `withKeyboardNavigation`. Both are element enhancers: they annotate
existing elements without changing component identity, parentage, layout,
measurement, source order, or painting.

Pibbl does not create or synchronize semantic DOM descendants. Applications that
require screen-reader semantics own an alternative accessible implementation
using their framework of choice, including fallback content inside the Canvas
when appropriate.

## Goals

- Track one arbitrary logical Pibbl event target as focused while the Canvas owns
  DOM focus.
- Make Tab and Shift+Tab cross the Canvas naturally within surrounding native
  DOM controls.
- Provide deterministic source-order focus traversal.
- Provide opt-in geometry-based arrow navigation for grids, lists, toolbars,
  diagrams, and arbitrary spatial arrangements.
- Let pointer, mouse, pen, and touch interaction update logical focus through
  the common event system.
- Preserve explicit target ownership and Pibbl component identity.
- Trigger rendering and familiar logical focus events when focus changes.
- Keep focus and keyboard-navigation implementation code out of application
  bundles when neither enhancer is used.
- Export every public API from `@pibbl/core` without deep imports.

## Non-goals

- Generating an accessibility tree or persistent semantic DOM mirror.
- Making internal Canvas focus alone sufficient for screen-reader access.
- A public button, input, form, grid, or other widget library.
- Inferring a custom target's hit path or navigation bounds from its rendered
  descendants.
- Numeric positive-`tabIndex` ordering.
- Default Tab or arrow wrapping.
- Arrow-key escape from an inner navigation boundary into an outer boundary.
- Programmatic leaf refs with an imperative `focus()` method.
- A CSS cascade, pseudo-class engine, or Tailwind-style focus syntax in the
  first delivery.
- Automatically integrating focus between Pibbl targets and application-owned DOM
  alternatives.

## Public composition

Applications enable the behavior through named root exports:

```ts
import {
  pibbl,
  flow,
  grid,
  withFocusManagement,
  withKeyboardNavigation,
} from "@pibbl/core";

pibbl(
  canvas,
  withFocusManagement(
    flow({
      children: [
        TopControls(),
        withKeyboardNavigation(
          grid({
            children: cells,
            style: gridStyle,
          }),
          { mode: "directional" },
        ),
        BottomControls(),
      ],
    }),
  ),
);
```

`withFocusManagement(element)` installs one focus boundary for the enhanced
subtree and activates the Canvas focus host. `withKeyboardNavigation(element,
{ mode: "directional" })` marks a descendant navigation boundary. Neither call
creates a component or render wrapper.

A Pibbl root has at most one focus-management boundary. A second boundary on the
same root produces a targeted error rather than competing for the Canvas focus
host. A keyboard-navigation boundary must be inside that focus boundary; using
one without a focus manager also produces a targeted error.

Focus management requires an `HTMLCanvasElement` root. Installing it on a root
`OffscreenCanvas` produces a targeted error because there is no DOM focus host.
Offscreen layers rendered under an HTML Canvas continue to participate through
the shared root focus manager.

The first release has one navigation mode, `"directional"`. The explicit mode
keeps the enhancer extensible without claiming that directional navigation
requires a visual grid.

## Focus targets and enrollment

Only explicit event-target registrations can enter the focus index. Component
props, returned descendants, paint output, cursor declarations, and propagation
listeners do not create focus candidates by themselves.

The default enrollment rule is:

- a target with `onClick`, `onKeyDown`, or `onKeyUp` is keyboard-focusable;
- pointer movement, hover, wheel, cursor, drag-over, focus observation, and
  capture-only handlers do not imply keyboard focus;
- `keyboardFocusable: true` explicitly includes another event target;
- `keyboardFocusable: false` explicitly excludes an otherwise automatic target.

`keyboardFocusable` is a capability adjective. It never commands Pibbl to focus a
target during render.

Each candidate uses the event target's stable identity: mounted component
identity plus the target hook or built-in interaction slot. The same target
remains focused across ordinary rerenders. Keyed children preserve focus when
reordered under the same parent. Reparenting or remounting creates a new target,
following Pibbl's existing identity contract.

Source traversal determines focus order. Pibbl does not use geometry or numeric
`tabIndex` values for Tab ordering.

## Native and logical focus state

The browser owns DOM focus. While active:

```text
document.activeElement === canvas
Pibbl focused target === one live event target or none
```

The focus manager owns:

- whether the Canvas focus boundary is active;
- the current live logical target, if any;
- the most recent focus input modality needed for focus-visible behavior;
- the ordered live candidate index for the latest completed render;
- the direction of an external Tab entry;
- Space-key activation state;
- directional-boundary membership and candidate bounds.

When at least one candidate exists, the manager makes the HTML Canvas a native
Tab stop. It snapshots the Canvas's previous focusability state and restores it
exactly on removal or root disposal. If all candidates disappear, the Canvas no
longer remains a dead Pibbl-created Tab stop.

A focus change dispatches logical events through the common dispatcher:

```text
previous target: focusout (bubbles) -> blur (does not bubble)
next target:     focusin  (bubbles) -> focus (does not bubble)
```

`relatedTarget` identifies the other live logical target when one exists. Pibbl
schedules one ordinary coalesced render after the transition so the target
snapshot and any future focus-style consumer can update.

When the Canvas loses DOM focus, logical focus becomes inactive and the current
target is cleared. Application-owned DOM descendants or alternatives are not
silently folded into the Pibbl focus index.

## Entering and leaving the Canvas with Tab

The manager observes Tab direction only while installed, using an exactly owned
listener on the Canvas's document. This avoids focus sentinels or generated DOM
siblings.

- Forward Tab into the Canvas chooses the first live candidate.
- Shift+Tab into the Canvas chooses the last live candidate.
- Tab while a non-final target is focused moves to the next candidate and calls
  `preventDefault()`.
- Shift+Tab while a non-first target is focused moves to the previous candidate
  and calls `preventDefault()`.
- Tab from the last target and Shift+Tab from the first target are not canceled;
  the browser resumes native DOM traversal outside the Canvas.
- If DOM focus enters programmatically without a known direction, Pibbl uses
  forward entry.
- If the Canvas is focused with no current target, Tab chooses the first target
  and Shift+Tab chooses the last before allowing an exit on a later key press.

There is no default wrapping. Directional boundaries do not alter Tab order.
A row-major source declaration therefore tabs left-to-right and then
top-to-bottom, but this follows source order rather than geometric inference.

## Pointer, mouse, pen, and touch focus

Press interaction uses the event subsystem's one resolved topmost target.

- `pointerdown` is authoritative where Pointer Events are available. A native
  `mousedown` or `touchstart` performs the same default when no corresponding
  pointer event represented that press.
- A press on a keyboard-focusable target focuses the Canvas and selects that
  logical target.
- Mouse, pen, and touch-shaped PointerEvents follow the same rule.
- A compatibility mouse event following a pointer event, or a Touch Event
  accompanying the same pointer press, does not cause a second logical focus
  transition.
- A press on a non-focusable target or empty Canvas background focuses the
  Canvas but clears the logical target.
- Pointer capture changes later pointer targeting but does not independently
  move keyboard focus.
- Canvas DOM blur deactivates logical focus regardless of the last pointer.

The event target's handler receives the event before a default focus action is
committed. Calling `preventDefault()` prevents the manager's default focus
change, matching the DOM convention that canceling a pointer-down default can
prevent focus transfer.

## Keyboard dispatch and default actions

Keyboard events first dispatch to the focused target through capture, target,
and bubble phases. Optional policies run only if the event remains unhandled,
using `defaultPrevented` as the DOM-shaped handled signal.

The ordering is:

```text
keydown/keyup dispatch
    -> target or ancestor may preventDefault()
    -> focus-manager activation default
    -> nearest keyboard-navigation boundary default
```

A focusable target with `onClick` receives button-like default keyboard
activation:

- Enter produces one logical click from `keydown`.
- Space prevents native scrolling on `keydown`, records the pressed target, and
  produces one logical click on matching `keyup` if the target remains focused
  and live.
- Preventing the relevant keyboard event suppresses the default click.
- Moving focus, cancellation, blur, or unmount before Space release cancels the
  pending activation.
- Pibbl does not synthesize an extra click when the browser has already supplied
  the logical activation.

The logical click uses a synthetic `MouseEvent` with `detail: 0` as
`originalEvent`, preserving the public click-handler contract, and records the
originating `KeyboardEvent` as `sourceEvent`. Applications needing different
semantics handle the key event and call `preventDefault()`.

## Directional navigation

`withKeyboardNavigation(element, { mode: "directional" })` establishes an
arrow-navigation boundary over the enhanced element's eligible descendants.
It is named directional because the children need not form a grid.

Targets use their rendered root-logical navigation rectangles. Built-in
targets provide bounds from their known geometry or allocated box. A custom
event target supplies `keyboardNavigationBounds` in its component-local
coordinate space when its arbitrary `Path2D` does not have a reliable native
bounding-box API; Pibbl captures the current transform and converts all four
corners to a root-logical axis-aligned envelope. A focusable target without
bounds remains in Tab order but is not an arrow-navigation candidate.

For Left, Right, Up, and Down:

1. The focused target and its ancestors receive `keydown` first.
2. If prevented, no navigation policy runs.
3. The nearest containing directional boundary considers its live candidates.
4. Candidates outside the requested half-plane are discarded.
5. Candidates whose bounds overlap the current target on the perpendicular
   axis are preferred.
6. Remaining candidates are ranked by nearest forward edge distance, then
   perpendicular distance, then source order.
7. The winner becomes focused and the key's default action is prevented.
8. If there is no winner, focus remains where it is.

The algorithm is deterministic and works for regular grids, uneven cards,
toolbars, lists, diagrams, and other spatial layouts. It does not wrap.

## Nested navigation boundaries

The nearest directional boundary owns arrow navigation for its descendants.
Targets inside a nested boundary are excluded from the outer boundary's direct
candidate set while focus remains inside the nested boundary.

At an inner boundary edge, the arrow key does not bubble into the outer
navigation policy. Focus remains in place. A future explicit edge-delegation
option may be designed if concrete use cases justify it; the first release does
not include one.

Tab and Shift+Tab ignore directional boundaries and continue through the one
global source-order candidate list. This makes nested forms and controls
predictable: controls receive their own keys first, Tab follows declared order,
and only an unprevented arrow key reaches the nearest directional policy.

## Focus visuals

Focus visuals are deliberately separate from focus movement.

The first delivery provides two familiar mechanisms:

- logical `onFocus`, `onBlur`, `onFocusIn`, and `onFocusOut` handlers can update
  ordinary `useState`;
- `useEventTarget` returns `isFocused` and `isFocusVisible` render snapshots for
  a custom target.

The manager schedules a render on every logical focus transition. Pointer focus
sets `isFocused` but normally not `isFocusVisible`; Tab and arrow navigation set
both. Applications may choose always-visible focus by using `isFocused`.

No pseudo-style language is introduced in this delivery. A later
`focus:`/`focus-visible:` style enhancer can consume the same state without
changing target identity or navigation behavior. The public demo must render a
clear high-contrast focus indicator and must not rely on color alone.

## Accessibility boundary and guidance

Internal focus is a keyboard interaction facility, not an accessibility tree.
Pibbl will not create persistent semantic descendants, assign ARIA roles, mutate
hidden Canvas text, use `aria-activedescendant`, or repeatedly refocus generated
DOM to force announcements.

Documentation will tell application developers to provide an equivalent
accessible implementation with the framework they already use. Canvas fallback
content may be appropriate, but the application owns:

- semantic roles, names, descriptions, states, and relationships;
- screen-reader announcements;
- editable DOM controls and text selection;
- synchronization between visual Canvas state and alternative DOM state;
- avoidance of duplicate or invisible keyboard stops;
- the choice of whether the Canvas interaction surface, the semantic
  alternative, or both participate in a particular user experience.

The alternative must expose the same meaningful data and operations rather
than merely a prose description of the Canvas. The Canvas itself should have an
accessible name and concise usage instructions whenever it remains a keyboard
surface.

Pibbl documentation must be candid: using `withFocusManagement` does not make a
Canvas application screen-reader accessible.

## Optionality and bundle boundary

Focus is installed only by `withFocusManagement`. Directional navigation is
installed only by `withKeyboardNavigation`. Without those imports being used:

- no Canvas `tabIndex` mutation occurs;
- no document key listener is installed;
- no focus candidate index is maintained;
- no Tab, activation, focus-visible, or directional-scoring policy runs;
- focus and navigation implementation modules must be absent from a packed
  consumer's optimized output.

The event registry may carry inert keyboard metadata without importing focus
implementation. The focus module reaches into the event system through a small
internal policy interface; the base event dispatcher never imports the focus
module.

Root named exports from `@pibbl/core` remain the only supported import site. ESM
module boundaries and `sideEffects: false` must let consumer bundlers eliminate
unused focus code even though the names are re-exported from the package root.

## Lifecycle and failure behavior

- Installing either enhancer twice over the same effective boundary is
  idempotent or produces a targeted development error; it never installs
  duplicate native listeners.
- Removing a focused target dispatches no event to the dead target, clears
  pending activation and capture references, and leaves the Canvas with no
  logical target.
- Removing a directional boundary removes its membership without changing
  component identity.
- Render failure releases focus-owned DOM mutations and listeners through the
  existing root/component teardown paths.
- `dispose()` restores the Canvas focusability state, removes document
  listeners, clears logical focus, and is idempotent.
- Application handler failures remain isolated by the event dispatcher.

## Public demonstration

The docs/demos/examples application will contain one representative scenario:

```text
native DOM control before the Canvas

Canvas:
  [top control] [top control]

  [ 1] [ 2] [ 3] [ 4]
  [ 5] [ 6] [ 7] [ 8]
  [ 9] [10] [11] [12]

  [bottom control] [bottom control]

native DOM control after the Canvas
```

The button-like controls and squares are private scenario components, not Pibbl
exports. They demonstrate the documented forwarding or explicit hook patterns.

The scenario proves:

- forward and reverse entry from surrounding native DOM;
- Tab and Shift+Tab through every Canvas target in source order;
- left-to-right, top-to-bottom Tab behavior from row-major declarations;
- arrow navigation only inside the directional square boundary;
- no arrow wrapping or escape from an inner boundary;
- pointer, pen-shaped PointerEvent, and touch-shaped PointerEvent focus;
- click plus Enter and Space activation;
- focus clearing on empty Canvas interaction and DOM blur;
- a clear focus-visible indicator;
- continued operation after keyed reorder and target removal.

The same public scenario is driven headlessly. Exhaustive edge cases remain in
deterministic test-lab scenarios rather than making the learning example
unreadable.

## Verification

Required evidence includes:

- focus-candidate enrollment and explicit inclusion/exclusion tests;
- stable target identity across rerender and keyed sibling reorder;
- focus clearing on unmount, reparenting, empty Canvas interaction, blur, and
  disposal;
- Canvas `tabIndex` snapshot, mutation, dynamic empty-state, and exact restore
  tests;
- forward/reverse external entry and boundary exit with real surrounding DOM
  controls;
- source-order Tab tests independent of geometry;
- Enter and Space activation order, cancellation, blur, and unmount tests;
- pointer default-focus cancellation and compatibility-event de-duplication;
- directional candidate scoring, tie-breaking, transforms, layout movement,
  missing bounds, and no-wrap tests;
- nested directional ownership and inner-edge containment tests;
- target-first keyboard handling for text/form-like controls;
- focus/focusin/blur/focusout order, propagation, related targets, and scheduled
  render tests;
- focus-visible modality transitions and high-contrast demo evidence;
- public `@pibbl/core` imports in source, declarations, Bundler, NodeNext, packed
  consumer, source-browser, built-browser, and Studio editor declarations;
- an optimized packed consumer that uses ordinary Pibbl but not the enhancers and
  proves focus implementation markers are absent;
- an optimized packed consumer using both enhancers and proving the expected
  implementation is present and operational;
- the manual/headless shared public demonstration described above.

The aggregate repository trust gate runs after focused verification. Historical
test totals are not used as completion evidence.

## Delivery order

1. Implement and approve the DOM-aligned user-event foundation.
2. Add the optional focus manager and source-order Tab traversal.
3. Add directional navigation and nested-boundary behavior.
4. Add focus render snapshots and focus-visible behavior.
5. Add the public demonstration, accessibility guidance, packed-consumer proof,
   and complete trust-gate evidence.

Each slice begins with observable public contract cases. Focus work does not
bypass or duplicate the shared event dispatcher.

## Standards and guidance basis

- [WHATWG HTML Canvas element and fallback content](https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element)
- [WHATWG HTML focus](https://html.spec.whatwg.org/multipage/interaction.html#focus)
- [WHATWG HTML activation behavior](https://html.spec.whatwg.org/multipage/interaction.html#activation-behavior-of-elements)
- [W3C Pointer Events Level 4](https://www.w3.org/TR/pointerevents4/)
- [W3C UI Events](https://www.w3.org/TR/uievents/)
- [WAI-ARIA Authoring Practices keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [WAI-ARIA Authoring Practices button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
