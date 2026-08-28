# CRC DOM-aligned user events design

Status: proposed

Date: 2026-08-28

## Summary

CRC will expand its current mouse-only interaction support into one DOM-aligned
user-event system. Native Canvas events enter small family adapters, pass
through one shared logical dispatcher, and reach one explicit CRC event target
through capture, target, and bubble phases.

The design extends CRC's original immediate-mode technique rather than adding a
retained DOM or scene graph. Components and hooks explicitly register the
minimum interaction state that must survive rendering. Hit testing and event
paths are derived when an event occurs. Rendering remains synchronous and does
not retain drawing commands.

This event foundation is independent of focus policy. The optional focus and
keyboard-navigation layer is specified separately in
[`2026-08-28-focus-and-keyboard-navigation-design.md`](./2026-08-28-focus-and-keyboard-navigation-design.md).

## Goals

- Support the pertinent DOM user-event families with familiar event names and
  ordering.
- Resolve one topmost logical target using CRC's existing transformed, clipped,
  global paint ledger.
- Support capture, target, and bubble propagation through existing component
  ancestry.
- Preserve explicit component and resource ownership.
- Install native Canvas listeners lazily and release them exactly.
- Provide direct DOM-style event props on built-in drawing components.
- Give custom components explicit hooks for registering hit targets and
  propagation listeners.
- Preserve CRC's immediate-mode rendering, component identity, source paint
  order, layer behavior, and scheduled updates.
- Establish the event substrate needed by optional focus management without
  embedding focus policy into the dispatcher.

## Non-goals

- A retained DOM, virtual DOM, accessibility tree, or scene graph.
- Inferring interaction geometry from arbitrary drawing commands or returned
  descendants.
- A built-in widget library or semantic controls such as buttons, forms, or
  listboxes.
- Reimplementing browser event families that cannot meaningfully reach a Canvas
  or a future explicit CRC input adapter.
- Simulating obsolete or vendor-specific events.
- Making every painted primitive intercept pointer events by default.
- A generalized plugin framework for event policies.
- Focus styling or keyboard-navigation policy. Those consume this subsystem but
  do not belong to it.

## Governing architectural principle

CRC already renders the complete component tree while retaining only
identity-bound hook state and runtime resources. User events use the same
pattern:

```text
render traversal
    -> explicit sparse event registrations
    -> native user event
    -> derive target and temporary propagation path
    -> dispatch
```

The implementation may maintain indexes required for hit testing and resource
ownership, but it must not retain Canvas drawing commands or create semantic
descendants. The phrase **event tree** is intentionally avoided. CRC has a
sparse interaction registry, and a propagation path exists only for the
duration of one dispatch.

## Event-family contract

CRC supports these event types and their DOM-style `onX` and `onXCapture`
handler names where capture is meaningful.

### Pointer events

- `pointerover`
- `pointerenter`
- `pointerdown`
- `pointermove`
- `pointerrawupdate` when the browser supplies it
- `pointerup`
- `pointercancel`
- `pointerout`
- `pointerleave`
- `gotpointercapture`
- `lostpointercapture`

Pointer data preserves the browser's mouse, pen, or touch `pointerType` and the
native pointer properties. CRC does not invent device classes beyond the
browser values.

### Activation and mouse compatibility events

- `click`
- `dblclick`
- `auxclick`
- `contextmenu`
- `mouseover`
- `mouseenter`
- `mousedown`
- `mousemove`
- `mouseup`
- `mouseout`
- `mouseleave`

CRC forwards the compatibility sequence supplied by the browser. It does not
synthesize a second mouse sequence after pointer events and does not suppress a
native sequence merely because the application subscribed to both families.

### Touch events

- `touchstart`
- `touchmove`
- `touchend`
- `touchcancel`

Touch Events remain supported because applications may need their multi-touch
lists even when Pointer Events are preferred for new interaction code.

### Wheel, keyboard, and focus events

- `wheel`
- `keydown`
- `keyup`
- `focus`
- `blur`
- `focusin`
- `focusout`

The obsolete `keypress` event is not supported. Focus events in this subsystem
are logical transport; the optional focus manager decides which CRC target is
focused.

### Editing and composition events

- `beforeinput`
- `input`
- `change`
- `compositionstart`
- `compositionupdate`
- `compositionend`
- `select`
- `selectionchange` when supplied by an explicit input adapter

A plain Canvas does not natively behave like an editable control. These events
are available to future explicit CRC input controls and adapters through the
same dispatcher; their existence does not cause CRC to create hidden editable
DOM.

### Clipboard events

- `copy`
- `cut`
- `paste`

### Drag and drop events

- `dragstart`
- `drag`
- `dragend`
- `dragenter`
- `dragleave`
- `dragover`
- `drop`

### Explicit exclusions

Lifecycle, media, network, animation, transition, storage, and obsolete vendor
events are not part of the user-input subsystem. CRC may support another event
category later without routing it through geometric hit testing.

Semantic-control events such as `submit`, `reset`, `invalid`, `toggle`, and
`beforetoggle` require a corresponding control contract. They are not
synthesized merely because similarly named DOM events exist.

## Public event props

Built-in drawing components with known interaction geometry accept the
applicable DOM-style handler props directly:

```ts
rect({
  onPointerDown: handlePointerDown,
  onClick: handleClick,
  onKeyDown: handleKeyDown,
  style: {
    x: 20,
    y: 20,
    width: 120,
    height: 40,
    fill: "#2563eb",
  },
});
```

Capture handlers use the `Capture` suffix, such as `onClickCapture` and
`onPointerDownCapture`. Handler types are exported by family and as one composed
event-handler interface from `@crc/core`; type-only imports add no runtime code.

CRC does not inspect arbitrary custom-component props for event-looking names.
A custom component declares only the events it chooses to support, then either:

1. forwards those handlers to a drawing component that owns the hit geometry;
   or
2. explicitly registers handlers and a hit path through an event-target hook.

Returning drawing descendants never hoists or aggregates their geometry into
the parent component.

## Explicit registration hooks

The recommended custom-target hook groups all handlers belonging to one
conceptual target:

```ts
const state = crcEventTarget(
  {
    onClick,
    onPointerDown,
    onPointerUp,
    onKeyDown,
  },
  {
    path,
    fill: true,
    lineInteractionWidth: 0,
    keyboardFocusable: undefined,
    keyboardNavigationBounds: bounds,
  },
);
```

One call owns one stable target slot. Its identity is the mounted component
identity plus the hook slot. `keyboardFocusable` and
`keyboardNavigationBounds` are inert metadata unless the optional focus package
is reachable in the application. They are described by the focus design.

`crcEventTarget` returns a read-only render snapshot containing `isFocused` and
`isFocusVisible`. It exposes no imperative `focus()` method. When focus
management is absent, both values are `false`. This lets a custom target render
focus visuals without a ref or a retained component object.

An ancestor that wants to participate in propagation without becoming a hit or
focus target registers explicitly:

```ts
crcEventListener({
  onPointerDownCapture,
  onClick,
});
```

`crcEventListener` attaches handlers to the current mounted component for
capture and bubble traversal. It has no geometry and cannot become a focus
candidate.

The existing singular `crcEvent` hook remains supported with its shipped
Canvas-observer and path-bound behavior. New components with several handlers
should prefer one grouped `crcEventTarget`, preventing several event hooks from
accidentally representing several conceptual targets. Migration may implement
the old hook through the same dispatcher, but must retain its documented public
behavior.

All public functions and types are exported from `@crc/core`. Supported code
does not use deep imports.

## Sparse registrations and identity

An event-target registration contains only:

- its owning CRC instance and mounted component;
- its hook or built-in interaction slot;
- its current handler map;
- its current hit path and hit-test options, when geometric;
- its captured transform and clipping stack;
- its current paint-ledger position;
- optional cursor and keyboard metadata;
- the minimal pointer, hover, press, and focus state that refers to it.

Rerender updates a live registration in place. Replacing handlers does not
replace target identity. Keyed children retain target identity when reordered
within the same parent. Reparenting and remounting follow CRC's existing
identity contract and therefore create a new target.

Components with no event target, event listener, cursor, or optional event
policy create no event-specific registration.

## Target resolution

Coordinate-bearing events resolve one topmost live target through the existing
reverse global paint ledger. Hit tests use the same root-logical coordinates,
transforms, clipping stacks, layers, fill/stroke semantics, and interaction
widths used by current mouse interaction.

A painted object without an event registration does not automatically occlude a
registered target underneath it. This preserves CRC's explicit interaction
model: drawing alone does not opt into user interaction.

Pointer capture overrides coordinate hit testing for the captured pointer.
Touch contacts retain the target chosen at `touchstart`, matching the DOM Touch
Events target model. Keyboard, composition, editing, clipboard, and logical
focus events use the current logical focus target when the focus manager is
installed; otherwise only explicit Canvas-wide observers can receive them.

## Temporary propagation path

After resolving a target, CRC walks the existing mounted-component parent
references and collects only matching event-listener registrations. The path is
used for one dispatch:

```text
root listeners -> ancestor listeners -> target -> ancestor listeners -> root
                 capture              target    bubble
```

- Capture proceeds from the root toward the target.
- Target capture handlers run before target non-capture handlers.
- Bubble proceeds from the target's parent toward the root when the event type
  bubbles.
- Non-bubbling DOM events still participate in capture and target phases where
  the platform event does.
- `focus` and `blur` do not bubble; `focusin` and `focusout` do.
- `pointerenter`, `pointerleave`, `mouseenter`, and `mouseleave` do not bubble.
- `pointerover`, `pointerout`, `mouseover`, and `mouseout` do bubble.

Movement between targets compares the old and new ancestry paths. CRC emits
boundary events only for the portions actually exited or entered, so movement
between descendants does not falsely leave and re-enter their shared ancestor.

The propagation path is not saved after dispatch.

## Activation targeting

Down and up events independently resolve their logical targets. When the
browser supplies `click`, `auxclick`, or `dblclick`, CRC uses the live down/up
history and component ancestry to mirror DOM activation targeting as closely as
its explicit registrations permit:

- matching live down and up targets activate that target;
- differing targets activate their nearest common live logical ancestor when
  one exists in the propagation lineage;
- a removed target cannot receive later activation;
- double-click state belongs to the resulting live click target;
- native browser ordering and hysteresis remain authoritative.

Keyboard-generated logical click behavior belongs to the optional focus
manager, not the core event dispatcher.

## Event objects

CRC uses one lightweight event facade rather than subclassing native browser
events or constructing a family-specific retained object hierarchy. Every CRC
event provides familiar DOM-shaped fields and methods:

```ts
event.type;
event.target;
event.currentTarget;
event.relatedTarget;
event.eventPhase;
event.bubbles;
event.cancelable;
event.defaultPrevented;
event.timeStamp;
event.originalEvent;
event.sourceEvent;
event.composedPath();

event.preventDefault();
event.stopPropagation();
event.stopImmediatePropagation();
```

`target`, `currentTarget`, and `composedPath()` refer to opaque logical CRC
targets, not DOM nodes or component refs. They expose only target operations
that have a DOM analogue, initially pointer-capture operations. They do not
expose `focus()`.

Coordinate events also provide CRC root-logical `x` and `y`, preserving the
current public coordinate contract. Family facades expose the commonly used
native fields, such as pointer identity and pressure, mouse buttons and
modifiers, keyboard key/code/repeat/composition state, wheel deltas, touch
lists, input data, clipboard data, and drag `dataTransfer`.
`originalEvent` remains authoritative for browser-specific or uncommon native
fields. `sourceEvent` is normally absent; a higher-level policy may set it when
one logical event is synthesized from another input event, while preserving the
logical event family's `originalEvent` type.

`preventDefault()` updates the logical facade and forwards to the native event
when it is cancelable. `stopPropagation()` and
`stopImmediatePropagation()` stop the CRC path and forward to the native event
so later DOM bubbling beyond the Canvas is stopped when the browser still
permits it.

## Pointer capture

The logical `currentTarget` supports the DOM-shaped operations:

```ts
event.currentTarget.setPointerCapture(event.pointerId);
event.currentTarget.hasPointerCapture(event.pointerId);
event.currentTarget.releasePointerCapture(event.pointerId);
```

CRC calls native pointer capture on the root Canvas and records the logical
target for that pointer ID. Subsequent pointer events target that logical owner
until release, cancellation, unmount, or native capture loss. Capture is per
pointer, not global.

Unmount and root disposal clear logical and native capture exactly. An
unmounted target receives no ghost `lostpointercapture` callback.

## Native adapters and listener ownership

There is one dispatcher and a small adapter for each native event family:

```text
native Canvas event
    -> family adapter
    -> shared target resolver
    -> shared capture/target/bubble dispatcher
```

Adapters translate native coordinates and family data. They do not implement
their own hit-testing, propagation, cancellation, or component-lifetime rules.

The root HTML Canvas owns at most one native listener for each native event
type. A listener is installed when the first live target, propagation listener,
Canvas observer, or optional policy requests that type, and is removed when the
last requester releases it. Cancellable wheel and touch listeners are
registered so `preventDefault()` remains effective.

Native user-event collection requires an `HTMLCanvasElement` root. Offscreen
layers continue to share their root HTML Canvas's interaction system, but a CRC
mount whose root is itself an `OffscreenCanvas` has no DOM event source. A
future explicit event-injection API would require its own design; this delivery
does not pretend that an `OffscreenCanvas` can receive browser UI events.

Every listener, target, observer, pointer capture, hover reference, pressed
reference, cursor ownership, and adapter-owned document listener has one
explicit owner and one idempotent release path. Root disposal releases all of
them.

## Mutation, failure, and scheduling

The dispatcher snapshots live handlers immediately before each target and
phase, rather than once for an entire native-event sequence.

- A handler removed before its turn is skipped.
- A target or ancestor unmounted before its turn is skipped.
- A target added during dispatch does not join the current path.
- Handler replacement on a live registration is visible to later logical events
  in the same native sequence.
- An exception from one application handler is reported through CRC's existing
  asynchronous error-isolation mechanism and does not corrupt dispatcher state
  or suppress unrelated handlers.
- Event handlers may schedule ordinary CRC state updates; rendering remains
  coalesced through the existing animation-frame scheduler.

## Compatibility with shipped mouse behavior

Until this design is implemented, the current mouse contracts remain
authoritative. The new dispatcher preserves topmost targeting, transformed and
clipped geometry, layer-wide paint order, root-logical coordinates, exact
resource cleanup, and Canvas-wide `crcEvent` observers.

DOM alignment intentionally corrects two limitations of the shipped
mouse-only model:

- over/out events gain DOM capture and bubbling semantics;
- component ancestry can receive propagated events and common-ancestor
  activation.

These behavior changes require public contract cases and migration notes. They
must not be introduced silently under the old mouse contract.

## Delivery boundaries

This design can be implemented and verified independently of focus management.
The first delivery ends when all event families, explicit registration,
propagation, pointer capture, lifecycle ownership, and compatibility evidence
are complete.

The implementation does not add public controls. Documentation may use small
local components to demonstrate forwarding handlers and registering hit paths;
those examples remain application patterns, not CRC exports.

## Verification

Executable evidence must include:

- unit tests for adapter translation and the shared event facade;
- contract tests for capture, target, bubble, non-bubbling events, cancellation,
  immediate cancellation, related targets, and composed paths;
- transformed, clipped, layered, fill, stroke, and expanded-interaction-width
  target tests;
- pointer-capture tests for mouse, pen-shaped PointerEvents, touch-shaped
  PointerEvents, multiple pointer IDs, cancellation, unmount, and disposal;
- touch-contact target retention and multi-touch-list preservation;
- native pointer/mouse compatibility-sequence tests without duplicate
  synthesis;
- click/common-ancestor, double-click, context-menu, wheel, keyboard,
  composition, clipboard, and drag/drop tests;
- mutation and thrown-handler isolation tests;
- exact native-listener installation and teardown counters;
- public `@crc/core` type and runtime imports in Bundler and NodeNext consumers;
- packed-package and source/built browser tests;
- a representative public scenario used both manually and headlessly.

Semantic state, event order, targets, and coordinates are asserted before
screenshots. Visual evidence is used only where it proves interaction geometry
that semantic assertions cannot.

## Standards basis

- [WHATWG HTML activation behavior](https://html.spec.whatwg.org/multipage/interaction.html#activation-behavior-of-elements)
- [W3C Pointer Events Level 4](https://www.w3.org/TR/pointerevents4/)
- [W3C UI Events](https://www.w3.org/TR/uievents/)
- [W3C Touch Events](https://www.w3.org/TR/touch-events/)
- [W3C Input Events Level 2](https://www.w3.org/TR/input-events-2/)
- [W3C Clipboard API and Events](https://www.w3.org/TR/clipboard-apis/)
- [WHATWG HTML drag and drop](https://html.spec.whatwg.org/multipage/dnd.html)
