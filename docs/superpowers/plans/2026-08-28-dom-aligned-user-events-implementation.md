# CRC DOM-Aligned User Events Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** Agent instructions and unchecked-looking task syntax below are preserved as dated evidence, not active work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CRC's eager mouse-only interaction path with one lazy, DOM-aligned user-event dispatcher supporting explicit targets, propagation, pointer capture, and the pertinent browser user-event families.

**Architecture:** Keep CRC immediate-mode: render-time hooks update sparse event target/listener registrations, coordinate events resolve one target through the existing global paint ledger, and dispatch derives a temporary component-ancestry path. Small native-family adapters feed one facade and propagation engine; the root HTML Canvas owns lazy listeners, while legacy `crcEvent` behavior remains compatible.

**Tech Stack:** TypeScript 5, Canvas 2D, DOM Pointer/Mouse/Touch/UI/Input/Clipboard/Drag APIs, Vitest Browser Mode with Playwright Chromium, pnpm 11.21.0, esbuild package verification.

**Spec:** `docs/superpowers/specs/2026-08-28-dom-aligned-user-events-design.md`

## Global Constraints

- Use Node.js 24.15 or newer and pnpm 11.21.0.
- Preserve immediate rendering, source paint order, component identity, transformed/clipped hit geometry, layer-wide target order, and scheduled updates.
- Do not infer event geometry from arbitrary drawing commands or returned descendants.
- Do not create a retained DOM, scene graph, accessibility tree, or widget library.
- Every event resource has one explicit owner and idempotent release path.
- Native event collection requires an `HTMLCanvasElement`; root `OffscreenCanvas` mounts remain without a DOM event source.
- Keep the existing singular `crcEvent` public behavior compatible.
- Export all supported runtime functions and types from `@crc/core`; do not add deep-import requirements.
- Add a failing observable contract test before each production change.
- Do not update visual baselines unless inspected semantic evidence proves an intentional pixel change.

## File Structure

New event units:

- `packages/core/src/lib/events/event-definitions.ts` — one authoritative event-name, prop-name, family, bubbling, cancellation, and coordinate metadata table.
- `packages/core/src/lib/events/types.ts` — public event facades, handler maps, target options/snapshots, and internal registration types.
- `packages/core/src/lib/events/native-listener-hub.ts` — reference-counted native Canvas listener acquisition and exact teardown.
- `packages/core/src/lib/events/event-facade.ts` — one logical event facade and family field projection.
- `packages/core/src/lib/events/event-path.ts` — temporary ancestry path construction across components and layers.
- `packages/core/src/lib/events/propagation.ts` — capture, target, bubble, mutation, cancellation, and error isolation.
- `packages/core/src/lib/events/hit-test.ts` — reverse-paint-order target resolution extracted from the current dispatcher.
- `packages/core/src/lib/events/boundary-transitions.ts` — over/out and enter/leave path-difference planning.
- `packages/core/src/lib/events/pointer-capture.ts` — native Canvas capture plus logical pointer-owner mapping.
- `packages/core/src/lib/events/dispatch.ts` — shared native-to-logical orchestration and activation history.
- `packages/core/src/lib/events/adapters/*.ts` — small pointer, mouse, touch, wheel, keyboard/focus, editing/composition, clipboard, and drag adapters.
- `packages/core/src/lib/hooks/crc-event-target.ts` — grouped explicit geometric target hook.
- `packages/core/src/lib/hooks/crc-event-listener.ts` — explicit non-geometric propagation listener hook.

Existing integration points:

- `packages/core/src/lib/types.ts` keeps general runtime types and imports/re-exports event types.
- `packages/core/src/lib/mount-crc.ts` creates the event root and no longer eagerly installs eight mouse listeners.
- `packages/core/src/lib/global-state.ts` clears the new root-owned event resources.
- `packages/core/src/lib/hooks/crc-region.ts` becomes the built-in compatibility adapter over grouped targets.
- `packages/core/src/lib/hooks/crc-event.ts` preserves singular observer/path behavior through the new event root.
- `packages/core/src/lib/util/wire-common-events.ts` becomes the built-in DOM-style prop-to-target bridge.
- `packages/core/src/lib/components/layer.ts` records the parent-component bridge needed for cross-layer propagation.
- `packages/core/src/index.ts` exports the public event APIs and types.

---

### Task 1: Freeze the Event Vocabulary and Public Type Model

**Files:**

- Create: `packages/core/src/lib/events/event-definitions.ts`
- Create: `packages/core/src/lib/events/types.ts`
- Create: `packages/core/src/lib/events/event-definitions.test.ts`
- Modify: `packages/core/src/lib/types.ts`

**Interfaces:**

- Produces: `CRCEventType`, `CRCEventMap`, `CRCEventHandlers`, `CRCEventHandler<K>`, `CRCEvent`, `CRCPointerEvent`, `CRCMouseEvent`, `CRCTouchEvent`, `CRCWheelEvent`, `CRCKeyboardEvent`, `CRCFocusEvent`, `CRCInputEvent`, `CRCCompositionEvent`, `CRCClipboardEvent`, `CRCDragEvent`, `CRCEventTarget`, `CRCEventTargetOptions`, and `CRCEventTargetSnapshot`.
- Produces: `CRC_EVENT_DEFINITIONS`, `CRC_EVENT_TYPES`, and `getCRCEventDefinition(type)` for all later tasks.

- [ ] **Step 1: Write the failing vocabulary and type tests**

Create a table-driven test that freezes this exact ordered event list:

```ts
const EXPECTED_TYPES = [
  "pointerover",
  "pointerenter",
  "pointerdown",
  "pointermove",
  "pointerrawupdate",
  "pointerup",
  "pointercancel",
  "pointerout",
  "pointerleave",
  "gotpointercapture",
  "lostpointercapture",
  "click",
  "dblclick",
  "auxclick",
  "contextmenu",
  "mouseover",
  "mouseenter",
  "mousedown",
  "mousemove",
  "mouseup",
  "mouseout",
  "mouseleave",
  "touchstart",
  "touchmove",
  "touchend",
  "touchcancel",
  "wheel",
  "keydown",
  "keyup",
  "focus",
  "blur",
  "focusin",
  "focusout",
  "beforeinput",
  "input",
  "change",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "select",
  "selectionchange",
  "copy",
  "cut",
  "paste",
  "dragstart",
  "drag",
  "dragend",
  "dragenter",
  "dragleave",
  "dragover",
  "drop",
] as const;

expect(CRC_EVENT_TYPES).toEqual(EXPECTED_TYPES);
expect(getCRCEventDefinition("pointerenter")).toMatchObject({ bubbles: false });
expect(getCRCEventDefinition("focusin")).toMatchObject({ bubbles: true });
expect(getCRCEventDefinition("keypress" as never)).toBeUndefined();
```

Add compile-time assignments proving `onPointerDownCapture` receives a
`CRCPointerEvent`, `onBeforeInput` receives a `CRCInputEvent`, and `keypress`
is not a key of `CRCEventMap`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/event-definitions.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the event modules do not exist.

- [ ] **Step 3: Implement the authoritative definition table**

Define each entry with this exact shape:

```ts
export interface CRCEventDefinition {
  readonly type: CRCEventType;
  readonly prop: CRCEventPropName;
  readonly captureProp: CRCEventCapturePropName;
  readonly family:
    | "pointer"
    | "mouse"
    | "touch"
    | "wheel"
    | "keyboard"
    | "focus"
    | "input"
    | "composition"
    | "clipboard"
    | "drag";
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly coordinate: boolean;
}
```

Use exact DOM-style spellings, including `onDblClick`,
`onGotPointerCapture`, `onBeforeInput`, `onCompositionStart`, and
`onSelectionChange`. Mark `pointerenter`, `pointerleave`, `mouseenter`,
`mouseleave`, `focus`, and `blur` non-bubbling; derive every other bubbling
flag from the corresponding platform contract.

- [ ] **Step 4: Implement the facade and handler type declarations**

Use a generic base rather than copying native event objects:

```ts
export interface CRCEvent<TOriginal extends Event = Event> {
  readonly type: string;
  readonly target: CRCEventTarget;
  readonly currentTarget: CRCEventTarget;
  readonly relatedTarget: CRCEventTarget | null;
  readonly eventPhase: 1 | 2 | 3;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly defaultPrevented: boolean;
  readonly timeStamp: number;
  readonly originalEvent: TOriginal;
  composedPath(): readonly CRCEventTarget[];
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

export interface CRCEventTarget {
  setPointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
}

export interface CRCEventTargetSnapshot {
  readonly isFocused: boolean;
  readonly isFocusVisible: boolean;
}

export interface CRCEventTargetOptions {
  readonly path: Path2D;
  readonly fill?: boolean;
  readonly lineInteractionWidth?: number;
  readonly cursor?: string;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}
```

Family interfaces expose the common native fields required by the spec while
retaining `originalEvent` for everything else. Preserve the existing public
`CRCMouseEvent` name and its root-logical `x`/`y` fields.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/event-definitions.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/events packages/core/src/lib/types.ts
git commit -m "feat(events): define DOM-aligned event vocabulary"
```

---

### Task 2: Add Lazy Native Listener Ownership

**Files:**

- Create: `packages/core/src/lib/events/native-listener-hub.ts`
- Create: `packages/core/src/lib/events/native-listener-hub.test.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/mount-crc.ts`
- Modify: `packages/core/src/lib/global-state.ts`
- Modify: `packages/core/test/support/runtime-diagnostics.ts`
- Modify: `packages/core/test/lifecycle-ownership.test.ts`

**Interfaces:**

- Consumes: `CRCEventType` and `CRCEventDefinition` from Task 1.
- Produces: `createNativeListenerHub(canvas, dispatch, teardowns)`, returning `acquire(type): () => void`, `count(type): number`, and `dispose(): void`.
- Produces: `CRCInstance.eventRoot.nativeListeners` for later registration tasks.

- [ ] **Step 1: Write failing reference-count and mount tests**

Assert:

```ts
expect(diagnostics.snapshot().nativeListeners).toBe(0);
const releaseA = hub.acquire("pointerdown");
const releaseB = hub.acquire("pointerdown");
expect(diagnostics.snapshot().nativeListeners).toBe(1);
releaseA();
expect(diagnostics.snapshot().nativeListeners).toBe(1);
releaseB();
expect(diagnostics.snapshot().nativeListeners).toBe(0);
releaseB();
expect(diagnostics.ledgerSnapshot().nativeListeners.duplicateReleases).toBe(0);
```

Change the empty-runtime lifecycle expectation from eight eager mouse listeners
to zero.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/native-listener-hub.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `mountCRC` still installs all mouse listeners eagerly.

- [ ] **Step 3: Implement the listener hub**

Use one record per native type:

```ts
interface NativeListenerRecord {
  count: number;
  listener: EventListener;
  options: AddEventListenerOptions | boolean;
}

export interface NativeListenerHub {
  acquire(type: CRCEventType): () => void;
  count(type: CRCEventType): number;
  dispose(): void;
}
```

On transition `0 -> 1`, call `canvas.addEventListener`. On `1 -> 0`, call
`removeEventListener` with the same listener and capture value. Use
`{ passive: false }` for cancellable touch and wheel events. Every returned
release closure is idempotent.

- [ ] **Step 4: Replace eager mount listeners with the event root**

Initialize one root-owned structure:

```ts
interface CRCEventRoot {
  readonly canvas: HTMLCanvasElement | undefined;
  readonly nativeListeners: NativeListenerHub | undefined;
  readonly targets: Set<CRCEventTargetRegistration>;
  readonly listenersByComponent: Map<string, Set<CRCEventListenerRegistration>>;
  readonly observers: Map<CRCEventType, Set<CRCNativeObserver>>;
  readonly pointerCaptures: Map<number, CRCEventNode>;
}
```

Layers reference their parent root's `eventRoot`. A root `OffscreenCanvas`
creates an event root without `canvas` or native listeners. Disposal clears the
sets/maps after running owned teardowns.

- [ ] **Step 5: Update diagnostics and run lifecycle tests**

Make diagnostics derive handler counts from `eventRoot` and
`CRC_EVENT_TYPES`, then run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/native-listener-hub.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts --browser.headless --browser.ui=false
```

Expected: PASS with zero listeners for an empty scene and exact release after
the last subscriber.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/events/native-listener-hub.ts packages/core/src/lib/events/native-listener-hub.test.ts packages/core/src/lib/types.ts packages/core/src/lib/mount-crc.ts packages/core/src/lib/global-state.ts packages/core/test/support/runtime-diagnostics.ts packages/core/test/lifecycle-ownership.test.ts
git commit -m "refactor(events): install native listeners lazily"
```

---

### Task 3: Implement Explicit Target and Propagation-Listener Registrations

**Files:**

- Create: `packages/core/src/lib/events/registrations.ts`
- Create: `packages/core/src/lib/hooks/crc-event-target.ts`
- Create: `packages/core/src/lib/hooks/crc-event-listener.ts`
- Create: `packages/core/src/lib/hooks/crc-event-target.test.ts`
- Modify: `packages/core/src/lib/hooks/crc-region.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/lib/types.ts`

**Interfaces:**

- Consumes: Task 1 handler/target types and Task 2 listener hub.
- Produces: `crcEventTarget(handlers, options): CRCEventTargetSnapshot`.
- Produces: `crcEventListener(handlers): void`.
- Produces internal `createTarget`, `updateTarget`, `releaseTarget`, `createListener`, `updateListener`, and `releaseListener` functions.

- [ ] **Step 1: Write failing ownership tests**

Cover one stable hook slot, handler replacement without identity replacement,
removing the last handler/cursor, hook-order failures, and no descendant
geometry inference:

```ts
const Composite = defineComp<{ onClick: CRCEventHandlers["onClick"] }>(
  ({ onClick }) => {
    crcEventListener({ onClick });
    return rect({ style: { width: 40, height: 40, fill: "#000" } });
  },
);

// Clicking the returned rect must not target Composite because no target path
// was registered and the rect itself has no handler.
expect(calls).toEqual([]);
```

Add a grouped target case with four handlers and assert one target record and
one component teardown.

- [ ] **Step 2: Run the test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/crc-event-target.test.ts packages/core/src/lib/hooks/hook-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the hooks and grouped registration do not exist.

- [ ] **Step 3: Implement target registrations**

Use this internal record:

```ts
export interface CRCEventTargetRegistration {
  readonly kind: "target";
  readonly owner: CRCInstance;
  readonly component: CompRefs<any>;
  readonly slot: number;
  readonly publicTarget: CRCEventTarget;
  handlers: CRCNormalizedHandlers;
  path: Path2D;
  fill: boolean;
  lineInteractionWidth: number;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
  cursor: string | undefined;
  keyboardFocusable: boolean | undefined;
  keyboardNavigationBounds: Readonly<LayoutBox> | undefined;
  live: boolean;
}
```

`updateTarget` refreshes the record in place, captures the current transform and
clip stack, moves it to the current end of the paint ledger, and diffs event
types to acquire/release native listeners. The snapshot consults only the
optional `eventRoot.focusPolicy` interface; absent policy returns both flags
`false` without importing a focus module.

- [ ] **Step 4: Implement propagation listeners**

Register listeners under `component.id`. They own no path, never enter the
paint ledger, and acquire native types only for their live handlers. Capture and
non-capture callbacks for the same event remain in one registration so one hook
slot has one teardown.

- [ ] **Step 5: Adapt `crcRegion` to grouped target ownership**

Keep `crcRegion` internal and preserve its current call sites. It should update
one `CRCEventTargetRegistration` and retain cursor-only regions. Keep temporary
type aliases where needed so existing mouse tests compile before the dispatcher
migration.

- [ ] **Step 6: Run hook and lifecycle checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/crc-event-target.test.ts packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/lib/hooks/crc-cursor.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/events/registrations.ts packages/core/src/lib/hooks/crc-event-target.ts packages/core/src/lib/hooks/crc-event-listener.ts packages/core/src/lib/hooks/crc-event-target.test.ts packages/core/src/lib/hooks/crc-region.ts packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/lib/types.ts
git commit -m "feat(events): add explicit target and listener hooks"
```

---

### Task 4: Build the Event Facade and Capture/Target/Bubble Dispatcher

**Files:**

- Create: `packages/core/src/lib/events/event-facade.ts`
- Create: `packages/core/src/lib/events/event-path.ts`
- Create: `packages/core/src/lib/events/propagation.ts`
- Create: `packages/core/src/lib/events/propagation.test.ts`
- Modify: `packages/core/src/lib/events/types.ts`

**Interfaces:**

- Consumes: target/listener registrations from Task 3.
- Produces: `buildEventPath(target): CRCEventNode[]`.
- Produces: `createCRCEvent(input): CRCEvent`.
- Produces: `dispatchEventPath(input): CRCEvent`.

- [ ] **Step 1: Write failing propagation tests**

Construct `root -> parent -> target` registrations and freeze these traces:

```ts
expect(trace).toEqual([
  "root-capture:1",
  "parent-capture:1",
  "target-capture:2",
  "target:2",
  "parent:3",
  "root:3",
]);
```

Add cases for non-bubbling `focus`, `stopPropagation`,
`stopImmediatePropagation`, `preventDefault`, `composedPath`, related targets,
handler replacement before a later phase, listener removal before its turn,
target removal, and a throwing handler followed by a safe handler.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/propagation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because path and facade modules do not exist.

- [ ] **Step 3: Implement path construction**

Walk `target.component.parent` to the root, collecting the live listener sets
from each component ID. Preserve listener registration order within a component.
Return immutable path snapshots for public `composedPath()` while rechecking
liveness immediately before each phase.

- [ ] **Step 4: Implement one mutable facade per logical dispatch**

The facade keeps internal propagation flags while exposing read-only getters.
`cancelable` is true only when both the logical event definition and
`originalEvent.cancelable` allow cancellation. `preventDefault` forwards only
under that same conjunction; a non-cancelable synthesized boundary event must
not cancel its cancelable movement source.
`stopPropagation` and `stopImmediatePropagation` update logical flags and call
the corresponding native method. Project root-logical coordinates and the
common family fields from `originalEvent`; do not use a Proxy or subclass native
events.

- [ ] **Step 5: Implement capture, target, and bubble**

Before invoking each registration/phase, fetch its current handler from the
live map. Report exceptions with `globalThis.reportError` and continue unless
logical propagation was stopped. Target capture precedes target non-capture.
Skip bubble for non-bubbling definitions.

- [ ] **Step 6: Run propagation and mutation tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/propagation.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

Expected: new propagation tests PASS and existing mouse tests remain PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/events/event-facade.ts packages/core/src/lib/events/event-path.ts packages/core/src/lib/events/propagation.ts packages/core/src/lib/events/propagation.test.ts packages/core/src/lib/events/types.ts
git commit -m "feat(events): dispatch capture target and bubble phases"
```

---

### Task 5: Migrate Hit Testing, Mouse Boundaries, and Activation

**Files:**

- Create: `packages/core/src/lib/events/hit-test.ts`
- Create: `packages/core/src/lib/events/boundary-transitions.ts`
- Create: `packages/core/src/lib/events/dispatch.ts`
- Create: `packages/core/src/lib/events/adapters/mouse.ts`
- Create: `packages/core/src/lib/events/mouse-dispatch.test.ts`
- Modify: `packages/core/src/lib/interaction-dispatch.ts`
- Modify: `packages/core/src/lib/mount-crc.ts`
- Modify: `packages/core/src/lib/hooks/crc-region.ts`
- Modify: `packages/core/test/interaction-dispatch.test.ts`
- Modify: `packages/core/test/mouse-contract.test.ts`

**Interfaces:**

- Consumes: Task 4 propagation engine.
- Produces: `resolveCoordinateTarget(eventRoot, point): CRCEventTargetRegistration | undefined`.
- Produces: `dispatchNativeEvent(root, type, nativeEvent): void`.
- Preserves: cursor refresh/removal functions currently imported from `interaction-dispatch.ts`.

- [ ] **Step 1: Write failing DOM-aligned mouse contract cases**

Add nested listener cases that prove `mouseover`/`mouseout` bubble while
`mouseenter`/`mouseleave` do not, movement between siblings leaves only the old
branch and enters only the new branch, and down on one child/up on another
targets the nearest common registered ancestor for click.

- [ ] **Step 2: Run mouse contract tests and verify the new cases fail**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/mouse-dispatch.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/mouse-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on propagation, boundary, and common-ancestor activation cases.

- [ ] **Step 3: Extract the existing recursive paint-ledger resolver**

Move transform composition, clipping-stack composition, layer recursion, fill
and stroke hit testing, and reverse paint order into `events/hit-test.ts`
without changing results. Return the target plus root-logical coordinates.
Keep cursor helpers callable through `interaction-dispatch.ts` until all imports
are migrated.

- [ ] **Step 4: Implement ancestry-difference boundary plans**

Given old and new logical paths, compute their longest common prefix and emit:

```text
old leaf -> old exclusive ancestors: out (bubbling), leave (non-bubbling)
new exclusive ancestors -> new leaf: over (bubbling), enter (non-bubbling)
primary movement at the new target
```

Use logical related targets and skip records that become dead before their
planned event.

- [ ] **Step 5: Implement mouse dispatch and activation history**

Record primary down/up paths, derive the nearest common live logical ancestor
for browser-supplied click, and keep double-click streak state on the resulting
click target. Preserve browser ordering and current click re-entry hysteresis.
Clear activation state on target removal and root disposal.

- [ ] **Step 6: Route lazy mouse listeners through the shared dispatcher**

Have the listener hub call `dispatchNativeEvent`. Remove the eager
mouse-specific switch from `interaction-dispatch.ts`; leave compatibility
re-exports for cursor and region-removal call sites until Task 8.

- [ ] **Step 7: Run mouse, geometry, layer, and cursor suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/mouse-dispatch.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/mouse-contract.test.ts packages/core/test/geometry-composition.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/hooks/crc-cursor.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/lib/events packages/core/src/lib/interaction-dispatch.ts packages/core/src/lib/mount-crc.ts packages/core/src/lib/hooks/crc-region.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/mouse-contract.test.ts
git commit -m "feat(events): route mouse input through logical propagation"
```

---

### Task 6: Add Pointer Events, Pointer Capture, and Wheel

**Files:**

- Create: `packages/core/src/lib/events/pointer-capture.ts`
- Create: `packages/core/src/lib/events/adapters/pointer.ts`
- Create: `packages/core/src/lib/events/adapters/wheel.ts`
- Create: `packages/core/src/lib/events/pointer-events.test.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/events/event-facade.ts`
- Modify: `packages/core/src/lib/events/registrations.ts`

**Interfaces:**

- Produces: `setLogicalPointerCapture`, `hasLogicalPointerCapture`, `releaseLogicalPointerCapture`, and `clearPointerCapturesForTarget`.
- Consumes: the `CRCEventTarget` methods defined in Task 1.

- [ ] **Step 1: Write failing pointer/capture tests**

Cover mouse-, pen-, and touch-shaped PointerEvents, two simultaneous pointer
IDs, captured movement outside geometry, release, `pointercancel`, native
`lostpointercapture`, unmount, and disposal. Assert one logical focus-independent
target and no duplicate compatibility synthesis. Add a wheel case that proves
root-logical coordinates, deltas, bubbling, and effective `preventDefault()`.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/pointer-events.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because pointer adapters and logical capture do not exist.

- [ ] **Step 3: Implement logical capture over native Canvas capture**

Map `pointerId -> live CRC event node`. Call native
`canvas.setPointerCapture(pointerId)` and `releasePointerCapture(pointerId)`;
route later pointer events to the logical owner before geometric hit testing.
Release one pointer without disturbing others. Target teardown clears its
entries before any later callback can run. When capture moves between two CRC
owners on the same Canvas, retain distinct active and pending logical owners
and process exactly one old-owner loss followed by one new-owner gain before
the next non-capture pointer event; the shared native Canvas capture itself
does not transfer between DOM elements.

- [ ] **Step 4: Implement pointer boundary and primary dispatch**

Reuse Task 5 path-difference planning for pointer over/out/enter/leave. Dispatch
`pointerrawupdate` only when received natively. Preserve pointer ID, type,
primary status, pressure, tangential pressure, tilt, twist, contact dimensions,
buttons, and modifiers on the facade.

- [ ] **Step 5: Implement wheel projection**

Resolve one coordinate target, preserve delta values/mode, and use the shared
propagation engine. The native hub must register wheel non-passively only while
a live wheel subscriber exists.

- [ ] **Step 6: Run pointer, lifecycle, and mouse compatibility tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/pointer-events.test.ts packages/core/src/lib/events/mouse-dispatch.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/events
git commit -m "feat(events): add pointer capture and wheel dispatch"
```

---

### Task 7: Add Touch and Non-Coordinate User-Event Families

**Files:**

- Create: `packages/core/src/lib/events/adapters/touch.ts`
- Create: `packages/core/src/lib/events/adapters/keyboard-focus.ts`
- Create: `packages/core/src/lib/events/adapters/editing.ts`
- Create: `packages/core/src/lib/events/adapters/clipboard.ts`
- Create: `packages/core/src/lib/events/adapters/drag.ts`
- Create: `packages/core/src/lib/events/event-families.test.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/events/event-facade.ts`

**Interfaces:**

- Consumes: target resolver and propagation from Tasks 4-6.
- Produces: adapter coverage for every event in `CRC_EVENT_TYPES`.
- Produces an internal `dispatchToLogicalTarget(type, target, originalEvent)` entry for the later focus policy.

- [ ] **Step 1: Write failing family-adapter tests**

Assert that a touch contact retains its `touchstart` target across move/end,
multi-touch lists are preserved, and `touchcancel` clears ownership. Assert
keyboard key/code/repeat/modifiers, focus related targets, beforeinput/input
data and inputType, composition data, clipboardData, and drag `dataTransfer`
reach the facade unchanged.

Use the internal explicit-target transport in focused tests for editing events
that a Canvas cannot natively originate; this is not a public dispatch API.
Do not create hidden DOM controls in the test or implementation.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/event-families.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing adapters and projected fields.

- [ ] **Step 3: Implement touch contact ownership**

Store `Touch.identifier -> live target` from `touchstart`; resolve each changed
contact independently and dispatch grouped Touch Events according to their
logical target. Release identifiers on end/cancel. Use the first changed touch
for facade `x`/`y` while preserving all native lists.

- [ ] **Step 4: Implement keyboard/focus and editing/composition adapters**

Without an installed focus policy, native keyboard/focus events have no
geometric descendant target and therefore remain targetless. The public
pathless `crcEvent` observer is mouse-only; only internal focused tests may
supply an explicit target to `dispatchToLogicalTarget` until focus/input
integration provides a supported route. Keep this transport neutral so the
next implementation plan can provide logical focus.

- [ ] **Step 5: Implement clipboard and drag adapters**

Clipboard adapters preserve `clipboardData`. Drag adapters use coordinate hit
testing, path-difference enter/leave handling, shared propagation, and preserve
`dataTransfer` and modifiers. Deliberately, Canvas `drag` and `dragend` also use
current coordinate hit testing rather than retaining the DOM drag source; this
delivery does not add drag-source state.

- [ ] **Step 6: Prove every definition has exactly one adapter route**

Add an assertion that iterates `CRC_EVENT_TYPES` and verifies the dispatcher
classifies every entry, with no `default` branch silently dropping a supported
type.

- [ ] **Step 7: Run family and lifecycle checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/event-families.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/lib/events
git commit -m "feat(events): support touch keyboard editing and drag families"
```

---

### Task 8: Wire Built-ins, Layers, Legacy Hooks, and Root Exports

**Files:**

- Modify: `packages/core/src/lib/util/wire-common-events.ts`
- Modify: `packages/core/src/lib/components/path.ts`
- Modify: `packages/core/src/lib/components/rect.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: `packages/core/src/lib/components/img.ts`
- Modify: `packages/core/src/lib/components/line.ts`
- Modify: `packages/core/src/lib/components/horizontal-line.ts`
- Modify: `packages/core/src/lib/components/vertical-line.ts`
- Modify: `packages/core/src/lib/components/svg-path.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/hooks/crc-event.ts`
- Modify: `packages/core/src/lib/interaction-dispatch.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/src/lib/components/*.test.ts`
- Test: `packages/core/src/lib/hooks/hook-contract.test.ts`

**Interfaces:**

- Consumes: all event APIs from Tasks 1-7.
- Produces: root exports `crcEventTarget`, `crcEventListener`, all public event types, and full DOM-style built-in props.
- Produces: cross-layer component ancestry bridges.

- [ ] **Step 1: Write failing public-API and built-in tests**

Add a table that renders every built-in target with representative pointer,
touch, keyboard, focus, clipboard, and drag props and confirms one target
registration per element. Add a custom component proving event props are not
inspected unless it forwards them or calls a hook. Add a layer case whose event
captures in the parent root, targets inside the layer, then bubbles back to the
parent.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components packages/core/src/lib/hooks/hook-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing props/exports and cross-layer ancestry.

- [ ] **Step 3: Replace `CRCBasicMouseEvents` with composed event-handler props**

Built-in drawing prop interfaces extend `CRCEventHandlers`. The shared wiring
function normalizes `onX`/`onXCapture` once and calls one grouped region/target
registration with the primitive's explicit path. Keep cursor-only targets.

- [ ] **Step 4: Preserve singular `crcEvent` compatibility**

Path-bound calls register one legacy target slot with the requested event.
No-path calls remain mouse-only Canvas-wide observers that run after target
propagation in registration order. They do not publicly dispatch keyboard,
focus, editing, composition, or clipboard families. Handler
replacement/removal and thrown-observer isolation retain the shipped contract.

- [ ] **Step 5: Bridge layer ancestry**

When `layer` creates its child CRC instance, record the live parent layer
component as `eventParent`. `buildEventPath` jumps from the child root to this
parent without changing render identity or IDs. Layer disposal clears the
bridge before child teardown.

- [ ] **Step 6: Export the public surface**

Export runtime values and types only through `packages/core/src/index.ts`.
Update the Studio declaration fixture indirectly through its generated public
entry; do not add source/deep imports.

- [ ] **Step 7: Run component, hook, layer, type, and package-consumer checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components packages/core/src/lib/hooks --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:package-consumer
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src playground/src/crc-editor-types.txt
git commit -m "feat(core): expose DOM-aligned user events"
```

---

### Task 9: Add the Shared Public Event Contract Scenario

**Files:**

- Modify: `packages/scenarios/src/event-trace.ts`
- Modify: `packages/scenarios/src/interaction-lab.example.ts`
- Modify: `packages/scenarios/src/interaction-lab.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/core/test/interaction-dispatch.test.ts`
- Modify: `packages/core/test/scenario-catalog.test.ts`
- Create: `docs/design/user-events-contract.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/event-resource-ownership.md`

**Interfaces:**

- Consumes: public `@crc/core` event APIs only.
- Produces: one manual/headless shared event laboratory and the implemented contract documentation.

- [ ] **Step 1: Add failing catalog and scenario expectations**

Extend the interaction laboratory with fixtures/actions for propagation,
pointer capture, touch target retention, wheel cancellation, keyboard fields,
composition, clipboard, and drag/drop. Freeze expected semantic traces before
changing the scenario implementation.

- [ ] **Step 2: Run scenario tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/interaction-dispatch.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the catalog actions and public scenario do not yet
exercise the new contracts.

- [ ] **Step 3: Implement readable public-API fixtures**

Keep learning code separate from exhaustive test-only matrices. Use direct
built-in props for ordinary targets, one `crcEventTarget` custom-path example,
and one `crcEventListener` propagation example. Do not add a public widget
component or implicit composite geometry.

- [ ] **Step 4: Update the implemented contracts**

Write exact event order, target, related-target, cancellation, capture,
mutation, native-listener ownership, OffscreenCanvas limitation, and legacy
observer rules. Mark the old mouse-only non-propagation clauses superseded only
after the executable contract passes.

- [ ] **Step 5: Run scenario/catalog and source/built smoke checks**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/interaction-dispatch.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:smoke
corepack pnpm@11.21.0 test:smoke:built
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/scenarios/src packages/core/test docs/design
git commit -m "docs(events): add shared user-event contract scenario"
```

---

### Task 10: Prove Performance, Packaging, and the Full Trust Gate

**Files:**

- Modify: `packages/core/test/event-performance.test.ts`
- Modify: `packages/core/test/lifecycle-ownership.test.ts`
- Modify: `packages/core/test/runtime-cleanup-stress.test.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `docs/testing/` field note selected for this delivery

**Interfaces:**

- Consumes: completed public event system.
- Produces: packed/public/lifecycle/performance evidence required before the focus plan starts.

- [ ] **Step 1: Add failing structural performance assertions**

Assert an empty CRC root owns zero native UI listeners and zero targets; one
event type owns one native listener regardless of target count; a topmost hit
still stops after the first successful region; and a miss performs one path test
per live geometric candidate with no propagation allocation retained afterward.

- [ ] **Step 2: Run performance and lifecycle suites and verify failures**

```bash
corepack pnpm@11.21.0 test:performance
corepack pnpm@11.21.0 test:lifecycle
```

Expected: FAIL where diagnostics still encode the eager eight-listener model or
the old region shape.

- [ ] **Step 3: Update packed-consumer coverage**

Import `crcEventTarget`, `crcEventListener`, and representative event types from
`@crc/core` in the strict Bundler/NodeNext consumer. Extend the packed verifier
to confirm no `src/` files, no deep imports, valid runtime loading, and public
declarations for every event family.

- [ ] **Step 4: Update diagnostics and performance expectations from measured structure**

Retain existing controlled wall-clock budgets unless a fresh reference run
demonstrates an intentional need to change them. Record structural counters and
the measured environment; do not weaken a guard simply to make it pass.

- [ ] **Step 5: Run focused static/package/browser gates**

```bash
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:ci
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

Expected: PASS on Node 24.15+ with Playwright Chromium.

- [ ] **Step 6: Run the aggregate trust gate**

```bash
corepack pnpm@11.21.0 trust
```

Expected: PASS. Record fresh totals and duration in the delivery field note;
never copy historical totals from earlier plans.

- [ ] **Step 7: Commit final evidence**

```bash
git add packages/core/test playground/package-consumer playground/src/crc-editor-types.txt tooling/verify-packed-consumer.mjs docs/testing
git commit -m "test(events): prove public event delivery"
```
