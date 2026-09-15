# WebGL Orbit Camera and Genuine Shadows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a composable `crcOrbitCamera()` pose-and-handler hook plus cached genuine shadow maps for every direct WebGL light, then make the complete lighting vertical slice interactive, documented, browser-visible, and fully verified.

**Architecture:** `crcOrbitCamera()` retains spherical state in component hook slots and returns ordinary camera values plus stable CRC event handlers; `WebGLLayer` continues to consume only a plain camera descriptor. Shadow participation is composed and settled entirely on the CPU, while the renderer owns per-light transactional depth resources, renders directional/spot single-view and point six-view maps, and samples them only against each light's direct Lambert contribution. Camera-only renders reuse light-space generations.

**Tech Stack:** TypeScript, CRC automatic JSX and signal/event hooks, WebGL2/GLSL ES 3.00, depth textures and framebuffers, Vitest browser mode with Playwright Chromium, pnpm 11.21.0 on Node 24.15.0, Markdown public documentation, deterministic scenario catalogs, and Studio/browser visual evidence.

**Spec:** [`docs/superpowers/specs/2026-09-15-webgl-orbit-camera-and-genuine-shadows-design.md`](../specs/2026-09-15-webgl-orbit-camera-and-genuine-shadows-design.md)

## Global Constraints

- Work only in `/Users/benlesh/GitHub/crc/.worktrees/webgl-lighting-materials` on `codex/webgl-lighting-materials`; preserve every unrelated main-checkout change.
- Start from approved design commit `9286895`. Existing commits through `5e9e5e9` implement the lighting/material/background runtime and eleven Studio-visible lessons; this plan incorporates the unfinished laboratory, documentation, consumer, review, and verification tail from the 2026-09-14 lighting plan rather than running that tail separately.
- Use a fresh implementer subagent for each task and a fresh spec-compliance/code-quality reviewer gate before the next task. Reviewers inspect tests and diffs but do not rerun commands during Tasks 1-10.
- Add failing observable evidence before production behavior. Public features require public-import/JSX evidence in addition to private unit tests.
- During Tasks 1-10, run only the focused RED and GREEN commands named by that task. Do not run `trust`, any `trust:*` script, `test:ci`, a broad lifecycle/performance suite, or a visual aggregate.
- Task 11 performs all baseline capture, branch-wide review, full aggregate verification, and browser inspection after implementation and documentation settle.
- The documented execution environment is Node 24.15.0 or newer on the Node 24 LTS line, pnpm 11.21.0, and Playwright Chromium. Use `fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0` for plan commands.
- Preserve one CPU-only child traversal, settled-scene ordering, opaque/transparent queues, geometry-based picking/focus, transactional bitmap/pick/focus publication, context-generation isolation, and exact teardown ownership.
- `WebGLLayer.camera` remains `CRCWebGLPerspectiveCamera | undefined`; do not add a camera class, `controls` prop, independent animation loop, or WebGL input subsystem.
- `crcOrbitCamera()` returns exactly `{ position, lookAt, handlers }`; handlers use ordinary CRC pointer/wheel events and request no idle frames.
- `WebGLLayer.style.shadows` is `false | "low" | "medium" | "high"`, defaults to `"medium"`, and means 0/512/1024/2048 requested pixels per view with 0/1/4/9 depth comparisons.
- Directional, point, and spot lights cast by default. Ambient and hemisphere lights never expose `castShadow`. CRC never silently chooses a primary shadow light.
- Opaque meshes cast and receive by default; partial-alpha meshes receive when lit but do not cast by default; final-alpha-zero meshes do neither even under an explicit `true`.
- Shadowing attenuates only the matching direct light's diffuse contribution. Ambient, hemisphere, other direct lights, and emissive contribution remain independent.
- Do not add panning, damping, autorotation, multi-touch pinch, cascades, screen-space/fake shadows, transmissive shadows, public shadow cameras/bias/map sizes, textures, PBR, HDR, environments, bloom, or raw GL access.
- Do not rewrite a visual baseline merely to pass. In Task 11 inspect actual, expected, and diff images and record why each intentional new baseline is correct.

---

### Task 1: Add the composable orbit-camera hook

**Files:**

- Create: `packages/webgl/src/lib/hooks/crc-orbit-camera.ts`
- Create: `packages/webgl/src/lib/hooks/crc-orbit-camera.test.tsx`
- Modify: `packages/core/src/internal.ts`
- Modify: `packages/webgl/src/index.ts`

**Interfaces:**

- Consumes: public `signal`, `CRCEventHandlers`, `CRCPointerEvent`, and `CRCWheelEvent`; friend `useInternalHookSlot` plus two narrow render-context helpers.
- Produces: `CRCOrbitCameraOptions`, `CRCOrbitCameraHandlers`, `CRCOrbitCameraResult`, and `crcOrbitCamera(options)` with stable handlers and value snapshots.

- [ ] **Step 1: Write failing public hook evidence.**

Create browser tests that import `crcOrbitCamera` from `@crc/webgl`, mount it in an ordinary CRC component, attach `result.handlers` to a Rectangle, and assert the exact initial pose, required handler keys, stable handler identities across a successful rerender, unchanged vector snapshot identity when values are equal, primary-pointer capture, root-logical drag deltas, unrelated-pointer rejection, pole clamping, wheel scaling, min/max distance clamping, one coalesced scheduled update per input change, and no idle frame request.

```tsx
const orbit = crcOrbitCamera({
  orbitPoint: [0, 1, 0],
  initialPosition: [0, 1, 10],
  minDistance: 2,
  maxDistance: 12,
});
snapshots.push({
  position: orbit.position,
  lookAt: orbit.lookAt,
  handlers: orbit.handlers,
});
return <Rectangle {...orbit.handlers} style={{ width: 200, height: 120 }} />;
```

- [ ] **Step 2: Run the focused hook test and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/hooks/crc-orbit-camera.test.tsx \
  --browser.headless --browser.ui=false
```

Expected: collection or assertions fail because `crcOrbitCamera` and its exported types do not exist.

- [ ] **Step 3: Add the narrow official-package render helpers.**

Export these version-coupled helpers only from `@crc/core/internal`; do not add them to `@crc/core`:

```ts
export function getCurrentLogicalViewport(): Readonly<{
  width: number;
  height: number;
}> {
  const surface = getSurfaceSnapshot(getCurrentCRCInstance());
  return Object.freeze({
    width: surface.logicalWidth,
    height: surface.logicalHeight,
  });
}

export function onCurrentRenderFinish(
  callback: (success: boolean) => void,
): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction)
    throw new Error(
      "onCurrentRenderFinish requires an active CRC render transaction.",
    );
  transaction.onFinish(callback);
}
```

- [ ] **Step 4: Implement the stable hook slot and handlers.**

Validate every candidate before accessing the slot. Store azimuth, polar angle, distance, one active pointer record, a signal-backed pose revision, latest committed live options, cached immutable position/lookAt snapshots, and one frozen required handler object in the slot. Use `onCurrentRenderFinish` plus a render revision to adopt only the latest successful options. Use the candidate `orbitPoint` and clamped candidate distance for the current returned pose, reusing each cached vector object when its numeric values are unchanged.

```ts
export function crcOrbitCamera(
  options: CRCOrbitCameraOptions,
): CRCOrbitCameraResult {
  const candidate = normalizeOrbitOptions(options);
  const viewport = getCurrentLogicalViewport();
  const slot = useInternalHookSlot<OrbitSlot>("webglOrbitCamera", (teardowns) =>
    createOrbitSlot(candidate, teardowns),
  ).value;
  slot.revision.get();
  stageOrbitOptions(slot, candidate, viewport);
  return snapshotOrbitResult(slot, candidate);
}
```

Use `0.01 * rotateSpeed` radians per root-logical drag pixel, clamp polar angle to `0.001..Math.PI - 0.001`, normalize wheel input with multipliers 1 pixel for pixel mode, 16 pixels for line mode, and the root logical height for page mode, and multiply distance by `Math.exp(deltaY * 0.001 * zoomSpeed)`. Call `preventDefault()` only when wheel input changes distance.

- [ ] **Step 5: Run the focused hook test and confirm GREEN.**

Run the Step 2 command. Expected: all orbit-hook tests pass with no continuously pending frame after input settles.

- [ ] **Step 6: Review and commit the hook.**

Confirm the root export contains no camera instance/class and the core root package exposes neither helper.

```sh
git add packages/core/src/internal.ts packages/webgl/src/index.ts packages/webgl/src/lib/hooks/crc-orbit-camera.ts packages/webgl/src/lib/hooks/crc-orbit-camera.test.tsx
git commit -m "feat(webgl): add composable orbit camera hook"
```

---

### Task 2: Carry shadow quality through the retained layer boundary

**Files:**

- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/components/webgl-layer.ts`
- Modify: `packages/webgl/src/lib/components/webgl-layer.test.tsx`
- Modify: `packages/webgl/src/lib/layer-controller.ts`
- Modify: `packages/webgl/src/lib/layer-controller.test.ts`
- Modify: `packages/webgl/src/lib/backend.ts`
- Modify: `packages/webgl/src/lib/backend.test.ts`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/composer.ts`
- Modify: `packages/webgl/src/lib/scene/composer.test.ts`
- Modify: `packages/webgl/src/index.ts`

**Interfaces:**

- Consumes: current WebGLLayer style resolution, controller retained-generation equality, and `CreateWebGLSceneComposerInput`.
- Produces: `CRCWebGLShadowQuality`, one normalized layer quality snapshot, and `ClosedWebGLSceneDraft.shadowQuality`.

- [ ] **Step 1: Add failing quality/default/cache-boundary tests.**

Assert omission resolves to `"medium"`; all four values reach the closed CPU draft; invalid runtime values name `WebGLLayer style.shadows`; a quality change invalidates the retained child generation once; an equal value reuses it; and `false` performs no shadow-specific GL operation.

```tsx
<WebGLLayer style={{ width: 64, height: 64, shadows: "high" }}>
  <Cube style={{ lit: false }} />
</WebGLLayer>
```

- [ ] **Step 2: Run the focused retained-boundary tests and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/components/webgl-layer.test.tsx \
  packages/webgl/src/lib/layer-controller.test.ts \
  packages/webgl/src/lib/backend.test.ts \
  packages/webgl/src/lib/scene/composer.test.ts \
  --browser.headless --browser.ui=false
```

Expected: type/runtime assertions fail because `shadows` is not part of the layer or composer contract.

- [ ] **Step 3: Normalize quality in `WebGLLayer`.**

```ts
export type CRCWebGLShadowQuality = false | "low" | "medium" | "high";

function resolveShadowQuality(value: unknown): CRCWebGLShadowQuality {
  if (value === undefined) return "medium";
  if (
    value === false ||
    value === "low" ||
    value === "medium" ||
    value === "high"
  ) {
    return value;
  }
  throw new TypeError(
    'WebGLLayer style.shadows must be false, "low", "medium", or "high".',
  );
}
```

Add the resolved quality to the layer style and pass it through controller construction and both render methods.

- [ ] **Step 4: Make quality part of retained equality and frame composition.**

Track `currentShadowQuality`, `retainedShadowQuality`, and each pending/committed generation's quality. Add `getShadowQuality` to `CreateWebGLBackendOptions`; snapshot it into every composer and closed draft. A quality-only update must execute the private child exactly once and publish a replacement candidate.

- [ ] **Step 5: Run the focused retained-boundary tests and confirm GREEN.**

Run the Step 2 command. Expected: all four files pass and composition remains CPU-only.

- [ ] **Step 6: Review and commit quality propagation.**

```sh
git add packages/webgl/src
git commit -m "feat(webgl): add layer shadow quality"
```

---

### Task 3: Settle light and mesh shadow participation

**Files:**

- Modify: `packages/webgl/src/lib/components/lights.ts`
- Modify: `packages/webgl/src/lib/components/lights.test.tsx`
- Modify: `packages/webgl/src/lib/components/mesh.ts`
- Modify: `packages/webgl/src/lib/components/mesh.test.tsx`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/composer.ts`
- Modify: `packages/webgl/src/lib/scene/composer.test.ts`
- Modify: `packages/webgl/src/lib/scene/settle.ts`
- Modify: `packages/webgl/src/lib/scene/settle.test.ts`

**Interfaces:**

- Consumes: final mesh alpha, `style.lit`, direct-light settled pose, and one stable private light declaration identity.
- Produces: optional submitted `castShadow`/`receiveShadow`, effective `SettledWebGLMesh.castsShadow`/`receivesShadow`, and direct-light `identity`/`castsShadow` fields.

- [ ] **Step 1: Add failing public and settlement tests.**

Cover closed style-key/type validation; default-true direct lights; absence of the field on ambient/hemisphere types; opaque, partial-alpha, and zero-alpha mesh defaults; explicit overrides; unlit/emissive casting; final-alpha-zero dominance; and unchanged pick/focus records.

```ts
expect(settled.opaque[0]).toMatchObject({
  castsShadow: true,
  receivesShadow: true,
});
expect(settled.transparent[0]).toMatchObject({
  castsShadow: false,
  receivesShadow: true,
});
expect(
  settled.lights.find((light) => light.kind === "directional"),
).toMatchObject({
  castsShadow: true,
});
```

- [ ] **Step 2: Run the focused component/settlement tests and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/components/lights.test.tsx \
  packages/webgl/src/lib/components/mesh.test.tsx \
  packages/webgl/src/lib/scene/composer.test.ts \
  packages/webgl/src/lib/scene/settle.test.ts \
  --browser.headless --browser.ui=false
```

Expected: assertions fail because submissions and settled records contain no shadow participation.

- [ ] **Step 3: Resolve and snapshot the new style booleans.**

Add `castShadow?: boolean` to directional/point/spot styles and both fields to `MeshStyle`. Reuse a field-aware resolver:

```ts
function resolveOptionalBoolean(
  componentName: string,
  fieldName: string,
  value: boolean | undefined,
): boolean | undefined {
  if (value !== undefined && typeof value !== "boolean") {
    throw new TypeError(`${componentName} ${fieldName} must be a boolean.`);
  }
  return value;
}
```

Create one private frozen identity per mounted direct-light primitive with `useInternalHookSlot("webglLightIdentity", () => Object.freeze({}))` and submit it with the light record. The identity owns no GPU or event resource.

- [ ] **Step 4: Derive effective participation during settlement.**

```ts
const alpha = mesh.color[3];
const castsShadow = alpha === 0 ? false : (mesh.castShadow ?? alpha === 1);
const receivesShadow = alpha === 0 ? false : (mesh.receiveShadow ?? mesh.lit);
```

Direct lights use `castsShadow = submission.castShadow ?? true`. Ambient and hemisphere records remain shadow-field-free. Preserve all existing queue and target behavior.

- [ ] **Step 5: Run the focused component/settlement tests and confirm GREEN.**

Run the Step 2 command. Expected: all participation/default/error tests pass without a GL call during composition or settlement.

- [ ] **Step 6: Review and commit participation semantics.**

```sh
git add packages/webgl/src/lib/components packages/webgl/src/lib/scene
git commit -m "feat(webgl): settle shadow participation"
```

---

### Task 4: Build deterministic shadow projections and cache keys

**Files:**

- Create: `packages/webgl/src/lib/scene/shadows.ts`
- Create: `packages/webgl/src/lib/scene/shadows.test.ts`
- Modify: `packages/webgl/src/lib/math/matrix4.ts`
- Modify: `packages/webgl/src/lib/math/matrix4.test.ts`
- Modify: `packages/webgl/src/lib/scene/settle.ts`
- Modify: `packages/webgl/src/lib/scene/settle.test.ts`

**Interfaces:**

- Consumes: settled world models, immutable geometry bounds, light pose/range/cone, effective participation, and layer quality.
- Produces: `SettledWebGLShadowPlan`, `SettledWebGLShadowLightPlan`, `SettledWebGLShadowCaster`, world bounds, one/six view-projection matrices, requested resolution, comparison count, and semantic cache equality.

- [ ] **Step 1: Add failing pure projection tests.**

Prove exact quality mappings, transformed eight-corner AABBs, stable directional fits, spot outer-cone perspective, six canonical point directions/up vectors, finite-range and derived-far behavior, pole-parallel up fallback, no-light/no-caster/no-receiver empty plans, and equality that ignores camera/base color but detects geometry/model/projection/caster changes.

```ts
expect(planShadowQuality("medium")).toEqual({
  quality: "medium",
  requestedResolution: 1024,
  comparisonCount: 4,
});
expect(pointPlan.viewProjectionMatrices).toHaveLength(6);
expect(sameShadowDepthPlan(before, cameraOnlyChange)).toBe(true);
```

- [ ] **Step 2: Run the focused math/settlement tests and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/math/matrix4.test.ts \
  packages/webgl/src/lib/scene/shadows.test.ts \
  packages/webgl/src/lib/scene/settle.test.ts \
  --browser.headless --browser.ui=false
```

Expected: tests fail because orthographic and shadow-plan functions are missing.

- [ ] **Step 3: Add orthographic and world-bounds math.**

```ts
export function setOrthographicMatrix4<T extends WritableNumbers>(
  out: T,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
): T;
```

Transform all eight immutable geometry-bound corners through the model matrix and reject non-finite or degenerate derived projection extents with a source-aware diagnostic.

- [ ] **Step 4: Produce immutable per-light shadow plans.**

Use these private shapes consistently in later tasks:

```ts
export interface SettledWebGLShadowCaster {
  readonly geometry: CRCWebGLGeometry;
  readonly model: Readonly<Float32Array>;
  readonly sourceIndex: number;
}

export interface SettledWebGLShadowLightPlan {
  readonly identity: object;
  readonly lightIndex: number;
  readonly kind: "directional" | "point" | "spot";
  readonly far: number;
  readonly bias: number;
  readonly viewProjectionMatrices: readonly Readonly<Float32Array>[];
  readonly casters: readonly SettledWebGLShadowCaster[];
}

export interface SettledWebGLShadowPlan {
  readonly quality: CRCWebGLShadowQuality;
  readonly requestedResolution: number;
  readonly comparisonCount: 0 | 1 | 4 | 9;
  readonly lights: readonly SettledWebGLShadowLightPlan[];
}
```

Directional/spot plans contain one matrix and point plans contain six. Derive automatic projection extents from settled caster/receiver world bounds, but keep the presentation camera out of shadow equality.

- [ ] **Step 5: Attach the plan to `SettledWebGLScene`.**

Settle meshes and direct lights first, then call `settleWebGLShadowPlan`. `false` produces resolution/comparisons zero and no light plans. Add `worldBounds` to settled meshes for the planner without changing pick/focus geometry.

- [ ] **Step 6: Run the focused math/settlement tests and confirm GREEN.**

Run the Step 2 command. Expected: all projection matrices and semantic equality assertions pass.

- [ ] **Step 7: Review and commit shadow planning.**

```sh
git add packages/webgl/src/lib/math packages/webgl/src/lib/scene
git commit -m "feat(webgl): plan light-space shadow views"
```

---

### Task 5: Add the shadow-depth and shadow-sampling programs

**Files:**

- Modify: `packages/webgl/src/lib/gpu/program-sources.ts`
- Modify: `packages/webgl/src/lib/gpu/program.ts`
- Modify: `packages/webgl/src/lib/gpu/program.test.ts`

**Interfaces:**

- Consumes: eight fixed light slots, one/six shadow projections, per-mesh receive state, and 1/4/9 comparisons.
- Produces: `WebGLProgramKey = "unlit" | "lambert" | "shadow-depth"`, `WebGLShadowDepthProgram`, and complete Lambert shadow uniforms/samplers.

- [ ] **Step 1: Add failing fake-GL and real-WebGL2 program tests.**

Assert the depth key selects distinct sources; every required depth/Lambert location is resolved and source-named on failure; all three programs compile/link in Chromium; and deletion remains exact by handle.

```ts
expect(
  createBuiltInProgram(gl, "shadow-depth", "DirectionalLight"),
).toMatchObject({
  key: "shadow-depth",
  positionAttribute: 0,
});
```

- [ ] **Step 2: Run the focused program test and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/gpu/program.test.ts \
  --browser.headless --browser.ui=false
```

Expected: compile-time/runtime failures report the absent `shadow-depth` key and uniforms.

- [ ] **Step 3: Add a depth-only built-in program.**

The vertex stage transforms `a_position` by `u_shadow_projection_view * u_model` and passes world position. The fragment stage writes ordinary `gl_FragCoord.z` for directional/spot views and radial `distance(v_world_position, u_shadow_light_position) / u_shadow_far` for point faces.

```glsl
uniform int u_shadow_radial;
uniform vec3 u_shadow_light_position;
uniform float u_shadow_far;

void main() {
  gl_FragDepth = u_shadow_radial == 1
    ? clamp(distance(v_world_position, u_shadow_light_position) / u_shadow_far, 0.0, 1.0)
    : gl_FragCoord.z;
}
```

- [ ] **Step 4: Extend Lambert with fixed-slot shadow sampling.**

Add per-frame `u_shadow_enabled[8]`, `u_shadow_matrix[8]`, `u_shadow_far_bias[8]`, `u_shadow_texel_size[8]`, and `u_shadow_comparison_count`; per-mesh `u_receive_shadow`; eight `sampler2D` and eight `samplerCube` uniforms. Generate constant-index branch functions in TypeScript so GLSL never dynamically indexes a sampler array.

```glsl
float direct_light_visibility(int index, int kind, vec3 world_position) {
  if (u_receive_shadow == 0 || u_shadow_enabled[index] == 0) return 1.0;
  if (kind == LIGHT_KIND_POINT) return sample_point_shadow(index, world_position);
  return sample_projected_shadow(index, world_position);
}
```

Multiply only the directional/point/spot diffuse result for the matching loop index by this visibility. Leave ambient, hemisphere, and emissive equations byte-for-byte equivalent.

- [ ] **Step 5: Run the focused program test and confirm GREEN.**

Run the Step 2 command. Expected: all three programs compile in real WebGL2 and fake-GL cleanup/location tests pass.

- [ ] **Step 6: Review and commit the program family.**

Confirm no public shader strings, callbacks, map sizes, or bias values escaped.

```sh
git add packages/webgl/src/lib/gpu/program-sources.ts packages/webgl/src/lib/gpu/program.ts packages/webgl/src/lib/gpu/program.test.ts
git commit -m "feat(webgl): add shadow map shaders"
```

---

### Task 6: Own per-light shadow resources transactionally

**Files:**

- Create: `packages/webgl/src/lib/gpu/shadow-resources.ts`
- Create: `packages/webgl/src/lib/gpu/shadow-resources.test.ts`

**Interfaces:**

- Consumes: `SettledWebGLShadowLightPlan`, requested resolution, target-specific context limits, and semantic plan equality.
- Produces: `WebGLShadowResourceCache`, `WebGLShadowResourceTransaction`, and leases for reusable/candidate 2D or cube depth textures.

- [ ] **Step 1: Add failing resource ownership tests.**

Cover lazy framebuffer/dummy allocation; `DEPTH_COMPONENT24` 2D/cube creation; framebuffer completeness failure; target-specific resolution clamping; exact six cube faces; resident reuse; one-light replacement without replacing siblings; sweep of omitted lights; candidate rollback; renderer shadow-program-generation invalidation; context-loss abandonment; cleanup-error reporting; and exact-once healthy disposal.

```ts
const transaction = cache.beginFrame();
const first = transaction.acquire(directionalPlan, 1024);
expect(first).toMatchObject({ needsRender: true, resolution: 1024, faces: 1 });
transaction.commit();

const reused = cache.beginFrame().acquire(equalDirectionalPlan, 1024);
expect(reused.needsRender).toBe(false);
```

- [ ] **Step 2: Run the focused resource test and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/gpu/shadow-resources.test.ts \
  --browser.headless --browser.ui=false
```

Expected: collection fails because the shadow cache module does not exist.

- [ ] **Step 3: Implement candidate/resident ownership.**

Use stable direct-light identity as the resident map key. Equal plans lease the resident texture; changed plans allocate a candidate texture and leave the previous resident untouched until commit. Commit installs candidates and deletes replaced/omitted healthy resources; rollback deletes only candidate handles.

```ts
export interface WebGLShadowResourceLease {
  readonly texture: WebGLTexture;
  readonly target: "2d" | "cube";
  readonly resolution: number;
  readonly faces: 1 | 6;
  readonly needsRender: boolean;
}

export interface WebGLShadowResourceTransaction {
  acquire(
    plan: SettledWebGLShadowLightPlan,
    requestedResolution: number,
  ): WebGLShadowResourceLease;
  attach(lease: WebGLShadowResourceLease, face: number): void;
  bindSamplingTextures(lights: readonly SettledWebGLShadowLightPlan[]): void;
  commit(): void;
  rollback(contextLost?: boolean): void;
}
```

`beginFrame` also snapshots the renderer shadow-program generation, which participates in resident equality even when all semantic light/caster inputs remain equal.

- [ ] **Step 4: Allocate complete fallback textures and one framebuffer.**

Bind one complete 1x1 depth `TEXTURE_2D` fallback to unused 2D slots and one complete 1x1 depth cube fallback to unused cube slots. Assign texture units 0-7 to 2D slots and 8-15 to cube slots. Configure depth textures with clamp-to-edge and nearest sampling; filtering comes from explicit shader comparisons.

- [ ] **Step 5: Run the focused resource test and confirm GREEN.**

Run the Step 2 command. Expected: all ownership, rollback, clamp, and exact-delete assertions pass.

- [ ] **Step 6: Review and commit the resource cache.**

```sh
git add packages/webgl/src/lib/gpu/shadow-resources.ts packages/webgl/src/lib/gpu/shadow-resources.test.ts
git commit -m "feat(webgl): own shadow map resources"
```

---

### Task 7: Render and sample directional and spot shadows

**Files:**

- Modify: `packages/webgl/src/lib/gpu/state.ts`
- Modify: `packages/webgl/src/lib/gpu/state.test.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.test.ts`
- Modify: `packages/webgl/src/lib/lighting-rendering.test.tsx`

**Interfaces:**

- Consumes: one-view shadow plans, shadow-depth program, shadow resource transactions, and Lambert shadow uniforms.
- Produces: depth-pass-before-color ordering, cached projected shadows, and real browser pixels for directional and spot occlusion.

- [ ] **Step 1: Add failing renderer/state/pixel tests.**

Assert a dirty directional/spot light performs one clear/depth pass before the default-framebuffer background clear; draws only effective casters; binds all fixed sampler units; writes `u_receive_shadow`; uses 1/4/9 comparisons; leaves unlit and nonreceiving pixels unchanged; and makes an occluded ground pixel darker than a nearby lit pixel in real WebGL2.

```ts
expect(operationCount(recording.operations, "framebufferTexture2D")).toBe(1);
expect(indexOf(recording.operations, "shadow:draw")).toBeLessThan(
  indexOf(recording.operations, "default:clear"),
);
```

- [ ] **Step 2: Run the focused direct-shadow tests and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/gpu/state.test.ts \
  packages/webgl/src/lib/scene/renderer.test.ts \
  packages/webgl/src/lib/lighting-rendering.test.tsx \
  --browser.headless --browser.ui=false
```

Expected: renderer ordering/pixel assertions fail because no depth pass or shadow sampling occurs.

- [ ] **Step 3: Add an isolated shadow-depth state installer.**

Configure the bound shadow framebuffer for depth test/write, disabled blending, disabled color writes, front-face polygon offset, and the lease resolution. Always restore the full renderer baseline before binding and clearing the default framebuffer.

```ts
export function installShadowDepthWebGLPass(
  gl: WebGL2RenderingContext,
  resolution: number,
  slopeBias: number,
  constantBias: number,
): void;
```

- [ ] **Step 4: Render dirty one-view leases.**

Begin both ordinary resource and shadow transactions after the baseline capability read. For each directional/spot lease with `needsRender`, attach face zero, clear depth, bind the shadow-depth program, upload its one projection-view matrix and radial flag zero, and draw every settled caster with its resident position/index geometry.

- [ ] **Step 5: Bind shadow inputs during Lambert color rendering.**

Restore baseline/default framebuffer, clear background/depth, bind all real/fallback shadow textures, upload fixed light-slot shadow metadata once per Lambert program per frame, and upload `u_receive_shadow` per mesh. Commit both resource transactions only after opaque and transparent queues complete; roll both back on failure.

- [ ] **Step 6: Run the focused direct-shadow tests and confirm GREEN.**

Run the Step 2 command. Expected: deterministic directional and spot shadow pixels plus renderer ordering/state tests pass.

- [ ] **Step 7: Review and commit direct shadows.**

```sh
git add packages/webgl/src/lib/gpu/state.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/scene/renderer.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/lighting-rendering.test.tsx
git commit -m "feat(webgl): render directional and spot shadows"
```

---

### Task 8: Render point-light cube shadows and prove cache/lifecycle behavior

**Files:**

- Modify: `packages/webgl/src/lib/scene/renderer.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.test.ts`
- Modify: `packages/webgl/src/lib/lighting-rendering.test.tsx`
- Modify: `packages/webgl/src/lib/gpu/shadow-resources.test.ts`
- Modify: `packages/webgl/src/lib/context-lifecycle.test.tsx`
- Modify: `packages/webgl/src/lib/webgl-performance.test.tsx`

**Interfaces:**

- Consumes: six-view point plans, cube leases, radial depth shader path, main-shader cube sampling, and controller camera invalidation.
- Produces: omnidirectional point shadows, per-light cache reuse/replacement, rollback, context restoration, and no depth regeneration for camera-only orbit.

- [ ] **Step 1: Add failing point/caching/lifecycle tests.**

Assert one dirty point light attaches and clears six cube faces in canonical order; each face uses radial mode and matching projection; a cube occludes the ground from the point source in real pixels; equal light/casters reuse all faces; camera-only updates issue color draws but zero shadow clears/draws; changing one light replaces only that light; caster changes invalidate every affected direct light; depth/color failures release candidates without corrupting resident reuse; transfer failure publishes no bitmap/pick/focus generation and leaks nothing while leaving already-valid renderer shadow caches reusable; and context loss abandons the lost generation.

```ts
expect(recording.shadowFaces).toEqual([0, 1, 2, 3, 4, 5]);
expect(recording.shadowRadialValues).toEqual([1, 1, 1, 1, 1, 1]);
expect(afterOrbit.shadowDraws - beforeOrbit.shadowDraws).toBe(0);
```

- [ ] **Step 2: Run the focused point/cache/lifecycle tests and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/scene/renderer.test.ts \
  packages/webgl/src/lib/lighting-rendering.test.tsx \
  packages/webgl/src/lib/gpu/shadow-resources.test.ts \
  packages/webgl/src/lib/context-lifecycle.test.tsx \
  packages/webgl/src/lib/webgl-performance.test.tsx \
  --browser.headless --browser.ui=false
```

Expected: six-face and reuse assertions fail while the one-view implementation remains green.

- [ ] **Step 3: Execute six radial depth views for point lights.**

For each dirty cube lease, loop faces `0..5`, attach `TEXTURE_CUBE_MAP_POSITIVE_X + face`, upload the corresponding settled matrix, set radial mode one, light position, and far distance, clear depth, and draw the caster queue.

- [ ] **Step 4: Finish point sampling and cache invalidation.**

Select the major cube direction from `worldPosition - lightPosition`, compare normalized radial distance minus private bias, and apply the tier's 1/4/9 tangent-space offsets. Keep color/intensity-only and presentation-camera changes outside `sameShadowDepthPlan`; include projection, caster geometry/model/alpha class, quality, and context generation.

- [ ] **Step 5: Close failure and lifecycle paths.**

On ordinary failure, roll back candidate shadow leases before restoring baseline. On context loss, abandon every context-generation handle without deletion. On healthy replacement/removal/disposal, delete each framebuffer, fallback texture, resident/candidate depth texture, and added program exactly once while continuing after cleanup errors.

- [ ] **Step 6: Run the focused point/cache/lifecycle tests and confirm GREEN.**

Run the Step 2 command. Expected: all five files pass, including zero regenerated shadow faces for a camera-only update.

- [ ] **Step 7: Review and commit point shadows and lifecycle.**

```sh
git add packages/webgl/src/lib/scene packages/webgl/src/lib/gpu packages/webgl/src/lib/context-lifecycle.test.tsx packages/webgl/src/lib/lighting-rendering.test.tsx packages/webgl/src/lib/webgl-performance.test.tsx
git commit -m "feat(webgl): add cached point light shadows"
```

---

### Task 9: Make the shared lighting scenes orbitable and visibly shadowed

**Files:**

- Modify: `tooling/webgl-lighting-example-contract.ts`
- Modify: `tooling/webgl-lighting-example-contract.check.ts`
- Modify: all existing `packages/scenarios/src/learning/webgl/*.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/shadow-quality.example.tsx`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Create: `packages/scenarios/src/webgl-lighting-lab.example.tsx`
- Create: `packages/scenarios/src/webgl-lighting-lab.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/scenarios/package.json`
- Create: `packages/core/test/webgl-lighting-lab.test.ts`
- Modify generated: `docs/scenario-index.md`

**Interfaces:**

- Consumes: `crcOrbitCamera`, default medium shadows, direct-light/mesh defaults, and the existing literal shared-scene contract.
- Produces: twelve identical-base lighting lessons, one dense deterministic laboratory, headless orbit/shadow probes, and the browser-visible `multiple-lights` vertical slice.

- [ ] **Step 1: Strengthen the source contract and write failing lab tests.**

Require exactly twelve ordered lesson IDs by appending `shadow-quality`; require `crcOrbitCamera`, one `Group {...orbit.handlers}`, one transparent viewport hit Rectangle, dynamic `position: orbit.position`/`lookAt: orbit.lookAt`, the same ground geometry, and no differences outside each concept-delta region. Add lab assertions for initial state, drag-changed camera pose, wheel distance, direct shadow pixel contrast, ambient/hemisphere no-shadow behavior, point-light six-direction coverage, quality switching, and disposal.

```ts
export const WEBGL_LIGHTING_EXAMPLE_IDS = [
  "lit-and-unlit",
  "ambient-light",
  "hemisphere-light",
  "directional-light",
  "point-light",
  "spot-light",
  "emissive-material",
  "webgl-background",
  "custom-geometry-normals",
  "multiple-lights",
  "transformed-light",
  "shadow-quality",
] as const;
```

- [ ] **Step 2: Run only the source-contract and lab RED checks.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsx tooling/webgl-lighting-example-contract.check.ts
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/webgl-lighting-lab.test.ts \
  --browser.headless --browser.ui=false
```

Expected: source count/required-fragment checks and missing lab module tests fail.

- [ ] **Step 3: Update the canonical lesson base once and replicate it literally.**

Each lesson calls the hook before returning JSX, wraps the viewport in the handler Group, leaves the two decorative Rectangles noninteractive, adds one transparent full-size Rectangle as empty-space hit geometry, and uses the returned pose in the otherwise unchanged camera.

```tsx
const orbit = crcOrbitCamera({
  orbitPoint: [0, -0.25, 0],
  initialPosition: [5.8, 4.2, 7.8],
  minDistance: 3,
  maxDistance: 18,
});

return (
  <Group {...orbit.handlers}>
    <Rectangle style={{ width: 720, height: 420, fill: "rgba(0, 0, 0, 0)" }} />
    <WebGLLayer
      camera={{
        type: "perspective",
        position: orbit.position,
        lookAt: orbit.lookAt,
        up: [0, 1, 0],
        fieldOfViewDegrees: 50,
        near: 0.1,
        far: 100,
      }}
      style={{ width: 720, height: 420, shadows: layerShadows }}
    >
      {scene}
    </WebGLLayer>
  </Group>
);
```

Every concept delta declares `const layerShadows: CRCWebGLShadowQuality = "medium"`; only `shadow-quality` changes that literal inside its concept-delta markers. Keep the shared `WebGLLayer` style byte-identical outside the delta. Ambient-only and hemisphere-only scenes document that they cannot cast direct shadows; every direct-light scene visibly projects onto the common plane.

- [ ] **Step 4: Build and register the deterministic lighting laboratory.**

Use public imports only. Include every light, background, transformed direct light, opaque/partial/zero-alpha, lit/unlit/emissive/custom-normal meshes, all quality modes through test-owned signals, a common viewport target, and exported immutable probe snapshots. Register scenario id `webgl-lighting`, source id `webgl-lighting-laboratory-example`, test route `#/testing/webgl-lighting`, and package subpath `@crc/scenarios/webgl-lighting-lab`.

- [ ] **Step 5: Run the same two focused checks and confirm GREEN.**

Run the Step 2 commands. Expected: twelve source files pass exact drift validation and the headless laboratory passes semantic orbit/shadow assertions.

- [ ] **Step 6: Regenerate only the scenario index and commit.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 scenarios:write-index
git add tooling/webgl-lighting-example-contract.ts tooling/webgl-lighting-example-contract.check.ts packages/scenarios packages/core/test/webgl-lighting-lab.test.ts docs/scenario-index.md
git commit -m "docs(webgl): add orbitable shadow examples"
```

Do not capture PNG baselines in this task.

---

### Task 10: Synchronize contracts, API docs, Studio types, and consumers

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/library-status.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/user-events-contract.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/focus-and-keyboard-navigation-contract.md`
- Modify: `docs/design/event-resource-ownership.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `docs/site/learn/README.md`
- Create: `docs/site/learn/guides/webgl-lighting.md`
- Modify: `docs/site/learn/guides/webgl-islands.md`
- Modify: `docs/site/api/README.md`
- Create: `docs/site/api/hooks/crc-orbit-camera.md`
- Modify: `docs/site/api/components/{webgl-layer,group-3d,mesh,cube,sphere,directional-light,point-light,spot-light}.md`
- Modify: `docs/site/api/functions/create-webgl-geometry.md`
- Modify: `docs/site/api/types/webgl.md`
- Modify: `tooling/studio-docs/fixtures/api/webgl.ts`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `tooling/verify-studio-visuals.mjs`

**Interfaces:**

- Consumes: the completed public runtime/types, twelve lessons, and deterministic lab.
- Produces: current normative contracts, searchable Learn/API pages, synchronized editor declarations and fixtures, NodeNext/bundler/runtime/packed evidence, the lab visual assertion, and one registered Studio visual route without baseline capture.

- [ ] **Step 1: Add failing consumer/type/docs assertions.**

Add type checks that construct every quality and participation option, call `crcOrbitCamera`, spread required handlers onto a CRC Group/Rectangle, and pass its pose into a plain perspective camera. Add runtime/packed export lists for `crcOrbitCamera`. Add Studio fixture inventories for the four orbit symbols and shadow types/fields. Register the `webgl-lighting` Studio visual route without creating its expected image; the separate laboratory visual remains inside `webgl-lighting-lab.test.ts`.

```ts
const orbit: CRCOrbitCameraResult = crcOrbitCamera({
  orbitPoint: [0, 0, 0],
  initialPosition: [4, 3, 8],
});
const camera: CRCWebGLPerspectiveCamera = {
  type: "perspective",
  position: orbit.position,
  lookAt: orbit.lookAt,
  up: [0, 1, 0],
  fieldOfViewDegrees: 50,
  near: 0.1,
  far: 100,
};
```

- [ ] **Step 2: Run focused static/consumer checks and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 -C packages/webgl run build
fnm exec --using=v24.15.0 -- node tooling/verify-studio-types.mjs
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsx tooling/studio-docs/studio-docs.check.ts
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc -p playground/package-consumer/tsconfig.bundler.json --noEmit
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc -p playground/package-consumer/tsconfig.nodenext.json --noEmit
```

Expected: the newly asserted WebGL build, docs/type inventories, and source consumer projects fail until every surface is synchronized. Packed and runtime consumer execution remain deferred to Task 11's aggregate trust gate.

- [ ] **Step 3: Update normative contracts and repository status.**

Remove statements that WebGL does not promise lighting/materials/backgrounds/shadows. Document compose → settle → shadow depth → color → bitmap commit, direct-light defaults, alpha participation, quality tiers, cache invalidation, six point views, camera-only reuse, hook ownership, ordinary event propagation, no independent hit geometry, and exact GPU teardown.

- [ ] **Step 4: Publish Learn and API documentation.**

The lighting guide teaches the shared scene, all five light families, nested Lambert material/emission, solid background, genuine shadows, and limits. The orbit API page shows `{ position, lookAt, handlers }` attached to one mesh and to a Group with backing Rectangle, explains stable per-render hook identity, and lists exact drag/wheel equations. Component/type pages list every new default and transparency rule.

- [ ] **Step 5: Synchronize Studio and package consumers.**

Copy the exact source declarations into `crc-editor-types.txt`; update grouped fixture ownership and related-type links; exercise JSX and non-JSX authoring in the package consumer; assert runtime and packed exports; keep `@crc/core/internal` absent from application imports.

- [ ] **Step 6: Run the focused static/consumer checks and confirm GREEN.**

Run the Step 2 commands. Expected: the WebGL package build, Studio declaration/docs consistency, and Bundler/NodeNext source consumer type checks pass.

- [ ] **Step 7: Review and commit shipping surfaces.**

```sh
git add AGENTS.md README.md docs packages/webgl playground tooling
git commit -m "docs(webgl): publish orbit cameras and shadows"
```

Do not update visual baselines or run browser aggregates in this task.

---

### Task 11: Consolidated review, visual inspection, and final aggregate verification

**Files:**

- Create after inspection: `packages/core/test/visual-baselines/webgl-lighting.expected.png`
- Create after inspection: `packages/core/test/visual-baselines/studio-webgl-lighting.expected.png`
- Create: `docs/testing/field-notes/2026-09-15-webgl-lighting-orbit-and-shadows.md`
- Modify only for final fixes: files already named in Tasks 1-10
- Modify: both implementation plan checkbox states after evidence is final

**Interfaces:**

- Consumes: the complete branch, both approved specs, both lighting implementation plans, focused evidence, lab route, and Studio route.
- Produces: reviewed fixes, intentionally accepted visual baselines, one fresh aggregate trust result, browser-visible confirmation, final evidence notes, and a clean handoff branch.

- [ ] **Step 1: Run a fresh whole-branch spec and code review before broad verification.**

Compare `a356be2...HEAD` against both approved design specs. Review public API drift, one-traversal settlement, shadow correctness, point six-view cost, cache keys, renderer transaction order, context loss/disposal, orbit handler lifecycle, interaction/focus invariants, examples, docs, and consumers. Record every Critical or Important finding and dispatch focused fix subagents until review is clean.

```sh
git diff --stat a356be2...HEAD
git diff --check a356be2...HEAD
```

- [ ] **Step 2: Run focused commands only for review fixes.**

For each fix, rerun the smallest test file or static command that failed or directly covers the changed contract. Do not start the aggregate gate until the review diff is clean and every focused fix is committed.

- [ ] **Step 3: Capture and inspect only the new visual baselines.**

Run the dedicated lab visual test once to produce its missing-baseline candidate, inspect that candidate, install only the reviewed candidate as `webgl-lighting.expected.png`, rerun the test, and inspect its expected, actual, and diff artifacts. Then build the Playground and update only the registered Studio `webgl-lighting` route; inspect its expected and actual captures before running the route comparison without `--update`. Accept images only when the shared ground plane shows genuine object silhouettes, the scene framing is correct, lighting remains concept-specific, and no Studio diagnostics obscure the preview.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/core/test/webgl-lighting-lab.test.ts --browser.headless --browser.ui=false
# Inspect test-screenshots/webgl-lighting/webgl-lighting.actual.png, then install the reviewed PNG as packages/core/test/visual-baselines/webgl-lighting.expected.png.
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/core/test/webgl-lighting-lab.test.ts --browser.headless --browser.ui=false
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 playground:build
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec node tooling/verify-studio-visuals.mjs --update --route=webgl-lighting
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec node tooling/verify-studio-visuals.mjs --route=webgl-lighting
```

- [ ] **Step 4: Run the complete aggregate trust gate.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

Record Node, pnpm, Playwright Chromium, command, exit status, suite counts, and duration. If it fails, preserve the first output, diagnose only the failing gate, add a failing focused regression where appropriate, commit the fix, rerun the focused gate, and then rerun the full aggregate once the branch is ready for a fresh completion claim.

- [ ] **Step 5: Verify the user-visible browser slice.**

Launch the Studio from this isolated worktree and inspect `#/examples/webgl/multiple-lights` in the in-app browser. Drag on empty viewport space and over geometry, wheel zoom, orbit behind both objects, and confirm the cube and sphere cast genuine moving-view shadows onto the plane without editor diagnostics. Also inspect the shadow-quality lesson at low/medium/high by editing code.

- [ ] **Step 6: Write and commit the evidence record.**

Document approved contracts, commit range, review findings/fixes, focused commands, visual-baseline rationale, aggregate output, and browser observations in the field note. Mark both plans complete only after fresh evidence supports every shipped claim.

```sh
git add packages/core/test/visual-baselines docs/testing/field-notes docs/superpowers/plans
git commit -m "test(webgl): record lighting and shadow trust evidence"
git status --short --branch
```

- [ ] **Step 7: Hand off without integrating destructively.**

Report the isolated worktree path, branch, final commit, fresh aggregate result, browser URL, remaining intentional non-goals, and safe integration choices. Do not merge, rebase, delete the worktree, or modify the user's main checkout without explicit instruction.
