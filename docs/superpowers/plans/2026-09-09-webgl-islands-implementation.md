# WebGL Islands Implementation Plan

> **Historical status: PROPOSED IMPLEMENTATION PLAN.** This plan records the proposed implementation sequence; current shipped behavior remains governed by `docs/design/` until every shipping gate in this plan passes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an official `@crc/webgl` package that renders declarative, interactive WebGL2 islands inside CRC Canvas 2D scenes with one JSX protocol, one global paint-order resolver, deterministic GPU ownership, and default cube, sphere, mesh, group, camera, and animation facilities.

**Architecture:** `@crc/core` gains a narrow version-coupled `@crc/core/internal` friend entry, a backend-neutral component traversal seam, and a fixed-shape miss/block/target resolver. `WebGLLayer` owns a private WebGL-backed CRC child instance, persistent WebGL2 `OffscreenCanvas`, committed `ImageBitmap` plus matching pick ledger, and one nested interaction bridge; `@crc/webgl` owns camera math, GPU state, resources, primitives, ray picking, caching, animation, and context recovery.

**Tech Stack:** TypeScript 7, CRC JSX/createElement runtime, HTML Canvas 2D, `OffscreenCanvas`, WebGL2, DOMMatrix/Path2D/ImageBitmap, Vitest Browser with Playwright Chromium, esbuild, pnpm 11.21.0, Node 24.15 or newer.

**Spec:** `docs/superpowers/specs/2026-09-09-webgl-islands-design.md`

## Global Constraints

- Preserve unrelated working-tree changes and untracked files; stage only files named by the active task.
- Keep `@crc/core` and `@crc/webgl` at the same package version and release them together; `@crc/webgl` declares that exact core version as a peer and never bundles core.
- Applications use the existing `@crc/core` JSX runtime. Do not create an `@crc/webgl/jsx-runtime` entry, a second element brand, or a second hook implementation.
- `@crc/core/internal` is resolvable only as an explicitly unsupported, version-coupled friend surface for official CRC packages. All other `@crc/core/lib/*` and source paths remain blocked.
- Preserve one synchronous component execution for each invalidated subtree in one scheduled frame. Do not add a camera prepass, retained draw-command list, or replay traversal.
- One `WebGLLayer` owns exactly one perspective camera. The omitted camera is position `[0, 0, 5]`, look-at `[0, 0, 0]`, up `[0, 1, 0]`, field of view `50`, near `0.1`, far `1000`, and aspect from logical layer dimensions.
- Do not inspect scene bounds or auto-fit the camera. Multiple cameras, viewports, portals, render-to-texture graphs, WebGL1, WebGPU, and workers remain outside this release.
- Request WebGL2 with `{ alpha: true, depth: true, premultipliedAlpha: true, preserveDrawingBuffer: false }` and use `transferToImageBitmap()` after a successful updated child traversal.
- Commit and replace the visible `ImageBitmap` and pick ledger as one generation. Close every replaced, rejected, context-lost, removed, and finally disposed bitmap exactly once.
- Canvas 2D and WebGL drawing primitives participate in hit resolution by default. `pointerEvents="none"` is the explicit paint-preserving opt-out.
- Structural containers contribute listener ancestry but no target geometry. Empty `Group`, layout, `Clip`, `Layer`, `WebGLLayer`, and `Group3D` space never becomes a rectangle target.
- All coordinate candidates write one reusable fixed-shape result with numeric `Miss`, `Block`, or `Target`; do not allocate a result object per candidate.
- Default WebGL picking is synchronous CPU raycasting against the geometry, camera, model transform, and supported depth state committed with the visible bitmap. Do not use `readPixels`, an ID framebuffer, or alpha readback.
- Opacity, transparent colors, filters, fragment alpha, and the transparent island background do not redefine declared hit geometry. The island background returns `Miss` because no geometry intersects it.
- Individual WebGL objects cannot interleave with an external Canvas 2D primitive inside one flattened island. Use multiple `WebGLLayer` passes for `WebGL back -> Canvas 2D -> WebGL front`.
- Install an explicit WebGL baseline around every primitive; built-ins set every state dependency and raw-context primitives restore extension-specific state in `finally`.
- Add a failing test before each production change. Public behavior requires public-package and browser evidence in addition to internal unit tests.
- Verify semantic target identity, event order, geometry, lifecycle counters, and WebGL calls before adding or changing a visual baseline.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for final evidence.

## File and Responsibility Map

### Core friend and traversal seam

- `packages/core/src/internal.ts`: the complete friend export list; no wildcard export of core internals.
- `packages/core/src/lib/backend/types.ts`: opaque backend tokens, frame drivers, backend primitive definitions, and backend mismatch diagnostics.
- `packages/core/src/lib/backend/canvas-2d-backend.ts`: existing Canvas save/restore, filter, presentation, root clear, and primitive invocation behavior behind the backend driver.
- `packages/core/src/lib/{define-primitive.ts,render.ts,execute-render.ts,mount-crc.ts,global-state.ts,types.ts}`: common identity/hooks traversal and backend-owned frame lifecycle.
- `packages/core/src/lib/element/metadata.ts`: backend-tagged primitive metadata in the existing WeakMap protocol.
- `packages/core/src/lib/components/layer-node-equality.ts`: retained child-tree snapshot helpers shared through the friend entry without becoming public API.

### Unified interactions

- `packages/core/src/lib/events/paint-entry.ts`: numeric paint-entry kinds, fixed hit request/result, and nested resolver records.
- `packages/core/src/lib/events/{registrations.ts,hit-test.ts,event-path.ts}`: geometry-independent target identity, central reverse dispatch, and cross-instance ancestry.
- `packages/core/src/lib/hooks/crc-paint-target.ts`: built-in drawing-target hook with default participation and explicit opt-out.
- `packages/core/src/lib/util/wire-common-events.ts`: common Canvas path registration using the drawing-target hook.
- `packages/core/src/lib/components/structural-events.ts`: one stable listener hook for child-bearing built-ins.
- Canvas drawing components, `Group`, `Clip`, `Layer`, and the five layout components: public participation/listener props and unchanged paint/layout geometry.
- `packages/core/src/lib/focus/geometry.ts`: root bounds through either Canvas Layer or WebGL nested-instance bridges.

### WebGL package

- `packages/webgl/package.json` and `packages/webgl/tsconfig.build.json`: version-locked peer package and bundled ESM/declaration build with core externalized.
- `packages/webgl/src/index.ts`: complete public WebGL surface.
- `packages/webgl/src/lib/types.ts`: public vectors, camera, transform, primitive, geometry, context, and component types.
- `packages/webgl/src/lib/math/{matrix4.ts,camera.ts,ray.ts}`: finite matrix math, camera snapshots, unprojection, and ray/triangle intersections.
- `packages/webgl/src/lib/geometry/{geometry.ts,cube.ts,sphere.ts}`: immutable branded triangles and deterministic built-in meshes.
- `packages/webgl/src/lib/{define-webgl-primitive.ts,backend.ts,render-environment.ts}`: backend primitive registration and one mutable per-frame environment stack.
- `packages/webgl/src/lib/gpu/{state.ts,program.ts,resources.ts}`: explicit GL baseline, shader program, and context-generation ownership.
- `packages/webgl/src/lib/components/{webgl-layer.ts,group-3d.ts,mesh.ts,cube.ts,sphere.ts}`: public primitives and the Canvas/WebGL composition boundary.
- `packages/webgl/src/lib/{pick-ledger.ts,scene-picker.ts}`: transient draw-matched pick records and nearest synchronous CPU resolution.
- `packages/webgl/src/lib/hooks/{crc-webgl-context.ts,crc-animation-frame.ts}`: raw render context and coalesced continuing-frame hook.

### Public evidence and documentation

- `packages/scenarios/src/learning/composition/webgl-islands.example.tsx`: readable default-camera cube/sphere lesson.
- `packages/scenarios/src/{webgl-lab.example.tsx,webgl-lab.ts,catalog.ts,learning-catalog.ts,index.ts}`: deterministic public interaction laboratory and catalog entries.
- `packages/core/test/{webgl-lab.test.ts,webgl-ownership.test.ts,webgl-performance.test.ts}`: browser behavior, exact lifecycle, and structural cost evidence.
- `packages/core/test/visual-baselines/webgl-islands.expected.png`: reviewed stable Chromium pixels.
- Root TypeScript/Vitest paths, Studio runtime/types, package consumers, and packed-consumer tooling: source/built/packed resolution of both packages with one core identity.
- Current contracts, API reference, guides, library status, root README, package README files, and testing notes: shipped semantics and limitations.
- `docs/migrations/default-pointer-participation.md`: compatibility guidance for applications that relied on passive Canvas shapes clicking through.

## Complexity and Ownership Contract

- Let `C` be traversed components, `D` WebGL draw primitives, `P` default-participating pick primitives, `T` tested triangles, and `L` nested Canvas/WebGL interaction boundaries. An updated frame adds `O(C + D)` JavaScript traversal/draw submission and default exact picking adds `O(P + T)` worst-case CPU work for one coordinate event.
- Reverse global resolution is `O(number of visited paint entries + L)`. It stops at the first `Block` or `Target`; an upper Canvas target prevents a lower WebGL picker call.
- The core resolver borrows one request and one result record per root coordinate lookup. Every candidate resets the same output fields; nested resolvers may borrow backend scratch arrays but may not retain core scratch.
- One static `WebGLLayer` owns one GL context, at most one committed bitmap, one committed pick ledger, and context-owned GPU caches. A render candidate temporarily adds at most one bitmap and one pick ledger until composition succeeds or fails.
- A cache hit performs one Canvas `drawImage`, replays retained focus metadata, and performs no child component execution, GL draw, bitmap transfer, shader compilation, buffer upload, or pick-ledger rebuild.
- Immutable geometry uploads once per WebGL context generation and uses deterministic leases. Component removal decrements one lease; the final lease deletes the handle once.
- One WebGL primitive callback performs constant framework state setup independent of sibling count. Production state restoration uses known assignments, not broad `getParameter()` polling.
- The baseline built-in pass has one color/depth clear per updated island, one draw call per mesh primitive, and one `transferToImageBitmap()` per updated island. Browser/GPU implementation cost remains opaque and is not asserted by wall-clock correctness tests.

---

### Task 1: Fixed-shape global hit resolver

**Files:**

- Create: `packages/core/src/lib/events/paint-entry.ts`
- Create: `packages/core/src/lib/events/hit-test.test.ts`
- Modify: `packages/core/src/lib/events/hit-test.ts`
- Modify: `packages/core/src/lib/events/registrations.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/focus/geometry.ts`

**Interfaces:**

- Consumes: current `CRCEventTargetRegistration`, Canvas path geometry, `CRCInstance.paintEntries`, Layer transforms/clips/bounds, and `isHit`.
- Produces:

```ts
export const enum CRCHitDisposition {
  Miss = 0,
  Block = 1,
  Target = 2,
}

export interface CRCHitTestInput {
  rootX: number;
  rootY: number;
}

export interface CRCHitTestOutput {
  disposition: CRCHitDisposition;
  target: CRCEventTargetRegistration | null;
}

export const enum CRCPaintEntryKind {
  Path = 0,
  NestedInstance = 1,
  Resolver = 2,
}
```

- `CRCPathPaintEntry` carries a target plus Path2D, fill/stroke, transform, and clipping data.
- `CRCNestedPaintEntry` carries a child instance, bounds, transform, clips, and either recursive Canvas resolution or one local backend resolver.
- `resolveCoordinateHit(eventRoot, input, output): CRCHitTestOutput` mutates and returns the supplied output; the existing `resolveCoordinateTarget` wrapper copies x/y into event-root-owned scratch and returns only a target for event dispatch.

- [ ] **Step 1: Write failing resolver-order and allocation tests**

In `hit-test.test.ts`, build three entries in paint order and assert exact output mutation:

```ts
const input = { rootX: 12, rootY: 18 };
const output = { disposition: CRCHitDisposition.Target, target: staleTarget };
resolveCoordinateHit(eventRoot, input, output);
expect(output).toEqual({
  disposition: CRCHitDisposition.Block,
  target: null,
});
expect(lowerResolver).not.toHaveBeenCalled();
```

Cover upper miss continuing to a lower target, upper block stopping without dispatch, upper target stopping with identity, nested Canvas Layer transform/clip composition, and a resolver callback receiving the mapped local point. Spy on the result factory and assert one output object for the entire root lookup.

- [ ] **Step 2: Run the focused resolver test and confirm the missing protocol failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/hit-test.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `paint-entry.ts`, the numeric dispositions, and `resolveCoordinateHit` do not exist.

- [ ] **Step 3: Separate logical targets from Canvas path paint entries**

Keep `CRCEventTargetRegistration.kind === "target"` for propagation. Move path-only fields into `CRCPathPaintEntry`, and give each target at most one stable Canvas entry:

```ts
interface CRCEventTargetRegistration {
  readonly kind: "target";
  readonly owner: CRCInstance;
  readonly component: CRCComponentRefs<any>;
  readonly publicTarget: CRCEventTarget;
  paintEntry: CRCPathPaintEntry | undefined;
  handlers: CRCNormalizedHandlers;
  cursor: string | undefined;
  keyboardFocusable: boolean | undefined;
  keyboardNavigationBounds: Readonly<LayoutBox> | undefined;
  live: boolean;
}
```

Update and release remove the prior paint entry before mutating it, refresh its source-order Set position, and keep `eventRoot.targets` as the liveness authority.

- [ ] **Step 4: Implement centralized numeric dispatch with borrowed output**

Reset both fields before every candidate and dispatch on `entry.paintKind`. Path entries call `isHit`; nested Canvas entries recurse; backend entries run their synchronous local resolver. Use `try/finally` around temporary mapped coordinates and clipping state. `Miss` continues, while `Block` and `Target` return immediately.

- [ ] **Step 5: Generalize focus bridge lookup**

Replace `findLayerBridge` with a nested-instance lookup whose entry exposes `instance` and `transform`. Projected focus bounds must compose through either Canvas Layer or a future WebGL resolver without inspecting backend-specific state.

- [ ] **Step 6: Run event, Layer, focus, and pointer regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/events/hit-test.test.ts packages/core/src/lib/events/mouse-dispatch.test.ts packages/core/src/lib/events/pointer-events.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/focus/directional-navigation.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS with current opt-in target behavior preserved.

- [ ] **Step 7: Commit the resolver protocol**

```bash
git add packages/core/src/lib/events/paint-entry.ts packages/core/src/lib/events/hit-test.test.ts packages/core/src/lib/events/hit-test.ts packages/core/src/lib/events/registrations.ts packages/core/src/lib/types.ts packages/core/src/lib/components/layer.ts packages/core/src/lib/focus/geometry.ts
git commit -m "refactor(core): unify coordinate hit resolution"
```

### Task 2: Default Canvas drawing participation and explicit opt-out

**Files:**

- Create: `packages/core/src/lib/hooks/crc-paint-target.ts`
- Modify: `packages/core/src/lib/events/types.ts`
- Modify: `packages/core/src/lib/events/registrations.ts`
- Modify: `packages/core/src/lib/util/wire-common-events.ts`
- Modify: `packages/core/src/lib/components/{arc,circle,ellipse,horizontal-line,img,line,path,polygon,rect,regular-polygon,star,svg-path,text,vertical-line,wedge}.ts`
- Modify: `packages/core/src/lib/components/event-integration.test.ts`
- Modify: `packages/core/src/lib/events/pointer-events.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/type-tests/final-public-vocabulary.tsx`

**Interfaces:**

- Produces public `CRCPointerEvents = "auto" | "none"` and `CRCEventParticipationOptions { pointerEvents?: CRCPointerEvents }`.
- Every Canvas drawing prop interface extends `CRCEventParticipationOptions`.
- `crcEventTarget()` retains its explicit custom-hook behavior; `crcPaintTarget()` is internal and keeps a geometry-bearing built-in live when `pointerEvents !== "none"`.

- [ ] **Step 1: Write failing passive-occlusion tests**

Render a clickable rear rectangle and a handler-free front `Star`; click their overlap and assert the rear handler remains untouched. Rerender the star with `pointerEvents="none"` and assert the same click reaches the rectangle. Add a `Group` transform, `Clip`, and nested `Layer` case to prove existing geometry—not rectangular allocation—controls the result.

```tsx
<>
  <Rectangle style={rearStyle} onClick={rearClick} />
  <Star style={frontStyle} />
</>
```

- [ ] **Step 2: Run the public interaction tests and confirm click-through currently occurs**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/event-integration.test.ts packages/core/src/lib/events/pointer-events.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the passive front primitive is removed from `paintEntries`.

- [ ] **Step 3: Add the built-in paint-target hook**

Implement one stable hook slot:

```ts
export function crcPaintTarget(
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
  pointerEvents: CRCPointerEvents = "auto",
): CRCEventTargetSnapshot {
  // create once; update with forcePaintParticipation when auto
}
```

`updateTargetRegistration` receives an internal `participatesInPaint` boolean. A passive built-in is live and enters `eventRoot.targets` plus `paintEntries`, but acquires no native event types unless its handlers, cursor, focus, or an ancestor listener require them. `none` releases hover, capture, focus observation, cursor ownership, and its paint entry exactly as target removal does.

- [ ] **Step 4: Route every drawing primitive through the new policy**

Pass `props.pointerEvents` through `wireCommonEvents`. Update Text to build its bounds whenever `pointerEvents !== "none"` even without handlers:

```ts
const textBounds = props.pointerEvents === "none" ? undefined : new Path2D();
```

Keep empty/move-only paths geometrically inert through `fill === false` and zero interaction width. Keep Image's resolved rectangle behavior even while decode is pending; its declared geometry, not decoded alpha, controls participation.

- [ ] **Step 5: Add type evidence for every built-in and invalid values**

In `final-public-vocabulary.tsx`, use `pointerEvents="none"` on Rectangle, Text, Image, one line, and one generated shape, then retain `@ts-expect-error` cases for `pointerEvents="painted"` and numeric values.

- [ ] **Step 6: Run focused behavior, typecheck, and lifecycle tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/event-integration.test.ts packages/core/src/lib/events/pointer-events.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/img-async.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: all selected suites and typecheck PASS.

- [ ] **Step 7: Commit default drawing participation**

```bash
git add packages/core/src/lib/hooks/crc-paint-target.ts packages/core/src/lib/events/types.ts packages/core/src/lib/events/registrations.ts packages/core/src/lib/util/wire-common-events.ts packages/core/src/lib/components/arc.ts packages/core/src/lib/components/circle.ts packages/core/src/lib/components/ellipse.ts packages/core/src/lib/components/horizontal-line.ts packages/core/src/lib/components/img.ts packages/core/src/lib/components/line.ts packages/core/src/lib/components/path.ts packages/core/src/lib/components/polygon.ts packages/core/src/lib/components/rect.ts packages/core/src/lib/components/regular-polygon.ts packages/core/src/lib/components/star.ts packages/core/src/lib/components/svg-path.ts packages/core/src/lib/components/text.ts packages/core/src/lib/components/vertical-line.ts packages/core/src/lib/components/wedge.ts packages/core/src/lib/components/event-integration.test.ts packages/core/src/lib/events/pointer-events.test.ts packages/core/src/index.ts packages/core/type-tests/final-public-vocabulary.tsx
git commit -m "feat(core): make painted primitives occlude by default"
```

### Task 3: Structural event listeners without structural hit boxes

**Files:**

- Create: `packages/core/src/lib/components/structural-events.ts`
- Create: `packages/core/src/lib/components/structural-events.test.tsx`
- Modify: `packages/core/src/lib/components/{g,clip,layer}.ts`
- Modify: `packages/core/src/lib/layout/{absolute,overlay,flow,flex,grid}.ts`
- Modify: `packages/core/src/lib/components/{g,clip,layer}.test.ts`
- Modify: `packages/core/src/lib/layout/layout-jsx.test.tsx`

**Interfaces:**

- `CRCStructuralEventProps extends CRCEventHandlers` is shared by all child-bearing built-ins.
- `wireStructuralEvents(handlers): void` always calls exactly one `crcEventListener` hook, even when the current handler map is empty.

- [ ] **Step 1: Write failing ancestor and empty-space tests**

Cover Canvas Group, Clip, Layer, Absolute, Overlay, Flow, Flex, and Grid. For each, clicking a descendant shape must dispatch target then ancestor; clicking an unpainted part of the container allocation must not dispatch the ancestor and may reach an unrelated lower branch.

```tsx
<Group onClick={groupClick}>
  <Star style={starStyle} />
</Group>
```

Also rerender a container from no handler to a handler and back to prove stable hook order and exact listener cleanup.

- [ ] **Step 2: Run the focused structural suite and confirm prop/type failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/structural-events.test.tsx packages/core/src/lib/layout/layout-jsx.test.tsx --browser.headless --browser.ui=false
```

Expected: FAIL because structural built-ins neither accept nor register handlers.

- [ ] **Step 3: Register listeners inside every structural render function**

Call `wireStructuralEvents(props)` before returning or placing children. Do not create a Path2D, target, bounds, cursor region, or focus candidate for the container. Preserve each component's existing transform, clip, layout, filter, and child materialization order.

- [ ] **Step 4: Run propagation, layout, filter, and Layer regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/structural-events.test.tsx packages/core/src/lib/events/propagation.test.ts packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/layout/layout-jsx.test.tsx packages/core/src/lib/filter/filter-integration.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS and empty structural space contributes zero targets.

- [ ] **Step 5: Commit structural propagation props**

```bash
git add packages/core/src/lib/components/structural-events.ts packages/core/src/lib/components/structural-events.test.tsx packages/core/src/lib/components/g.ts packages/core/src/lib/components/clip.ts packages/core/src/lib/components/layer.ts packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/layout/absolute.ts packages/core/src/lib/layout/overlay.ts packages/core/src/lib/layout/flow.ts packages/core/src/lib/layout/flex.ts packages/core/src/lib/layout/grid.ts packages/core/src/lib/layout/layout-jsx.test.tsx
git commit -m "feat(core): propagate events through structural components"
```

### Task 4: Backend-neutral traversal through the existing core friend entry

**Files:**

- Modify: `packages/core/src/internal.ts`
- Create: `packages/core/src/lib/backend/types.ts`
- Create: `packages/core/src/lib/backend/canvas-2d-backend.ts`
- Create: `packages/core/src/lib/backend/backend-dispatch.test.tsx`
- Modify: `packages/core/src/lib/{define-primitive,render,execute-render,mount-crc,global-state,types}.ts`
- Modify: `packages/core/src/lib/element/metadata.ts`
- Modify: `packages/core/src/lib/hooks/{hook-slot,crc-canvas-context}.ts`
- Modify: `packages/core/src/lib/components/layer-node-equality.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/tsconfig.build.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `tooling/assert-built-core.ts`
- Modify: `playground/package-consumer/{index.ts,runtime.mjs,tsconfig.bundler.json,tsconfig.nodenext.json}`

**Interfaces:**

- Extends the existing `@crc/core/internal` renderer-scheduler friend entry with an opaque `CRCBackendToken`, `CRCBackendDriver<E>`, `CRCBackendFrame<E>`, `CRCBackendPrimitiveDefinition`, `defineBackendPrimitive`, `mountBackendCRC`, `executeBackendCRC`, `getBackendEnvironment`, `getCurrentFrameTimestamp`, `requestCurrentInstanceFrame`, `useInternalHookSlot`, `useBackendEventTarget`, `setCurrentComponentAfterRender`, `registerNestedInteractionResolver`, `snapshotLayerNodeTree`, and `haveSameLayerNodeTree`.
- The core root uses `CANVAS_2D_BACKEND`; official sibling packages create private tokens through `createBackendToken("webgl2")`.

```ts
export interface CRCBackendFrameInput {
  readonly canvas: Canvas;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly renderTimestamp: number;
}

export interface CRCBackendFrame<E> {
  readonly environment: E;
  readonly context2D?: RenderingContext2D;
  readonly renderTarget?: RenderTargetSnapshot;
  readonly worldBaseTransform?: DOMMatrix;
}

export interface CRCBackendPrimitiveInput {
  readonly componentName: string;
  readonly source?: CRCElementSource;
  readonly definition: CRCBackendPrimitiveDefinition;
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
}

export interface CRCBackendMount {
  readonly canvas: Canvas;
  render(root: CRCNode, timestamp: number): void;
  requestFrame(updateParents: boolean): void;
  dispose(): void;
}

export interface CRCBackendDriver<E> {
  readonly token: CRCBackendToken;
  readonly name: string;
  beginFrame(input: CRCBackendFrameInput): CRCBackendFrame<E> | undefined;
  enterComponent(frame: CRCBackendFrame<E>): () => void;
  runPrimitive(
    frame: CRCBackendFrame<E>,
    input: CRCBackendPrimitiveInput,
    runProgram: (invoke: () => CRCNode | void) => void,
  ): void;
  finishFrame(frame: CRCBackendFrame<E>, success: boolean): void;
  dispose(): void;
}

export interface CRCNestedResolverInput {
  readonly child: CRCBackendMount;
  readonly bounds: Path2D;
  readonly pointerEvents: "auto" | "none";
  resolveLocal(localX: number, localY: number, output: CRCHitTestOutput): void;
}
```

- [ ] **Step 1: Write failing backend dispatch and restoration tests**

Create a test backend whose counters record begin, enter, primitive, finish, and dispose. Mount a private instance, render a keyed stateful component once, rerender it, and assert identity is retained. Throw from a primitive and assert `finishFrame(..., false)`, component teardowns, global backend/environment, layout stack, and parent globals restore exactly.

- [ ] **Step 2: Run the backend test and confirm the friend APIs are absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/backend/backend-dispatch.test.tsx --browser.headless --browser.ui=false
```

Expected: FAIL on the missing backend modules and backend traversal friend APIs.

- [ ] **Step 3: Move Canvas-specific frame behavior behind the driver**

Extract the current `prepareSurface`, 2D context acquisition, transform, clear, save/restore, primitive presentation, and filter boundary behavior into `canvas-2d-backend.ts`. Keep component scope preparation, hook finalization, enhancer enter/exit, child materialization, identity, unseen-ref teardown, and render transaction handling in common core traversal.

For a primitive backend mismatch, throw an error containing both names:

```text
Cube requires the webgl2 backend and cannot render in the canvas2d root. Place it under <WebGLLayer>.
```

Canvas primitives under WebGL name the Canvas primitive and explain that Canvas 2D children inside an island are unsupported.

- [ ] **Step 4: Add internal mount and scheduling hooks**

`mountBackendCRC(canvas, root, { parent, logicalWidth, logicalHeight, driver })` registers the private instance in the same `GLOBAL_STATE.crcInstances`, shares the parent's event root, and sets `interactionRoot`. Its `requestCurrentInstanceFrame(true)` adapter delegates to `crcInternalRequestRendererWork` so stale callbacks, realm scheduler coalescing, disposal, and parent scheduling keep one implementation.

- [ ] **Step 5: Extend only the reviewed friend list**

Extend the existing `@crc/core/internal` source and declaration entry with the
reviewed backend traversal APIs. Do not create another package entry, build
input, or scheduler singleton.

Update packed runtime evidence so `@crc/core/internal` resolves, while `@crc/core/lib/types`, `@crc/core/src/index`, and other undeclared subpaths still fail. Do not re-export `GLOBAL_STATE`, raw registries, `update`, or source-only implementation classes.

- [ ] **Step 6: Run core traversal, hooks, filters, Layer, and package-consumer gates**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/backend/backend-dispatch.test.tsx packages/core/src/lib/component-dispatch.test.tsx packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:package-consumer
```

Expected: all selected suites, typecheck, and source-package consumer PASS.

- [ ] **Step 7: Commit the backend friend seam**

```bash
git add packages/core/src/internal.ts packages/core/src/lib/backend/types.ts packages/core/src/lib/backend/canvas-2d-backend.ts packages/core/src/lib/backend/backend-dispatch.test.tsx packages/core/src/lib/define-primitive.ts packages/core/src/lib/render.ts packages/core/src/lib/execute-render.ts packages/core/src/lib/mount-crc.ts packages/core/src/lib/global-state.ts packages/core/src/lib/types.ts packages/core/src/lib/element/metadata.ts packages/core/src/lib/hooks/hook-slot.ts packages/core/src/lib/hooks/crc-canvas-context.ts packages/core/src/lib/components/layer-node-equality.ts packages/core/package.json packages/core/tsconfig.build.json tsconfig.json vitest.config.ts tooling/assert-built-core.ts playground/package-consumer/index.ts playground/package-consumer/runtime.mjs playground/package-consumer/tsconfig.bundler.json playground/package-consumer/tsconfig.nodenext.json
git commit -m "feat(core): expose official renderer friend seam"
```

### Task 5: WebGL package, immutable geometry, and camera math

**Files:**

- Create: `packages/webgl/package.json`
- Create: `packages/webgl/tsconfig.build.json`
- Create: `packages/webgl/README.md`
- Create: `packages/webgl/src/index.ts`
- Create: `packages/webgl/src/lib/types.ts`
- Create: `packages/webgl/src/lib/math/{matrix4,camera,ray}.ts`
- Create: `packages/webgl/src/lib/math/{matrix4,camera,ray}.test.ts`
- Create: `packages/webgl/src/lib/geometry/{geometry,cube,sphere}.ts`
- Create: `packages/webgl/src/lib/geometry/{geometry,cube,sphere}.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

**Interfaces:**

```ts
export type CRCWebGLVector3 = readonly [x: number, y: number, z: number];

export interface CRCWebGLPerspectiveCamera {
  type: "perspective";
  position: CRCWebGLVector3;
  lookAt: CRCWebGLVector3;
  up: CRCWebGLVector3;
  fieldOfViewDegrees: number;
  near: number;
  far: number;
}

export interface CRCWebGLCameraSnapshot {
  readonly descriptor: CRCWebGLPerspectiveCamera;
  readonly aspect: number;
  readonly viewMatrix: Readonly<Float32Array>;
  readonly projectionMatrix: Readonly<Float32Array>;
  readonly projectionViewMatrix: Readonly<Float32Array>;
  readonly inverseProjectionViewMatrix: Readonly<Float32Array>;
}

export interface CRCWebGLGeometryInput {
  positions: ArrayLike<number>;
  indices?: ArrayLike<number>;
}

declare const crcWebGLGeometryBrand: unique symbol;

export interface CRCWebGLGeometry {
  readonly [crcWebGLGeometryBrand]: true;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export function createWebGLGeometry(
  input: CRCWebGLGeometryInput,
): CRCWebGLGeometry;
```

- Internal geometry access returns copied `Float32Array` positions and `Uint32Array | undefined` indices without exposing them publicly.
- Internal `resolveCamera(camera, width, height)` returns frozen view, projection, projection-view, inverse projection-view, viewport, and generation-comparable scalar data.
- [ ] **Step 1: Write failing geometry validation and immutability tests**

Assert nonempty finite XYZ positions; non-indexed vertex count divisible by three; optional integer indices divisible by three and in range; defensive copies; frozen descriptor; cube bounds `[-0.5, 0.5]`; sphere radius `0.5`; deterministic sphere counts and indices.

- [ ] **Step 2: Write failing camera, matrix, and ray tests**

Cover every invalid camera rule, the exact omitted-camera values, aspect from `width / height`, unit cube visibility, `T * Rz * Ry * Rx * S`, negative/nonzero scales, matrix inversion, center-screen ray toward negative Z, corner unprojection, and Möller–Trumbore triangle distances.

- [ ] **Step 3: Run the new package tests and confirm missing-package failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/geometry/cube.test.ts packages/webgl/src/lib/geometry/sphere.test.ts packages/webgl/src/lib/math/matrix4.test.ts packages/webgl/src/lib/math/camera.test.ts packages/webgl/src/lib/math/ray.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `packages/webgl` does not exist.

- [ ] **Step 4: Add the version-locked package and build**

Use package version `0.0.1`, peer dependency `"@crc/core": "0.0.1"`, sideEffects false, and one root export. Add `"@crc/webgl": "workspace:*"` to the root dev dependencies. Build declarations with `tsc`, then bundle `src/index.ts` with esbuild while marking both `@crc/core` and `@crc/core/internal` external. Do not declare React or `@crc/types` as a WebGL dependency.

- [ ] **Step 5: Implement finite column-major math and immutable triangles**

Use allocation-free destination parameters for hot matrix/vector operations. Camera validation throws `WebGLLayer camera.<field> ...`; geometry validation throws `createWebGLGeometry <field> ...`. Copy caller arrays before returning the branded descriptor.

- [ ] **Step 6: Run package tests, typecheck, and build**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/geometry/cube.test.ts packages/webgl/src/lib/geometry/sphere.test.ts packages/webgl/src/lib/math/matrix4.test.ts packages/webgl/src/lib/math/camera.test.ts packages/webgl/src/lib/math/ray.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 --filter @crc/webgl build
```

Expected: all selected tests, typecheck, and the WebGL package build PASS.

- [ ] **Step 7: Commit the package foundation**

```bash
git add packages/webgl/package.json packages/webgl/tsconfig.build.json packages/webgl/README.md packages/webgl/src/index.ts packages/webgl/src/lib/types.ts packages/webgl/src/lib/math/matrix4.ts packages/webgl/src/lib/math/matrix4.test.ts packages/webgl/src/lib/math/camera.ts packages/webgl/src/lib/math/camera.test.ts packages/webgl/src/lib/math/ray.ts packages/webgl/src/lib/math/ray.test.ts packages/webgl/src/lib/geometry/geometry.ts packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/geometry/cube.ts packages/webgl/src/lib/geometry/cube.test.ts packages/webgl/src/lib/geometry/sphere.ts packages/webgl/src/lib/geometry/sphere.test.ts package.json tsconfig.json vitest.config.ts pnpm-lock.yaml
git commit -m "feat(webgl): add geometry and camera foundation"
```

### Task 6: WebGL primitive protocol, render environment, and Group3D

**Files:**

- Create: `packages/webgl/src/lib/define-webgl-primitive.ts`
- Create: `packages/webgl/src/lib/define-webgl-primitive.test.tsx`
- Create: `packages/webgl/src/lib/render-environment.ts`
- Create: `packages/webgl/src/lib/backend.ts`
- Create: `packages/webgl/src/lib/gpu/state.ts`
- Create: `packages/webgl/src/lib/gpu/state.test.ts`
- Create: `packages/webgl/src/lib/hooks/crc-webgl-context.ts`
- Create: `packages/webgl/src/lib/hooks/crc-webgl-context.test.tsx`
- Create: `packages/webgl/src/lib/components/group-3d.ts`
- Create: `packages/webgl/src/lib/components/group-3d.test.tsx`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/index.ts`

**Interfaces:**

- `defineWebGLPrimitive(render, capabilities)` registers against one package-private WebGL backend token through `defineBackendPrimitive`.
- Capabilities are a discriminated union whose `hit` is `{ kind: "geometry"; resolve(...) }`, `{ kind: "custom"; resolve(...) }`, or `{ kind: "none" }`; a paint-capable definition without one discriminator is a type and runtime error.
- `crcWebGLContext(): CRCWebGLContext` returns `gl`, camera matrices, model matrix, logical/backing viewport, density, timestamp, and component-owned resource operations only during WebGL primitive rendering.
- `CRCWebGLTransformStyle` implements finite translate/rotate/scale fields with `T * Rz * Ry * Rx * S` and nonzero scales.

```ts
export type CRCWebGLPrimitiveRender<P, S> = (
  props: Readonly<P>,
  style: Readonly<S>,
  context: CRCWebGLContext,
) => CRCNode | void;

export type CRCWebGLHitCapability<P, S> =
  | {
      readonly kind: "geometry";
      geometry(props: Readonly<P>, style: Readonly<S>): CRCWebGLGeometry;
    }
  | {
      readonly kind: "custom";
      resolve(input: CRCWebGLPrimitiveHitInput<P, S>): number | null;
    }
  | { readonly kind: "none" };

export interface CRCWebGLPrimitiveCapabilities<P, S, N, R> {
  readonly normalizeStyle?: (style: Readonly<S>) => Readonly<N>;
  readonly resolveStyle?: (
    style: Readonly<N>,
    context: Readonly<StyleResolutionContext>,
  ) => Readonly<R>;
  readonly hit: CRCWebGLHitCapability<P, R>;
}

export type CRCWebGLProgramProps<
  P,
  H extends CRCWebGLHitCapability<P, any>,
> = H extends { readonly kind: "none" }
  ? P & { readonly pointerEvents?: "none" }
  : P & CRCEventHandlers & CRCEventFocusOptions & CRCEventParticipationOptions;

export type CRCWebGLPrimitiveInput<
  P,
  S extends SystemStyle,
  H extends CRCWebGLHitCapability<P, any>,
> = PrimitiveInput<CRCWebGLProgramProps<P, H>, S>;

export interface CRCWebGLContext {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly camera: CRCWebGLCameraSnapshot;
  readonly modelMatrix: Readonly<Float32Array>;
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly backingViewport: Readonly<{ width: number; height: number }>;
  readonly density: Readonly<{ x: number; y: number }>;
  readonly timestamp: number;
  readonly resources: {
    use<T>(
      create: (gl: WebGL2RenderingContext) => T,
      release: (
        value: T,
        context: Readonly<{
          gl: WebGL2RenderingContext;
          contextLost: boolean;
        }>,
      ) => void,
      deps: readonly unknown[],
    ): T;
  };
}

export interface CRCWebGLPrimitiveHitInput<P, S> {
  readonly props: Readonly<P>;
  readonly style: Readonly<S>;
  readonly layerX: number;
  readonly layerY: number;
  readonly ndcX: number;
  readonly ndcY: number;
  readonly rayOrigin: CRCWebGLVector3;
  readonly rayDirection: CRCWebGLVector3;
  readonly modelMatrix: Readonly<Float32Array>;
  readonly camera: CRCWebGLCameraSnapshot;
}

export function defineWebGLPrimitive<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  H extends CRCWebGLHitCapability<P, R> = CRCWebGLHitCapability<P, R>,
>(
  render: CRCWebGLPrimitiveRender<P, R>,
  capabilities: CRCWebGLPrimitiveCapabilities<P, S, N, R> & { hit: H },
): CRCPrimitiveComponent<
  CRCWebGLProgramProps<P, H>,
  CRCWebGLPrimitiveInput<P, S, H>
>;
```

`resources.use(...)` is an ordered CRC hook: it prepends `contextGeneration` to dependencies, releases the previous value before replacement, and registers final component teardown. Its release context reports whether the GL context was lost so custom cleanup can avoid assuming valid handles. A custom hit resolver returns a finite nonnegative ray distance or `null`; layer/NDC fields permit analytic or projected-Path2D broad phases. Resource and hit callbacks must not retain render-environment scratch.

- [ ] **Step 1: Write failing protocol and backend-mismatch tests**

Define geometry-backed, custom-hit, and decorative primitives. Assert missing hit capability is rejected, decorative input accepts only `pointerEvents="none"`, duplicate/core brands are not created, Canvas use names `<WebGLLayer>`, and Canvas primitives in a WebGL child name the unsupported backend boundary. Prove WebGL child styles reject core `filter` at type level and report an actionable runtime error if an untyped caller smuggles one through.

- [ ] **Step 2: Write failing state-baseline and context-hook tests**

Use a recording WebGL2 double. Mutate program, VAO, buffers, textures, framebuffer, viewport/scissor, masks, blend/depth/cull/stencil/polygon-offset, clear, and pixel-store state in one primitive; assert the next primitive sees the documented baseline. Throw in the first callback and assert baseline restoration still occurs. Assert `crcWebGLContext` errors outside WebGL render, under Canvas 2D, and during measurement. Exercise `resources.use` across equal deps, changed deps, context generation, component removal, and lost context; assert one acquire and one matching release for every generation.

- [ ] **Step 3: Run focused tests and confirm missing APIs**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/define-webgl-primitive.test.tsx packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/hooks/crc-webgl-context.test.tsx packages/webgl/src/lib/components/group-3d.test.tsx --browser.headless --browser.ui=false
```

Expected: FAIL on missing WebGL primitive registration and environment modules.

- [ ] **Step 4: Implement the backend token and explicit baseline**

Create one token at module initialization. `beginFrame` clears transparent color and depth; `enterComponent` installs known framework state; `finally` reinstalls it using assignments rather than `getParameter()`. Include framebuffer, viewport/scissor, program, VAO/buffers, active texture/bindings, masks, blend/depth/cull/stencil/polygon-offset, clear values, and pixel-store values.

- [ ] **Step 5: Implement model-stack and Group3D listener behavior**

`Group3D` validates style, calls public `crcEventListener`, pushes the composed model matrix, registers the pop through `setCurrentComponentAfterRender`, returns children, and pops exactly once. It creates no draw or pick record and has no conceptual bounds.

- [ ] **Step 6: Run protocol, state, context, Group3D, and core dispatch suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/define-webgl-primitive.test.tsx packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/hooks/crc-webgl-context.test.tsx packages/webgl/src/lib/components/group-3d.test.tsx packages/core/src/lib/backend/backend-dispatch.test.tsx --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 7: Commit the WebGL primitive backend**

```bash
git add packages/webgl/src/lib/define-webgl-primitive.ts packages/webgl/src/lib/define-webgl-primitive.test.tsx packages/webgl/src/lib/render-environment.ts packages/webgl/src/lib/backend.ts packages/webgl/src/lib/gpu/state.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/hooks/crc-webgl-context.ts packages/webgl/src/lib/hooks/crc-webgl-context.test.tsx packages/webgl/src/lib/components/group-3d.ts packages/webgl/src/lib/components/group-3d.test.tsx packages/webgl/src/lib/types.ts packages/webgl/src/index.ts
git commit -m "feat(webgl): define the WebGL render backend"
```

### Task 7: WebGLLayer surface, bitmap transaction, and Canvas composition

**Files:**

- Create: `packages/webgl/src/lib/components/webgl-layer.ts`
- Create: `packages/webgl/src/lib/components/webgl-layer.test.tsx`
- Create: `packages/webgl/src/lib/layer-controller.ts`
- Create: `packages/webgl/src/lib/layer-controller.test.ts`
- Modify: `packages/webgl/src/lib/backend.ts`
- Modify: `packages/webgl/src/lib/render-environment.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/index.ts`

**Interfaces:**

```ts
export interface WebGLLayerProps extends CRCEventHandlers {
  children: CRCNode;
  camera?: CRCWebGLPerspectiveCamera;
  pointerEvents?: "auto" | "none";
}

export interface WebGLLayerStyle extends BoxStyle, LayoutItemStyle {}
```

- `WebGLLayerController` owns the OffscreenCanvas, WebGL2 context, private CRC controller/instance, pending candidate, committed bitmap/ledger generation, context generation, and interaction bridge.
- `renderUpdatedChild(root, camera, surface, timestamp)` creates a candidate bitmap/ledger; `composite(ctx, destination)` draws and commits a candidate only after `drawImage` returns; `dispose()` is idempotent.

- [ ] **Step 1: Write failing surface and capability tests**

Assert default logical dimensions use current allocation, backing dimensions multiply X/Y density once with core rounding, and context acquisition uses the exact attributes. Cover absent OffscreenCanvas, absent WebGL2, missing `transferToImageBitmap`, invalid dimensions, and returned attributes without alpha/depth; every error names `WebGLLayer` before child execution.

- [ ] **Step 2: Write failing bitmap transaction tests**

Record this order for an updated island:

```ts
expect(calls).toEqual([
  "child-render",
  "transfer-to-image-bitmap",
  "parent-draw-image",
  "commit-generation",
  "close-previous-bitmap",
]);
```

Make child render, transfer, and parent draw fail independently. Assert a candidate closes on failure, the old committed pair stays owned until fail-closed teardown, no incomplete pick ledger becomes live, and disposal closes the remaining bitmap once.

- [ ] **Step 3: Run focused layer tests and confirm the component is absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/components/webgl-layer.test.tsx packages/webgl/src/lib/layer-controller.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `WebGLLayer` and its controller do not exist.

- [ ] **Step 4: Implement the private child and parent bridge**

Materialize children once, wrap them in one keyed private Fragment root, mount with `mountBackendCRC`, assign the parent's current component as `eventParent`, and install one `CRCNestedPaintEntry` at the exact Canvas composite position. Capture current world transform, full clipping stack, and a Path2D of only the layer bounds. `pointerEvents="none"` omits the nested entry while painting continues.

- [ ] **Step 5: Implement candidate transfer and synchronous composition**

After successful child traversal call `transferToImageBitmap()`, pair it with the completed transient pick ledger, then draw source backing dimensions to logical destination dimensions. Commit the pair only after `drawImage` returns. Apply receiving `style.filter`, Canvas Group transforms, Clip, Layer density, and parent composition through the existing Canvas primitive/filter path.

- [ ] **Step 6: Run surface, filter, Layer, and transaction tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/components/webgl-layer.test.tsx packages/webgl/src/lib/layer-controller.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 7: Commit the WebGL island boundary**

```bash
git add packages/webgl/src/lib/components/webgl-layer.ts packages/webgl/src/lib/components/webgl-layer.test.tsx packages/webgl/src/lib/layer-controller.ts packages/webgl/src/lib/layer-controller.test.ts packages/webgl/src/lib/backend.ts packages/webgl/src/lib/render-environment.ts packages/webgl/src/lib/types.ts packages/webgl/src/index.ts
git commit -m "feat(webgl): composite WebGL islands into Canvas"
```

### Task 8: GPU resources and Mesh, Cube, and Sphere rendering

**Files:**

- Create: `packages/webgl/src/lib/gpu/{program,resources}.ts`
- Create: `packages/webgl/src/lib/gpu/{program,resources}.test.ts`
- Create: `packages/webgl/src/lib/components/{mesh,cube,sphere}.ts`
- Create: `packages/webgl/src/lib/components/{mesh,cube,sphere}.test.tsx`
- Modify: `packages/webgl/src/lib/backend.ts`
- Modify: `packages/webgl/src/lib/render-environment.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/index.ts`

**Interfaces:**

- `MeshProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions { geometry: CRCWebGLGeometry }`.
- `MeshStyle extends CRCWebGLTransformStyle { color?: string; opacity?: number; cursor?: string }`.
- `CubeStyle` adds finite positive `size?: number` defaulting to `1`; `SphereStyle` adds finite positive `radius?: number` defaulting to `0.5`.
- The built-in shader accepts model, view, projection, solid RGBA, and position attributes; no lights, normals, textures, or material graph.

- [ ] **Step 1: Write failing shader/resource ownership tests**

Assert compile/link logs name component and stage, failed intermediates are deleted, geometry uploads once per context generation, two components share one geometry/program cache with two leases, the final release deletes handles once, and no handle crosses contexts.

- [ ] **Step 2: Write failing primitive draw tests**

Render one transformed Mesh, Cube, and Sphere. Assert one source-order draw per primitive, depth enabled, `LEQUAL` tie behavior, culling disabled, transparent black clear, color default white, opacity default one, and exact model matrices. Assert opacity zero still draws and preserves pick eligibility for the later picking task.

- [ ] **Step 3: Run focused GPU and primitive tests and confirm missing implementations**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu/program.test.ts packages/webgl/src/lib/gpu/resources.test.ts packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/components/cube.test.tsx packages/webgl/src/lib/components/sphere.test.tsx --browser.headless --browser.ui=false
```

Expected: FAIL on missing GPU program/resource and primitive modules.

- [ ] **Step 4: Implement the unlit built-in pipeline**

Normalize concrete colors through a small Canvas 2D color parser owned by the WebGL package, convert to RGBA, multiply alpha by opacity, bind every required state explicitly, upload immutable geometry, set matrices, and issue `drawElements` or `drawArrays`. Do not add lighting, texture, normals, blending-based hit semantics, or raw shader strings to built-in props.

Cube and Sphere use one canonical unit geometry per context. Apply `size` and `radius * 2` through their local model scale so prop changes do not create unbounded geometry descriptors or GPU buffers.

- [ ] **Step 5: Implement component-owned and context-owned leases**

Use core friend resource slots keyed by component hook identity and a `WebGLLayer` context-generation cache keyed by immutable geometry identity. Roll back partial acquisition in `finally`; component/key/type removal releases its leases; driver disposal releases the remaining cache and program.

- [ ] **Step 6: Run GPU, primitive, backend, and lifecycle tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/components/cube.test.tsx packages/webgl/src/lib/components/sphere.test.tsx packages/webgl/src/lib/components/webgl-layer.test.tsx packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 7: Commit the built-in 3D primitives**

```bash
git add packages/webgl/src/lib/gpu/state.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/gpu/program.ts packages/webgl/src/lib/gpu/program.test.ts packages/webgl/src/lib/gpu/resources.ts packages/webgl/src/lib/gpu/resources.test.ts packages/webgl/src/lib/components/mesh.ts packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/components/cube.ts packages/webgl/src/lib/components/cube.test.tsx packages/webgl/src/lib/components/sphere.ts packages/webgl/src/lib/components/sphere.test.tsx packages/webgl/src/lib/backend.ts packages/webgl/src/lib/render-environment.ts packages/webgl/src/lib/types.ts packages/webgl/src/index.ts
git commit -m "feat(webgl): render mesh cube and sphere primitives"
```

### Task 9: Draw-matched WebGL picking in the global stack

**Files:**

- Create: `packages/webgl/src/lib/pick-ledger.ts`
- Create: `packages/webgl/src/lib/pick-ledger.test.ts`
- Create: `packages/webgl/src/lib/scene-picker.ts`
- Create: `packages/webgl/src/lib/scene-picker.test.ts`
- Modify: `packages/webgl/src/lib/define-webgl-primitive.ts`
- Modify: `packages/webgl/src/lib/render-environment.ts`
- Modify: `packages/webgl/src/lib/components/{mesh,cube,sphere,webgl-layer}.ts`
- Modify: `packages/webgl/src/lib/layer-controller.ts`
- Modify: `packages/core/src/lib/events/hit-test.test.ts`

**Interfaces:**

```ts
interface CRCWebGLPickRecord {
  readonly target: CRCEventTargetRegistration;
  readonly geometry: CRCWebGLGeometry;
  readonly model: Float32Array;
  readonly sourceOrder: number;
  readonly depthMode: "less-equal";
}
```

- `pickScene(ledger, camera, localX, localY, output)` writes core's shared `CRCHitTestOutput`.
- Geometry-backed custom primitives provide geometry/model; custom resolvers return a finite nonnegative ray distance or `null`; decorative primitives create no record.

- [ ] **Step 1: Write failing nearest-hit and transparent-background tests**

Cover center/corner rays, transformed/negative-scale geometry, miss, nearer object winning regardless of source order, later source winning an equal-depth tie, `pointerEvents="none"` skipping the front intersection, and opacity zero retaining geometry. Assert empty island pixels return `Miss` and lower Canvas content is considered.

- [ ] **Step 2: Write failing mixed Canvas/WebGL order tests**

Use a lower clickable Rectangle, WebGL cube, and later Canvas Star. Assert cube blocks the rectangle, transparent island background reaches it, and the star wins without invoking the WebGL picker. Set the star to `pointerEvents="none"` and assert the cube wins. Add two WebGLLayers around a Canvas primitive to prove the documented interleaving escape hatch.

- [ ] **Step 3: Run picker and mixed-order tests and confirm click-through failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/lib/scene-picker.test.ts packages/webgl/src/lib/components/webgl-layer.test.tsx packages/core/src/lib/events/hit-test.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the committed island has no scene picker or WebGL targets.

- [ ] **Step 4: Record target identity with draw state**

During the same primitive traversal that submits a draw, use `useBackendEventTarget` and append one pick record containing the stable target, immutable geometry, copied committed model matrix, source index, and supported depth mode. `pointerEvents="none"` appends nothing. Never derive records by traversing children again.

- [ ] **Step 5: Implement CPU ray resolution**

Map layer-local x/y to NDC, unproject one ray, transform it into each geometry's local space, intersect indexed or non-indexed triangles, transform the winning point back to camera/world depth, and write the nearest supported result. Reuse ray, vector, inverse-matrix, and output scratch. Do not call hooks, mutate state, retain core scratch, read pixels, or issue GL commands.

- [ ] **Step 6: Run picker, global event, Layer, and performance suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/lib/scene-picker.test.ts packages/webgl/src/lib/components/webgl-layer.test.tsx packages/core/src/lib/events/hit-test.test.ts packages/core/src/lib/events/pointer-events.test.ts packages/core/src/lib/components/layer.test.ts packages/core/test/event-performance.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS; default picking records zero `readPixels` calls and one borrowed core result.

- [ ] **Step 7: Commit unified WebGL picking**

```bash
git add packages/webgl/src/lib/pick-ledger.ts packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/lib/scene-picker.ts packages/webgl/src/lib/scene-picker.test.ts packages/webgl/src/lib/define-webgl-primitive.ts packages/webgl/src/lib/render-environment.ts packages/webgl/src/lib/components/mesh.ts packages/webgl/src/lib/components/cube.ts packages/webgl/src/lib/components/sphere.ts packages/webgl/src/lib/components/webgl-layer.ts packages/webgl/src/lib/layer-controller.ts packages/core/src/lib/events/hit-test.test.ts
git commit -m "feat(webgl): resolve 3D targets in global paint order"
```

### Task 10: Full event propagation, cursor, focus, and keyboard behavior

**Files:**

- Create: `packages/webgl/src/lib/events-integration.test.tsx`
- Modify: `packages/webgl/src/lib/components/{group-3d,mesh,cube,sphere,webgl-layer}.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.ts`
- Modify: `packages/webgl/src/lib/layer-controller.ts`
- Modify: `packages/core/src/lib/focus/geometry.ts`
- Modify: `packages/core/src/lib/focus/layer-focus-render.test.ts`
- Modify: `packages/core/src/lib/events/event-path.ts`

**Interfaces:**

- WebGL targets use the existing `CRCEventTargetRegistration` and therefore the existing event facade, propagation, related-target, pointer-capture, cursor, focus, activation, editing, clipboard, and drag/drop implementations.
- Automatic navigation bounds are the root-logical axis-aligned projection of a mesh's eight local geometry AABB corners through committed model, camera, layer viewport, and outer CRC bridge transforms. Explicit `keyboardNavigationBounds` overrides the automatic local layer rectangle.

- [ ] **Step 1: Write failing Group3D/WebGLLayer propagation tests**

Click a Cube nested under Group3D and WebGLLayer listeners. Assert root capture, layer capture, group capture, target capture, target, group bubble, and layer bubble order. Click empty layer/group space and assert neither structural listener fires. Remove the cube during capture and prove existing live-route mutation semantics remain intact.

- [ ] **Step 2: Write failing input-family and focus tests**

Drive pointer hover/down/up/capture, mouse click/context menu, touch, wheel, keyboard activation, focus transitions, clipboard, and drag/drop through one cube. Assert root-logical x/y, stable logical target identity, related targets, cursor changes, and capture release on removal. Under `FocusManagement` and `KeyboardNavigation`, assert projected cube/sphere bounds establish source-order Tab and directional movement.

- [ ] **Step 3: Run focused integration tests and confirm missing propagation metadata**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/events-integration.test.tsx packages/core/src/lib/focus/layer-focus-render.test.ts packages/core/src/lib/events/propagation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL where the WebGL bridge or projected navigation bounds are incomplete.

- [ ] **Step 4: Bridge ancestry and committed focus metadata**

Set the WebGL child instance's `eventParent` to the current WebGLLayer component before child traversal. Register Group3D and WebGLLayer handlers as listeners only. Store automatic projected navigation bounds in the same candidate generation as bitmap/picking, and replay them on cache hits through the existing focus-policy bridge.

- [ ] **Step 5: Run all event-family, focus, and WebGL integration suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/events-integration.test.tsx packages/core/src/lib/events/event-families.test.ts packages/core/src/lib/events/pointer-events.test.ts packages/core/src/lib/events/propagation.test.ts packages/core/src/lib/focus packages/core/test/focus-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 6: Commit complete WebGL event behavior**

```bash
git add packages/webgl/src/lib/events-integration.test.tsx packages/webgl/src/lib/components/group-3d.ts packages/webgl/src/lib/components/mesh.ts packages/webgl/src/lib/components/cube.ts packages/webgl/src/lib/components/sphere.ts packages/webgl/src/lib/components/webgl-layer.ts packages/webgl/src/lib/pick-ledger.ts packages/webgl/src/lib/layer-controller.ts packages/core/src/lib/focus/geometry.ts packages/core/src/lib/focus/layer-focus-render.test.ts packages/core/src/lib/events/event-path.ts
git commit -m "feat(webgl): integrate propagation focus and input events"
```

### Task 11: Animation, retained caching, and one-traversal scheduling

**Files:**

- Create: `packages/webgl/src/lib/hooks/crc-animation-frame.ts`
- Create: `packages/webgl/src/lib/hooks/crc-animation-frame.test.tsx`
- Create: `packages/webgl/src/lib/webgl-performance.test.tsx`
- Modify: `packages/webgl/src/lib/components/webgl-layer.ts`
- Modify: `packages/webgl/src/lib/layer-controller.ts`
- Modify: `packages/webgl/src/lib/backend.ts`
- Modify: `packages/webgl/src/index.ts`
- Modify: `packages/core/src/lib/components/layer-node-equality.ts`

**Interfaces:**

- `crcAnimationFrame(): number` returns the active CRC frame timestamp and requests exactly one next frame for the owning private instance with parent recomposition.
- WebGLLayer cache identity includes retained child root/props/styles/enhancers, camera scalars, logical dimensions, X/Y density, focus revision, context generation, and owned resource generation.
- Layer controller tracks `renderedGeneration`, `candidateGeneration`, and `committedGeneration`; an already-rendered child candidate is composited by the parent without a second child traversal.

- [ ] **Step 1: Write failing animation coalescing tests**

Render two animated components and one Canvas sibling. Assert both hooks see the same timestamp, one child rAF is pending, one parent recomposition follows, removing one caller leaves one continuing request, removing both stops, and disposal cancels the pending callback. Invoke a stale saved callback after key replacement and assert it cannot schedule the replacement mount.

- [ ] **Step 2: Write failing cache and single-traversal counters**

Assert an unchanged parent render performs one Canvas composite and zero child executions, GL draws, transfers, uploads, and ledger writes. Change each cache dimension independently and assert exactly one child traversal and transfer. Trigger child state and animation updates and assert the subsequent parent render does not execute the child twice.

- [ ] **Step 3: Run animation/performance tests and confirm missing hook/cache failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/hooks/crc-animation-frame.test.tsx packages/webgl/src/lib/webgl-performance.test.tsx --browser.headless --browser.ui=false
```

Expected: FAIL because continuing-frame ownership and WebGL cache generations are absent.

- [ ] **Step 4: Implement the continuing-frame hook**

Use one internal hook slot to retain mount identity, return `getCurrentFrameTimestamp()`, and call `requestCurrentInstanceFrame(true)`. Rely on core's realm scheduler coalescing and stale-owner checks; do not install a package-global loop or a second scheduler.

- [ ] **Step 5: Implement cache snapshots and generation handoff**

Use the friend-exported retained-tree snapshot without consuming opaque iterables twice. A child-originated render creates a candidate at the shared timestamp; parent composition consumes it. A parent-originated invalidation runs the child once synchronously. Cache hits replay focus metadata and use the committed bitmap/ledger pair.

- [ ] **Step 6: Run animation, cache, Layer, hook, and performance suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/hooks/crc-animation-frame.test.tsx packages/webgl/src/lib/webgl-performance.test.tsx packages/webgl/src/lib/components/webgl-layer.test.tsx packages/core/src/lib/hooks/crc-state.test.ts packages/core/src/lib/components/layer.test.ts packages/core/test/event-performance.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS with exact traversal and transfer counters.

- [ ] **Step 7: Commit animation and retained islands**

```bash
git add packages/webgl/src/lib/hooks/crc-animation-frame.ts packages/webgl/src/lib/hooks/crc-animation-frame.test.tsx packages/webgl/src/lib/webgl-performance.test.tsx packages/webgl/src/lib/components/webgl-layer.ts packages/webgl/src/lib/layer-controller.ts packages/webgl/src/lib/backend.ts packages/webgl/src/index.ts packages/core/src/lib/components/layer-node-equality.ts
git commit -m "feat(webgl): animate and retain WebGL islands"
```

### Task 12: Context loss, failure isolation, and exact resource teardown

**Files:**

- Create: `packages/core/test/webgl-ownership.test.ts`
- Create: `packages/webgl/src/lib/context-lifecycle.test.tsx`
- Modify: `packages/webgl/src/lib/{backend,layer-controller,render-environment}.ts`
- Modify: `packages/webgl/src/lib/gpu/{state,program,resources}.ts`
- Modify: `packages/webgl/src/lib/components/webgl-layer.ts`
- Modify: `packages/core/src/lib/global-state.ts`

**Interfaces:**

- One layer owns one `webglcontextlost` and one `webglcontextrestored` listener.
- Context loss increments the context generation, invalidates every GPU handle, closes/removes the committed bitmap, clears committed picking/focus state, and schedules no work until restoration.
- Restoration schedules one ordinary CRC frame; public descriptors rebuild resources into the new generation.

- [ ] **Step 1: Write failing context loss/restoration tests**

Dispatch a cancelable loss event and assert it is handled once, stale bitmap/pick targets disappear, old handles are not reused or double-deleted, and no clicks hit invisible prior geometry. Dispatch restoration and assert one scheduled rebuild publishes a new matched generation only after successful draw and composition.

- [ ] **Step 2: Write failing failure-injection ownership matrix**

Inject failures at context acquisition, shader creation/compile/link, buffer/VAO creation, upload, primitive draw, custom resolver registration, child traversal, bitmap transfer, parent composite, state restoration, and disposal. Record acquired/released counts for contexts, listeners, programs, shaders, buffers, VAOs, framebuffers, textures, bitmaps, targets, component refs, and rAFs; every completed test returns to its exact baseline.

- [ ] **Step 3: Run ownership tests and confirm leaked generations**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/context-lifecycle.test.tsx packages/core/test/webgl-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL until context generations and every failure path release exact ownership.

- [ ] **Step 4: Implement loss-safe invalidation and restoration**

Attach listeners during layer mount and remove them in the same component teardown. On loss, prevent default, mark the driver unavailable, invalidate caches without issuing invalid GL deletes against a lost context, close bitmaps, release logical targets, and ignore stale restore events after removal. On restoration, acquire a new generation and schedule through core.

- [ ] **Step 5: Aggregate teardown errors without skipping later releases**

Use CRC's `Teardowns`/`runTeardown` pattern so one failing application release is reported but cannot suppress bitmap close, target release, listener removal, cache invalidation, child-controller disposal, or framework-state restoration.

- [ ] **Step 6: Run ownership, cleanup-stress, and failure regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/context-lifecycle.test.tsx packages/core/test/webgl-ownership.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts packages/core/src/lib/teardowns.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS with every final counter at baseline.

- [ ] **Step 7: Commit context and failure ownership**

```bash
git add packages/webgl/src/lib/backend.ts packages/webgl/src/lib/layer-controller.ts packages/webgl/src/lib/render-environment.ts packages/webgl/src/lib/gpu/state.ts packages/webgl/src/lib/gpu/program.ts packages/webgl/src/lib/gpu/resources.ts packages/webgl/src/lib/components/webgl-layer.ts packages/webgl/src/lib/context-lifecycle.test.tsx packages/core/test/webgl-ownership.test.ts packages/core/src/lib/global-state.ts
git commit -m "fix(webgl): make context ownership fail closed"
```

### Task 13: Public learning and deterministic browser scenarios

**Files:**

- Create: `packages/scenarios/src/learning/composition/webgl-islands.example.tsx`
- Create: `packages/scenarios/src/webgl-lab.example.tsx`
- Create: `packages/scenarios/src/webgl-lab.ts`
- Create: `packages/core/test/webgl-lab.test.ts`
- Create: `packages/core/test/webgl-performance.test.ts`
- Create after inspected comparison: `packages/core/test/visual-baselines/webgl-islands.expected.png`
- Modify: `packages/scenarios/src/{catalog,learning-catalog,index}.ts`
- Modify: `packages/scenarios/package.json`
- Modify: `packages/core/test/{scenario-catalog,learning-examples}.test.ts`
- Modify: `tooling/learning-source-contract.ts`
- Modify: `tooling/crc-runtime-source.ts`
- Modify: `tooling/crc-studio-runtime-entry.ts`
- Modify: `playground/src/{sandbox-module,editor-workbench}.ts`
- Modify: `playground/package.json`

**Interfaces:**

- Learning example: a default-camera animated `Group3D` with clickable Cube/Sphere over Canvas 2D and later Canvas text.
- Laboratory modes: `mixed-order`, `depth`, `transforms`, `clipped`, `layered`, `filtered`, `focus`, `animation`, and `context-restored`.
- Public state reports mode, revision, last target, cube/sphere selections, animation angle, focus target, and context generation.

- [ ] **Step 1: Add failing catalog/source tests before scenario implementation**

Assert the exact routes, source paths, direct imports from both `@crc/core` and `@crc/webgl`, one `@jsxImportSource @crc/core` runtime, no core internal/deep imports, declared actions, and public state schema.

- [ ] **Step 2: Run catalog checks and confirm missing entries**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/scenario-catalog.test.ts packages/core/test/learning-examples.test.ts packages/core/test/webgl-lab.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because WebGL scenario files and catalogs do not exist.

- [ ] **Step 3: Implement the learning example and deterministic laboratory**

Keep teaching and exhaustive fixtures separate. Use only public package imports. Add fixed probe coordinates for lower Rectangle, cube, transparent island background, upper Star, overlapping sphere, clipped area, and focus candidates. Expose actions that deterministically change camera, rotation, pointerEvents, source order, and context generation.

- [ ] **Step 4: Add semantic browser and structural-performance assertions**

Drive real mouse, pointer, touch, keyboard, focus, and context events. Assert state and target paths before pixels. Spy on GL calls and bitmap transfer to prove one traversal, one draw per primitive, one transfer per updated island, no transfer on cache hit, no readback/ID pass, one parent composite, and exact cleanup.

- [ ] **Step 5: Add a visual baseline only after inspecting expected/actual/diff**

Capture stable regions for transparent composition, Canvas/WebGL order, default camera, cube/sphere silhouettes, clip, and outer filter. Use narrow documented masks only for platform-sensitive raster edges; do not mask surrounding order, layout, or transparency.

```bash
corepack pnpm@11.21.0 test:studio-visual:update
corepack pnpm@11.21.0 test:studio-visual
```

Expected: the reviewed baseline is created once, then the non-update command PASSes.

- [ ] **Step 6: Run scenarios, browser laboratory, performance, and Studio builds**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/webgl-lab.test.ts packages/core/test/webgl-performance.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

Expected: all commands PASS in source and built modes.

- [ ] **Step 7: Commit public scenario evidence**

```bash
git add packages/scenarios/src/learning/composition/webgl-islands.example.tsx packages/scenarios/src/webgl-lab.example.tsx packages/scenarios/src/webgl-lab.ts packages/scenarios/src/catalog.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/index.ts packages/scenarios/package.json packages/core/test/webgl-lab.test.ts packages/core/test/webgl-performance.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/learning-examples.test.ts packages/core/test/visual-baselines/webgl-islands.expected.png tooling/learning-source-contract.ts tooling/crc-runtime-source.ts tooling/crc-studio-runtime-entry.ts playground/src/sandbox-module.ts playground/src/editor-workbench.ts playground/package.json pnpm-lock.yaml
git commit -m "test(webgl): prove public WebGL island behavior"
```

### Task 14: Public exports, contracts, consumers, and aggregate trust gate

**Files:**

- Create: `docs/guides/webgl-islands.md`
- Create: `docs/migrations/default-pointer-participation.md`
- Create: `docs/testing/field-notes/2026-09-09-webgl-islands.md`
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `packages/webgl/README.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/library-status.md`
- Modify: `docs/guides/{configuring-jsx,custom-components-and-primitives,layout-groups-clips-and-layers,focus-keyboard-and-accessibility,without-jsx}.md`
- Modify: `docs/design/{canvas-surface,runtime-hooks,drawing-components,style-system,layout-system,user-events,focus-and-keyboard-navigation,mouse-interaction,event-resource-ownership,runtime-resource-ownership}.md`
- Modify: `playground/package-consumer/{index.ts,jsx.tsx,runtime.mjs,tsconfig.bundler.json,tsconfig.nodenext.json}`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `tooling/verify-docs.mjs`
- Modify: `tooling/assert-built-core.ts`
- Modify: `tooling/crc-runtime-source.ts`
- Modify: `tooling/crc-studio-runtime-entry.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- `@crc/webgl` exports exactly `WebGLLayer`, `Group3D`, `Mesh`, `Cube`, `Sphere`, `createWebGLGeometry`, `defineWebGLPrimitive`, `crcWebGLContext`, `crcAnimationFrame`, and the public types used by those values.
- `@crc/core/internal` remains absent from the public API reference except for a warning in package-boundary documentation; applications receive no compatibility promise.
- Bundler and NodeNext consumers import both packages while JSX still compiles against `@crc/core/jsx-runtime`.

- [ ] **Step 1: Add failing packed/source consumer assertions**

Compile JSX and createElement scenes importing Canvas values from core and WebGL values from webgl, including one geometry-backed `defineWebGLPrimitive`, one custom-hit primitive, and one decorative primitive. At runtime assert one shared `Fragment`, element brand, scheduler identity probe, and backend token registry. Inspect the WebGL bundle/tarball and reject embedded core implementation markers or a second core chunk. Verify exact runtime export names and blocked undeclared deep paths.

- [ ] **Step 2: Run package and documentation checks and record the expected gaps**

```bash
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 docs:check
```

Expected: FAIL until consumer fixtures, export inventories, current contracts, and docs mutation evidence describe the new packages and compatibility change.

- [ ] **Step 3: Update normative contracts before claiming shipped behavior**

Replace the old “purely visual paths do not occlude” rule with default drawing participation and explicit `pointerEvents="none"`. Document structural listener-only behavior, fixed miss/block/target resolution, WebGL nested bridges, projected focus bounds, shared scheduler, ImageBitmap transactions, filters outside the island, GL state/resource ownership, context loss, and the no-interleaving limitation.

- [ ] **Step 4: Complete guides, API reference, status, and package README files**

Show the same JSX runtime with imports from both packages, default camera example, explicit camera override, Mesh geometry construction, Cube/Sphere/Group3D, click propagation, transparent-background pass-through, pointerEvents opt-out, animation, raw-context obligations, context limitations, and non-JSX construction. State that `@crc/core/internal` is reserved for matching official packages.

- [ ] **Step 5: Run the full static, package, browser, lifecycle, and performance gates**

Run on the documented Node 24.15+ and pnpm 11.21.0 environment:

```bash
corepack pnpm@11.21.0 trust
```

Expected: documentation/export/link consistency, catalogs, typecheck, lint/format, all builds, packed consumers, browser/visual suites, built smoke, lifecycle cleanup, WebGL ownership, and structural performance checks PASS with zero failures.

- [ ] **Step 6: Inspect the final diff and write dated field notes**

Record the exact environment, commands, results, browser version, visual-baseline reasoning, known platform sensitivity, and any intentionally deferred non-goals. Confirm no generated source, temporary diff image, local server state, or unrelated file is staged.

- [ ] **Step 7: Commit the shipping surface**

```bash
git add README.md packages/core/README.md packages/webgl/README.md docs/api-reference.md docs/library-status.md docs/guides/webgl-islands.md docs/guides/configuring-jsx.md docs/guides/custom-components-and-primitives.md docs/guides/layout-groups-clips-and-layers.md docs/guides/focus-keyboard-and-accessibility.md docs/guides/without-jsx.md docs/migrations/default-pointer-participation.md docs/design/canvas-surface-contract.md docs/design/runtime-hooks-contract.md docs/design/drawing-components-contract.md docs/design/style-system-contract.md docs/design/layout-system-contract.md docs/design/user-events-contract.md docs/design/focus-and-keyboard-navigation-contract.md docs/design/mouse-interaction-contract.md docs/design/event-resource-ownership.md docs/design/runtime-resource-ownership.md docs/testing/field-notes/2026-09-09-webgl-islands.md playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/package-consumer/tsconfig.bundler.json playground/package-consumer/tsconfig.nodenext.json tooling/verify-packed-consumer.mjs tooling/verify-studio-types.mjs tooling/verify-docs.mjs tooling/assert-built-core.ts tooling/crc-runtime-source.ts tooling/crc-studio-runtime-entry.ts package.json pnpm-lock.yaml
git commit -m "docs(webgl): publish WebGL island contracts"
```

- [ ] **Step 8: Re-run the aggregate gate on the committed tree**

```bash
corepack pnpm@11.21.0 trust
git status --short
```

Expected: trust PASSes again and status contains only unrelated pre-existing work, if any.
