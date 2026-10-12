# Pibbl Focus and Keyboard Navigation Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** Agent instructions and unchecked-looking task syntax below are preserved as dated evidence, not active work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, tree-shakable logical focus manager with DOM-integrated Tab traversal, pointer focus, keyboard activation, focus render state, and nested directional navigation.

**Architecture:** The HTML Canvas remains the single native focus host. Element enhancers annotate existing Pibbl elements without changing identity; one optional root manager observes explicit event targets during successful renders, maintains source-order candidates and directional boundaries, and supplies default actions after shared event dispatch. The base event system communicates through a small optional policy interface and never imports focus implementation modules.

**Tech Stack:** TypeScript 5, DOM Focus and Keyboard APIs, Pibbl's DOM-aligned user-event foundation, Canvas 2D geometry, Vitest Browser Mode with Playwright Chromium, pnpm 11.21.0, esbuild tree-shaking verification.

**Spec:** `docs/superpowers/specs/2026-08-28-focus-and-keyboard-navigation-design.md`

## Global Constraints

- Complete and approve `docs/superpowers/plans/2026-08-28-dom-aligned-user-events-implementation.md` first.
- Use Node.js 24.15 or newer and pnpm 11.21.0.
- `withFocusManagement` and `withKeyboardNavigation` are element enhancers, not structural wrapper components.
- Enhancers must not change component identity, parentage, layout, measurement, source order, or painting.
- A Pibbl root has at most one focus-management boundary; directional boundaries require that manager.
- The HTML Canvas is the only DOM focus host; root `OffscreenCanvas` focus installation is an error.
- Tab order is source order. Geometry is used only for arrow navigation.
- Do not add numeric positive-`tabIndex` ordering, default wrapping, or inner-edge escape.
- Do not expose a leaf ref or imperative `focus()` method.
- Do not create semantic DOM descendants, ARIA mirrors, hidden editable controls, or a public widget library.
- Export every public API from `@pibbl/core`; focus implementation must disappear from optimized consumers that do not use either enhancer.
- Use public scenarios for manual/headless evidence and exact resource-ownership tests for DOM mutations/listeners.

## File Structure

New focus units:

- `packages/core/src/lib/element-enhancers.ts` — private lifecycle reconciliation for identity-transparent element annotations; not a public plugin API.
- `packages/core/src/lib/focus/types.ts` — focus candidate, boundary, modality, manager, and event-policy interfaces.
- `packages/core/src/lib/focus/with-focus-management.ts` — public root focus enhancer.
- `packages/core/src/lib/focus/with-keyboard-navigation.ts` — public directional-boundary enhancer.
- `packages/core/src/lib/focus/focus-manager.ts` — candidate collection, current target, focus snapshots, render commits, and teardown.
- `packages/core/src/lib/focus/dom-focus-host.ts` — Canvas `tabIndex`, focus/blur, document Tab-direction listener, and exact restoration.
- `packages/core/src/lib/focus/focus-events.ts` — logical focusout/blur/focusin/focus transitions.
- `packages/core/src/lib/focus/keyboard-defaults.ts` — Tab and Enter/Space default actions.
- `packages/core/src/lib/focus/directional-navigation.ts` — deterministic arrow candidate scoring and nested boundary ownership.
- `packages/core/src/lib/focus/geometry.ts` — local target rectangles transformed into root-logical axis-aligned bounds.

Integration points:

- `packages/core/src/lib/types.ts` adds erased/optional element-enhancer metadata and the event root's focus-policy bridge.
- `packages/core/src/lib/render.ts` reconciles and enters element enhancer scopes without importing focus modules.
- `packages/core/src/lib/execute-render.ts` preserves successful-render commit/failure cleanup semantics.
- `packages/core/src/lib/events/registrations.ts` reports target metadata and reads focus snapshots through the optional bridge.
- `packages/core/src/lib/events/dispatch.ts` asks the optional focus policy for non-coordinate targets and post-dispatch default actions.
- Built-in drawing components provide explicit navigation rectangles where geometry is knowable.
- `packages/core/src/index.ts` is the only public import surface.

---

### Task 1: Add Identity-Transparent Element Enhancer Lifecycle

**Files:**

- Create: `packages/core/src/lib/element-enhancers.ts`
- Create: `packages/core/src/lib/element-enhancers.test.ts`
- Create: `packages/core/src/lib/focus/with-focus-management.ts`
- Create: `packages/core/src/lib/focus/with-keyboard-navigation.ts`
- Create: `packages/core/src/lib/focus/types.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/render.ts`

**Interfaces:**

- Produces internal `PibblElementEnhancerDescriptor` and `PibblMountedElementEnhancer` lifecycle types.
- Produces public `withFocusManagement(element)` and `withKeyboardNavigation(element, { mode: 'directional' })` values, initially backed by test descriptors rather than a completed manager.
- Produces `CompEl.enhancers?` metadata and `CompRefs.mountedEnhancers` ownership.

- [ ] **Step 1: Write failing identity and lifecycle tests**

Assert that enhancing a keyed stateful component preserves its exact component
ID, state hook, parent ID, layout box, paint order, and measurement behavior
across rerender. Assert enhancer acquisition once, enter/exit every render,
release when metadata disappears, reverse release order, failure cleanup, and
idempotent root disposal.

```ts
const enhanced = withFocusManagement(
  withKeyboardNavigation(Child({ key: "stable" }), { mode: "directional" }),
);
expect(enhanced.type).toBe(Child({ key: "stable" }).type);
expect(enhanced.key).toBe("stable");
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because elements have no enhancer metadata or lifecycle.

- [ ] **Step 3: Implement the private enhancer lifecycle contract**

Use these internal interfaces:

```ts
export interface PibblElementEnhancerDescriptor {
  readonly key: symbol;
  mount(context: {
    readonly component: CompRefs<any>;
    readonly instance: PibblInstance;
  }): PibblMountedElementEnhancer;
}

export interface PibblMountedElementEnhancer {
  update(next: PibblElementEnhancerDescriptor): void;
  enter(): void;
  exit(success: boolean): void;
  dispose(): void;
}
```

`render` reconciles descriptors by key before invoking the component, enters in
declaration order, and exits in reverse order after descendants. Missing
descriptors dispose before the component renders. Component teardown disposes
every remaining mounted enhancer once. This file exports no public mechanism
for applications to define arbitrary plugins.

- [ ] **Step 4: Implement identity-transparent enhancer constructors**

Both public functions return a shallow element copy with appended enhancer
metadata. They preserve `type`, `props`, `style`, `key`, and `identityHint`.
Applying the same focus enhancer twice to one element throws a targeted error.
The directional options accept only `{ mode: 'directional' }`.

- [ ] **Step 5: Run identity, layout, and failure tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/layout --browser.headless --browser.ui=false
```

Expected: PASS with unchanged unenhanced behavior.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/element-enhancers.ts packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/focus packages/core/src/lib/types.ts packages/core/src/lib/render.ts
git commit -m "feat(focus): add identity-transparent element enhancers"
```

---

### Task 2: Build Focus Candidate Collection and Render Snapshots

**Files:**

- Create: `packages/core/src/lib/focus/focus-manager.ts`
- Create: `packages/core/src/lib/focus/geometry.ts`
- Create: `packages/core/src/lib/focus/focus-manager.test.ts`
- Modify: `packages/core/src/lib/focus/with-focus-management.ts`
- Modify: `packages/core/src/lib/focus/with-keyboard-navigation.ts`
- Modify: `packages/core/src/lib/events/types.ts`
- Modify: `packages/core/src/lib/events/registrations.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/components/path.ts`
- Modify: `packages/core/src/lib/components/rect.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: `packages/core/src/lib/components/img.ts`
- Modify: `packages/core/src/lib/components/line.ts`
- Modify: `packages/core/src/lib/components/horizontal-line.ts`
- Modify: `packages/core/src/lib/components/vertical-line.ts`

**Interfaces:**

- Consumes: event target records and enhancer scopes.
- Produces: `PibblFocusPolicyBridge.observeTarget`, `removeTarget`, `snapshot`, `resolveKeyboardTarget`, and `afterDispatch`.
- Produces: committed source-order `PibblFocusCandidate[]` and directional boundary membership.

- [ ] **Step 1: Write failing enrollment and identity tests**

Cover automatic candidates for `onClick`, `onKeyDown`, and `onKeyUp`; exclusion
for hover/move/wheel/cursor/drag-over/focus/capture-only handlers; explicit
`keyboardFocusable: true/false`; source order; keyed reorder; ordinary rerender;
reparenting; removal; failed-render rollback; and one-manager-per-root errors.

Assert `useEventTarget` snapshots are `{ isFocused: false,
isFocusVisible: false }` without a manager and reflect manager state after a
transition without exposing `focus()`.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/focus-manager.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because no focus manager observes target registrations.

- [ ] **Step 3: Implement committed candidate collection**

Use an active boundary stack during traversal and this candidate shape:

```ts
export interface PibblFocusCandidate {
  readonly target: PibblEventTargetRegistration;
  readonly sourceIndex: number;
  readonly directionalBoundary: PibblDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}
```

At focus-boundary entry, begin a pending candidate frame. Each explicit target
registration calls `observeTarget`. On successful boundary exit, atomically
replace the committed list; on failure, discard pending candidates and let Pibbl's
existing render-failure teardown run. If the focused target is absent from the
new committed list, clear focus without calling the dead target.

- [ ] **Step 4: Implement enrollment rules and snapshots**

Automatic eligibility checks normalized target handlers for `click`, `keydown`,
or `keyup`. An explicit boolean overrides that result. Listener registrations
and cursor-only targets never enroll. The event root stores the bridge as an
optional structural interface so importing the event system does not import
focus modules.

- [ ] **Step 5: Implement navigation-bound conversion**

Treat public `keyboardNavigationBounds` as local component coordinates captured
with the target's current transform. Transform all four rectangle corners into
root-logical space, including layer bridges, and store their axis-aligned
envelope. Built-ins supply explicit local rectangles where knowable:

- rect/image/text: rendered rectangle;
- line helpers: endpoint envelope expanded by interaction width;
- arbitrary Path2D/SVG path: only caller-supplied bounds;
- missing bounds: Tab candidate but not directional candidate.

- [ ] **Step 6: Run focus-manager, geometry, layer, and identity tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/focus-manager.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/focus packages/core/src/lib/events packages/core/src/lib/types.ts packages/core/src/lib/components
git commit -m "feat(focus): collect stable focus candidates"
```

---

### Task 3: Integrate the Canvas DOM Focus Host and Source-Order Tab

**Files:**

- Create: `packages/core/src/lib/focus/dom-focus-host.ts`
- Create: `packages/core/src/lib/focus/dom-focus-host.test.ts`
- Create: `packages/core/src/lib/focus/keyboard-defaults.ts`
- Create: `packages/core/src/lib/focus/tab-navigation.test.ts`
- Modify: `packages/core/src/lib/focus/focus-manager.ts`
- Modify: `packages/core/src/lib/focus/with-focus-management.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/global-state.ts`

**Interfaces:**

- Produces: `mountDOMFocusHost(manager, canvas, teardowns)`.
- Produces: `moveTab(manager, backwards): 'moved' | 'exit'`.
- Consumes: event dispatch's optional focus-policy target/default hooks.

- [ ] **Step 1: Write failing DOM entry/exit tests**

Mount a native button, Canvas, and another native button. Assert:

```text
forward:  native-before -> first Pibbl -> ... -> last Pibbl -> native-after
reverse:  native-after -> last Pibbl -> ... -> first Pibbl -> native-before
```

Cover programmatic Canvas focus with no known direction, Canvas focus with no
current target, no wrapping, dynamic zero candidates, pre-existing `tabindex`,
exact attribute restoration, one document listener, blur, enhancer removal,
dispose twice, and root OffscreenCanvas error.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/dom-focus-host.test.ts packages/core/src/lib/focus/tab-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because Canvas focusability and Tab defaults are absent.

- [ ] **Step 3: Implement exact Canvas focusability ownership**

Snapshot `hasAttribute('tabindex')` and `getAttribute('tabindex')`. While live
candidates exist, ensure the Canvas is a Tab stop. When the list becomes empty,
restore the pre-manager state so Pibbl does not leave a dead stop. Final teardown
restores the same snapshot idempotently.

- [ ] **Step 4: Track external Tab direction**

Install one capture `keydown` listener on `canvas.ownerDocument` while the
manager is mounted. Record only unprevented Tab and `shiftKey`. On Canvas focus,
choose first/last accordingly; unknown/programmatic entry chooses first. Remove
the document listener exactly on manager disposal.

- [ ] **Step 5: Route keyboard events to the current logical target**

The event dispatcher asks `focusPolicy.resolveKeyboardTarget()` before
dispatching keyboard, composition, editing, clipboard, and logical focus events.
After `keydown`, call the optional policy's `afterDispatch` only when the target
remains live.

- [ ] **Step 6: Implement Tab defaults**

If a next internal target exists, call `preventDefault()` and update logical
focus. At the first/last edge, do not prevent default; clear logical state on the
subsequent Canvas blur and let the browser continue native traversal. Tab ignores
directional-boundary membership.

- [ ] **Step 7: Run focus host, Tab, lifecycle, and listener-count tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/dom-focus-host.test.ts packages/core/src/lib/focus/tab-navigation.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/lib/focus packages/core/src/lib/events/dispatch.ts packages/core/src/lib/global-state.ts packages/core/test
git commit -m "feat(focus): traverse Canvas targets with Tab"
```

---

### Task 4: Dispatch Logical Focus Events and Press-to-Focus Defaults

**Files:**

- Create: `packages/core/src/lib/focus/focus-events.ts`
- Create: `packages/core/src/lib/focus/focus-events.test.ts`
- Create: `packages/core/src/lib/focus/press-focus.test.ts`
- Modify: `packages/core/src/lib/focus/focus-manager.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/events/adapters/pointer.ts`
- Modify: `packages/core/src/lib/events/adapters/mouse.ts`
- Modify: `packages/core/src/lib/events/adapters/touch.ts`

**Interfaces:**

- Produces: `transitionLogicalFocus(manager, next, modality)`.
- Consumes: `dispatchToLogicalTarget` from the event foundation.

- [ ] **Step 1: Write failing focus-event order tests**

Freeze this order for A -> B:

```ts
expect(trace).toEqual([
  "focusout:A->B",
  "blur:A->B",
  "focusin:B->A",
  "focus:B->A",
]);
```

Assert capture/bubble behavior, logical related targets, one scheduled render,
no callbacks to removed targets, blur clearing, and coalescing with state updates
from focus handlers.

- [ ] **Step 2: Write failing pointer/mouse/touch focus tests**

Cover pointerdown as authoritative; mousedown/touchstart fallback when no
matching pointer press exists; compatibility de-duplication; non-focusable
target and empty-background clearing; `preventDefault()` suppressing the focus
default; pointer capture not moving focus; and DOM blur always clearing.

- [ ] **Step 3: Run focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/focus-events.test.ts packages/core/src/lib/focus/press-focus.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because logical focus transitions and press defaults are absent.

- [ ] **Step 4: Implement focus transitions**

Dispatch previous-target events before mutating to the next public snapshot,
then dispatch next-target events. If the previous target is already dead, skip
its callbacks. Update modality and schedule `update(root.canvas)` once; the
existing frame scheduler coalesces redundant requests.

- [ ] **Step 5: Implement press defaults after event propagation**

Run the default only if the primary press remains unprevented. Set a pending
pointer target before calling `canvas.focus({ preventScroll: true })` so the
synchronous DOM focus event selects the intended logical target rather than the
first candidate. Track the represented native press to suppress following
compatibility mouse/touch focus transitions.

- [ ] **Step 6: Run event, focus, cursor, and lifecycle tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus packages/core/src/lib/events packages/core/src/lib/hooks/use-cursor.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/focus packages/core/src/lib/events
git commit -m "feat(focus): synchronize logical and pointer focus"
```

---

### Task 5: Add Enter and Space Click Activation

**Files:**

- Create: `packages/core/src/lib/focus/keyboard-activation.test.ts`
- Modify: `packages/core/src/lib/focus/keyboard-defaults.ts`
- Modify: `packages/core/src/lib/focus/focus-manager.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/events/event-facade.ts`
- Modify: `packages/core/src/lib/events/types.ts`

**Interfaces:**

- Produces: `applyKeyboardActivationDefault(manager, event)`.
- Produces: `PibblEvent.sourceEvent?: Event` for logical events synthesized from another input event.

- [ ] **Step 1: Write failing activation-order tests**

Cover Enter click on keydown, Space scroll prevention on keydown and click on
matching keyup, repeat suppression, target change, blur, cancellation, unmount,
handler removal, and `preventDefault()` from target or ancestor. Assert the
target's key handler runs before the click default and only one click occurs.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/keyboard-activation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because keyboard activation state is absent.

- [ ] **Step 3: Add synthetic-event provenance without breaking mouse types**

Add optional `sourceEvent` to the base Pibbl facade. For keyboard activation,
construct a cancelable synthetic `MouseEvent('click', { bubbles: true,
detail: 0 })`; expose it as `originalEvent` so `onClick` retains its mouse-event
contract, and expose the originating `KeyboardEvent` as `sourceEvent`. Native
clicks leave `sourceEvent` undefined.

- [ ] **Step 4: Implement Enter and Space defaults**

Enter activates once on non-repeating keydown. Space records the live focused
target on initial keydown, prevents scrolling, and activates only if the same
target remains focused/live on keyup. Any prevented key event suppresses its
default. Clear pending Space state on blur, focus movement, cancellation,
unmount, and disposal.

- [ ] **Step 5: Run keyboard, click, and mutation tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/keyboard-activation.test.ts packages/core/src/lib/events/mouse-dispatch.test.ts packages/core/src/lib/events/propagation.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/focus packages/core/src/lib/events
git commit -m "feat(focus): activate click targets from keyboard"
```

---

### Task 6: Implement Deterministic Directional Navigation

**Files:**

- Create: `packages/core/src/lib/focus/directional-navigation.ts`
- Create: `packages/core/src/lib/focus/directional-navigation.test.ts`
- Modify: `packages/core/src/lib/focus/with-keyboard-navigation.ts`
- Modify: `packages/core/src/lib/focus/focus-manager.ts`
- Modify: `packages/core/src/lib/focus/keyboard-defaults.ts`

**Interfaces:**

- Produces: `findDirectionalCandidate(current, candidates, direction)`.
- Produces: `PibblDirection = 'left' | 'right' | 'up' | 'down'`.
- Consumes: root-logical candidate bounds from Task 2.

- [ ] **Step 1: Write failing scoring tests**

Freeze regular-grid, uneven-card, list, toolbar, diagonal, overlapping-beam,
off-axis fallback, missing-bounds, transformed, and exact-tie cases. Assert the
ranking tuple:

```ts
type DirectionalScore = readonly [
  beamPenalty: 0 | 1,
  forwardEdgeDistance: number,
  perpendicularDistance: number,
  sourceIndex: number,
];
```

Candidates whose centers are not in the requested half-plane are excluded.
Perpendicular bounds overlap gives `beamPenalty = 0`; otherwise it is `1`.

- [ ] **Step 2: Run the scoring test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/directional-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because no directional algorithm exists.

- [ ] **Step 3: Implement pure scoring and deterministic selection**

Keep geometry math independent of DOM events and focus mutation. Normalize
negative/zero-sized rectangles, discard non-finite bounds, compute edge gaps
without rounding, and compare the score lexicographically.

- [ ] **Step 4: Connect unprevented arrow-key defaults**

After target/ancestor keydown dispatch, map ArrowLeft/Right/Up/Down to a
direction. Find the focused candidate's nearest boundary, score only candidates
owned directly by that boundary, transition focus to a winner, and prevent the
native default. No winner leaves focus and default-prevention state unchanged.

- [ ] **Step 5: Prove Tab remains source-order only**

Add a deliberately geometry-scrambled declaration and assert Tab follows
source order while arrows follow bounds. Add a row-major declaration and assert
its natural Tab order is left-to-right then top-to-bottom without a geometry
sort.

- [ ] **Step 6: Run directional and Tab tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/directional-navigation.test.ts packages/core/src/lib/focus/tab-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/focus
git commit -m "feat(focus): navigate targets by direction"
```

---

### Task 7: Enforce Nested Directional Boundaries and Key Precedence

**Files:**

- Create: `packages/core/src/lib/focus/nested-navigation.test.ts`
- Modify: `packages/core/src/lib/focus/with-keyboard-navigation.ts`
- Modify: `packages/core/src/lib/focus/focus-manager.ts`
- Modify: `packages/core/src/lib/focus/keyboard-defaults.ts`
- Modify: `packages/core/src/lib/focus/directional-navigation.ts`

**Interfaces:**

- Consumes: directional boundary membership from Tasks 2 and 6.
- Produces: nearest-boundary ownership with no inner-edge escape.

- [ ] **Step 1: Write failing nested and form-like key tests**

Create an outer directional collection containing an inner collection and a
form-like target whose `onKeyDown` prevents ArrowLeft/Right. Assert:

- the form-like target keeps its own arrow keys;
- an unprevented arrow uses only the nearest boundary;
- the inner boundary edge stays put and does not invoke the outer policy;
- nested descendants remain in the one global Tab sequence;
- removing/reordering either boundary refreshes membership without remounting
  the target.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/nested-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on nested ownership and edge containment.

- [ ] **Step 3: Commit nearest-boundary membership atomically**

Directional enhancer enter pushes a boundary token; exit pops it in `finally`.
Each observed candidate records only the top token. On successful render,
replace each boundary's direct candidate list. Inner candidates never appear in
the outer direct list.

- [ ] **Step 4: Enforce target-first policy order**

The common event dispatcher completes key propagation first. Focus activation
defaults run next. Directional defaults run last only when
`defaultPrevented === false`. A failed inner lookup ends processing without
consulting any outer boundary.

- [ ] **Step 5: Run nested, mutation, failure, and identity tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/nested-navigation.test.ts packages/core/src/lib/focus/focus-manager.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/focus
git commit -m "feat(focus): contain nested directional navigation"
```

---

### Task 8: Export the Optional API and Prove Bundle Elimination

**Files:**

- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `playground/src/pibbl-editor-types.txt`
- Create: `packages/core/src/lib/focus/public-api.test.ts`

**Interfaces:**

- Produces root exports `withFocusManagement`, `withKeyboardNavigation`, and
  `PibblKeyboardNavigationOptions`; the event plan already exports the target
  snapshot and navigation-bounds types these APIs consume.
- Produces packed-consumer no-focus and with-focus optimized bundle assertions.

- [ ] **Step 1: Write failing public import tests**

Import both enhancers and all public focus option types from `@pibbl/core` in
strict Bundler and NodeNext consumers. Add a runtime smoke call that enhances an
element and verifies its type/key/style are unchanged.

- [ ] **Step 2: Add failing tree-shaking assertions**

Give the focus module one stable implementation marker used by a real error
message, for example `PIBBL_FOCUS_MANAGEMENT_V1`. In the packed verifier, use the
repository's esbuild API to produce two optimized consumer bundles:

```ts
// no-focus entry
import { rect } from "@pibbl/core";
console.log(rect({ style: { width: 1, height: 1 } }));

// focus entry
import { rect, withFocusManagement } from "@pibbl/core";
console.log(withFocusManagement(rect({ style: { width: 1, height: 1 } })));
```

Assert the marker is absent from the no-focus output and present in the focus
output.

- [ ] **Step 3: Run package checks and verify failure**

```bash
corepack pnpm@11.21.0 test:package-consumer:packed
```

Expected: FAIL on missing exports or missing bundle proof.

- [ ] **Step 4: Export root APIs without a base-runtime import edge**

Re-export the enhancer modules from `packages/core/src/index.ts`. Verify
`render.ts`, event registration, built-ins, and `pibbl.ts` contain no runtime
import from `lib/focus/*`; they may use erased type imports and optional
structural callbacks only.

- [ ] **Step 5: Implement packed bundle verification**

Bundle both generated entries with `bundle: true`, `format: 'esm'`,
`minify: true`, `treeShaking: true`, and `platform: 'browser'`. Read the emitted
text and apply the marker assertions before deleting the temporary consumer.

- [ ] **Step 6: Run type, package, Studio declaration, and public API tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/public-api.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 playground:build
```

Expected: PASS with focus code absent from the optimized no-focus consumer.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src playground/package-consumer playground/src/pibbl-editor-types.txt tooling/verify-packed-consumer.mjs
git commit -m "feat(core): export tree-shakable focus management"
```

---

### Task 9: Add the Public Focus Demonstration and Accessibility Guidance

**Files:**

- Create: `packages/scenarios/src/focus-navigation.example.ts`
- Create: `packages/scenarios/src/focus-navigation.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Create: `packages/core/test/focus-navigation.test.ts`
- Create: `packages/core/test/support/user-input.ts`
- Modify: `packages/core/test/scenario-catalog.test.ts`
- Create: `docs/design/focus-and-keyboard-navigation-contract.md`
- Create: `docs/design/canvas-accessibility-guidance.md`

**Interfaces:**

- Consumes: public `@pibbl/core` imports only.
- Produces: one documentation-candidate scenario driven by the same headless test.

- [ ] **Step 1: Write failing catalog and behavior tests**

Expect a `focus-and-keyboard-navigation` catalog entry with native controls
before/after the Canvas, two local top controls, twelve row-major directional
squares, and two local bottom controls. Freeze state fields for current target,
last activation source, activation count, and focus-visible modality.

- [ ] **Step 2: Add real input helpers**

In `user-input.ts`, use Playwright/CDP for mouse and touch-shaped pointer input
and `vitest/browser` keyboard APIs for Tab, Shift+Tab, arrows, Enter, and Space.
Helpers accept root-logical target points and reuse current surface coordinate
conversion; they do not call internal focus-manager functions.

- [ ] **Step 3: Run the scenario test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/focus-navigation.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the shared scenario is absent.

- [ ] **Step 4: Implement the readable public example**

Keep control-like helpers private to the example. They explicitly register
their own rectangular path with `useEventTarget`, use the returned `isFocused`
and `isFocusVisible` snapshots for high-contrast non-color-only visuals, and
paint their own rect/text children. Do not export a button component or hoist
child geometry.

Mount ordinary DOM buttons immediately before and after the Canvas and remove
them during scenario disposal. Wrap the scene once with focus management and
only the twelve-square subtree with directional navigation.

- [ ] **Step 5: Drive the complete public behavior**

Assert forward/reverse DOM entry and exit, every source-order Tab stop,
row-major Tab order, square-only arrows, no wrapping, nested-edge containment,
pointer/pen/touch focus, click/Enter/Space activation, empty-background clearing,
blur, keyed reorder, target removal, and focus-visible rendering.

- [ ] **Step 6: Write implemented contract and candid accessibility guidance**

Document the DOM/Pibbl focus split, event order, enrollment, Tab, directional
scoring, nested boundaries, activation, visual snapshots, bundle optionality,
and lifecycle. State plainly that internal focus is not screen-reader semantics.
Explain application-owned Canvas fallback DOM, state synchronization, names,
roles, keyboard-path duplication risks, and equivalent operations without
prescribing a framework.

- [ ] **Step 7: Run scenario, catalog, source/built smoke, and visual safeguard**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/focus-navigation.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:smoke
corepack pnpm@11.21.0 test:smoke:built
corepack pnpm@11.21.0 test:visual-safeguard
```

Expected: PASS. Add or update a visual baseline only if the scenario is included
in the repository's approved visual matrix and the semantic assertions already
pass.

- [ ] **Step 8: Commit**

```bash
git add packages/scenarios/src packages/core/test docs/design
git commit -m "docs(focus): add keyboard navigation demonstration"
```

---

### Task 10: Prove Final Lifecycle, Packaging, and Trust Gates

**Files:**

- Modify: `packages/core/test/lifecycle-ownership.test.ts`
- Modify: `packages/core/test/runtime-cleanup-stress.test.ts`
- Modify: `packages/core/test/event-performance.test.ts`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `docs/testing/` field note selected for this delivery

**Interfaces:**

- Consumes: completed event and focus implementations.
- Produces: final release evidence with no focus leaks and measured no-focus bundle elimination.

- [ ] **Step 1: Add failing ownership stress assertions**

Exercise 1,000 rerenders, handler replacement/removal, candidate reorder/removal,
directional boundary removal/re-addition, Canvas focus/blur, pending Space,
pointer capture, abort, disposal twice, and remount. Assert stable target,
listener, document-listener, enhancer, focus-manager, frame, and `tabIndex`
ownership counters.

- [ ] **Step 2: Run lifecycle/performance tests and verify failures**

```bash
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

Expected: FAIL until all diagnostics cover focus resources and final counts.

- [ ] **Step 3: Complete structural diagnostics**

Add test-only counters for focus manager, document listeners, current target,
candidate count, directional boundary count, pending activation, and original
Canvas `tabIndex`. Keep diagnostics unreachable from package build entries.

- [ ] **Step 4: Run focused static, package, browser, and lifecycle gates**

```bash
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:ci
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

Expected: PASS on Node 24.15+ and Playwright Chromium, including the packed
no-focus marker absence.

- [ ] **Step 5: Run the aggregate trust gate**

```bash
corepack pnpm@11.21.0 trust
```

Expected: PASS. Record the exact command, Node/pnpm/Chromium environment, fresh
test totals, duration, packed bundle evidence, and any intentionally inspected
visual diff in the field note.

- [ ] **Step 6: Commit final evidence**

```bash
git add packages/core/test tooling/verify-packed-consumer.mjs docs/testing
git commit -m "test(focus): prove focus and navigation delivery"
```
