# Static GLB Feedback Slice Implementation Plan

> **Historical status: This implementation plan records completed work and is not current guidance.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an application load one self-contained static GLB through `@crc/webgl/gltf`, render its default scene through a public `Model`, orbit it, light it with one existing analytic light, and interact with the complete model as one CRC target.

**Architecture:** A pure GLB decoder compiles supported glTF data into one opaque immutable `CRCWebGLAsset`. `useGLTF()` owns asynchronous fetch/decode generations and publishes that asset through ordinary hook state. `Model` synchronously expands the selected scene into the existing settled-scene pipeline, sharing one logical target across its primitives. The renderer adds UV/tangent buffers, immutable image/sampler resources, a direct-light metallic-roughness program, and a shadow depth-array binding so textured PBR does not exceed WebGL2's guaranteed fragment-sampler budget.

**Tech Stack:** TypeScript 7, CRC JSX and hooks, WebGL2, `OffscreenCanvas`, `ImageBitmap`, Fetch, glTF 2.0/GLB, Vitest Browser with Playwright Chromium, esbuild, pnpm 11.21.0, Node 24.15 or newer.

**Spec:** `docs/superpowers/specs/2026-09-17-professional-webgl-assets-and-printable-models-design.md`, Milestone 1 only.

## Global Constraints

- Preserve unrelated working-tree changes and untracked files. Stage only the paths listed by the active task.
- This plan ends at **slice ready for feedback**, not feature complete. Do not add HDR environments, tone mapping, normal/occlusion/emissive maps, generated tangents, UV1, vertex colors, alpha modes, double-sided materials, animations, skins, morph targets, compression, external `.gltf` resources, 3MF, or STL.
- Accept only GLB version 2 with one JSON chunk and at most one BIN chunk. Images must be buffer-view-backed PNG or JPEG; reject data URLs and external URLs.
- Select `json.scene`, or scene zero when `scene` is omitted. Reject a file with no renderable selected scene. Ignore imported cameras and lights in this slice.
- Preserve node preorder, primitive order, glTF matrices/TRS, triangle coordinates, material assignment, and declared winding. Do not auto-center, fit, rescale, rotate, or replace the CRC camera.
- Preserve the existing synchronous component contract. Fetching and image decoding start from a component-owned post-success render callback; component evaluation never awaits or throws a promise.
- Keep `@crc/webgl/gltf` optional. The `@crc/webgl` root bundle must not include the parser or decoder implementation.
- `CRCWebGLAsset` and texture values are opaque immutable descriptors. Do not expose glTF JSON, mutable scene nodes, source buffers, decoded images, WebGL handles, or a retained editable graph.
- Existing `Mesh` behavior remains Lambert by default. PBR is opt-in through the imported material descriptor and must not change current cube, sphere, or manual mesh pixels.
- Interpret base-color RGB in sRGB and convert it to linear in the fragment shader; alpha remains linear. Metallic and roughness factors are linear data.
- One `Model` is one event/focus target. Its nearest intersected triangle resolves the hit, while its focus bounds are the union of every projected primitive in the model.
- Preserve transactional scene commits. A failed parse, decode, upload, draw, bitmap transfer, or component evaluation must not publish a partial asset, bitmap, pick ledger, or focus generation.
- Context loss retains CPU asset data needed for restoration, invalidates GPU resources without delete calls, and reuploads from immutable descriptors after restoration.
- Use deterministic counters and explicit close/delete calls as ownership evidence. Garbage collection is never the oracle.
- Add a focused failing test before every production change. Public behavior needs browser-visible and packed-consumer evidence, not internal tests alone.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for recorded verification.

## File and Responsibility Map

### Shadow sampler foundation

- `packages/webgl/src/lib/gpu/shadow-resources.ts`: replace one-texture-per-shadow-view storage with one context-owned depth `TEXTURE_2D_ARRAY`; allocate and render individual layers transactionally.
- `packages/webgl/src/lib/gpu/program-sources.ts`: sample directional, spot, and point shadow views from the one array; keep light-space math and quality filtering unchanged.
- `packages/webgl/src/lib/scene/renderer.ts`: assign stable array layers to shadow views and bind one shadow sampler for Lambert and PBR programs.
- `packages/webgl/src/lib/gpu/{state,shadow-resources}.test.ts` and `packages/webgl/src/lib/scene/renderer.test.ts`: exact allocation, binding, invalidation, rollback, and camera-only reuse evidence.

### Immutable geometry, textures, materials, and assets

- `packages/webgl/src/lib/types.ts`: public UV/tangent geometry streams, opaque asset type, and `Model` props/style.
- `packages/webgl/src/lib/geometry/geometry.ts`: validate and copy UV0 and optional tangents beside existing positions/normals/indices.
- `packages/webgl/src/lib/texture/texture.ts`: private branded decoded-image and sampler descriptors plus exact CPU image lease ownership.
- `packages/webgl/src/lib/assets/{types,asset}.ts`: private selected-scene graph, material/texture bindings, bounds, public brand, and producer/consumer lease operations.
- `packages/webgl/src/lib/components/model.ts`: synchronously submit imported primitives with composed transforms, one target identity, and instance-wide style multipliers.
- `packages/webgl/src/lib/components/material.ts`: validate the slice's factor/base-color-texture subset without widening the deferred material surface accidentally.

### GLB adapter

- `packages/webgl/src/gltf.ts`: the complete public `@crc/webgl/gltf` entry; export only `useGLTF` and its public source/result types.
- `packages/webgl/src/lib/gltf/{schema,glb,accessor,decode,use-gltf}.ts`: container validation, bounded accessor decoding, selected-scene compilation, browser image decoding, and component-owned async generation lifecycle.
- `packages/webgl/src/lib/gltf/test-fixtures.ts`: deterministic programmatic GLB fixtures for malformed containers, accessors, scene graphs, materials, textures, and lifecycle races.
- `packages/webgl/package.json` and `packages/webgl/tsconfig.build.json`: build and export the optional subpath without moving parser code into the root entry.

### Renderer integration

- `packages/webgl/src/lib/scene/{types,settle,renderer}.ts`: carry imported texture/PBR records through existing opaque ordering, light, shadow, pick, and focus settlement.
- `packages/webgl/src/lib/gpu/{program,program-sources,renderer-resources}.ts`: UV/tangent vertex inputs, direct metallic-roughness shading, sRGB base-color sampling, texture/sampler upload, context restoration, and exact release.
- `packages/webgl/src/lib/pick-ledger.ts`: aggregate projected bounds for repeated primitive records that share one `Model` target.
- Existing tests beside each file: semantic state and ownership evidence before visual evidence.

### Public evidence

- `packages/scenarios/src/learning/webgl/static-glb.example.tsx`: readable loading/error/ready example using the public root and glTF subpath.
- `packages/scenarios/src/{learning-catalog,catalog,index}.ts`: public example registration and exact Studio route.
- `playground/public/models/crc-static-glb-slice.glb`: small vendored self-contained model with recorded license/provenance.
- `packages/core/test/static-glb-slice.test.ts`: browser-visible load, orbit, light, hit, focus, replacement, and disposal evidence.
- Package consumers, Studio declarations, and API fixtures: root plus `@crc/webgl/gltf` resolution from source, built output, and packed tarballs.

## Slice Contract

The public surface delivered by this plan is:

```ts
// @crc/webgl
declare const crcWebGLAssetBrand: unique symbol;

export interface CRCWebGLAsset {
  readonly [crcWebGLAssetBrand]: true;
  readonly bounds: Readonly<{
    readonly min: CRCWebGLVector3;
    readonly max: CRCWebGLVector3;
  }>;
}

export interface ModelStyle extends CRCWebGLTransformStyle {
  readonly opacity?: number;
  readonly color?: string;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly cursor?: string;
}

export interface ModelProps extends CRCWebGLTargetProps {
  readonly asset: CRCWebGLAsset;
  readonly style?: ModelStyle;
}

export function Model(props: ModelProps): null;

// @crc/webgl/gltf
export type CRCGLTFSource = string | URL | ArrayBuffer;

export type CRCWebGLAssetLoadResult =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly asset: CRCWebGLAsset }
  | { readonly status: "error"; readonly error: Error };

export function useGLTF(source: CRCGLTFSource): CRCWebGLAssetLoadResult;
```

The internal slice material stored by imported primitives is:

```ts
interface CRCWebGLPBRMetallicRoughnessMaterial {
  readonly type: "pbr-metallic-roughness";
  readonly baseColorFactor: readonly [number, number, number, number];
  readonly baseColorTexture?: CRCWebGLTextureBinding;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
}

interface CRCWebGLTextureBinding {
  readonly texture: CRCWebGLTexture;
  readonly textureCoordinate: 0;
}
```

Only the fields above are accepted during this milestone. The complete public material descriptor remains a Milestone 2 change so the feedback slice does not promise deferred maps, UV1, alpha modes, or manual texture construction prematurely.

---

### Task 1: Collapse shadow views into one depth texture array

**Files:**

- Modify: `packages/webgl/src/lib/gpu/shadow-resources.ts`
- Modify: `packages/webgl/src/lib/gpu/shadow-resources.test.ts`
- Modify: `packages/webgl/src/lib/gpu/program-sources.ts`
- Modify: `packages/webgl/src/lib/gpu/program.ts`
- Modify: `packages/webgl/src/lib/gpu/state.ts`
- Modify: `packages/webgl/src/lib/gpu/state.test.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.test.ts`

**Interfaces:**

```ts
export const WEBGL_MAX_SHADOW_VIEWS = WEBGL_MAX_LIGHTS * 6;

interface CRCWebGLShadowArrayResource {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly resolution: number;
  readonly capacity: number;
}

interface CRCWebGLShadowViewAssignment {
  readonly layer: number;
  readonly matrix: CRCWebGLMatrix4;
}
```

- [ ] **Step 1: Add failing storage and renderer tests**

Assert that eight point lights require one `TEXTURE_2D_ARRAY`, one framebuffer, and 48 layers rather than 48 texture objects; every shadow draw selects its layer with `framebufferTextureLayer`; color passes bind one sampler; camera-only updates reuse valid layers; allocation/draw failure leaves the prior valid generation intact.

```ts
expect(gl.texStorage3D).toHaveBeenCalledWith(
  gl.TEXTURE_2D_ARRAY,
  1,
  gl.DEPTH_COMPONENT24,
  resolution,
  resolution,
  48,
);
expect(gl.framebufferTextureLayer).toHaveBeenCalledWith(
  gl.FRAMEBUFFER,
  gl.DEPTH_ATTACHMENT,
  texture,
  0,
  expectedLayer,
);
```

- [ ] **Step 2: Run the focused tests and confirm they fail on per-view textures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/scene/renderer.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the renderer creates and binds separate 2D/cube depth textures and has no array-layer assignment.

- [ ] **Step 3: Implement transactional array allocation and layer rendering**

Allocate one immutable depth array per quality/resolution generation. Map directional and spot lights to one layer and point lights to six consecutive layers. Attach only the active layer while drawing. Keep the previous array live until the candidate array and all invalid shadow views finish successfully; delete the rejected candidate in `finally`.

- [ ] **Step 4: Replace cube sampling with explicit point-face selection**

In the shader, choose the dominant-axis cube face, compute its 2D UV, use the matching light view matrix/layer, and sample the shared `sampler2DArray`. Preserve current depth bias and PCF tap counts. Remove the eight `sampler2D` plus eight `samplerCube` declarations and bind the array at one fixed texture unit.

- [ ] **Step 5: Run shadow, lighting, and context regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/context-lifecycle.test.tsx packages/core/test/webgl-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS; existing Lambert light/shadow semantics remain unchanged while the color program reserves one shadow sampler instead of sixteen.

- [ ] **Step 6: Commit the sampler foundation**

```bash
git add packages/webgl/src/lib/gpu/shadow-resources.ts packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/gpu/program-sources.ts packages/webgl/src/lib/gpu/program.ts packages/webgl/src/lib/gpu/state.ts packages/webgl/src/lib/gpu/state.test.ts packages/webgl/src/lib/scene/renderer.ts packages/webgl/src/lib/scene/renderer.test.ts
git commit -m "refactor(webgl): store shadows in a depth array"
```

### Task 2: Add UV0 and supplied tangent geometry streams

**Files:**

- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/geometry/geometry.ts`
- Modify: `packages/webgl/src/lib/geometry/geometry.test.ts`
- Modify: `packages/webgl/src/lib/gpu/renderer-resources.ts`
- Modify: `packages/webgl/src/lib/gpu/renderer-resources.test.ts`
- Modify: `packages/webgl/src/lib/gpu/program.ts`

**Interfaces:**

```ts
export interface CRCWebGLGeometryInput {
  readonly positions: ArrayLike<number>;
  readonly normals?: ArrayLike<number>;
  readonly tangents?: ArrayLike<number>;
  readonly textureCoordinates0?: ArrayLike<number>;
  readonly indices?: ArrayLike<number>;
}
```

- [ ] **Step 1: Add failing validation and upload tests**

Cover exact UV pair/tangent quartet lengths, finite values, defensive copying, omitted-stream behavior, buffer upload contents, vertex attribute enable/disable, rollback after the third buffer upload, and exact deletion on final lease/context disposal.

- [ ] **Step 2: Confirm the new fields and buffers are absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing input fields and missing UV/tangent GPU buffers.

- [ ] **Step 3: Validate and snapshot both streams**

Copy values to `Float32Array`. Require `uv.length === vertexCount * 2` and `tangent.length === vertexCount * 4`. Reject non-finite values with field/index diagnostics. Keep the immutable geometry WeakMap as the only data access path.

- [ ] **Step 4: Upload optional buffers transactionally**

Add fixed attribute locations for UV0 and tangent. A missing stream disables the attribute and installs a constant default; a present stream owns one buffer in the existing context-generation resource. Delete every created candidate buffer when later acquisition fails.

- [ ] **Step 5: Run geometry, mesh, renderer-resource, and context tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/context-lifecycle.test.tsx --browser.headless --browser.ui=false
```

Expected: PASS with existing position/normal/index uploads unchanged.

- [ ] **Step 6: Commit geometry streams**

```bash
git add packages/webgl/src/lib/types.ts packages/webgl/src/lib/geometry/geometry.ts packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/gpu/renderer-resources.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/gpu/program.ts
git commit -m "feat(webgl): add uv and tangent geometry streams"
```

### Task 3: Add immutable decoded textures and direct-light PBR rendering

**Files:**

- Create: `packages/webgl/src/lib/texture/texture.ts`
- Create: `packages/webgl/src/lib/texture/texture.test.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/components/material.ts`
- Modify: `packages/webgl/src/lib/components/material.test.ts`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/settle.ts`
- Modify: `packages/webgl/src/lib/scene/settle.test.ts`
- Modify: `packages/webgl/src/lib/gpu/program.ts`
- Modify: `packages/webgl/src/lib/gpu/program-sources.ts`
- Modify: `packages/webgl/src/lib/gpu/renderer-resources.ts`
- Modify: `packages/webgl/src/lib/gpu/renderer-resources.test.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.ts`
- Modify: `packages/webgl/src/lib/scene/renderer.test.ts`

**Interfaces:**

```ts
interface CRCWebGLTextureSampler {
  readonly wrapS: "repeat" | "clamp-to-edge" | "mirrored-repeat";
  readonly wrapT: "repeat" | "clamp-to-edge" | "mirrored-repeat";
  readonly minFilter:
    | "nearest"
    | "linear"
    | "nearest-mipmap-nearest"
    | "linear-mipmap-nearest"
    | "nearest-mipmap-linear"
    | "linear-mipmap-linear";
  readonly magFilter: "nearest" | "linear";
}

interface CRCWebGLTextureBinding {
  readonly texture: CRCWebGLTexture;
  readonly textureCoordinate: 0;
}

interface CRCWebGLPBRMetallicRoughnessMaterial {
  readonly type: "pbr-metallic-roughness";
  readonly baseColorFactor: readonly [number, number, number, number];
  readonly baseColorTexture?: CRCWebGLTextureBinding;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
}
```

- [ ] **Step 1: Add failing descriptor, upload, shading, and ownership tests**

Test glTF defaults (`[1,1,1,1]`, metallic `1`, roughness `1`), range rejection, immutable sampler normalization, texture upload with `UNPACK_FLIP_Y_WEBGL = false` and no ambient state leakage, conditional mip generation, one upload per context generation, multiple material references, rollback, exact delete, context loss/restoration, and `ImageBitmap.close()` after the final CPU lease.

For shader semantics, assert base-color texture RGB follows the IEC sRGB transfer function before factor/tint multiplication; alpha does not. Assert metallic `1` removes diffuse response, roughness changes the GGX lobe, and the existing direct-light shadow factor attenuates only that light.

- [ ] **Step 2: Run the focused tests and confirm missing PBR/texture failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/texture/texture.test.ts packages/webgl/src/lib/components/material.test.ts packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/scene/renderer.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because only unlit/Lambert programs and geometry resources exist.

- [ ] **Step 3: Implement immutable CPU texture leases**

Brand a private descriptor holding width, height, decoded `ImageBitmap`, normalized sampler, and reference counters. The producer owns one lease; each live asset/material dependency owns another. Close the bitmap exactly once after the last lease. Expose no public constructor in this slice.

- [ ] **Step 4: Settle the closed PBR subset**

Add the `"pbr-metallic-roughness"` shading discriminant and fully defaulted factor record. Preserve Lambert as the omitted `Mesh.style.material` behavior. Queue alpha uses base-color-factor alpha multiplied by mesh/Model color alpha and opacity; texture alpha does not move this slice into blend mode because alpha modes are deferred.

- [ ] **Step 5: Add the direct-light metallic-roughness program**

Use Schlick Fresnel, GGX/Trowbridge-Reitz normal distribution, Smith correlated visibility, and energy-conserving Lambert diffuse. Support CRC directional, point, and spot lights plus their shadow factor. Ambient/hemisphere may contribute diffuse fill to nonmetals but must not fabricate metallic reflections. No environment, intermediate HDR target, exposure, or tone mapping enters this task.

- [ ] **Step 6: Upload and bind texture/sampler resources transactionally**

Cache by opaque texture identity per context generation. Restore pixel-store state explicitly. Create mip levels only when the sampler requires them. Candidate upload failure deletes its texture and leaves the committed scene generation untouched.

- [ ] **Step 7: Run focused renderer and lifecycle regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/texture/texture.test.ts packages/webgl/src/lib/components/material.test.ts packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/context-lifecycle.test.tsx --browser.headless --browser.ui=false
```

Expected: PASS; all pre-existing Lambert suites retain their prior draw/program/resource counts except the intentional shadow-array binding change.

- [ ] **Step 8: Commit the texture/PBR renderer**

```bash
git add packages/webgl/src/lib/texture/texture.ts packages/webgl/src/lib/texture/texture.test.ts packages/webgl/src/lib/types.ts packages/webgl/src/lib/components/material.ts packages/webgl/src/lib/components/material.test.ts packages/webgl/src/lib/scene/types.ts packages/webgl/src/lib/scene/settle.ts packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/gpu/program.ts packages/webgl/src/lib/gpu/program-sources.ts packages/webgl/src/lib/gpu/renderer-resources.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/scene/renderer.ts packages/webgl/src/lib/scene/renderer.test.ts
git commit -m "feat(webgl): render textured metallic roughness materials"
```

### Task 4: Introduce the opaque asset and `Model` target

**Files:**

- Create: `packages/webgl/src/lib/assets/types.ts`
- Create: `packages/webgl/src/lib/assets/asset.ts`
- Create: `packages/webgl/src/lib/assets/asset.test.ts`
- Create: `packages/webgl/src/lib/components/model.ts`
- Create: `packages/webgl/src/lib/components/model.test.tsx`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/components/mesh.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.ts`
- Modify: `packages/webgl/src/lib/pick-ledger.test.ts`
- Modify: `packages/webgl/src/index.ts`
- Create: `packages/webgl/src/public-api.test.ts`

**Interfaces:**

```ts
interface CRCWebGLAssetPrimitiveRecord {
  readonly geometry: CRCWebGLGeometry;
  readonly material: CRCWebGLPBRMetallicRoughnessMaterial;
  readonly modelMatrix: CRCWebGLMatrix4;
  readonly sourceOrder: number;
}

interface CRCWebGLAssetData {
  readonly primitives: readonly CRCWebGLAssetPrimitiveRecord[];
  readonly bounds: CRCWebGLBounds3;
}

declare function createInternalWebGLAsset(
  data: CRCWebGLAssetData,
  dependencies: readonly CRCWebGLTexture[],
): CRCWebGLAsset;
```

- [ ] **Step 1: Add failing asset, model, pick, and focus tests**

Create one internal asset with two transformed primitives. Assert stable primitive order, composed `Model` transform, color/opacity and shadow overrides, one shared event target, nearest triangle hit, union focus bounds, two independent Model instances sharing CPU/GPU resources, omission release, invalid asset diagnostics, and exact dependency lease release.

- [ ] **Step 2: Run focused tests and confirm the public types/components are missing**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/assets/asset.test.ts packages/webgl/src/lib/components/model.test.tsx packages/webgl/src/lib/pick-ledger.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the asset brand, `Model`, shared-target aggregation, and internal constructor do not exist.

- [ ] **Step 3: Build the opaque asset with exact leases**

Store private data in a WeakMap keyed by the frozen public value. Copy/freeze primitive records and bounds before publication. The constructor acquires texture dependency leases transactionally. Expose internal `get`, `acquire`, and `release` operations only to sibling implementation modules; the root export reveals only the brand and bounds.

- [ ] **Step 4: Refactor mesh submission for shared target reuse**

Extract the existing `Mesh` submission path so `Model` can submit N primitives under one component identity and one `useEventTarget` result. Do not recursively call `Mesh` as a component or consume a variable number of hooks. Every primitive receives the composed asset-node and Model matrices plus one stable source tie.

- [ ] **Step 5: Aggregate focus metadata by target**

Change pick-ledger focus publication from last-record-wins to a per-target projected union. Picking still tests each primitive and returns the nearest depth record, but every record maps to the shared `Model` target.

- [ ] **Step 6: Run component, picking, focus, and public-vocabulary tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/assets/asset.test.ts packages/webgl/src/lib/components/model.test.tsx packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/lib/scene-picker.test.ts packages/webgl/src/lib/components/mesh.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: PASS; `Model` is public while the internal constructor/data stay absent from emitted root declarations.

- [ ] **Step 7: Commit the asset boundary**

```bash
git add packages/webgl/src/lib/assets/types.ts packages/webgl/src/lib/assets/asset.ts packages/webgl/src/lib/assets/asset.test.ts packages/webgl/src/lib/components/model.ts packages/webgl/src/lib/components/model.test.tsx packages/webgl/src/lib/types.ts packages/webgl/src/lib/components/mesh.ts packages/webgl/src/lib/pick-ledger.ts packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/index.ts packages/webgl/src/public-api.test.ts
git commit -m "feat(webgl): add immutable assets and model instances"
```

### Task 5: Decode the bounded static GLB subset

**Files:**

- Create: `packages/webgl/src/lib/gltf/schema.ts`
- Create: `packages/webgl/src/lib/gltf/glb.ts`
- Create: `packages/webgl/src/lib/gltf/glb.test.ts`
- Create: `packages/webgl/src/lib/gltf/accessor.ts`
- Create: `packages/webgl/src/lib/gltf/accessor.test.ts`
- Create: `packages/webgl/src/lib/gltf/decode.ts`
- Create: `packages/webgl/src/lib/gltf/decode.test.ts`
- Create: `packages/webgl/src/lib/gltf/test-fixtures.ts`

**Interfaces:**

```ts
interface CRCDecodedGLB {
  readonly json: CRCGLTFDocument;
  readonly binaryChunk: Uint8Array | undefined;
}

interface CRCGLTFDecodePlatform {
  decodeImage(
    bytes: Uint8Array,
    mimeType: "image/png" | "image/jpeg",
  ): Promise<ImageBitmap>;
}

async function decodeGLBAsset(
  bytes: ArrayBuffer,
  platform: CRCGLTFDecodePlatform,
): Promise<CRCWebGLAsset>;
```

- [ ] **Step 1: Add failing container and accessor matrices**

Cover magic/version/declared length, chunk alignment/order/duplicates, UTF-8 JSON, missing BIN data, integer overflow, buffer-view bounds, accessor offsets/stride, scalar/vector arity, supported component types, normalization, indices, sparse rejection for this slice, non-finite output, and triangle mode rejection. Every failure must include the failing JSON path or byte/chunk context.

- [ ] **Step 2: Add failing scene/material/image tests**

Cover default-scene and scene-zero selection, no-scene/no-renderable failure, node index bounds, cycle/multiple-parent rejection, matrix versus TRS exclusivity, quaternion normalization, preorder, multi-primitive meshes, POSITION requirement, optional NORMAL/UV0/TANGENT/indices, material defaults/factors, base-color texture/sampler, buffer-view PNG/JPEG, external image rejection, unsupported required extensions, optional extension ignore, and exact bitmap cleanup after any later failure.

- [ ] **Step 3: Confirm all parser suites fail on missing modules**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gltf/glb.test.ts packages/webgl/src/lib/gltf/accessor.test.ts packages/webgl/src/lib/gltf/decode.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because no GLB decoder exists.

- [ ] **Step 4: Implement the pure GLB container reader**

Use `DataView` with explicit little-endian reads and checked additions before slicing. Require GLB 2, JSON first, at most one BIN chunk, and zero/space padding permitted only where glTF allows it. Parse JSON into `unknown`; schema helpers validate every accessed field rather than casting the whole document.

- [ ] **Step 5: Implement bounded accessor decoding**

Return fresh typed logical arrays, deinterleaving when needed. Apply glTF normalized integer conversion exactly. Permit only accessor shapes needed by POSITION/NORMAL/TANGENT/TEXCOORD_0/indices and primitive mode TRIANGLES. This slice rejects sparse accessors with an actionable unsupported-feature error.

- [ ] **Step 6: Compile selected nodes, primitives, materials, and images**

Compose parent/local matrices in node preorder, instantiate a mesh for every referencing node, decode each referenced image once, normalize sampler defaults, build immutable geometry/PBR records, compute transformed asset bounds, and publish the asset only after every dependency succeeds. On failure, release constructed geometry/texture/asset candidates in reverse acquisition order.

- [ ] **Step 7: Run parser and asset suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gltf/glb.test.ts packages/webgl/src/lib/gltf/accessor.test.ts packages/webgl/src/lib/gltf/decode.test.ts packages/webgl/src/lib/assets/asset.test.ts --browser.headless --browser.ui=false
```

Expected: PASS for the bounded subset and exact diagnostics; deferred features remain explicit failures, not silently ignored behavior.

- [ ] **Step 8: Commit the decoder**

```bash
git add packages/webgl/src/lib/gltf/schema.ts packages/webgl/src/lib/gltf/glb.ts packages/webgl/src/lib/gltf/glb.test.ts packages/webgl/src/lib/gltf/accessor.ts packages/webgl/src/lib/gltf/accessor.test.ts packages/webgl/src/lib/gltf/decode.ts packages/webgl/src/lib/gltf/decode.test.ts packages/webgl/src/lib/gltf/test-fixtures.ts
git commit -m "feat(webgl): decode static self contained glb assets"
```

### Task 6: Add component-owned `useGLTF` and the optional package subpath

**Files:**

- Create: `packages/webgl/src/gltf.ts`
- Create: `packages/webgl/src/lib/gltf/use-gltf.ts`
- Create: `packages/webgl/src/lib/gltf/use-gltf.test.tsx`
- Modify: `packages/webgl/package.json`
- Modify: `packages/webgl/tsconfig.build.json`
- Modify: `tsconfig.json`
- Modify: `tooling/crc-runtime-source.ts`
- Modify: `tooling/crc-studio-runtime-entry.ts`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `playground/src/sandbox-module.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`

**Interfaces:**

```ts
export type CRCGLTFSource = string | URL | ArrayBuffer;

export function useGLTF(source: CRCGLTFSource): CRCWebGLAssetLoadResult;
```

- [ ] **Step 1: Add failing hook lifecycle tests**

Use controllable fetch and image-decode promises. Assert initial loading, effect-start after successful render, ready/error publication, URL CORS/fetch propagation, ArrayBuffer defensive copy and identity comparison, same-source stability, changed-source loading, `AbortController` cancellation, stale completion suppression, stale candidate disposal, removal before completion, failed component cleanup, root disposal, and no process-wide cache.

- [ ] **Step 2: Add failing package-resolution tests**

Require `@crc/webgl/gltf` from the source aliases, built package, Bundler consumer, NodeNext consumer, and packed tarball. Assert root `@crc/webgl` output does not contain or re-export `useGLTF`, GLB magic strings, or decoder modules.

- [ ] **Step 3: Run hook tests and the WebGL build to observe missing subpath failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gltf/use-gltf.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 --filter @crc/webgl build
```

Expected: FAIL because `src/gltf.ts`, the hook, and package export do not exist.

- [ ] **Step 4: Implement the generation-owned hook**

Use `useInternalHookSlot` for the active generation/teardown record, read a slot-owned revision signal so completion schedules ordinary CRC work, and register startup through `onCurrentRenderFinish`. Start fetch/decode only when that callback receives `success === true`; a failed component evaluation must never begin the candidate generation. For URLs, abort retired fetches; for every source, compare a monotonically increasing generation before publication. Decode with:

```ts
createImageBitmap(blob, {
  colorSpaceConversion: "none",
  imageOrientation: "none",
  premultiplyAlpha: "none",
});
```

Convert any non-`Error` rejection to an actionable `Error`. Release every uncommitted asset and keep the published result stable until source replacement/removal.

- [ ] **Step 5: Export and build the optional entry**

Add `./gltf` to `exports` and `typesVersions`, add `src/gltf.ts` to declaration roots, and add it as an esbuild entry. Keep core externalized. Do not import `gltf.ts` from `src/index.ts`.

- [ ] **Step 6: Run hook, build, declaration, and consumer checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gltf/use-gltf.test.tsx packages/webgl/src/lib/gltf/decode.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 --filter @crc/webgl build
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

Expected: PASS; emitted root and glTF declarations resolve through supported package names, and the root bundle stays parser-free.

- [ ] **Step 7: Commit the hook and package surface**

```bash
git add packages/webgl/src/gltf.ts packages/webgl/src/lib/gltf/use-gltf.ts packages/webgl/src/lib/gltf/use-gltf.test.tsx packages/webgl/package.json packages/webgl/tsconfig.build.json tsconfig.json tooling/crc-runtime-source.ts tooling/crc-studio-runtime-entry.ts tooling/verify-studio-types.mjs tooling/verify-packed-consumer.mjs playground/src/sandbox-module.ts playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs
git commit -m "feat(webgl): expose component owned glb loading"
```

### Task 7: Prove the public end-to-end slice in a deterministic browser scenario

**Files:**

- Create: `packages/scenarios/src/learning/webgl/static-glb.example.tsx`
- Create: `packages/scenarios/src/static-glb-slice.ts`
- Create: `packages/scenarios/src/static-glb-slice.test.ts`
- Create: `packages/core/test/static-glb-slice.test.ts`
- Create: `playground/public/models/crc-static-glb-slice.glb`
- Create: `playground/public/models/crc-static-glb-slice.LICENSE.md`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `playground/src/crc-editor-types.txt`

**Public example contract:**

```tsx
const loaded = useGLTF("/models/crc-static-glb-slice.glb");
const orbit = useOrbitCamera({
  orbitPoint: [0, 0.5, 0],
  initialPosition: [4, 3, 6],
});

return (
  <Group {...orbit.handlers}>
    <Rectangle style={{ width: 720, height: 420, fill: "transparent" }} />
    <WebGLLayer
      camera={{
        type: "perspective",
        position: orbit.position,
        lookAt: orbit.lookAt,
        up: [0, 1, 0],
        fieldOfViewDegrees: 48,
        near: 0.1,
        far: 100,
      }}
      style={{ width: 720, height: 420 }}
    >
      <DirectionalLight
        style={{ rotationXDegrees: -42, rotationYDegrees: 35 }}
      />
      {loaded.status === "ready" ? (
        <Model asset={loaded.asset} keyboardFocusable />
      ) : null}
    </WebGLLayer>
  </Group>
);
```

- [ ] **Step 1: Select and record the representative asset**

Choose a small self-contained static GLB whose license permits repository redistribution and that visibly exercises hierarchy, at least two primitives, UV0, embedded PNG/JPEG base color, and non-default metallic/roughness factors. Record title, author, source URL, exact source revision/download date, license text/link, and any transformation used to create the vendored file. Do not use an asset without complete provenance.

- [ ] **Step 2: Add failing public scenario tests before registration**

Drive loading to ready and assert semantic probes for primitive count, selected-scene transform, material factors, one texture upload, PBR program use, one analytic light, one shadow array, orbit-camera update, whole-model click target, Tab focus with union bounds, source replacement, error fallback, removal, and disposal counters. Serve a malformed GLB for the error mode.

- [ ] **Step 3: Run the focused scenario/browser tests and confirm the route is missing**

```bash
corepack pnpm@11.21.0 exec vitest run packages/scenarios/src/static-glb-slice.test.ts packages/core/test/static-glb-slice.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the scenario, public asset, catalog entry, and browser route do not exist.

- [ ] **Step 4: Implement loading, ready, and error presentation**

Keep loading/error UI in ordinary Canvas components outside the WebGL island. Attach the orbit handler bundle to an explicit viewport-sized target so empty-island drags work. Render one `Model`, one directional light, and a simple ground/reference mesh. Expose deterministic scenario probes without making them public runtime API.

- [ ] **Step 5: Register the exact Studio route**

Use browse group `webgl` and slug `static-glb` so the feedback URL is:

```text
http://localhost:5173/#/examples/webgl/static-glb
```

Update editor declarations so `Model`, `CRCWebGLAsset`, `CRCWebGLAssetLoadResult`, and `useGLTF` type-check in Studio snippets.

- [ ] **Step 6: Run focused browser, catalog, and Studio checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/scenarios/src/static-glb-slice.test.ts packages/core/test/static-glb-slice.test.ts packages/core/test/webgl-lab.test.ts packages/core/test/webgl-ownership.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 playground:build
```

Expected: PASS. Manually inspect the exact URL and verify texture orientation, hierarchy, metallic/roughness response, shadow, orbit, click, focus ring/bounds, loading, and error states before recording slice feedback.

- [ ] **Step 7: Commit the public feedback slice**

```bash
git add packages/scenarios/src/learning/webgl/static-glb.example.tsx packages/scenarios/src/static-glb-slice.ts packages/scenarios/src/static-glb-slice.test.ts packages/core/test/static-glb-slice.test.ts playground/public/models/crc-static-glb-slice.glb playground/public/models/crc-static-glb-slice.LICENSE.md packages/scenarios/src/learning-catalog.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts playground/src/crc-editor-types.txt
git commit -m "feat(webgl): add static glb feedback example"
```

### Task 8: Verify and hand off the slice for experiential feedback

**Files:**

- Modify only if required by a failing check: public package-consumer fixtures, declarations, scenario catalog, or files changed by Tasks 1-7
- Do not update design contracts or claim feature completeness in this milestone

- [ ] **Step 1: Run the complete focused slice matrix once**

```bash
corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/geometry/geometry.test.ts packages/webgl/src/lib/texture/texture.test.ts packages/webgl/src/lib/components/material.test.ts packages/webgl/src/lib/assets/asset.test.ts packages/webgl/src/lib/components/model.test.tsx packages/webgl/src/lib/gltf/glb.test.ts packages/webgl/src/lib/gltf/accessor.test.ts packages/webgl/src/lib/gltf/decode.test.ts packages/webgl/src/lib/gltf/use-gltf.test.tsx packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/context-lifecycle.test.tsx packages/scenarios/src/static-glb-slice.test.ts packages/core/test/static-glb-slice.test.ts packages/core/test/webgl-ownership.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 --filter @crc/webgl build
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

Expected: every command PASS on Node 24.15+ and pnpm 11.21.0. Record fresh command output; do not substitute historical totals.

- [ ] **Step 2: Inspect the built package boundary**

Verify `@crc/webgl`, `@crc/webgl/gltf`, and `@crc/webgl/internal` export maps and declarations. Inspect the root bundle/chunks to confirm ordinary procedural consumers do not import parser or image-decoder code. Confirm no source-path or private-module import appears in scenario or consumer code.

- [ ] **Step 3: Perform the manual feedback pass**

Start Studio, open `http://localhost:5173/#/examples/webgl/static-glb`, and record:

- whether the asset is recognizably correct versus its source preview;
- UV orientation and base-color accuracy;
- metallic and roughness response under the one analytic light;
- node hierarchy/transform placement;
- shadow correctness while orbiting;
- whole-model click, focus, and projected bounds;
- loading, malformed-source error, source replacement, removal, and remount behavior; and
- browser console/resource warnings.

This is the **slice ready for feedback** milestone. Stop for user evaluation before adding Milestone 2 work.

- [ ] **Step 4: Commit only verification-driven corrections**

If verification changed files, rerun the affected focused command, stage only those exact files, and commit:

```bash
git commit -m "fix(webgl): harden static glb feedback slice"
```

If no files changed, do not create an empty commit.

## Explicitly Deferred After This Plan

- Remaining static glTF core validation and sparse accessor support.
- Missing-normal generation and MikkTSpace-compatible tangent generation.
- Metallic-roughness, normal, occlusion, and emissive textures beyond the slice's base-color texture.
- UV1, vertex colors, alpha mask/blend, double-sided materials, and texture-aware shadow cutouts.
- HDR environment loading, diffuse/specular IBL, BRDF lookup, linear intermediate targets, exposure, PBR Neutral mapping, and final display encoding.
- Public manual texture creation/loading.
- Imported animations, skins, morph targets, cameras, lights, instancing, Draco, meshopt, KTX2/Basis, and advanced material extensions.
- 3MF, STL, print diagnostics, editable topology, CSG, ray tracing, and WebGPU.
- Feature-complete documentation/contracts, visual baselines, and the aggregate `trust` gate. Those follow accepted experiential feedback and proportional hardening.
