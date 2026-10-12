# Generic Render Layer and Three.js Feedback Slice Implementation Plan

> **Historical status: This implementation plan records completed work and is not current guidance.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first runnable Pibbl/Three.js vertical slice: a public generic render-layer lifecycle, a first-class `@pibbl/three` adapter, and an attributed mixed 2D/3D instancing showcase whose pass-through, block, target, scheduling, resize, filter, and teardown behavior can be evaluated in the Studio.

**Architecture:** `@pibbl/core` owns one persistent `OffscreenCanvas`, Pibbl scheduling, bitmap composition, and event arbitration through `defineRenderLayer()`. `@pibbl/three` implements `defineThreeLayer()` strictly on that public lifecycle, owns one transparent `THREE.WebGLRenderer`, and translates Three raycasting plus a scoped controls-input bridge into the generic interaction contract. The showcase uses ordinary Three objects and addons inside one flattened Pibbl paint entry, with Pibbl primitives both below and above it.

**Tech Stack:** TypeScript 7, Pibbl JSX/runtime, Canvas 2D, `OffscreenCanvas`, Three.js 0.186.x, Three `OrbitControls`, Vitest Browser Mode, Playwright Chromium, pnpm 11.21.0, esbuild, Vite Studio.

**Spec:** `docs/superpowers/specs/2026-09-18-generic-render-layers-and-threejs-integration-design.md`

## Global Constraints

- This plan ends at **Milestone 1: slice ready for feedback**. Do not delete `packages/webgl`, `@pibbl/particles/webgl`, old WebGL examples, tests, documentation, or baselines in this plan. Their removal belongs to a post-feedback plan.
- Preserve every unrelated working-tree change. In particular, merge carefully around the already-modified `packages/scenarios/src/learning-catalog.ts` and generated `docs/scenario-index.md`; never overwrite the particle work already present there.
- Call `defineRenderLayer()` and `defineThreeLayer()` at module scope. Definition time must allocate no canvas, renderer, target, listener, or scheduler resource.
- Keep every lifecycle callback synchronous. Reject a returned thenable with a component-specific development error.
- Do not add a reconciler, Three JSX primitives, a private Three copy, `requestAnimationFrame()`, `renderer.setAnimationLoop()`, WebGPU, XR, AR, or a hidden DOM overlay.
- `@pibbl/three` may import only the public `@pibbl/core` surface. If the adapter needs a capability, make it part of the generic render-layer contract instead of reaching into `@pibbl/core/internal`.
- The old `@pibbl/webgl` package may remain installed during this slice, but no new code may depend on it.
- The generic layer must preserve Pibbl outer layout, transforms, clips, `style.filter`, source paint order, logical events, focus policy, and teardown ownership.
- Because Pibbl traverses an immediate-mode root as a whole, the controller snapshots custom props shallowly and admits `update()`/`render()` only when an own prop key/value changes by `Object.is`, the resolved size changes, or the layer is explicitly invalidated. Applications that mutate an object-valued prop in place must call `context.invalidate()`.
- Use Three `^0.186.0`, the current tested release line when this plan was written. Keep it external to the `@pibbl/three` bundle.
- The browser-visible checkpoint is `http://localhost:5173/#/examples/composition/three-instancing` unless Vite reports a different available port.

## Required contract clarification

The approved interaction snapshot needs one small additive field to implement the approved controls behavior honestly. A blocked, unregistered Three object must be able to feed `OrbitControls` without being represented as a fake Pibbl logical target. Add this generic winner-input hook:

```ts
export interface PibblRenderLayerInput<Target extends object> {
  readonly type:
    | "pointerdown"
    | "pointermove"
    | "pointerup"
    | "pointercancel"
    | "wheel"
    | "contextmenu"
    | "click";
  readonly point: Readonly<{ x: number; y: number }>;
  readonly hit: PibblRenderLayerHit<Target>;
  readonly originalEvent: PointerEvent | WheelEvent | MouseEvent;
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
}

export interface PibblRenderLayerInteractionSnapshot<Target extends object> {
  readonly targets: Iterable<PibblRenderLayerTarget<Target>>;
  hitTest(
    point: Readonly<{ x: number; y: number }>,
  ): PibblRenderLayerHit<Target>;
  onInput?(input: Readonly<PibblRenderLayerInput<Target>>): void;
}
```

Core calls `onInput` only when this render layer wins arbitration as a registered target, an unregistered block, or a `target-layer` miss. It does not call it for a pass-through miss or when a later Pibbl paint entry wins. This is a renderer-neutral input seam; `@pibbl/three` uses it to drive its scoped compatibility element.

---

## Task 1: Add the generic raster lifecycle to `@pibbl/core`

**Files:**

- Create: `packages/core/src/lib/render-layer/types.ts`
- Create: `packages/core/src/lib/render-layer/controller.ts`
- Create: `packages/core/src/lib/render-layer/define-render-layer.ts`
- Create: `packages/core/src/lib/render-layer/define-render-layer.test.tsx`
- Modify: `packages/core/src/index.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`

**Interfaces:**

- Public `PibblRenderLayerSize`, `PibblRenderLayerFrame`, `PibblRenderLayerContext`, `PibblRenderLayerStyle`, `PibblRenderLayerComponentProps`, `PibblRenderLayerDefinition`, and `defineRenderLayer()`.
- One private `RenderLayerController<Props, Resources, Target>` per mounted Pibbl component identity.
- The controller owns the `OffscreenCanvas`, stable context, application resources, candidate/committed bitmaps, frame timing, invalidation gate, and exact teardown.

- [ ] Add the focused failing lifecycle test before production code. Use a Canvas-2D fake external renderer so the core contract is independent of Three:

```tsx
const calls: string[] = [];

const TestLayer = defineRenderLayer<
  { color: string },
  { ctx: OffscreenCanvasRenderingContext2D }
>({
  create(context, props) {
    calls.push(`create:${props.color}`);
    const ctx = context.canvas.getContext("2d");
    if (!ctx) throw new Error("missing test context");
    return { ctx };
  },
  update(_resources, props) {
    calls.push(`update:${props.color}`);
  },
  resize(_resources, size) {
    calls.push(
      `resize:${size.width}x${size.height}@${size.backingWidth}x${size.backingHeight}`,
    );
  },
  render(resources, frame) {
    calls.push(`render:${frame.frameId}:${frame.delta}`);
    resources.ctx.fillRect(0, 0, 8, 8);
  },
  dispose() {
    calls.push("dispose");
  },
});
```

Assert definition time is inert; first mount orders `create`, initial `resize`, `render`; the first `delta` is zero; a later prop update orders `update` before `render`; backing-only and logical resize call `resize`; and unmount calls `dispose` exactly once.

- [ ] Run the focused test and confirm the expected failure:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-layer/define-render-layer.test.tsx --browser.headless --browser.ui=false
```

Expected: import/compile failure because `defineRenderLayer` does not exist.

- [ ] Define the public types. Reserve `key`, `style`, Pibbl event/focus participation props, and `missBehavior` from custom `Props`:

```ts
type PibblRenderLayerReservedProp =
  | "key"
  | "style"
  | "missBehavior"
  | keyof PibblEventHandlers
  | keyof PibblEventFocusOptions
  | keyof PibblEventParticipationOptions;

export type PibblRenderLayerProps<Props> =
  Extract<keyof Props, PibblRenderLayerReservedProp> extends never
    ? Props & PibblRenderLayerComponentProps
    : never;

export function defineRenderLayer<
  Props,
  Resources,
  Target extends object = object,
>(
  definition: PibblRenderLayerDefinition<Props, Resources, Target>,
): PibblComponent<PibblRenderLayerProps<Props>>;
```

- [ ] Implement `defineRenderLayer()` as a definition-time `definePrimitive()` call that closes over the immutable definition. Reuse the existing `Layer` width/height resolution rules and surface rounding; do not create a second layout algorithm.

- [ ] Implement `RenderLayerController` with these exact lifecycle rules:

  - capability-check `OffscreenCanvas` and `transferToImageBitmap` before calling application `create()`;
  - allocate one backing canvas per mounted identity;
  - expose one stable context whose `size` getter always returns the current immutable size snapshot;
  - call `create()` once, skip duplicate initial `update()`, call initial `resize()`, then `render()`;
  - compare a shallow snapshot of custom prop own keys/values with `Object.is`, call later `update()` only when it changes, and reuse the committed bitmap on unrelated root traversals;
  - call `resize()` only when logical/backing size changed and render for changed props, changed size, or explicit invalidation;
  - set the backing canvas dimensions before `resize()`;
  - create an immutable frame from Pibbl scheduler `frameId` and logical time, with first delta zero and `deltaSeconds === delta / 1000`;
  - transfer a candidate `ImageBitmap` only after a successful render;
  - draw candidate-or-committed bitmap exactly once at the primitive's paint position;
  - promote the candidate only from the current render transaction's success callback; close a discarded candidate on failure;
  - make retained `context.invalidate()` request one coalesced Pibbl render and gate coordinate input until a successful commit;
  - make `frame.invalidate()` request the next Pibbl frame without gating the candidate being committed;
  - make old invalidation closures no-ops after disposal;
  - call application `dispose()` only if `create()` completed, then close candidate/committed bitmaps in `finally`.

- [ ] Add a thenable guard around every lifecycle callback:

```ts
function assertSynchronous(value: unknown, callback: string): void {
  if (value && typeof (value as { then?: unknown }).then === "function") {
    throw new TypeError(`defineRenderLayer ${callback}() must be synchronous.`);
  }
}
```

- [ ] Extend the lifecycle test with coalesced retained invalidation, `frame.invalidate()` continuous scheduling, unchanged bitmap reuse, rejected async callbacks, create failure without application disposal, render failure retaining the prior committed bitmap, and late invalidation after disposal.

- [ ] Export `defineRenderLayer` and every public render-layer type from `@pibbl/core`. Update the source package-consumer fixture and exact runtime export list for the new single runtime export.

- [ ] Run the focused test and the existing Layer/filter regression checks:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-layer/define-render-layer.test.tsx packages/core/src/lib/components/layer.test.ts packages/core/src/lib/filter/filter-region.test.ts --browser.headless --browser.ui=false
```

Expected: all selected tests pass.

- [ ] Commit only this task's files:

```sh
git add packages/core/src/lib/render-layer packages/core/src/index.ts playground/package-consumer/index.ts playground/package-consumer/runtime.mjs
git commit -m "feat(core): add generic render layer lifecycle"
```

## Task 2: Add transactional miss/block/target arbitration and winner input

**Files:**

- Modify: `docs/superpowers/specs/2026-09-18-generic-render-layers-and-threejs-integration-design.md`
- Modify: `packages/core/src/lib/render-layer/types.ts`
- Modify: `packages/core/src/lib/render-layer/controller.ts`
- Create: `packages/core/src/lib/events/resolver-input.ts`
- Modify: `packages/core/src/lib/events/paint-entry.ts`
- Modify: `packages/core/src/lib/events/hit-test.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/render-layer/define-render-layer.test.tsx`
- Modify: `packages/core/src/index.ts`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Public `PibblRenderLayerHit`, `PibblRenderLayerTarget`, `PibblRenderLayerInteraction`, `PibblRenderLayerInteractionSnapshot`, and `PibblRenderLayerInput`.
- Internal coordinate-winner record carried alongside `PibblHitTestOutput`; it is not a logical target.
- Stable target registrations keyed by application `Target` object identity.

- [ ] Add failing browser tests for all three outcomes using one fake render layer painted over a clickable Pibbl rectangle:

  - `miss` + default `pass-through` reaches the lower rectangle;
  - `miss` + `block` reaches nothing;
  - `miss` + `target-layer` invokes the layer's structural handler exactly once;
  - `block` reaches neither lower rectangle nor a Pibbl logical leaf, but calls `onInput` with `{ kind: "block" }`;
  - `target` dispatches to the registered target, then bubbles through the layer component;
  - a later-painted Pibbl rectangle wins without calling this layer's `onInput`;
  - a target with `pointerEvents: "none"` is absent from the candidate target map;
  - explicit layer-local focus bounds transform through an outer `Group` and activate from keyboard focus policy.

- [ ] Run the test and confirm semantic failures rather than changing assertions:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-layer/define-render-layer.test.tsx --browser.headless --browser.ui=false
```

Expected: lifecycle cases remain green; new interaction cases fail because no resolver/target bridge exists.

- [ ] Update the spec status from awaiting review to approved/implementation planned, document the shallow custom-prop admission rule, and add the required `onInput` clarification exactly as shown near the top of this plan. Remove the duplicated `frame` parameter already present in the spec's `render()` signature while touching that block.

- [ ] Add one resolver paint entry at the render layer's exact Canvas paint position. Its bounds are the local layer box, its transform/clip stack come from the current Pibbl render target, and its hit callback maps the committed generic result as follows:

```ts
switch (hit.kind) {
  case "miss":
    return missBehavior === "pass-through"
      ? miss()
      : missBehavior === "block"
        ? block(winner)
        : target(layerTarget, winner);
  case "block":
    return block(winner);
  case "target":
    return target(committedTargets.get(hit.target), winner);
}
```

- [ ] Reuse core's target registration machinery inside the controller. Keep one registration per stable target object; stage fresh handlers/cursor/focus bounds during settlement; enroll/update/release them only when the matching bitmap commits. A failed candidate must not publish new handlers or focus geometry over old pixels.

- [ ] Register layer event props as one structural listener. For `target-layer`, use a private empty-handler target in the same component so the structural listener participates once without duplicating the user's handlers on a second node.

- [ ] Extend `PibblHitTestOutput` with an internal winner identity. Refactor coordinate dispatch so the winner's `onInput` runs only for the outcome that actually won reverse paint order. Preserve `Block` with `target: null`; do not manufacture a logical event target for the input bridge.

- [ ] In `resolver-input.ts`, retain winner-owned pointer capture by pointer ID. `setPointerCapture()` keeps subsequent pointer move/up/cancel delivery with the winning layer and prevents lower coordinate targets from activating until release; release on pointer up/cancel, controller teardown, or explicit release. Delegate native capture to the root Canvas when available, but keep Pibbl ownership authoritative.

- [ ] Ensure a retained external `context.invalidate()` immediately fail-closes the committed resolver to `Block`, whereas `frame.invalidate()` leaves the just-committed resolver live. A lifecycle/settlement failure keeps the gate closed until a later successful bitmap/interaction pair commits.

- [ ] Add a settlement validation test for duplicate target identities and a resolution-time diagnostic for a hit function returning an identity absent from the same snapshot. Fail closed before reporting the error.

- [ ] Run the focused interaction and existing event suites:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-layer/define-render-layer.test.tsx packages/core/src/lib/events/hit-test.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/focus-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: all selected tests pass with existing event ordering unchanged.

- [ ] Commit only this task's files:

```sh
git add docs/superpowers/specs/2026-09-18-generic-render-layers-and-threejs-integration-design.md packages/core/src/lib/render-layer packages/core/src/lib/events/resolver-input.ts packages/core/src/lib/events/paint-entry.ts packages/core/src/lib/events/hit-test.ts packages/core/src/lib/events/dispatch.ts packages/core/src/lib/types.ts packages/core/src/index.ts playground/package-consumer/index.ts
git commit -m "feat(core): arbitrate render layer interaction"
```

## Task 3: Add `@pibbl/three` on the public generic lifecycle

**Files:**

- Create: `packages/three/package.json`
- Create: `packages/three/tsconfig.build.json`
- Create: `packages/three/README.md`
- Create: `packages/three/src/index.ts`
- Create: `packages/three/src/lib/types.ts`
- Create: `packages/three/src/lib/define-three-layer.ts`
- Create: `packages/three/src/lib/default-picker.ts`
- Create: `packages/three/src/lib/project-bounds.ts`
- Create: `packages/three/src/lib/three-input-bridge.ts`
- Create: `packages/three/src/lib/define-three-layer.test.tsx`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `packages/scenarios/package.json`
- Modify: `playground/package.json`

**Interfaces:**

- Public `defineThreeLayer()` plus the approved `PibblThreeLayerResources`, `PibblThreeLayerContext`, `PibblThreeLayerDefinition`, `PibblThreeTarget`, `PibblThreePickResult`, `PibblThreePicker`, `PibblThreeRendererOptions`, and `PibblThreeInputBridge` types.
- Private adapter resources wrap application resources, the adapter-owned renderer, default raycaster, input bridge, current props, and candidate picker/target maps.
- `@pibbl/three` peers on `@pibbl/core` 0.0.1 and `three` `^0.186.0`; its build externalizes both.

- [ ] Add `three: ^0.186.0` to the workspace catalog, add workspace dependencies, path aliases, and the new package manifest/build. Run the locked install:

```sh
corepack pnpm@11.21.0 install
```

Inspect `pnpm-lock.yaml`; expect one workspace-resolved `@pibbl/three` and one Three 0.186.x package.

- [ ] Write the adapter's focused failing tests before implementation. Cover definition-time inertness, one renderer per mounted identity, forced alpha/canvas, renderer resize before application resize, default render, custom render, application-dispose-before-renderer-dispose, and no adapter call to `requestAnimationFrame` or `setAnimationLoop`.

- [ ] Add default picker tests with a perspective camera and deterministic boxes:

  - transparent gap => `miss`;
  - nearest unregistered visible mesh => `block`;
  - registered mesh or nearest registered ancestor => `target`;
  - registered `pointerEvents: "none"` object and its subtree are skipped;
  - a custom picker replaces only picking, not lifecycle or composition;
  - omitted explicit focus bounds project the committed object's `Box3` into layer-local logical bounds.

- [ ] Add an `OrbitControls` compatibility test that connects only inside `create()`, dispatches a Pibbl-arbitrated pointer drag and wheel through the bridge, changes the camera, requests a Pibbl render, and cleans up every compatibility listener/capture on disposal.

- [ ] Run the new tests and confirm they fail because `@pibbl/three` has no implementation:

```sh
corepack pnpm@11.21.0 exec vitest run packages/three/src/lib/define-three-layer.test.tsx --browser.headless --browser.ui=false
```

- [ ] Implement `defineThreeLayer()` only by calling public `defineRenderLayer()`:

```ts
export function defineThreeLayer<
  Props,
  Resources extends PibblThreeLayerResources,
>(definition: PibblThreeLayerDefinition<Props, Resources>) {
  return defineRenderLayer<
    Props,
    ThreeAdapterResources<Props, Resources>,
    THREE.Object3D
  >({
    create(context, initialProps) {
      const renderer = new THREE.WebGLRenderer({
        ...definition.renderer,
        canvas: context.canvas,
        alpha: true,
      });
      const input = createThreeInputBridge(context);
      const threeContext = createThreeContext(context, renderer, input);
      const resources = definition.create(threeContext, initialProps);
      assertThreeResources(resources);
      return { renderer, input, threeContext, resources, props: initialProps };
    },
    // update, resize, render, dispose, and interaction delegate below
  });
}
```

- [ ] On resize, call `renderer.setPixelRatio(1)` and `renderer.setSize(backingWidth, backingHeight, false)` before application `resize()`. Keep logical width/height for camera projection; do not let Three multiply Pibbl's already-resolved backing density again.

- [ ] If application `render()` is absent, call `renderer.render(resources.scene, resources.camera)`. Never call `setAnimationLoop()`.

- [ ] Settle `definition.targets()` into generic target descriptors keyed by `Object3D`. Build the default picker with one reusable `THREE.Raycaster`, layer-local NDC, recursive scene intersections, nearest registered ancestor lookup, `pointerEvents="none"` subtree skipping, and unregistered-geometry blocking. Build a fresh custom picker only when `definition.pick` exists.

- [ ] For focusable targets without explicit bounds, snapshot `Box3.setFromObject(object)` after the successful render, project its eight world corners through the committed camera, clip to the logical viewport, and publish the resulting layer-local rectangle. Treat empty/non-finite projections as non-focusable for that generation.

- [ ] Implement the scoped r186 `OrbitControls` bridge. The compatibility element/document pair needs only:

  - `addEventListener`/`removeEventListener`/`dispatchEvent`;
  - `clientWidth`, `clientHeight`, and zero-origin `getBoundingClientRect()` from current layer size;
  - `style.touchAction` and `style.cursor` storage;
  - `ownerDocument` and `getRootNode()` returning the compatibility document target;
  - pointer capture methods backed by `PibblRenderLayerInput`;
  - pointer, wheel, context-menu, and click events with local `clientX/clientY` and original modifier/button data.

  Dispatch bridge input only from generic `onInput`. Dispatch pointer-down/wheel/context-menu to the element; while captured, dispatch pointer-move/up to the compatibility document as OrbitControls r186 expects. Invalidate after a delivered event. Reject `connect()` outside application `create()` and dispose all bridge listeners after application disposal.

- [ ] In adapter teardown, call application `dispose()` first, then bridge cleanup, `renderer.dispose()`, and adapter-owned resource cleanup in `finally`. Do not infer disposal of application geometries, materials, textures, controls, composers, or loaders.

- [ ] Run focused Three and core lifecycle tests:

```sh
corepack pnpm@11.21.0 exec vitest run packages/three/src/lib/define-three-layer.test.tsx packages/core/src/lib/render-layer/define-render-layer.test.tsx --browser.headless --browser.ui=false
```

Expected: all selected tests pass.

- [ ] Commit only this task's files:

```sh
git add packages/three pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json vitest.config.ts packages/scenarios/package.json playground/package.json
git commit -m "feat(three): add Three.js render layer adapter"
```

## Task 4: Build the attributed mixed Pibbl/Three proving scene

**Files:**

- Create: `packages/scenarios/src/learning/composition/three-instancing.example.tsx`
- Create: `packages/scenarios/src/three-instancing-lab.example.tsx`
- Create: `packages/scenarios/src/three-instancing-lab.ts`
- Create: `packages/core/test/three-instancing-lab.test.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/scenarios/package.json`
- Modify: `tooling/learning-source-contract.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Public lesson slug/route: `three-instancing` / `#/examples/composition/three-instancing`, order `116`.
- Deterministic lab ID/route: `three-instancing` / `#/testing/three-instancing`, learning order `177`.
- Lab state reports `missBehavior`, `lastResolution`, tile clicks, Three-target clicks, blocked Three inputs, camera changes, target propagation trace, and revision.
- Export fixed probe coordinates for an exposed Pibbl tile, unregistered Three instance, registered Three target, empty gap, and foreground toolbar.

- [ ] Add the failing catalog/source/browser tests first. Require:

  - one public learning entry under Composition with API tags `defineThreeLayer`, `InstancedMesh`, `OrbitControls`, and `missBehavior`;
  - direct public imports from `@pibbl/core`, `@pibbl/three`, `three`, and `three/addons/controls/OrbitControls.js` only;
  - an attribution comment linking the official example source and Three MIT license;
  - one deterministic scenario with exact state fields, actions, and probes;
  - no `@pibbl/core/internal`, `@pibbl/webgl`, `requestAnimationFrame`, or `setAnimationLoop` in either new source file.

- [ ] Run the focused tests and confirm the expected missing-entry/source failure:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/three-instancing-lab.test.ts --browser.headless --browser.ui=false
```

- [ ] Adapt the official Three `webgl_instancing_raycast` idea, not its standalone shell. The layer definition should have this recognizable resource shape:

```ts
interface InstancingResources {
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  instances: InstancedMesh;
  registered: Mesh;
  raycaster: Raycaster;
  pointer: Vector2;
  hoveredInstance: number | undefined;
  props: Readonly<InstancingProps>;
}

const ThreeInstancingLayer = defineThreeLayer<
  InstancingProps,
  InstancingResources
>({
  renderer: { antialias: true },
  create(context, initialProps) {
    // Scene, camera, HemisphereLight, procedural InstancedMesh field,
    // one separate registered icosahedron, and connected OrbitControls.
  },
  update(resources, props) {
    resources.props = props;
  },
  resize(resources, size) {
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  },
  render(resources, frame, context) {
    const controlsChanged = resources.controls.update(frame.deltaSeconds);
    context.renderer.render(resources.scene, resources.camera);
    if (controlsChanged) frame.invalidate();
  },
  targets(resources, props) {
    return [
      {
        object: resources.registered,
        handlers: { onClick: props.onThreeTarget },
        cursor: "pointer",
        keyboardFocusable: true,
      },
    ];
  },
  dispose(resources) {
    resources.controls.dispose();
    resources.instances.geometry.dispose();
    // Dispose every application-owned material/geometry exactly once.
  },
});
```

- [ ] Keep the scene procedural and deterministic: a tuned lattice of lit `IcosahedronGeometry` instances using `InstancedMesh` and instance colors, `HemisphereLight`, one distinct registered icosahedron, a transparent background, a fixed initial camera, and no external assets, Stats, or lil-gui.

- [ ] Paint numbered Pibbl tiles before the layer. Paint a compact Pibbl policy control and status readout after it. Wrap or place the layer so one visible clip edge and one outer drop-shadow filter demonstrate Pibbl composition without obscuring the interaction probes.

- [ ] Route bridge pointer movement through an application `Raycaster` to recolor the hovered `InstancedMesh` instance. On pointer press over an unregistered instance, call the Pibbl state callback with `Three blocked`; do not register the instanced mesh as a Pibbl target.

- [ ] Make the registered separate icosahedron visually unmistakable and report `Three target` through its Pibbl target handler. Record a capture/target/bubble trace to prove it uses Pibbl propagation. Ensure Enter/Space activation after focus reports the same target.

- [ ] Make a click through a projected gap report `Pibbl tile`. Cycle the layer's `missBehavior` among `pass-through`, `block`, and `target-layer`; under `target-layer`, empty-space drag must orbit through the bridge while lower tiles remain untouched.

- [ ] Keep the foreground toolbar interactive at coordinates overlapping Three output. Its later Pibbl paint entry must win without delivering bridge input.

- [ ] Add this exact attribution near the top of both source files, preserving the URLs:

```ts
// Adapted from Three.js "webgl_instancing_raycast":
// https://github.com/mrdoob/three.js/blob/dev/examples/webgl_instancing_raycast.html
// Three.js is MIT licensed: https://github.com/mrdoob/three.js/blob/dev/LICENSE
```

- [ ] Update the learning-source validator with one narrowly identified Three lesson rule. Do not broadly allow arbitrary package imports in other lessons. Add direct validator fixtures for accepted and rejected Three/addon imports.

- [ ] Add deterministic browser assertions for exposed-tile pass-through, unregistered blocking with bridge diagnostics, registered Pibbl target propagation, foreground toolbar precedence, miss-policy cycling, OrbitControls camera change through Pibbl scheduling, focus activation, outer clip/filter pixels, resize, and disposal. Prefer semantic state and stable geometry assertions; add only a few tolerant pixel probes where they prove transparent composition.

- [ ] Regenerate the scenario index, inspect the diff, and preserve the user's existing particle-related generated changes:

```sh
corepack pnpm@11.21.0 scenarios:write-index
git diff -- docs/scenario-index.md packages/scenarios/src/learning-catalog.ts
```

- [ ] Run the focused public evidence:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/three-instancing-lab.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 scenarios:check
```

Expected: both tests and catalog/source validation pass.

- [ ] Commit only the Three showcase/catalog changes, leaving unrelated pre-existing edits unstaged:

```sh
git add packages/scenarios/src/learning/composition/three-instancing.example.tsx packages/scenarios/src/three-instancing-lab.example.tsx packages/scenarios/src/three-instancing-lab.ts packages/core/test/three-instancing-lab.test.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/scenarios/package.json tooling/learning-source-contract.ts packages/core/test/learning-examples.test.ts
git add -p packages/scenarios/src/learning-catalog.ts docs/scenario-index.md
git diff --cached --check
git commit -m "feat(examples): add Three instancing integration showcase"
```

## Task 5: Prove source, built, and packed distribution boundaries

**Files:**

- Modify: `tooling/assert-built-core.ts`
- Modify: `tooling/pibbl-runtime-source.ts`
- Modify: `tooling/pibbl-studio-runtime-entry.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `packages/three/package.json`

**Interfaces:**

- Source-mode and built-mode Studio resolve `@pibbl/three` exactly once from the selected source tree.
- Bundler and NodeNext consumers see the same public declarations.
- Packed consumer installs one `@pibbl/core`, one `@pibbl/three`, and one peer `three`; the adapter tarball contains no core or Three implementation.

- [ ] Add a package-consumer type example that defines a minimal Three layer from public imports, uses `PibblThreeLayerResources`, and proves reserved prop conflicts become `never`. Add a JSX use of the returned component with `missBehavior` and `style.filter`.

- [ ] Update runtime export assertions: `@pibbl/core` adds only `defineRenderLayer`; `@pibbl/three` has only `defineThreeLayer` as a runtime export. Assert that `@pibbl/three` does not re-export Three values.

- [ ] Add `@pibbl/three` to source/built Studio entry maps and built-source leakage checks. Export it from the Studio editor runtime so the public workbench compiles and runs the displayed source in both modes.

- [ ] Extend packed-consumer verification to pack/install `packages/three`, require `dist/index.d.ts`, `dist/index.mjs`, and source map, and assert:

```js
const expectedThreePeers = JSON.stringify({
  "@pibbl/core": "0.0.1",
  three: "^0.186.0",
});
if (JSON.stringify(threeManifest.peerDependencies) !== expectedThreePeers) {
  throw new Error("@pibbl/three must keep exact tested core and Three peers.");
}
```

Bundle a tiny browser consumer and verify exactly one installed root for `@pibbl/core`, `@pibbl/three`, and `three`, no `/packages/*/src/` inputs, no embedded Pibbl identity markers in `@pibbl/three`, and no bundled Three renderer source inside the adapter tarball.

- [ ] Run source declaration/runtime checks:

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:package-consumer
```

Expected: Bundler, NodeNext, and runtime export assertions pass.

- [ ] Run packed and built-Studio checks:

```sh
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

Expected: packed consumer and both Studio modes pass, and built mode reports no Pibbl source leakage.

- [ ] Commit only distribution-boundary changes:

```sh
git add tooling/assert-built-core.ts tooling/pibbl-runtime-source.ts tooling/pibbl-studio-runtime-entry.ts playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs tooling/verify-packed-consumer.mjs packages/three/package.json
git commit -m "test(packaging): verify Three integration distribution"
```

## Task 6: Verify and present the feedback slice

**Files:**

- Verify only; do not start the removal/hardening milestone.

- [ ] Inspect the complete slice diff against the approved spec and confirm no new code imports `@pibbl/webgl`, starts a private frame loop, creates a visible DOM overlay, or uses Three outside `@pibbl/three` and the two proving sources:

```sh
git diff --check HEAD~5..HEAD
rg -n "requestAnimationFrame|setAnimationLoop|@pibbl/webgl" packages/three packages/scenarios/src/learning/composition/three-instancing.example.tsx packages/scenarios/src/three-instancing-lab.example.tsx
```

Expected: no whitespace errors; the search has no matches except any intentional negative-test string literals, which must be visibly confined to tests.

- [ ] Run the proportional slice gate once, not the full aggregate trust suite:

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-layer/define-render-layer.test.tsx packages/three/src/lib/define-three-layer.test.tsx packages/core/test/three-instancing-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/focus-navigation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

- [ ] Start the source-mode Studio and keep it available for feedback:

```sh
corepack pnpm@11.21.0 playground
```

- [ ] Open `http://localhost:5173/#/examples/composition/three-instancing` and manually inspect:

  1. exposed Pibbl tiles respond through transparent gaps;
  2. ordinary instances recolor but block the tiles behind them;
  3. the distinct registered icosahedron reports `Three target` and keyboard activation;
  4. the foreground Pibbl toolbar wins over overlapping Three pixels;
  5. pass-through, block, and target-layer policies visibly differ;
  6. orbit drag/wheel changes the camera without another animation loop;
  7. the outer clip and drop shadow affect the complete Three bitmap;
  8. resizing/remounting does not recreate resources unnecessarily or leave stale input.

- [ ] Report this milestone exactly as **Slice ready for feedback**, include the actual Vite URL and the focused commands' fresh results, and explicitly state that `@pibbl/webgl` and old examples remain temporarily by design.

- [ ] Stop for hands-on user feedback. Do not proceed automatically into deletion, TransformControls compatibility, exhaustive failure/ownership matrices, the 608-example classification inventory, documentation replacement, historical supersession banners, performance evidence, visual baselines, or `pnpm trust`.

## Post-feedback follow-on plan boundary

After the user accepts or revises the slice API, write a separate implementation plan covering:

1. accepted API adjustments;
2. deletion of `packages/webgl`, `@pibbl/particles/webgl`, old WebGL lessons/labs/tests/baselines, and active documentation;
3. complete package/script/tooling cleanup;
4. TransformControls and broader lifecycle/failure/focus/ownership hardening;
5. the maintained Three example-route inventory;
6. final public guides/API references and superseded-history banners;
7. proportional visual/performance evidence and the fresh aggregate `corepack pnpm@11.21.0 trust` gate.
