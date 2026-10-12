# Settled-Scene WebGL Rendering Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** This plan records the completed implementation; current shipped behavior is governed by the current contracts under `docs/design/`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace primitive-at-a-time WebGL drawing with one frame-local compose → settle → render pipeline per `WebGLLayer`, while preserving the existing unlit built-ins and island transaction and removing traversal-time raw WebGL APIs.

**Architecture:** A CPU-only `WebGLSceneComposer` collects immutable mesh submissions during the existing single Pibbl traversal. `finishFrame(true)` closes and settles that draft, derives opaque/transparent queues plus geometry-backed pick/focus records, and passes the settled scene to a generation-owned renderer. The renderer alone may touch WebGL state or resources; its transactional resident-set cache commits only after a complete render. `WebGLLayerController` keeps the existing bitmap/pick transaction and no longer treats resource-cache contents as scene invalidation state.

**Tech Stack:** TypeScript 7, Pibbl JSX/createElement runtime, HTML Canvas 2D, `OffscreenCanvas`, WebGL2, Vitest Browser with Playwright Chromium, esbuild, pnpm 11.21.0, Node 24.15 or newer.

**Spec:** `docs/superpowers/specs/2026-09-13-webgl-settled-scene-rendering-design.md`

## Global Constraints

- Preserve unrelated working-tree changes and untracked files. In particular, do not modify the pre-existing `tooling/verify-docs.mjs` edit, `docs/strategy/particle-effects-research.md`, or `docs/superpowers/specs/2026-09-13-first-class-particle-effects-design.md` unless a later user request explicitly puts them in scope.
- This plan covers the settled-scene foundation only. Do not add normals, materials, lights, backgrounds, environment maps, shadows, emission, HDR targets, tone mapping, or bloom here.
- Keep one `WebGLLayer` as one camera, one private WebGL2 context, one frame-local scene, and one flattened Canvas paint entry. Do not add `Scene3D`, a `lights` prop, multiple viewports, or a retained scene graph.
- Preserve the current Pibbl component traversal and identity machinery. Every invalidated component and backend primitive executes exactly once; settlement and rendering may not replay component code.
- `beginFrame()` and child traversal are CPU-only for WebGL: no clear, draw, shader/program creation, vertex-array/buffer creation, upload, or baseline installation may occur before successful traversal finishes.
- `finishFrame(false)` discards without settling or rendering. `finishFrame(true)` is the only render entry and must perform its own rollback before rethrowing because core has already selected the success completion path.
- Final alpha is parsed color alpha multiplied by `style.opacity`. Alpha `1` is opaque, `(0, 1)` is transparent, and `0` is absent from raster queues but remains eligible for pick/focus participation.
- Render opaque submissions in ascending source order with blending disabled and depth writes enabled. Render transparent submissions farthest-to-nearest by transformed geometry-bounds center, with ascending source order as the exact equal-depth tie-breaker, blending enabled, and depth writes disabled.
- Derive render and pick/focus data from the same immutable mesh submission. Raster reordering must not change event ancestry, Tab order, source indices, or equal-depth picking; the later source index still wins an equal pick depth.
- Preserve the existing Canvas/WebGL bitmap-and-pick publication transaction. Never publish a partial scene, transfer more than one bitmap for one updated scene, or pair new pixels with old pick/focus metadata.
- Remove, without aliases, the public `defineWebGLPrimitive`, `pibblWebGLContext`, raw context/resource types, custom analytic hit path, and component-owned WebGL resource registry.
- Keep `createWebGLGeometry` public. Ordinary custom shapes remain ordinary components that return `Mesh`.
- Add a failing test before each production behavior change. Public behavior needs root-package, package-consumer, browser-scenario, lifecycle, and structural-cost evidence.
- Inspect visual expected/actual/diff output before accepting any baseline update. Never rewrite a baseline merely to make a test pass.
- Use the documented Node 24.15+, pnpm 11.21.0, and Playwright Chromium environment for final evidence.

## File and Responsibility Map

### Scene composition and planning

- Create `packages/webgl/src/lib/scene/types.ts`: private immutable mesh-submission and settled-scene record types.
- Create `packages/webgl/src/lib/scene/composer.ts`: frame-local CPU state, source indices, model scopes, submission snapshots, close/discard invariants, and candidate-target release.
- Create `packages/webgl/src/lib/scene/settle.ts`: alpha classification, view-depth calculation, deterministic queue ordering, and pick/focus derivation.
- Create `packages/webgl/src/lib/scene/{composer,settle}.test.ts`: CPU-only ownership, transform, closure, classification, sorting, and shared render/pick evidence.

### Rendering and GPU ownership

- Create `packages/webgl/src/lib/gpu/renderer-resources.ts`: one transactional resident-set cache for one context generation.
- Create `packages/webgl/src/lib/gpu/renderer-resources.test.ts`: handle sharing, commit/sweep, rollback, partial construction, context loss, and exact disposal.
- Create `packages/webgl/src/lib/scene/renderer.ts`: lazy baseline creation, one clear, opaque/transparent state, queue execution, and transaction closure.
- Create `packages/webgl/src/lib/scene/renderer.test.ts`: WebGL command ordering and failure evidence independent of Pibbl traversal.
- Modify `packages/webgl/src/lib/gpu/{state.ts,state.test.ts}`: retain the complete baseline installer, remove the traversal-oriented frame-start helper after backend migration, and prove restoration attempts all owned state.
- Keep `packages/webgl/src/lib/gpu/program.ts` and its tests as the positions-only unlit shader implementation for this project.

### Backend and built-ins

- Modify `packages/webgl/src/lib/backend.ts`: compose during traversal; settle/render only in successful finish; own renderer generations, rollback, completion, and failure timestamps.
- Create `packages/webgl/src/lib/backend.test.ts`: lifecycle phase order, one traversal, late-sibling inclusion, discard, finish-time rollback, and completion-slot evidence.
- Modify `packages/webgl/src/lib/components/{mesh,cube,sphere,group-3d}.ts`: submit scene records instead of drawing; preserve validation and transform order.
- Modify their existing tests for submission behavior, final pass order, zero-alpha paint omission, and Group3D LIFO cleanup.
- Modify `packages/webgl/src/lib/layer-controller.ts`: remove `ownedResourceGeneration` from completed/candidate/committed records and cache validity while preserving the bitmap/pick transaction.

### Removed traversal-era extension surface

- Delete `packages/webgl/src/lib/define-webgl-primitive.ts` and its test.
- Delete `packages/webgl/src/lib/hooks/pibbl-webgl-context.ts` and its test.
- Delete `packages/webgl/src/lib/primitive-metadata.ts`.
- Delete `packages/webgl/src/lib/render-environment.ts`.
- Delete `packages/webgl/src/lib/gpu/resources.ts` and its lease-oriented test.
- Modify `packages/webgl/src/lib/{types.ts,pick-ledger.ts,scene-picker.ts}` and their tests to retain only public declarative types and geometry-backed picking.
- Modify `packages/webgl/src/lib/math/camera.ts` and tests so resolved camera matrices are package-private rather than a public snapshot type.
- Modify all WebGL component, event, lifecycle, layer-controller, animation-frame, and performance tests that currently manufacture raw primitives; use public built-ins, ordinary components, or injected renderer/platform failures instead.

### Public consumers, scenarios, and documentation

- Modify `packages/webgl/src/index.ts`, `playground/package-consumer/{index.ts,runtime.mjs}`, `playground/src/pibbl-editor-types.txt`, `tooling/verify-studio-types.mjs`, and `tooling/studio-docs/{api-exports.check.ts,fixtures/api/webgl.ts}` for the reduced public surface: 7 runtime values and 15 public types.
- Modify `packages/scenarios/src/{webgl-lab.example.tsx,webgl-lab.ts,catalog.ts}` and `packages/core/test/{webgl-lab,webgl-ownership,webgl-performance}.test.ts` to remove raw-context reporting/restoration controls and add deterministic settled-transparency evidence.
- Modify `packages/scenarios/src/learning/composition/webgl-islands.example.tsx` to explain the layer as a settled scene while retaining the animated cube/sphere lesson.
- Regenerate only the scenario/catalog artifacts changed by those sources, including `docs/scenario-index.md` when required.
- Delete the public API pages for the two removed values and update the WebGL type/API index, WebGL guide, custom-component guide, package/root READMEs, `docs/library-status.md`, `AGENTS.md`, and all affected normative contracts under `docs/design/`.
- Update `tooling/docs-contract-preservation-baseline.json` only for deliberately revised normative statements; preserve the unrelated verification-script edit.

## Private Interfaces

The task sections may refine field placement, but these names and ownership directions are fixed across the plan:

```ts
export type WebGLRGBA = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
];

export interface WebGLMeshSubmission {
  readonly kind: "mesh";
  readonly componentName: string;
  readonly source: PibblElementSource | undefined;
  readonly geometry: PibblWebGLGeometry;
  readonly model: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly sourceIndex: number;
  readonly target: PibblEventTargetRegistration | undefined;
  readonly keyboardNavigationBounds: PibblEventTargetRegistration["keyboardNavigationBounds"];
}

export interface SettledWebGLMesh extends WebGLMeshSubmission {
  readonly viewDepth: number;
}

export interface SettledWebGLScene {
  readonly contextGeneration: number;
  readonly camera: ResolvedWebGLCamera;
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly backingViewport: Readonly<{ width: number; height: number }>;
  readonly density: Readonly<{ x: number; y: number }>;
  readonly timestamp: number;
  readonly meshes: readonly SettledWebGLMesh[];
  readonly opaque: readonly SettledWebGLMesh[];
  readonly transparent: readonly SettledWebGLMesh[];
  readonly pickEntries: readonly PibblWebGLGeometryPickRecord[];
}
```

No type in this block is exported from `@pibbl/webgl`.

## Complexity and Ownership Contract

- Let `C` be traversed components, `M` submitted meshes, `G` distinct referenced geometries, `P` participating pick meshes, and `T` tested triangles. One updated scene costs `O(C + M log M)` in JavaScript because only the transparent subset is sorted; opaque planning/rendering and candidate resource lookup are `O(M)`, with `O(G)` resident GPU records. Default exact picking remains `O(P + T)` worst-case per coordinate event.
- A clean layer cache hit stays `O(1)` framework work plus one Canvas `drawImage`: no child traversal, composer, settlement, GL state work, resource transaction, draw, transfer, or pick rebuild.
- One context generation owns at most one unlit program handle and one upload per resident immutable geometry. During a render attempt, live handles are bounded by the union of the previous resident set and the candidate set.
- A scene draft and settled scene live only within one backend frame/`finishFrame` call. Completed layer state retains bitmap, camera, pick/focus data, and tree/cache keys, never mesh submissions or render queues.
- Every close, discard, transaction commit/rollback, context invalidation, bitmap close, target release, listener release, and final disposal is idempotent or guarded so a handle is not released twice.

---

### Task 1: Add the CPU-only scene composer

**Files:**

- Create: `packages/webgl/src/lib/scene/types.ts`
- Create: `packages/webgl/src/lib/scene/composer.ts`
- Create: `packages/webgl/src/lib/scene/composer.test.ts`

**Interfaces:**

- Consumes: `PibblBackendFrameInput`, package-private `ResolvedWebGLCamera`, immutable `PibblWebGLGeometry`, `PibblElementSource`, target registrations, and matrix multiplication helpers.
- Produces:

```ts
export interface CreateWebGLSceneComposerInput {
  readonly frame: PibblBackendFrameInput;
  readonly camera: ResolvedWebGLCamera;
  readonly contextGeneration: number;
}

export interface SubmitWebGLMeshInput {
  readonly componentName: string;
  readonly source?: PibblElementSource;
  readonly geometry: PibblWebGLGeometry;
  readonly localModel: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly target?: PibblEventTargetRegistration;
  readonly keyboardNavigationBounds?: PibblEventTargetRegistration["keyboardNavigationBounds"];
}

export function createWebGLSceneComposer(
  input: CreateWebGLSceneComposerInput,
): WebGLSceneComposer;
export function pushWebGLModelMatrix(
  composer: WebGLSceneComposer,
  local: Readonly<Float32Array>,
): () => void;
export function submitWebGLMesh(
  composer: WebGLSceneComposer,
  input: SubmitWebGLMeshInput,
): void;
export function closeWebGLSceneComposer(
  composer: WebGLSceneComposer,
): ClosedWebGLSceneDraft;
export function discardWebGLSceneComposer(composer: WebGLSceneComposer): void;
```

- `WebGLSceneComposer` does not contain a `WebGL2RenderingContext`, renderer, cache, baseline, framebuffer, or resource callback.

- [ ] **Step 1: Write failing composer ownership and scope tests**

  In `composer.test.ts`, create a composer without a GL object and assert viewport/density/timestamp snapshots, monotonically increasing source indices, and copied matrices/colors. Mutate the caller's local matrix after submission and verify the record is unchanged. Push nested model scopes, submit under each scope, release in LIFO order, and assert exact composed matrices.

  Add failures for an out-of-order pop, a close with an unbalanced stack, submission after close, a second close, and discard followed by submission. Assert no composer method calls any fake GL spy because no GL value is accepted.

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/composer.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because the scene types and composer do not exist.

- [ ] **Step 3: Define private draft and submission records**

  Implement `scene/types.ts` with the interfaces in the global block plus a mutable package-private composer state. Snapshot the logical/backing viewports and density with frozen records. Store one identity matrix at stack index zero.

- [ ] **Step 4: Implement model scopes, mesh submission, close, and discard**

  The submission path computes the final model once and stores a private copy:

  ```ts
  const model = new Float32Array(16);
  multiplyMatrix4(model, composer.modelStack.at(-1)!, input.localModel);
  composer.meshes.push(
    Object.freeze({
      kind: "mesh",
      componentName: input.componentName,
      source: input.source,
      geometry: input.geometry,
      model,
      color: Object.freeze([...input.color]) as WebGLRGBA,
      sourceIndex: composer.nextSourceIndex++,
      target: input.target,
      keyboardNavigationBounds: input.keyboardNavigationBounds,
    }),
  );
  ```

  `closeWebGLSceneComposer` first verifies the root-only model stack, then changes state before publishing a frozen draft snapshot. `discardWebGLSceneComposer` closes the state without invoking user code or WebGL.

- [ ] **Step 5: Run the composer tests and typecheck the WebGL package**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/composer.test.ts --browser.headless --browser.ui=false
  corepack pnpm@11.21.0 exec tsc -p packages/webgl/tsconfig.build.json --noEmit
  ```

  Expected: PASS; the new files are unused by the current backend and introduce no public exports.

- [ ] **Step 6: Commit the composer**

  ```bash
  git add packages/webgl/src/lib/scene/types.ts packages/webgl/src/lib/scene/composer.ts packages/webgl/src/lib/scene/composer.test.ts
  git commit -m "feat(webgl): add frame-local scene composer"
  ```

### Task 2: Settle render queues and derive geometry interaction data

**Files:**

- Create: `packages/webgl/src/lib/scene/settle.ts`
- Create: `packages/webgl/src/lib/scene/settle.test.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.test.ts`

**Interfaces:**

- Consumes: one open `WebGLSceneComposer`, geometry bounds, composed model matrices, resolved camera matrices, and geometry pick-ledger helpers.
- Produces:

```ts
export function settleWebGLScene(
  composer: WebGLSceneComposer,
): SettledWebGLScene;

export function releaseWebGLPickParticipation(
  entries: readonly PibblWebGLGeometryPickRecord[],
): void;
```

- `settleWebGLScene` is synchronous and CPU-only. It owns the one legal composer close and returns no application-reachable mutable data.

- [ ] **Step 1: Write failing classification, sorting, and pick-derivation tests**

  Submit meshes whose final alphas are `1`, `0.75`, `0.25`, and `0`. Assert opaque source order, transparent farthest-to-nearest order, ascending source index for equal view depth, and zero-alpha exclusion from both raster queues.

  Give all four submissions live fake targets and assert all four geometry pick entries retain the same geometry, model values, camera projection, source index, and explicit/automatic focus geometry. Mutate every caller-owned input after submission and confirm the settled scene is unchanged and frozen.

- [ ] **Step 2: Run the focused settlement test and confirm failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/pick-ledger.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because settlement and its shared pick derivation do not exist.

- [ ] **Step 3: Implement view-depth calculation and deterministic planning**

  Compute the local geometry-bounds center, transform it by the submitted model and camera view matrix, and store `viewDepth = -viewPosition[2]`. Reject non-finite results with the submission component/source diagnostic. Use an explicit comparator:

  ```ts
  transparent.sort(
    (left, right) =>
      right.viewDepth - left.viewDepth || left.sourceIndex - right.sourceIndex,
  );
  ```

  Classify against the final submitted alpha exactly; do not clamp, epsilon-adjust, or use style opacity independently.

- [ ] **Step 4: Derive pick and focus entries while settling**

  Create one transient pick ledger for the logical viewport. For each submission with a target, call `recordGeometryWebGLPick` with that submission's geometry, model, camera, navigation override, source index, and `less-equal` depth mode. Commit the transient ledger to freeze its entries, then embed those entries in the settled scene.

  Move `releaseWebGLPickParticipation` from the traversal environment into `pick-ledger.ts`, retaining unique-target and idempotent release behavior.

- [ ] **Step 5: Run settlement, projection, and picker regressions**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/lib/scene-picker.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with existing nearest-depth/equal-source geometry picking unchanged.

- [ ] **Step 6: Commit settlement**

  ```bash
  git add packages/webgl/src/lib/scene/settle.ts packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/pick-ledger.ts packages/webgl/src/lib/pick-ledger.test.ts
  git commit -m "feat(webgl): settle scene render and pick queues"
  ```

### Task 3: Add the transactional renderer resource cache

**Files:**

- Create: `packages/webgl/src/lib/gpu/renderer-resources.ts`
- Create: `packages/webgl/src/lib/gpu/renderer-resources.test.ts`
- Reuse: `packages/webgl/src/lib/gpu/program.ts`
- Reuse: `packages/webgl/src/lib/geometry/geometry.ts`

**Interfaces:**

- Consumes: one `WebGL2RenderingContext`, one context generation, the unlit program factory, immutable geometry descriptors, and geometry upload data.
- Produces:

```ts
export interface WebGLRendererResourceTransaction {
  useProgram(componentName: string): WebGLBuiltInProgram;
  useGeometry(
    geometry: PibblWebGLGeometry,
    componentName: string,
  ): WebGLGeometryResource;
  commit(): void;
  rollback(contextLost?: boolean): void;
}

export class WebGLRendererResourceCache {
  constructor(
    gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  );
  beginRender(): WebGLRendererResourceTransaction;
  invalidateContext(): void;
  dispose(contextLost: boolean): void;
}
```

- Only one transaction may be active. Candidate state records used keys and handles created during that attempt; resident state records only the preceding successful render.

- [ ] **Step 1: Write failing resident-set transaction tests**

  Cover one program/geometry shared by multiple submissions in one candidate, reuse across identical successful renders, deletion of geometry omitted by the next successful scene, an empty-scene commit sweeping the program and all geometry, and rejection of nested or post-close transaction operations.

  For rollback, start with a successful resident scene, create one new candidate geometry, inject a later failure, and assert candidate-only handles are deleted while resident handles remain reusable. Cover partial shader/program/vertex-array/position-buffer/index-buffer construction with exact cleanup counts.

  For context loss, invalidate during an active transaction and assert all JS records clear with zero WebGL deletion calls. For ordinary disposal, assert every union-resident/candidate live handle deletes exactly once even if `dispose`, `rollback`, or `commit` is called again.

- [ ] **Step 2: Run the focused resource test and confirm the missing API**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/gpu/program.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because `WebGLRendererResourceCache` does not exist.

- [ ] **Step 3: Implement candidate acquisition and partial-construction cleanup**

  `useProgram` and `useGeometry` first mark the candidate key, reuse a live cached handle when present, and otherwise create/upload inside a guarded helper. Do not add a half-created resource to either map. Geometry errors include the requesting component name.

- [ ] **Step 4: Implement commit, rollback, invalidation, and disposal**

  Commit deletes prior resident handles absent from the candidate, adopts candidate key sets, and closes the transaction. Rollback deletes only handles listed in `createdDuringCandidate`, retains the prior resident sets, and closes. Context invalidation clears maps and invalidates the active transaction without GL deletes. Ordinary disposal iterates the union of live records once and reports cleanup errors without suppressing later cleanup.

- [ ] **Step 5: Run resource and program tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/gpu/program.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with one handle per key/generation and exact rollback/disposal counts.

- [ ] **Step 6: Commit renderer resource ownership**

  ```bash
  git add packages/webgl/src/lib/gpu/renderer-resources.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts
  git commit -m "feat(webgl): add transactional renderer resources"
  ```

### Task 4: Render only immutable settled scenes

**Files:**

- Create: `packages/webgl/src/lib/scene/renderer.ts`
- Create: `packages/webgl/src/lib/scene/renderer.test.ts`
- Modify: `packages/webgl/src/lib/gpu/state.ts`
- Modify: `packages/webgl/src/lib/gpu/state.test.ts`

**Interfaces:**

- Consumes: `SettledWebGLScene`, one context-generation GL context, the complete state baseline, the unlit program, and `WebGLRendererResourceCache`.
- Produces:

```ts
export class WebGLSceneRenderer {
  constructor(
    gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  );
  render(scene: SettledWebGLScene): void;
  invalidateContext(): void;
  dispose(contextLost: boolean): void;
}
```

- The constructor is CPU-only. The first `render()` lazily reads the bounded baseline capability and opens a resource transaction.

- [ ] **Step 1: Write failing pass-order and state tests**

  Feed a hand-built settled scene with opaque meshes in source order, transparent meshes already sorted by settlement, and a zero-alpha mesh present only in `meshes`. Record every GL command and assert: baseline before clear; one transparent color/depth clear; opaque draws first with `BLEND` disabled and `depthMask(true)`; transparent draws with source-alpha blending and `depthMask(false)`; final baseline restoration; zero-alpha never acquired/drawn; no `readPixels`, framebuffer creation, or hidden pass.

  Assert one indexed and one non-indexed geometry use `drawElements`/`drawArrays` correctly and receive the exact model/view/projection/color uniforms from the settled records.

- [ ] **Step 2: Write failing renderer failure tests**

  Inject failures at baseline creation, clear, program acquisition, geometry upload, first/second draw, final baseline restoration, and transaction commit. Assert no successful completion is returned; candidate-only resources roll back; every possible baseline restoration is attempted; and the first operational error remains authoritative while secondary cleanup errors are reported.

- [ ] **Step 3: Run the focused renderer tests and confirm failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/gpu/state.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because the settled-scene renderer does not exist.

- [ ] **Step 4: Implement opaque and transparent draw passes**

  Use one draw helper for both queues and vary only pass state:

  ```ts
  installOpaquePass(gl); // blend off, LEQUAL, depth test/write on
  for (const mesh of scene.opaque) drawMesh(gl, transaction, scene, mesh);

  installTransparentPass(gl); // SRC_ALPHA, LEQUAL, depth test on/write off
  for (const mesh of scene.transparent) {
    drawMesh(gl, transaction, scene, mesh);
  }
  ```

  Bind every state dependency explicitly. Clear only after the full scene is settled and the generation check succeeds.

- [ ] **Step 5: Implement renderer transaction/finally behavior**

  Open one resource transaction per render. Restore the framework baseline before commit. On any exception, roll back with the current context-loss state, attempt baseline restoration if the generation remains valid, then rethrow. `invalidateContext()` calls the cache's no-delete invalidation; normal disposal deletes the live cache exactly once.

- [ ] **Step 6: Run renderer, resource, state, and shader tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/gpu/program.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with deterministic calls and no traversal dependency.

- [ ] **Step 7: Commit the settled-scene renderer**

  ```bash
  git add packages/webgl/src/lib/scene/renderer.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/gpu/state.ts packages/webgl/src/lib/gpu/state.test.ts
  git commit -m "feat(webgl): render settled scene passes"
  ```

### Task 5: Switch the backend and built-ins to deferred scene submission

**Files:**

- Create: `packages/webgl/src/lib/backend.test.ts`
- Modify: `packages/webgl/src/lib/backend.ts`
- Modify: `packages/webgl/src/lib/components/mesh.ts`
- Modify: `packages/webgl/src/lib/components/mesh.test.tsx`
- Modify: `packages/webgl/src/lib/components/cube.ts`
- Modify: `packages/webgl/src/lib/components/cube.test.tsx`
- Modify: `packages/webgl/src/lib/components/sphere.ts`
- Modify: `packages/webgl/src/lib/components/sphere.test.tsx`
- Modify: `packages/webgl/src/lib/components/group-3d.ts`
- Modify: `packages/webgl/src/lib/components/group-3d.test.tsx`
- Modify: `packages/webgl/src/lib/layer-controller.ts`
- Modify: `packages/webgl/src/lib/layer-controller.test.ts`

**Interfaces:**

- Consumes: core's unchanged `PibblBackendDriver` lifecycle, the composer/settler/renderer, `defineBackendPrimitive`, `getBackendEnvironment`, `getCurrentElementSource`, and `useBackendEventTarget`.
- Produces:

```ts
export interface WebGLCompletedFrame {
  readonly renderedGeneration: number;
  readonly contextGeneration: number;
  readonly pickEntries: readonly PibblWebGLGeometryPickRecord[];
}

export interface WebGLBackendDriver extends PibblBackendDriver<WebGLSceneComposer> {
  readonly renderedGeneration: number;
  hasCompletedFrame(): boolean;
  takeFailedFrameTimestamp(): number | undefined;
  takeCompletedFrame(): WebGLCompletedFrame;
  invalidateContext(generation: number): void;
  restoreContext(): void;
}
```

- `Mesh`, `Cube`, and `Sphere` keep their existing public prop/style types. Their backend programs return `void` after one `submitWebGLMesh`; only `Group3D` returns children.

- [ ] **Step 1: Write failing backend phase-boundary tests**

  Mount ordinary wrapper components around two meshes. Record wrapper/primitive execution plus the first GL call. Assert both later siblings have executed before `getParameter`, clear, shader/program/VAO/buffer creation, upload, or draw. Assert every wrapper and mesh runs once, the same successful frame draws both submissions, and one dirty frame clears once.

  Call the driver lifecycle directly and prove `finishFrame(false)` performs zero GL calls, closes the draft, publishes no completion, and records the failed timestamp. Inject a renderer failure from `finishFrame(true)` and prove candidate pick targets/resources release, no completion is available, and the original error is rethrown without a second finish call.

- [ ] **Step 2: Update built-in tests for planned pass behavior**

  Change the current Mesh/Cube/Sphere test so an opaque cube submitted after a transparent mesh draws first; the transparent mesh draws second; and an opacity-zero sphere produces no raster draw. Assert the same three model matrices are present in settled/pick data, final color alpha remains `(parsed alpha × opacity)`, and the zero-alpha sphere is still pickable/focusable.

  Extend Group3D tests for nested translation × Z/Y/X rotation × scale snapshots, sibling scope isolation, and stack unwinding when a descendant throws.

- [ ] **Step 3: Run the focused tests and confirm immediate drawing fails the new contract**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/backend.test.ts packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/components/group-3d.test.tsx packages/webgl/src/lib/layer-controller.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because the current backend clears/draws during traversal and opacity-zero meshes still draw.

- [ ] **Step 4: Convert built-ins to package-private scene submissions**

  Replace the raw-context draw helper with a submission helper that runs all validation before GPU access:

  ```ts
  function submitBuiltInMesh(
    componentName: string,
    props: Readonly<PibblWebGLTargetProps>,
    geometry: PibblWebGLGeometry,
    style: Readonly<MeshStyle>,
    uniformScale: number,
  ): void {
    const composer =
      getBackendEnvironment<WebGLSceneComposer>(WEBGL_BACKEND_TOKEN);
    const target = useBackendEventTarget(
      props,
      {
        cursor: style.cursor,
        deferKeyboardNavigationGeometry: true,
        keyboardFocusable: props.keyboardFocusable,
      },
      props.pointerEvents === "none" ? "none" : "auto",
    );
    submitWebGLMesh(composer, {
      componentName,
      source: getCurrentElementSource(),
      geometry,
      localModel: resolveLocalModel(style, uniformScale),
      color: resolveFinalColor(componentName, style),
      target,
      keyboardNavigationBounds: props.keyboardNavigationBounds,
    });
  }
  ```

  Define each built-in with `defineBackendPrimitive(WEBGL_BACKEND_TOKEN, ...)`. Move Group3D's existing CPU matrix push/pop to the composer and preserve its listener-only behavior.

- [ ] **Step 5: Rewire the backend lifecycle**

  `beginFrame` resolves camera/context generation and creates only a composer. `enterComponent` becomes a no-op cleanup. `runPrimitive` keeps the inner-filter diagnostic and invokes the backend primitive once. `finishFrame(true)` closes/settles, creates or reuses the matching generation renderer, renders, then publishes completion metadata; its `catch` discards/releases candidate participation, records the timestamp, clears completion, and rethrows. `finishFrame(false)` only discards/releases and records the timestamp.

  Defer replacement/disposal of an old renderer until successful settlement. Reject stale generation work before publication.

- [ ] **Step 6: Remove resource-generation cache keys from the layer controller**

  Delete `ownedResourceGeneration` from driver getters, completion records, pending/committed generations, failed-retry checks, cache-hit checks, and candidate publication. Keep tree, camera, surface, focus revision, and context generation as the exact cache keys.

- [ ] **Step 7: Run backend, built-in, layer, event, and picker tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/backend.test.ts packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/components/cube.test.tsx packages/webgl/src/lib/components/sphere.test.tsx packages/webgl/src/lib/components/group-3d.test.tsx packages/webgl/src/lib/layer-controller.test.ts packages/webgl/src/lib/events-integration.test.tsx packages/webgl/src/lib/scene-picker.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS for built-in authoring, new render order, transforms, events, and bitmap/pick pairing. Traversal-era raw primitive suites may remain to be removed in Task 6 and are not run here.

- [ ] **Step 8: Commit the backend switch**

  ```bash
  git add packages/webgl/src/lib/backend.ts packages/webgl/src/lib/backend.test.ts packages/webgl/src/lib/components/mesh.ts packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/components/cube.ts packages/webgl/src/lib/components/cube.test.tsx packages/webgl/src/lib/components/sphere.ts packages/webgl/src/lib/components/sphere.test.tsx packages/webgl/src/lib/components/group-3d.ts packages/webgl/src/lib/components/group-3d.test.tsx packages/webgl/src/lib/layer-controller.ts packages/webgl/src/lib/layer-controller.test.ts
  git commit -m "refactor(webgl): defer drawing until scene settlement"
  ```

### Task 6: Remove traversal-era raw APIs and harden lifecycle behavior

**Files:**

- Delete: `packages/webgl/src/lib/define-webgl-primitive.ts`
- Delete: `packages/webgl/src/lib/define-webgl-primitive.test.tsx`
- Delete: `packages/webgl/src/lib/hooks/pibbl-webgl-context.ts`
- Delete: `packages/webgl/src/lib/hooks/pibbl-webgl-context.test.tsx`
- Delete: `packages/webgl/src/lib/primitive-metadata.ts`
- Delete: `packages/webgl/src/lib/render-environment.ts`
- Delete: `packages/webgl/src/lib/gpu/resources.ts`
- Delete: `packages/webgl/src/lib/gpu/resources.test.ts`
- Modify: `packages/webgl/src/index.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/math/camera.ts`
- Modify: `packages/webgl/src/lib/math/camera.test.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.test.ts`
- Modify: `packages/webgl/src/lib/scene-picker.ts`
- Modify: `packages/webgl/src/lib/scene-picker.test.ts`
- Modify: `packages/webgl/src/lib/components/webgl-layer.test.tsx`
- Modify: `packages/webgl/src/lib/context-lifecycle.test.tsx`
- Modify: `packages/webgl/src/lib/events-integration.test.tsx`
- Modify: `packages/webgl/src/lib/hooks/use-animation-frame.test.tsx`
- Modify: `packages/webgl/src/lib/layer-controller.test.ts`
- Modify: `packages/webgl/src/lib/webgl-performance.test.tsx`

**Interfaces:**

- Removes public values: `defineWebGLPrimitive`, `pibblWebGLContext`.
- Removes public types: `PibblWebGLCameraSnapshot`, `PibblWebGLContext`, `PibblWebGLHitCapability`, `PibblWebGLPrimitiveCapabilities`, `PibblWebGLPrimitiveHitInput`, `PibblWebGLPrimitiveInput`, `PibblWebGLPrimitiveRender`, `PibblWebGLProgramProps`.
- Retains public values: `WebGLLayer`, `Group3D`, `Mesh`, `Cube`, `Sphere`, `createWebGLGeometry`, `useAnimationFrame`.
- Retains public declarative types: vectors, perspective camera, geometry input/descriptor, transforms, and all component prop/style types.

- [ ] **Step 1: Write/convert tests to the post-raw-API contract**

  Replace test-only raw primitives with one of three supported patterns:

  1. an ordinary component that increments/throws/calls `useAnimationFrame()` and returns a public `Mesh`, `Cube`, or `Sphere`;
  2. a direct composer/renderer unit test for internal failures and counters; or
  3. an injected fake GL/OffscreenCanvas failure in controller/context tests.

  Add export assertions that the two removed values are absent at runtime. Remove custom-hit snapshot/resolver cases; preserve all geometry picker tests for nearest depth, equal-depth later source, extreme scale, out-of-view miss, and caller-owned output reuse.

- [ ] **Step 2: Run the converted suites and confirm old definitions conflict**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib --browser.headless --browser.ui=false
  ```

  Expected before production deletion: FAIL on obsolete raw exports/types or tests that still exercise component-owned GL resources/custom hits.

- [ ] **Step 3: Delete raw modules and simplify internal types/picking**

  Remove the files listed above and every import/reference in `packages/webgl/src`. Define `ResolvedWebGLCamera` directly in `math/camera.ts`; do not export its matrices from the package root. Reduce `PibblWebGLPickRecord` to the geometry record and remove custom value cloning, custom camera snapshots, and analytic resolution branches from `pick-ledger.ts`/`scene-picker.ts`.

  Remove `beginWebGLFrame` after confirming the new renderer is its only conceptual replacement; keep `createWebGLStateBaseline` and `installWebGLStateBaseline` package-private.

- [ ] **Step 4: Prove context loss and failure fencing with renderer-owned resources**

  Rewrite lifecycle assertions around built-in program/geometry handles: loss during composition creates no GPU resources; loss during render invalidates without delete calls; restoration creates one new renderer generation on the next scheduled frame; ordinary disposal deletes the restored live handles exactly once. Inject failures for render, bitmap transfer, parent Canvas draw, layer removal, and root disposal and assert no mismatched committed bitmap/picker/focus generation.

- [ ] **Step 5: Prove cache and animation behavior without raw context access**

  Use an ordinary component that calls `useAnimationFrame()` and returns `Cube` to retain timestamp/one-loop tests. Use wrapper execution counters plus GL/transfer spies for clean-cache evidence. Assert a clean parent recomposition performs one Canvas `drawImage` and zero child execution, settlement, GL state/resource/draw work, transfer, or ledger rebuild.

- [ ] **Step 6: Run every WebGL unit/browser suite and package build**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib --browser.headless --browser.ui=false
  corepack pnpm@11.21.0 --filter @pibbl/webgl run build
  ```

  Expected: PASS, with no source reference to the removed APIs or traversal environment.

- [ ] **Step 7: Scan the WebGL source for forbidden architecture remnants**

  ```bash
  rg -n "defineWebGLPrimitive|pibblWebGLContext|PibblWebGLContext|PibblWebGLHitCapability|WebGLResourceGenerationRegistry|ownedResourceGeneration|recordCustomWebGLPick|beginWebGLFrame" packages/webgl/src
  ```

  Expected: no matches.

- [ ] **Step 8: Commit raw-surface removal and lifecycle hardening**

  ```bash
  git add packages/webgl/src
  git commit -m "refactor(webgl): remove traversal-time raw GL surface"
  ```

### Task 7: Update package consumers, Studio types, and public scenarios

**Files:**

- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `playground/src/pibbl-editor-types.txt`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `tooling/studio-docs/api-exports.check.ts`
- Modify: `tooling/studio-docs/fixtures/api/webgl.ts`
- Modify: `packages/scenarios/src/webgl-lab.example.tsx`
- Modify: `packages/scenarios/src/webgl-lab.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/learning/composition/webgl-islands.example.tsx`
- Modify: `packages/core/test/webgl-lab.test.ts`
- Modify: `packages/core/test/webgl-ownership.test.ts`
- Modify: `packages/core/test/webgl-performance.test.ts`
- Regenerate if changed by the catalog command: `docs/scenario-index.md`

**Interfaces:**

- The package consumer composes custom geometry only as `<Mesh geometry={...}>` and exercises `useAnimationFrame()` from an ordinary component.
- Studio/runtime inventories expect these sorted runtime exports:

```ts
[
  "Cube",
  "Group3D",
  "Mesh",
  "Sphere",
  "WebGLLayer",
  "useAnimationFrame",
  "createWebGLGeometry",
];
```

- API inventory totals become 7 WebGL values and 15 WebGL types.

- [ ] **Step 1: Write failing public inventory and package-consumer expectations**

  Remove positive use of the two raw values/eight raw types. Import the package as value and type namespaces in `playground/package-consumer/index.ts`, then add explicit negative probes for every removed name:

  ```ts
  import * as WebGLRuntime from "@pibbl/webgl";
  import type * as WebGLTypes from "@pibbl/webgl";

  // @ts-expect-error traversal-time raw GL construction is not public
  void WebGLRuntime.defineWebGLPrimitive;
  // @ts-expect-error traversal-time raw GL context access is not public
  void WebGLRuntime.pibblWebGLContext;

  // @ts-expect-error resolved camera matrices are package-private
  type RemovedCameraSnapshot = WebGLTypes.PibblWebGLCameraSnapshot;
  // @ts-expect-error traversal-time raw GL context is not public
  type RemovedContext = WebGLTypes.PibblWebGLContext;
  // @ts-expect-error raw primitive hit capability is not public
  type RemovedHitCapability = WebGLTypes.PibblWebGLHitCapability<
    unknown,
    unknown
  >;
  // @ts-expect-error raw primitive capabilities are not public
  type RemovedCapabilities = WebGLTypes.PibblWebGLPrimitiveCapabilities<
    unknown,
    never,
    never,
    never
  >;
  // @ts-expect-error custom analytic hit input is not public
  type RemovedHitInput = WebGLTypes.PibblWebGLPrimitiveHitInput<
    unknown,
    unknown
  >;
  // @ts-expect-error backend primitive input is not public
  type RemovedPrimitiveInput = WebGLTypes.PibblWebGLPrimitiveInput<
    unknown,
    never,
    never
  >;
  // @ts-expect-error raw primitive render callback is not public
  type RemovedPrimitiveRender = WebGLTypes.PibblWebGLPrimitiveRender<
    unknown,
    unknown
  >;
  // @ts-expect-error raw backend program props are not public
  type RemovedProgramProps = WebGLTypes.PibblWebGLProgramProps<unknown, never>;
  ```

  Update `runtime.mjs` to assert the exact seven-value export list and construct a scene only from retained declarative APIs.

  In `api-exports.check.ts`, make the fixture prove the retained `PibblWebGLPerspectiveCamera` type rather than the removed context type, then change the expected counts to `7` and `15`.

- [ ] **Step 2: Run consumer and Studio checks and confirm stale declarations/docs fail**

  ```bash
  corepack pnpm@11.21.0 test:package-consumer
  node tooling/verify-studio-types.mjs
  corepack pnpm@11.21.0 test:studio-docs
  ```

  Expected initially: FAIL on stale editor declarations, runtime inventories, or API pages.

- [ ] **Step 3: Update generated-facing declarations and retained usage examples**

  Remove all raw API declarations from `pibbl-editor-types.txt` and the Studio verifier's synthetic programs/export arrays. Keep exact component props, camera, geometry, transform, and animation-frame declarations. Update package consumers for Bundler, NodeNext, and runtime use of the seven supported values.

- [ ] **Step 4: Replace public raw-context laboratory controls with transparency evidence**

  Remove `ContextReporter`, `PibblWebGLContext`, `contextGeneration`, `context-restored`, and `restore-context` from the public WebGL lab. Add a `transparency` mode/action containing overlapping near/far semi-transparent meshes submitted in intentionally unhelpful source order. Add stable probe points and semantic state so the test can distinguish the expected back-to-front blend from the old immediate depth-write result.

  Keep context-loss/restoration evidence in package-internal lifecycle tests, where the controller legitimately owns the surface/context.

- [ ] **Step 5: Update browser ownership and structural-cost tests**

  Replace `TraversalProbe` with an ordinary counted component returning a public mesh. Update expected draw/transfer/composite/resource counts for renderer-resident geometry sharing and sweeps. Preserve assertions for one traversal, one transfer, no `readPixels`, no hidden framebuffer, exact bitmap closure, exact listeners, clean cache reuse, and final zero live resources.

- [ ] **Step 6: Refresh the learning example language and scenario catalog**

  Keep the animated cube/sphere scene, but describe its children as composing one scene whose renderer runs after composition. Update lab summary/tags/actions to name settled transparency and remove public raw extension/context-restoration claims. Run the catalog writer only after the source metadata is correct.

  ```bash
  corepack pnpm@11.21.0 scenarios:write-index
  ```

- [ ] **Step 7: Run package, Studio, scenario, browser, lifecycle, and performance checks**

  ```bash
  corepack pnpm@11.21.0 test:package-consumer
  corepack pnpm@11.21.0 test:package-consumer:packed
  node tooling/verify-studio-types.mjs
  corepack pnpm@11.21.0 scenarios:check
  corepack pnpm@11.21.0 exec vitest run packages/core/test/webgl-lab.test.ts packages/core/test/webgl-ownership.test.ts packages/core/test/webgl-performance.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS in source and packed-package modes with exact export inventories and deterministic settled-transparency pixels/state.

- [ ] **Step 8: Commit consumers and public evidence**

  ```bash
  git add playground/package-consumer/index.ts playground/package-consumer/runtime.mjs playground/src/pibbl-editor-types.txt tooling/verify-studio-types.mjs tooling/studio-docs/api-exports.check.ts tooling/studio-docs/fixtures/api/webgl.ts packages/scenarios/src/webgl-lab.example.tsx packages/scenarios/src/webgl-lab.ts packages/scenarios/src/catalog.ts packages/scenarios/src/learning/composition/webgl-islands.example.tsx packages/core/test/webgl-lab.test.ts packages/core/test/webgl-ownership.test.ts packages/core/test/webgl-performance.test.ts docs/scenario-index.md
  git commit -m "test(webgl): prove settled scene public behavior"
  ```

### Task 8: Update normative contracts and public documentation

**Files:**

- Delete: `docs/site/api/functions/define-webgl-primitive.md`
- Delete: `docs/site/api/hooks/pibbl-webgl-context.md`
- Modify: `docs/site/api/index.md`
- Modify: `docs/site/api/types/webgl.md`
- Modify: `docs/site/learn/guides/webgl-islands.md`
- Modify: `docs/site/learn/guides/custom-components-and-primitives.md`
- Modify: `packages/webgl/README.md`
- Modify: `README.md`
- Modify: `docs/library-status.md`
- Modify: `AGENTS.md`
- Modify: `docs/design/animation-contract.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/event-resource-ownership.md`
- Modify: `docs/design/focus-and-keyboard-navigation-contract.md`
- Modify: `docs/design/layout-system-contract.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `docs/design/signals-and-scheduling-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/user-events-contract.md`
- Modify: `tooling/docs-contract-preservation-baseline.json`

**Interfaces:**

- Public documentation teaches `<WebGLLayer>` children as scene declarations, `Group3D` as a transform/listener scope, and `Mesh` plus `createWebGLGeometry` as the custom-shape extension path.
- Normative contracts state compose → settle → render → Canvas composite/commit and remove all promises of primitive-time raw GL, custom hit callbacks, component-owned GPU resources, and source-order-only rasterization.
- Historical 2026-09-09 design/plan files remain unchanged evidence; the approved 2026-09-13 design explicitly supersedes the conflicting sections.

- [ ] **Step 1: Make documentation checks fail on the stale public surface**

  Update the API export fixture/coverage expectation first, then run:

  ```bash
  corepack pnpm@11.21.0 docs:check
  corepack pnpm@11.21.0 studio-docs:check
  corepack pnpm@11.21.0 test:studio-docs
  ```

  Expected: FAIL because obsolete API pages and contract-preservation entries still describe removed exports/behavior.

- [ ] **Step 2: Rewrite the WebGL public guide and API pages**

  Delete the two obsolete pages and their API-index links. In the WebGL guide, include one custom geometry component:

  ```tsx
  function Marker({ x }: { x: number }) {
    return <Mesh geometry={markerGeometry} style={{ translateX: x }} />;
  }
  ```

  Explain that child source order establishes identity and tie-breaking, not an irrevocable GPU draw sequence; the renderer sees the whole successful scene before choosing opaque and transparent passes. Document zero-alpha pickability, object-level transparency limitations, one-camera boundary, filters on the outer layer, and current lack of lighting/material/environment effects.

- [ ] **Step 3: Update all normative contracts coherently**

  Replace “draw during primitive traversal” with the four-stage lifecycle. Record renderer-owned resident resources and rollback/context-loss semantics, render/pick shared submissions, transparent sorting independent of focus/event order, geometry-only built-in targeting, clean layer cache behavior, and the unchanged scheduler/private-mount model.

  In `signals-and-scheduling-contract.md`, refine the WebGL portion of Render ordering to scene composition → settle/render → ancestor Canvas composition without changing the six scheduler phases. In `animation-contract.md`, retain the one realm clock and explain that animation changes scene declarations before the layer's settled render.

- [ ] **Step 4: Update repository summaries and preservation baseline**

  Change root/package READMEs, library status, and `AGENTS.md` public surface/boundaries. Remove the raw APIs from all current-source inventories. Update `tooling/docs-contract-preservation-baseline.json` only after reviewing each changed normative clause; do not stage `tooling/verify-docs.mjs`.

- [ ] **Step 5: Scan current documentation for stale raw/immediate claims**

  ```bash
  rg -n "defineWebGLPrimitive|pibblWebGLContext|PibblWebGLContext|component-owned WebGL|draws? during primitive|primitive-at-a-time" README.md AGENTS.md packages/webgl/README.md docs/design docs/site docs/library-status.md
  ```

  Expected: no stale current-contract/public-guide references. Matches in the approved 2026-09-13 spec may name removed APIs as historical decisions; historical 2026-09-09 records are outside this current-doc scan.

- [ ] **Step 6: Run documentation, catalog, formatting, and link checks**

  ```bash
  corepack pnpm@11.21.0 docs:check
  corepack pnpm@11.21.0 studio-docs:check
  corepack pnpm@11.21.0 test:studio-docs
  corepack pnpm@11.21.0 scenarios:check
  corepack pnpm@11.21.0 exec prettier --check 'README.md' 'AGENTS.md' 'packages/webgl/README.md' 'docs/**/*.md'
  ```

  Expected: PASS with no undocumented or stale public exports.

- [ ] **Step 7: Commit contracts and documentation without unrelated files**

  ```bash
  git add README.md AGENTS.md packages/webgl/README.md docs/design docs/site docs/library-status.md tooling/docs-contract-preservation-baseline.json
  git commit -m "docs(webgl): specify settled scene rendering"
  ```

### Task 9: Run visual, package, lifecycle, and aggregate trust gates

**Files:**

- Inspect without modifying: `packages/core/test/visual-baselines/webgl-islands.expected.png`
- Create: `docs/testing/field-notes/2026-09-13-webgl-settled-scene-rendering.md`

**Interfaces:**

- Consumes: the completed implementation, public scenario, package builds, Studio builds, Chromium output, deterministic counters, and repository trust scripts.
- Produces: fresh verification evidence with command, documented environment, result, intentional visual-diff rationale if any, and final working-tree audit.

- [ ] **Step 1: Run focused semantic tests before screenshots**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib packages/core/test/webgl-lab.test.ts packages/core/test/webgl-ownership.test.ts packages/core/test/webgl-performance.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS. Confirm the tests explicitly cover one traversal, first-GL-after-composition, late siblings, alpha queues, sorting, picking, rollback, cache hits, context restoration, and exact final disposal.

- [ ] **Step 2: Run type, build, consumer, and Studio gates**

  ```bash
  corepack pnpm@11.21.0 typecheck
  corepack pnpm@11.21.0 build
  corepack pnpm@11.21.0 test:package-consumer
  corepack pnpm@11.21.0 test:package-consumer:packed
  corepack pnpm@11.21.0 playground:build
  corepack pnpm@11.21.0 playground:build:built
  ```

  Expected: PASS for root and package declarations, Bundler/NodeNext, packed runtime, and source/built Studio modes.

- [ ] **Step 3: Run lifecycle and structural performance gates**

  ```bash
  corepack pnpm@11.21.0 test:lifecycle
  corepack pnpm@11.21.0 test:performance
  ```

  Expected: PASS with zero leaked/duplicate-released resources and no additional traversal, transfer, framebuffer, or readback work.

- [ ] **Step 4: Inspect WebGL visual output**

  Run the existing visual safeguard/browser route that emits expected, actual, and diff output. Inspect all three images. The captured filtered scene is opaque and should remain unchanged, while the new transparency case is asserted semantically outside the baseline. If the baseline differs, treat that as an unexpected rendering regression and diagnose it before proceeding; do not update the expected image in this project.

  ```bash
  corepack pnpm@11.21.0 test:visual-safeguard
  corepack pnpm@11.21.0 test:studio-visual
  ```

- [ ] **Step 5: Run the aggregate trust gate**

  ```bash
  corepack pnpm@11.21.0 trust
  ```

  Expected: PASS on the documented environment. Do not substitute dated documentation totals for this fresh result.

- [ ] **Step 6: Write the verification field note**

  Record Node/pnpm/Chromium versions, exact commands, fresh results, any reviewed visual diff, and the intentional public breaking removals. State explicitly that lighting remains the next project and that the settled-scene lifecycle is now its prerequisite.

- [ ] **Step 7: Audit the diff and forbidden references**

  ```bash
  git status --short
  git diff --check 3b09bb5..HEAD
  rg -n "defineWebGLPrimitive|pibblWebGLContext|PibblWebGLContext|WebGLResourceGenerationRegistry|ownedResourceGeneration" packages playground tooling README.md AGENTS.md docs/design docs/site docs/library-status.md
  ```

  Expected: only the two known unrelated working-tree items remain unstaged; diff check is clean; current code/docs contain no forbidden API/ownership remnants. The separately committed particle-effects design remains untouched and falls before this implementation diff boundary.

- [ ] **Step 8: Commit final verified evidence**

  ```bash
  git add docs/testing/field-notes/2026-09-13-webgl-settled-scene-rendering.md
  git commit -m "test(webgl): record settled scene verification"
  ```

  Confirm the baseline is unchanged; the unrelated `tooling/verify-docs.mjs` and `docs/strategy/particle-effects-research.md` changes were never staged; and the separately committed `docs/superpowers/specs/2026-09-13-first-class-particle-effects-design.md` was not modified.

## Completion Boundary

This plan is complete only when all nine tasks pass, the aggregate trust gate is fresh and green, the current public API contains no traversal-time raw GL escape hatch, and one `WebGLLayer` demonstrably composes a complete frame-local scene before any renderer work begins.

After this checkpoint, start the separate lighting/material/environment design named in the approved spec. That next project can extend the scene-entry union and renderer passes, but it must not reopen the compose → settle → render → commit lifecycle decided here.
