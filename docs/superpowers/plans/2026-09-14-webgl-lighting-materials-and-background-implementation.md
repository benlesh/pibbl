# WebGL Lighting, Materials, and Background Implementation Plan

> **Historical status: IMPLEMENTED.** This plan was completed together with the
> orbit-camera and genuine-shadow follow-on plan. The final implementation and
> aggregate evidence are recorded in
> `docs/testing/field-notes/2026-09-15-webgl-lighting-orbit-and-shadows.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add settled-scene Ambient, Hemisphere, Directional, Point, and Spot lights, default-lit Lambert materials with explicit unlit and emissive behavior, immutable custom-geometry normals, and a solid WebGL background, with one directly editable shared scene across every public demonstration.

**Architecture:** Components continue to compose a CPU-only scene before any WebGL work. Meshes, lights, and the background are separate declarations; settlement validates the complete scene, derives normal matrices and world-space light pose, and produces immutable render/pick/focus plans. The renderer then uses closed `unlit` and `lambert` program keys, fixed eight-light uniforms, transactional program/geometry ownership, the existing opaque/transparent queues, and one default-framebuffer pass.

**Tech Stack:** TypeScript, CRC automatic JSX, WebGL2/GLSL ES 3.00, Vitest browser mode with Playwright Chromium, pnpm 11.21.0 on Node 24.15.0, Markdown public documentation, deterministic scenario catalogs, and pixel/structural browser evidence.

**Spec:** [`docs/superpowers/specs/2026-09-14-webgl-lighting-materials-and-background-design.md`](../specs/2026-09-14-webgl-lighting-materials-and-background-design.md)

## Global Constraints

- Work only in `/Users/benlesh/GitHub/crc/.worktrees/webgl-lighting-materials` on `codex/webgl-lighting-materials`; preserve every unrelated main-checkout change.
- Use a fresh implementer subagent and a fresh reviewer subagent for every task. The reviewer checks the task diff against this plan and the approved spec; Critical or Important findings return to an implementer before the next task.
- Add failing observable evidence before production behavior. Public features require public-import/JSX evidence in addition to internal tests.
- During Tasks 1-11, run only the focused command named by that task. Do not run `trust`, any `trust:*` script, `test:ci`, or a broad lifecycle/performance/visual aggregate.
- Task 12 performs branch-wide review, resolves findings, and runs exactly one complete `fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust` after all fixes are committed.
- Preserve mesh source ordering, transparent bounds-center sorting, pick/focus derivation, transaction semantics, context-generation ownership, and at-most-one bitmap publication.
- Light/background components never acquire event targets or GPU resources. Lighting affects pixels only.
- The total light limit is eight declarations, including ambient, hemisphere, and zero-intensity declarations. The ninth rejects during settlement before WebGL mutation.
- Every public lighting lesson contains the same literal camera, Cube, Sphere, ground-plane positions/indices/normals, transforms, colors, opacity, materials, and framing. Only the named light/background/material delta changes.
- Do not add textures, UVs, tangents, PBR, image environments, shadows, area lights, HDR, tone mapping, bloom, glow, light masks, custom falloff, or many-light rendering.

---

## Task 1: Add immutable geometry normals and correct built-in normals

**Interfaces produced:** `CRCWebGLGeometryInput.normals`, private owned `Float32Array` normal data, flat Cube normals, radial Sphere normals.

**Interfaces consumed later:** settlement normal validation and Lambert normal-buffer uploads.

**Files:**

- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/geometry/geometry.ts`
- Modify: `packages/webgl/src/lib/geometry/geometry.test.ts`
- Modify: `packages/webgl/src/lib/geometry/cube.ts`
- Modify: `packages/webgl/src/lib/geometry/cube.test.ts`
- Modify: `packages/webgl/src/lib/geometry/sphere.ts`
- Modify: `packages/webgl/src/lib/geometry/sphere.test.ts`

- [ ] Add failing geometry tests for normal length, source finiteness, Float32 finiteness, nonzero XYZ vectors, ownership copying, and private retrieval.

```ts
it("copies valid normals into immutable descriptor-owned Float32 data", () => {
  const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0];
  const geometry = createWebGLGeometry({ positions: TRIANGLE, normals });
  normals[1] = 0;

  expect(Array.from(getWebGLGeometryData(geometry).normals!)).toEqual([
    0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]);
});

it.each([
  { normals: [0, 1, 0], message: "length must match positions.length" },
  { normals: [0, 1, 0, 0, NaN, 0, 0, 1, 0], message: "must be finite" },
  { normals: [0, 0, 0, 0, 1, 0, 0, 1, 0], message: "must be nonzero" },
])("rejects invalid normals", ({ normals, message }) => {
  expect(() => createWebGLGeometry({ positions: TRIANGLE, normals })).toThrow(
    message,
  );
});
```

- [ ] Run the focused geometry tests and confirm the new assertions fail for the missing normals contract.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/geometry/geometry.test.ts \
  packages/webgl/src/lib/geometry/cube.test.ts \
  packages/webgl/src/lib/geometry/sphere.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Extend the public and private geometry shapes exactly as follows and copy normals during descriptor creation.

```ts
export interface CRCWebGLGeometryInput {
  readonly positions: ArrayLike<number>;
  readonly normals?: ArrayLike<number>;
  readonly indices?: ArrayLike<number>;
}

interface WebGLGeometryData {
  readonly positions: Float32Array;
  readonly normals: Float32Array | undefined;
  readonly indices: Uint32Array | undefined;
  readonly bounds: WebGLGeometryBounds;
}
```

- [ ] Validate normals after Float32 conversion in triples, using max-component scaling to determine whether each stored vector has a finite nonzero direction without overflowing its length computation.

- [ ] Replace the Cube's eight shared corners with 24 face-owned vertices, six exact axis normals, and 36 indices while preserving size, bounds, and 12 triangles.

- [ ] Add radial normals parallel to every canonical Sphere position, including the duplicated seam and pole vertices, while preserving radius, bounds, and triangle count.

- [ ] Run the same focused geometry tests and confirm they pass.

- [ ] Review the task diff for accidental public geometry handles or UV/tangent additions, then commit.

```sh
git add packages/webgl/src/lib/types.ts packages/webgl/src/lib/geometry
git commit -m "feat(webgl): add immutable geometry normals"
```

---

## Task 2: Resolve closed material styles and submit shading intent

**Interfaces produced:** `CRCWebGLLambertMaterial`, `CRCWebGLMaterial`, `MeshStyle.lit`, `MeshStyle.material`, parsed concrete color helper, resolved mesh material submission.

**Interfaces consumed later:** settlement selects `unlit`/`lambert`, derives linear base/emissive colors, and requires normals only for lit meshes.

**Files:**

- Create: `packages/webgl/src/lib/components/style-values.ts`
- Create: `packages/webgl/src/lib/components/material.ts`
- Create: `packages/webgl/src/lib/components/material.test.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/components/mesh.ts`
- Modify: `packages/webgl/src/lib/components/mesh.test.tsx`
- Modify: `packages/webgl/src/lib/components/webgl-layer.test.tsx`
- Modify: `packages/webgl/src/lib/components/cube.test.tsx`
- Modify: `packages/webgl/src/lib/components/sphere.test.tsx`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/composer.ts`
- Modify: `packages/webgl/src/lib/scene/composer.test.ts`
- Modify: `packages/webgl/src/index.ts`

- [ ] Add failing public component tests for default `lit: true`, explicit `lit: false`, default Lambert material, emissive defaults, concrete color alpha, closed runtime fields, and no GL work during submission.

```tsx
expect(compose(<Mesh geometry={geometry} />).meshes[0]).toMatchObject({
  lit: true,
  material: {
    type: "lambert",
    emissiveColor: [0, 0, 0, 1],
    emissiveIntensity: 1,
  },
});

expect(compose(<Cube style={{ lit: false }} />).meshes[0]?.lit).toBe(false);
expect(() =>
  compose(
    <Sphere style={{ material: { type: "lambert", emissiveIntensity: -1 } }} />,
  ),
).toThrow("Sphere style.material.emissiveIntensity must be nonnegative");
```

- [ ] Run the focused component/composer tests and confirm the material assertions fail.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/components/material.test.ts \
  packages/webgl/src/lib/components/mesh.test.tsx \
  packages/webgl/src/lib/components/webgl-layer.test.tsx \
  packages/webgl/src/lib/components/cube.test.tsx \
  packages/webgl/src/lib/components/sphere.test.tsx \
  packages/webgl/src/lib/scene/composer.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Move the existing concrete Canvas color parser/token validation from `mesh.ts` to `style-values.ts` and expose a field-aware internal signature.

```ts
export interface ParsedConcreteColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

export function parseConcreteColor(
  componentName: string,
  fieldName: string,
  value: string,
): ParsedConcreteColor;
```

- [ ] Add and export the public closed material types.

```ts
export interface CRCWebGLLambertMaterial {
  readonly type: "lambert";
  readonly emissiveColor?: string;
  readonly emissiveIntensity?: number;
}

export type CRCWebGLMaterial = CRCWebGLLambertMaterial;
```

- [ ] Implement `resolveWebGLMaterial(componentName, value)` with own-key validation for `type`, `emissiveColor`, and `emissiveIntensity`; reject unknown types/fields for untyped callers; default color to black and intensity to one.

- [ ] Add `readonly lit?: boolean` and `readonly material?: CRCWebGLMaterial` to `MeshStyle`, validate `lit` as a runtime boolean, and submit immutable resolved material data without changing target registration or the final alpha calculation.

- [ ] Extend scene submission/draft types to carry `lit` and resolved material data while preserving the mesh-only `sourceIndex` counter and copied model/color ownership.

- [ ] Add retained-WebGLLayer tests proving scalar material fields are snapshotted when the component executes, replacing a nested descriptor invalidates, a fresh equivalent descriptor may conservatively invalidate, and mutating the same descriptor in place is unsupported and may remain cached.

- [ ] Export `CRCWebGLLambertMaterial` and `CRCWebGLMaterial` from `@crc/webgl` without introducing a generic `Material` value.

- [ ] Run the same focused tests and confirm they pass.

- [ ] Review the executable material identity evidence and confirm core gained no material-specific equality logic; then commit.

```sh
git add packages/webgl/src/lib/components packages/webgl/src/lib/scene packages/webgl/src/lib/types.ts packages/webgl/src/index.ts
git commit -m "feat(webgl): add Lambert material styles"
```

---

## Task 3: Compose light and solid-background declarations

**Interfaces produced:** six public declaration components and types, `submitWebGLLight`, `submitWebGLBackground`, ordered light/background draft records.

**Interfaces consumed later:** settlement transforms all light pose and enforces global capacity/background uniqueness.

**Files:**

- Create: `packages/webgl/src/lib/components/lights.ts`
- Create: `packages/webgl/src/lib/components/lights.test.tsx`
- Create: `packages/webgl/src/lib/components/webgl-background.ts`
- Create: `packages/webgl/src/lib/components/webgl-background.test.tsx`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/composer.ts`
- Modify: `packages/webgl/src/lib/scene/composer.test.ts`
- Modify: `packages/webgl/src/index.ts`

- [ ] Add failing JSX and `createElement` tests that compose all declarations before/after meshes, prove the current model matrix is copied for transformable lights, and prove declarations add no event target, pick entry, or mesh source index.

```tsx
const scene = compose(
  <>
    <Mesh geometry={geometry} style={{ lit: false }} />
    <AmbientLight style={{ color: "#fff", intensity: 0.25 }} />
    <Group3D style={{ translateX: 3, rotationYDegrees: 90 }}>
      <PointLight style={{ range: 10 }} />
      <DirectionalLight />
    </Group3D>
    <WebGLBackground style={{ color: "rgb(8 17 31 / 75%)" }} />
  </>,
);

expect(scene.meshes.map((mesh) => mesh.sourceIndex)).toEqual([0]);
expect(scene.lights.map((light) => light.kind)).toEqual([
  "ambient",
  "point",
  "directional",
]);
expect(scene.backgrounds).toHaveLength(1);
```

- [ ] Add compile-time `@ts-expect-error` cases proving lights/background reject children, event/focus/cursor/pointer props, and filters, while only transformable light styles accept shared transform fields.

- [ ] Add failing runtime/default tests for every declaration: white and intensity `1`; Hemisphere white sky/ground and local `+Y`; Directional/Spot local `-Z`; Point/Spot unbounded range; Spot `0°`/`45°`; zero intensity allowed; nonfinite/negative intensity rejected; nonfinite/nonpositive range rejected; nonfinite/out-of-range/reversed cone angles rejected; concrete context-free colors required; background color required; unknown runtime fields rejected; background under `Group3D` ignores its transform; and declaration JSX position does not change draft semantics.

- [ ] Run the focused declaration/composer tests and confirm the new public values and records are absent.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/components/lights.test.tsx \
  packages/webgl/src/lib/components/webgl-background.test.tsx \
  packages/webgl/src/lib/scene/composer.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Define exact public styles and prop shapes; use a package-private optional unique-symbol marker so declaration-only empty props do not structurally accept event or child props.

```ts
export interface AmbientLightStyle {
  readonly color?: string;
  readonly intensity?: number;
}
export interface HemisphereLightStyle extends CRCWebGLTransformStyle {
  readonly skyColor?: string;
  readonly groundColor?: string;
  readonly intensity?: number;
}
export interface DirectionalLightStyle extends CRCWebGLTransformStyle {
  readonly color?: string;
  readonly intensity?: number;
}
export interface PointLightStyle extends DirectionalLightStyle {
  readonly range?: number;
}
export interface SpotLightStyle extends PointLightStyle {
  readonly innerConeAngleDegrees?: number;
  readonly outerConeAngleDegrees?: number;
}
export interface WebGLBackgroundStyle {
  readonly color: string;
}
```

- [ ] Implement light primitives with exact own-key validation; parse concrete colors and finite nonnegative intensity, validate optional strictly positive range and spot half-angle fields, compose/copy a model for transformable lights, and submit only CPU records.

- [ ] Implement `WebGLBackground` as a transform-free, target-free declaration whose exact style requires one concrete `color` and rejects unknown runtime fields.

- [ ] Extend composer draft/close ownership with `lights` and `backgrounds` arrays; retain source data for diagnostics; do not enforce capacity, uniqueness, or transformed-vector validity until settlement.

- [ ] Export all six runtime values and their props/style types from `@crc/webgl`.

- [ ] Run the same focused tests and confirm they pass.

- [ ] Review that inserting declarations never changes a mesh source index and no declaration calls `useBackendEventTarget`; then commit.

```sh
git add packages/webgl/src/lib/components packages/webgl/src/lib/scene packages/webgl/src/index.ts
git commit -m "feat(webgl): compose light and background declarations"
```

---

## Task 4: Settle materials, normal matrices, light pose, capacity, and background

**Interfaces produced:** complete immutable `SettledWebGLScene`, `SettledWebGLShading`, semantic `SettledWebGLLight`, scale-normalized inverse-transpose normal matrices.

**Interfaces consumed later:** shaders/resources/renderer receive only renderer-safe, fully validated values.

**Files:**

- Create: `packages/webgl/src/lib/scene/normals.ts`
- Create: `packages/webgl/src/lib/scene/normals.test.ts`
- Modify: `packages/webgl/src/lib/math/matrix4.ts`
- Modify: `packages/webgl/src/lib/math/matrix4.test.ts`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/settle.ts`
- Modify: `packages/webgl/src/lib/scene/settle.test.ts`
- Modify: `packages/webgl/src/lib/backend.test.ts`

- [ ] Add failing CPU tests for inverse-transpose behavior under identity, uniform, nonuniform, and negative scale; singular lit rejection; extreme representability rejection; unlit singular acceptance; and shader-ordered Float32 pair validation.

```ts
expect(Array.from(createSettledNormalMatrix(nonUniformModel))).toEqual([
  0.5, 0, 0, 0, 1, 0, 0, 0, 0.25,
]);
expect(() => compose(<Cube style={{ scaleX: 0 }} />)).toThrow(
  "WebGL transform.scaleX must be nonzero",
);
expect(() => compose(<Cube style={{ lit: false, scaleX: 0 }} />)).toThrow(
  "WebGL transform.scaleX must be nonzero",
);
expect(() => settle(internalLitMeshWithSingularModel())).toThrow(
  "lit normal matrix must be invertible",
);
expect(() => settle(internalUnlitMeshWithSingularModel())).not.toThrow();
```

- [ ] Add failing settlement tests for default-lit/no-normal failure with component/source diagnostics, unlit normal omission, linear base/emissive resolution, light transformations, group scale semantics, eight accepted/ninth rejected, zero intensity counting, and one background accepted/two rejected before any fake-GL call.

```ts
expect(settled.lights).toMatchObject([
  { kind: "ambient" },
  { kind: "hemisphere", axis: [0, 1, 0] },
  { kind: "directional", direction: [0, 0, -1] },
  { kind: "point", position: [3, 4, 2], range: 12 },
  { kind: "spot", direction: [0, 0, -1], innerConeCosine: 1 },
]);
expect(() => settle(sceneWithLights(9))).toThrow(
  "WebGLLayer supports at most 8 light declarations",
);
```

- [ ] Run the focused settlement/math tests and confirm they fail for the absent derived plan.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/math/matrix4.test.ts \
  packages/webgl/src/lib/scene/normals.test.ts \
  packages/webgl/src/lib/scene/composer.test.ts \
  packages/webgl/src/lib/scene/settle.test.ts \
  packages/webgl/src/lib/backend.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Implement JS-number affine inverse-transpose extraction, divide all nine entries by the largest absolute component before Float32 conversion, and reject singular/nonfinite/zero/unrepresentable matrices.

- [ ] Implement CPU max-component safe normalization in the same Float32 operation order as the Lambert shader and validate every distinct lit geometry/normal-matrix pair.

- [ ] Add matrix helpers that transform local origins with `w = 1` and local directions/axes with `w = 0`, then safely normalize or reject; never apply transform magnitude to intensity, range, or cone fields.

- [ ] Define settled shading and lights as closed discriminated unions.

```ts
export type SettledWebGLShading =
  | {
      readonly kind: "unlit";
      readonly displayBaseColor: WebGLRGBA;
      readonly linearEmissive: CRCWebGLVector3;
    }
  | {
      readonly kind: "lambert";
      readonly linearBaseColor: WebGLRGBA;
      readonly linearEmissive: CRCWebGLVector3;
      readonly normalMatrix: Readonly<Float32Array>;
    };

export type SettledWebGLLight =
  | SettledAmbientLight
  | SettledHemisphereLight
  | SettledDirectionalLight
  | SettledPointLight
  | SettledSpotLight;
```

- [ ] Preserve the exact unlit no-effective-emission display-color fast path; otherwise decode sRGB inputs to linear values, apply contribution alpha to RGB only, and leave final mesh alpha unchanged.

- [ ] Settle every light in declaration order; use transformed local `+Y` for hemisphere, local `-Z` for directional/spot, transformed origin for point/spot, cosine half-angles for spot, `undefined` for unbounded range, and immutable owned arrays.

- [ ] Enforce eight total lights and background uniqueness after closing the draft but before renderer entry; include component/JSX source details in failures.

- [ ] Extend `SettledWebGLScene` with `lights` and optional `background` while preserving opaque/transparent classification, queue order, and pick/focus records exactly.

- [ ] Run the same focused tests and confirm they pass.

- [ ] Review every settlement failure path for zero GL mutations and immutable ownership, then commit.

```sh
git add packages/webgl/src/lib/math packages/webgl/src/lib/scene packages/webgl/src/lib/backend.test.ts
git commit -m "feat(webgl): settle lighting and normal plans"
```

---

## Task 5: Compile closed unlit and Lambert shader programs

**Interfaces produced:** `WebGLProgramKey`, tagged `WebGLUnlitProgram`/`WebGLLambertProgram`, fixed eight-light GLSL, complete uniform/attribute locations.

**Interfaces consumed later:** transactional cache acquires programs by key; renderer binds semantic scene data.

**Files:**

- Create: `packages/webgl/src/lib/gpu/program-sources.ts`
- Modify: `packages/webgl/src/lib/gpu/program.ts`
- Modify: `packages/webgl/src/lib/gpu/program.test.ts`

- [ ] Add failing fake-GL tests for separate keyed source selection, required locations, partial vertex/fragment/link cleanup, missing array-uniform diagnostics using `[0]`, and exact program deletion.

```ts
expect(createBuiltInProgram(gl, "lambert", "Cube")).toMatchObject({
  key: "lambert",
  positionAttribute: 0,
  normalAttribute: 1,
});
expect(gl.uniformNames).toContain("u_light_kind[0]");
expect(gl.uniformNames).toContain("u_light_color_intensity[0]");
```

- [ ] Add a real Chromium WebGL2 compile/link test for both programs so uniform activity and GLSL portability are not inferred from the fake.

- [ ] Run only `program.test.ts` and confirm the keyed Lambert assertions fail.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/gpu/program.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Define the closed program API.

```ts
export type WebGLProgramKey = "unlit" | "lambert";

export type WebGLBuiltInProgram = WebGLUnlitProgram | WebGLLambertProgram;

export function createBuiltInProgram(
  gl: WebGL2RenderingContext,
  key: WebGLProgramKey,
  componentName: string,
): WebGLBuiltInProgram;
```

- [ ] Preserve the current unlit vertex/fragment behavior exactly for the no-emission fast path and extend it with linear emissive uniforms/branching only when emission contributes.

- [ ] Implement Lambert vertex output for world position and shader-safe normalized world normal using location 0 positions, location 1 normals, `u_model`, and the settled `u_normal_matrix`.

- [ ] Implement a fixed `MAX_LIGHTS = 8` fragment loop with integer kinds and four `vec4[8]` arrays for linear color/intensity, position/range, direction-or-axis/inner cosine, and hemisphere-ground/outer cosine.

- [ ] Encode exact ambient, hemisphere, directional, inverse-square point, quartic finite range, smooth/hard spot cone, origin-zero diffuse, emissive addition, `[0,1]` clamp, standard sRGB encoding, and unchanged output alpha.

- [ ] Keep program keys independent of component identity and active light count; resolve all required locations before publishing a program.

- [ ] Run the same focused program test and confirm both fake cleanup and real Chromium compilation pass.

- [ ] Review shader equations line-by-line against the spec and commit.

```sh
git add packages/webgl/src/lib/gpu/program.ts packages/webgl/src/lib/gpu/program-sources.ts packages/webgl/src/lib/gpu/program.test.ts
git commit -m "feat(webgl): add fixed Lambert shader program"
```

---

## Task 6: Own keyed programs and optional normal buffers transactionally

**Interfaces produced:** renderer transaction `useProgram(key, componentName)`, complete geometry resources with optional normal buffer, resident/candidate keyed program maps.

**Interfaces consumed later:** renderer can switch programs without reordering and share geometry between lit/unlit meshes.

**Files:**

- Modify: `packages/webgl/src/lib/gpu/renderer-resources.ts`
- Modify: `packages/webgl/src/lib/gpu/renderer-resources.test.ts`
- Modify: `packages/webgl/src/lib/context-lifecycle.test.tsx`

- [ ] Add failing resource tests for two resident program keys, candidate use/creation sets, omission sweeps, healthy rollback, context-loss abandonment, and geometry reuse across program keys.

- [ ] Add failing normal-buffer cases for failure at position creation, normal creation, index creation, upload, post-upload context loss, rollback, sweep, and disposal; assert every healthy handle is deleted exactly once and lost-generation handles are abandoned.

```ts
const transaction = cache.beginRender();
const unlit = transaction.useProgram("unlit", "Cube");
const lambert = transaction.useProgram("lambert", "Cube");
const first = transaction.useGeometry(normalsGeometry, "Cube");
const second = transaction.useGeometry(normalsGeometry, "Sphere");
expect(second).toBe(first);
transaction.commit();
expect(gl.createdPrograms).toHaveLength(2);
expect(gl.createdBuffers).toHaveLength(3); // position + normal + index
```

- [ ] Run the focused resources/lifecycle tests and confirm failures expose the single-program/no-normal assumptions.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/gpu/renderer-resources.test.ts \
  packages/webgl/src/lib/context-lifecycle.test.tsx \
  --browser.headless --browser.ui=false
```

- [ ] Replace the single program slot and booleans with resident `Map<WebGLProgramKey, WebGLBuiltInProgram>`, candidate used-key set, and candidate created-program map.

- [ ] Change `useProgram` to require a key, create at most one candidate program per key, retain used resident keys, sweep omitted resident keys on commit, and delete only candidate-created keys on healthy rollback.

- [ ] Extend `WebGLGeometryResource` with `normalBuffer`; upload owned normal data at attribute location 1 when present; retain one VAO/resource per geometry descriptor regardless of program key.

- [ ] Preserve creation-order cleanup and the existing conservative context-loss rule across position, normal, and index handles.

- [ ] Update lifecycle count assertions deliberately: default-lit indexed Cube has position + normal + index; mixed lit/unlit scenes own two programs but one shared geometry resource.

- [ ] Run the same focused tests and confirm they pass.

- [ ] Review candidate/resident state closure after every throw, invalidate, and dispose path, then commit.

```sh
git add packages/webgl/src/lib/gpu/renderer-resources.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/context-lifecycle.test.tsx
git commit -m "feat(webgl): own lighting GPU resources transactionally"
```

---

## Task 7: Render the settled scene with exact lighting and background behavior

**Interfaces produced:** one-pass background clear, per-frame fixed light upload, source-order-preserving program switching, representative public-path pixels.

**Interfaces consumed later:** examples and lab rely on real lighting semantics.

**Files:**

- Modify: `packages/webgl/src/lib/scene/renderer.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.test.ts`
- Create: `packages/webgl/src/lib/lighting-rendering.test.tsx`

- [ ] Extend the renderer fake to record clear color, transaction timing, program keys, attribute bindings, normal matrices, array uniforms, draw order, framebuffer binds, readbacks, and resource creation counts.

- [ ] Add failing structural tests proving: baseline precedes background clear color; exactly one clear occurs; the resource transaction always opens after clear; no background draw/pass/framebuffer/readback occurs; omitted background clears transparent black; and a mesh-to-empty transition commits an empty used set that sweeps the prior program/geometry.

- [ ] Add failing order tests that interleave unlit/Lambert opaque and transparent meshes, then assert existing opaque source order and transparent settled order survive program switches.

- [ ] Add failing uniform tests that vary scenes from zero to eight lights and assert one Lambert program is reused, light/camera data binds once per Lambert use for a frame, and geometry remains resident when only lights change.

- [ ] Add public-path pixel tests for no-light lit black, exact old unlit sRGB/alpha, unlit emission, ambient, hemisphere midpoint/poles, directional orientation, point inverse square/floor/range, smooth and equal-angle spot cones, light color alpha, emissive self-lighting, and transparent/alpha background.

```tsx
render(
  <WebGLLayer camera={CAMERA}>
    <DirectionalLight style={{ rotationXDegrees: -90 }} />
    <Mesh geometry={UPWARD_TRIANGLE} style={{ color: "#808080" }} />
  </WebGLLayer>,
);
expect(await pixelAt(canvas, 50, 50)).toEqual([128, 128, 128, 255]);
```

- [ ] Run the focused renderer tests and confirm the renderer still lacks the planned programs/uniforms/background semantics.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/scene/renderer.test.ts \
  packages/webgl/src/lib/lighting-rendering.test.tsx \
  --browser.headless --browser.ui=false
```

- [ ] Reorder renderer entry to validate generation and install the complete baseline, install the settled background or transparent-black clear value, clear color/depth once, and only then begin the required resource transaction, including background-only and empty scenes.

- [ ] Pack the ordered semantic lights into fixed typed arrays without allocating GL resources, using range `0` only as the internal unbounded sentinel and explicit kind values shared with GLSL.

- [ ] Bind camera/fixed light data to the Lambert program for the frame, bind mesh-specific model/normal/base/emissive/alpha data per draw, and bind only display-base/emissive data for unlit draws.

- [ ] Switch keyed programs inside the existing queues, bind location 1 only for Lambert geometry, and preserve zero-alpha raster omission and pick/focus eligibility.

- [ ] Restore the complete baseline before commit; on any failure roll back the candidate, restore the baseline when the context remains usable, and rethrow without publication.

- [ ] Run the same focused renderer tests and confirm structural and representative pixel evidence passes.

- [ ] Review that there is no second traversal, pass, framebuffer, texture, readback, shadow, HDR, bloom, or output transform, then commit.

```sh
git add packages/webgl/src/lib/scene/renderer.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/lighting-rendering.test.tsx
git commit -m "feat(webgl): render settled Lambert lighting"
```

---

## Task 8: Migrate existing scenes deliberately and lock public interaction semantics

**Interfaces produced:** explicit legacy unlit intent in non-lighting fixtures; public default-lit behavior; unchanged picking/focus/events/background miss semantics.

**Files:**

- Modify: `packages/webgl/src/lib/backend.test.ts`
- Modify: `packages/webgl/src/lib/components/mesh.test.tsx`
- Modify: `packages/webgl/src/lib/components/webgl-layer.test.tsx`
- Modify: `packages/webgl/src/lib/events-integration.test.tsx`
- Modify: `packages/webgl/src/lib/scene-picker.test.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.test.ts`
- Modify: `packages/scenarios/src/learning/composition/webgl-islands.example.tsx`
- Modify: `packages/scenarios/src/webgl-lab.example.tsx`
- Modify: any additional exact-color WebGL fixture found by `rg -n '<(Mesh|Cube|Sphere)' packages tooling playground`

- [ ] Inventory every existing Mesh/Cube/Sphere use and classify it as a lighting test, a direct picker/ledger fixture that bypasses settlement, a pick-focused scene that settles, or a legacy exact-color/composition test; add `lit: false` to the latter two scene categories when lighting is irrelevant.

- [ ] Add failing public tests that distinguish default-lit/no-light black from explicit-unlit old color, while keeping a normal-less unlit custom mesh valid and a normal-less lit custom mesh rejected.

- [ ] Add background interaction evidence showing opaque background pixels produce a nested WebGL miss, while lit/unlit/emissive geometry retains the same target, cursor, pointer capture, focus bounds, Tab order, and keyboard activation.

```tsx
<WebGLLayer camera={CAMERA}>
  <WebGLBackground style={{ color: "#ffffff" }} />
  <Cube onClick={onClick} style={{ lit: false, color: "#ff0000" }} />
</WebGLLayer>
```

- [ ] Run the focused compatibility/interaction tests and confirm only intended default-lit expectations fail.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/backend.test.ts \
  packages/webgl/src/lib/components/mesh.test.tsx \
  packages/webgl/src/lib/components/webgl-layer.test.tsx \
  packages/webgl/src/lib/events-integration.test.tsx \
  packages/webgl/src/lib/scene-picker.test.ts \
  packages/webgl/src/lib/pick-ledger.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Apply `lit: false` to existing examples/tests whose purpose is exact old color, Canvas/WebGL composition, ordering, lifecycle, or settled pick behavior rather than lighting; leave direct picker/ledger fixtures unchanged and do not add irrelevant normals merely to silence failures.

- [ ] Add the new default-lit and interaction assertions without weakening old geometry/order/focus expectations.

- [ ] Run the same focused tests and confirm they pass.

- [ ] Review every migration hunk to ensure it expresses intent rather than hiding an untested lighting regression, then commit.

```sh
git add packages/webgl/src packages/scenarios/src/learning/composition/webgl-islands.example.tsx packages/scenarios/src/webgl-lab.example.tsx
git commit -m "test(webgl): lock lighting compatibility semantics"
```

---

## Task 9: Prove lifecycle, failure isolation, and the dense lighting laboratory

**Interfaces produced:** generation-safe lighting resources, deterministic lab route/scenario, semantic browser coverage, structural one-frame evidence.

**Files:**

- Modify: `packages/webgl/src/lib/context-lifecycle.test.tsx`
- Modify: `packages/webgl/src/lib/layer-controller.test.ts`
- Modify: `packages/webgl/src/lib/webgl-performance.test.tsx`
- Create: `packages/scenarios/src/webgl-lighting-lab.ts`
- Create: `packages/scenarios/src/webgl-lighting-lab.example.tsx`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/scenarios/package.json`
- Modify: `packages/core/test/scenario-catalog.test.ts`
- Create: `packages/core/test/webgl-lighting-lab.test.ts`
- Create after inspection: `packages/core/test/visual-baselines/webgl-lighting.expected.png`
- Modify generated index through its repository generator: `docs/scenario-index.md`

- [ ] Add failing lifecycle cases for Lambert vertex/fragment/link/location failure, normal-buffer creation/upload failure, failure after one program succeeds, render failure, context loss during candidate construction, restoration into one new generation, root failure, removal, and disposal.

- [ ] Assert failed/old generations never publish bitmap/pick/focus records; healthy candidate handles delete once; lost-generation handles are abandoned; light/background declarations own zero handles.

- [ ] Add structural tests proving one dirty scene composes every component once, settles before first GL mutation, clears once, transfers at most one bitmap, retains geometry when only light values change, and a clean scene does no traversal/settlement/light upload/render/transfer.

- [ ] Run only the focused lifecycle/performance files and confirm new failure controls initially expose missing evidence rather than production defects.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/webgl/src/lib/context-lifecycle.test.tsx \
  packages/webgl/src/lib/layer-controller.test.ts \
  packages/webgl/src/lib/webgl-performance.test.tsx \
  --browser.headless --browser.ui=false
```

- [ ] Close any production ownership defect in the narrow renderer/program/resource file that owns it, keeping the new lifecycle assertion red before the fix and green after it.

- [ ] Build `webgl-lighting-lab.example.tsx` as a dense deterministic public-import scene containing all five light types, background, lit/unlit/emissive meshes, transformed light, custom normals, transparent mesh, interaction targets, and test-only signal controls exported by `webgl-lighting-lab.ts`.

- [ ] Register scenario id/slug `webgl-lighting`, source id `webgl-lighting-laboratory-example`, learning order `175`, required APIs, package export, and generated scenario index.

- [ ] Add a headless semantic test that drives the lab controls and asserts representative pixels, late-light global influence, eight/ninth behavior through a failure fixture, unchanged topmost target/focus geometry, clean-cache behavior, and context restoration.

- [ ] Capture the visual expected image only after inspecting actual/expected/diff, document why the new baseline is intentional, and never rewrite an unrelated baseline.

- [ ] Run the focused lab/catalog checks only.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/scenario-catalog.test.ts \
  packages/core/test/webgl-lighting-lab.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Review lifecycle counters, deterministic controls, and baseline inspection evidence, then commit.

```sh
git add packages/webgl/src packages/scenarios docs/scenario-index.md packages/core/test/webgl-lighting-lab.test.ts packages/core/test/visual-baselines/webgl-lighting.expected.png
git commit -m "test(webgl): add lighting lifecycle laboratory"
```

---

## Task 10: Add eleven same-scene editable demonstrations and enforce drift

**Interfaces produced:** public WebGL learning group, eleven self-contained examples, source-level base-scene equality check.

**Files:**

- Create: `packages/scenarios/src/learning/webgl/lit-and-unlit.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/ambient-light.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/hemisphere-light.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/directional-light.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/point-light.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/spot-light.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/emissive-material.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/webgl-background.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/custom-geometry-normals.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/multiple-lights.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/transformed-light.example.tsx`
- Create: `tooling/webgl-lighting-example-contract.ts`
- Create: `tooling/webgl-lighting-example-contract.check.ts`
- Modify: `tooling/learning-source-contract.ts`
- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `packages/scenarios/package.json`
- Modify: root `package.json`
- Modify: `playground/src/app/navigation.ts`
- Modify: `playground/test/navigation.test.ts`
- Modify: `playground/test/routes.test.ts`
- Modify: `tooling/scenario-catalog.ts`

- [ ] Add a failing contract check that enumerates exactly eleven WebGL lighting lessons, requires direct `@crc/core`/`@crc/webgl` imports and one mount, and compares a normalized literal base block delimited by neutral source comments.

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
] as const;
```

- [ ] Make the checker require exactly one declared concept-delta region per file and reject any difference in camera, ground positions/normals/indices, Cube/Sphere/Mesh transforms, colors, opacity, material declarations, or framing outside that region.

- [ ] Run the source/catalog checks and confirm they fail because the examples and WebGL domain do not exist.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsx tooling/webgl-lighting-example-contract.check.ts
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/learning-examples.test.ts \
  playground/test/navigation.test.ts \
  playground/test/routes.test.ts \
  --browser.headless --browser.ui=false
```

- [ ] Author one canonical literal base scene with perspective camera, flat Cube, curved Sphere, custom ground Mesh with explicit upward normals, dark background, fixed transforms/colors/opacity/Lambert material, and stable canvas framing.

- [ ] Copy that complete visible base into every lesson so Studio users can edit it without an imported fixture; vary only the concept delta: a light/background declaration, the `lit` comparison, the emissive material, or the transformed-light animation wrapper.

- [ ] Keep the custom-normal lesson's geometry byte-for-byte identical to every other lesson and explain/edit the already-present normal array rather than substituting a different plane.

- [ ] Make the multiple-lights lesson place at least one light after the meshes to demonstrate whole-scene influence independent of JSX order.

- [ ] Make the transformed-light lesson use signals/animation to change a containing `Group3D`; demonstrate nested point/spot pose composition and state explicitly that group scale does not alter range, intensity, or cone angles.

- [ ] Add a `webgl` learning/presentation domain, register the eleven unique orders `380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480` with exact API metadata, add the navigation group, and update source validation for the new directory and descriptive component exports.

- [ ] Add the drift checker to `scenarios:check` so normal repository verification enforces the shared-scene contract.

- [ ] Run the same focused source/catalog/navigation checks and confirm all eleven examples pass.

- [ ] Review every diff between example files and verify it is inside the named delta region, then commit.

```sh
git add packages/scenarios/src/learning/webgl packages/scenarios/src/learning-types.ts packages/scenarios/src/learning-catalog.ts packages/core/test/learning-examples.test.ts tooling package.json playground
git commit -m "docs(webgl): add same-scene lighting lessons"
```

---

## Task 11: Publish the complete API, documentation, Studio, and consumer contract

**Interfaces produced:** synchronized package exports/declarations, public API pages and guide, Studio runtime/types/search/visual route, Bundler/NodeNext/packed consumer evidence, updated normative contracts.

**Files:**

- Modify: `packages/webgl/src/index.ts`
- Modify: `packages/webgl/README.md`
- Modify: root `README.md`
- Modify: root `AGENTS.md`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `tooling/studio-docs/api-exports.check.ts`
- Modify: `tooling/verify-docs.mjs`
- Modify: `tooling/docs-contract-preservation-baseline.json`
- Modify: `tooling/docs-contract-preservation.mjs`
- Create: `docs/site/api/components/ambient-light.md`
- Create: `docs/site/api/components/hemisphere-light.md`
- Create: `docs/site/api/components/directional-light.md`
- Create: `docs/site/api/components/point-light.md`
- Create: `docs/site/api/components/spot-light.md`
- Create: `docs/site/api/components/webgl-background.md`
- Create: `docs/site/learn/guides/webgl-lighting.md`
- Modify: `docs/site/api/components/webgl-layer.md`
- Modify: `docs/site/api/components/mesh.md`
- Modify: `docs/site/api/components/cube.md`
- Modify: `docs/site/api/components/sphere.md`
- Modify: `docs/site/api/components/group-3d.md`
- Modify: `docs/site/api/functions/create-webgl-geometry.md`
- Modify: `docs/site/api/types/webgl.md`
- Modify: `docs/site/api/README.md`
- Modify: `docs/site/learn/README.md`
- Modify: `docs/site/learn/guides/webgl-islands.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/user-events-contract.md`
- Modify: `docs/design/focus-and-keyboard-navigation-contract.md`
- Modify: `docs/design/event-resource-ownership.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `tooling/verify-studio-visuals.mjs`
- Create after inspection: `packages/core/test/visual-baselines/studio-webgl-lighting.expected.png`

- [ ] Add failing export/inventory/consumer checks for exactly 13 WebGL runtime values, 29 WebGL public types, 93 combined Studio runtime values, 204 combined Studio structural types, and the six new component constructors plus material/geometry declarations.

- [ ] Add failing consumer examples using both JSX and `createElement`, all five lights, background, `lit`, Lambert emission, and geometry normals through the package root only.

- [ ] Run focused type/export/docs/consumer checks and confirm the missing inventories/pages fail.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc -p packages/webgl/tsconfig.json --noEmit
fnm exec --using=v24.15.0 -- node tooling/verify-studio-types.mjs
fnm exec --using=v24.15.0 -- node tooling/verify-docs.mjs
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsx \
  tooling/studio-docs/api-exports.check.ts
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 --filter @crc/core build
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 --filter @crc/webgl build
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc \
  -p playground/package-consumer/tsconfig.bundler.json
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc \
  -p playground/package-consumer/tsconfig.nodenext.json
fnm exec --using=v24.15.0 -- node playground/package-consumer/runtime.mjs
fnm exec --using=v24.15.0 -- node tooling/verify-packed-consumer.mjs
```

- [ ] Synchronize `@crc/webgl` runtime/type exports and Studio declarations. Export exactly these new runtime values: `AmbientLight`, `HemisphereLight`, `DirectionalLight`, `PointLight`, `SpotLight`, `WebGLBackground`.

- [ ] Synchronize the 14 new named public types: six props, six styles, `CRCWebGLLambertMaterial`, and `CRCWebGLMaterial`; update fixed inventory counts rather than weakening them.

- [ ] Update Bundler, NodeNext, runtime, and packed-tarball consumers to prove root-only imports, automatic JSX, and emitted declarations; do not expose `@crc/core/internal` or `@crc/webgl` source paths.

- [ ] Write one API page per declaration and update Mesh/Cube/Sphere/Group3D/WebGLLayer/geometry/type docs with defaults, exact validation, local `-Z`/`+Y`, group scale semantics, eight-light cap, no-light black, normal requirements, material identity, color alpha, and background click-through.

- [ ] Write the public guide around the shared example scene and explicitly separate background from future environment lighting, emission from future bloom/glow, and ordinary lighting from future shadows/textures.

- [ ] Update normative contracts for whole-scene influence, one-pass background alpha, style locality, no interaction participation, unchanged pick/focus geometry, CPU settlement before GL mutation, and exact renderer/resource ownership.

- [ ] Update README/library status/AGENTS public surface and remove only the shipped lighting/material/solid-background items from deliberate boundaries; leave textures/environments/shadows/glow deferred.

- [ ] Add `{ name: "webgl-lighting", hash: "#/examples/webgl/multiple-lights", ready: ".studio-preview__frame", waitForWorkbench: true }` to `tooling/verify-studio-visuals.mjs`, build the Playground, update only that route's baseline, inspect `test-screenshots/studio/webgl-lighting.actual.png` against `packages/core/test/visual-baselines/studio-webgl-lighting.expected.png`, then run only that route's comparison; leave all unrelated baselines byte-identical.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 playground:build
fnm exec --using=v24.15.0 -- node tooling/verify-studio-visuals.mjs \
  --update --route=webgl-lighting
fnm exec --using=v24.15.0 -- node tooling/verify-studio-visuals.mjs \
  --route=webgl-lighting
```

- [ ] Update documentation provenance/baseline files so preservation checks recognize the new normative text without weakening existing clauses.

- [ ] Run the same focused type/export/docs/consumer commands plus the single `--route=webgl-lighting` Studio visual comparison; do not run the aggregate gate.

- [ ] Review public names/counts/links against generated declarations and the approved spec, then commit.

```sh
git add packages/webgl packages/core/test/visual-baselines/studio-webgl-lighting.expected.png playground tooling docs README.md AGENTS.md
git commit -m "docs(webgl): publish lighting and material contracts"
```

---

## Task 12: Perform branch-wide review, fix findings, and run the single aggregate gate

**Interfaces produced:** reviewed implementation, one canonical full verification record, final field note.

**Files:**

- Create: `docs/testing/field-notes/2026-09-14-webgl-lighting-materials-and-background.md`
- Modify: only files required to resolve branch-wide review findings

- [ ] Ask a fresh branch-wide reviewer to compare `git diff a356be2...HEAD` against the approved design, this plan, AGENTS.md, and existing settled-scene contracts; require severity-ranked Critical/Important/Minor findings with file/line evidence.

- [ ] Dispatch a fresh implementer for every Critical or Important finding, add a failing focused regression test first, make the narrow fix, run only that regression file, and commit the fix.

- [ ] Repeat branch-wide review until no Critical or Important findings remain; record any accepted Minor item without describing it as fixed.

- [ ] Inspect `git status`, `git diff --check`, example drift output, changed visual expected/actual/diff images, and the full branch file list before starting the aggregate gate.

- [ ] Run exactly one complete aggregate repository gate on the reviewed head under the documented toolchain.

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

- [ ] If the aggregate gate fails, diagnose the first failure with `superpowers:systematic-debugging`, add a focused reproducer, fix and review it, then report the aggregate failure honestly; do not rerun the complete aggregate gate without explicit user approval because the one-run budget has been consumed.

- [ ] If the aggregate gate passes, record the exact Node/pnpm/Chromium versions, exit status, test totals, skips, lifecycle/performance results, visual inspections, reviewer verdict, and commit SHA in the field note.

- [ ] Run only field-note formatting, focused docs verification, and `git diff --check`; these are not a second aggregate test gate.

```sh
/Users/benlesh/GitHub/crc/node_modules/.bin/prettier --check \
  docs/testing/field-notes/2026-09-14-webgl-lighting-materials-and-background.md
fnm exec --using=v24.15.0 -- node tooling/verify-docs.mjs
git diff --check
```

- [ ] Commit the final evidence record and confirm the lighting worktree is clean.

```sh
git add docs/testing/field-notes/2026-09-14-webgl-lighting-materials-and-background.md
git commit -m "docs(testing): record WebGL lighting verification"
git status --short --branch
```

---

## Plan Self-Review Checklist

- [ ] Trace every approved public API, default, validation rule, light equation, transform rule, queue rule, ownership rule, failure mode, interaction guarantee, example, consumer, and documentation surface to at least one task.
- [ ] Confirm every production task creates failing evidence before implementation and names one focused verification command.
- [ ] Confirm no intermediate task invokes an aggregate trust/test/lifecycle/performance/visual gate and Task 12 invokes `trust` exactly once.
- [ ] Confirm public/private type shapes agree across component submission, scene draft, settlement, program resource, renderer, declarations, Studio, and consumers.
- [ ] Confirm every demonstration contains the same literal base scene and the drift checker enforces it.
- [ ] Scan this plan for placeholders or hand-waving language and resolve every match before execution.

```sh
rg -n 'T[B]D|T[O]DO|implement la[t]er|similar t[o]|appropriate error handlin[g]|tests for the abov[e]' \
  docs/superpowers/plans/2026-09-14-webgl-lighting-materials-and-background-implementation.md
```
