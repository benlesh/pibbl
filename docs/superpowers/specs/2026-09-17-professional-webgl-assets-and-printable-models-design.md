# Professional WebGL assets and printable-model interoperability design

> **Historical status: This approved design is a dated implementation record and is not current guidance.**

> **Status: APPROVED DESIGN.** The design and staged delivery boundaries were
> approved on 2026-09-17. Current shipped behavior remains governed by
> `docs/design/` until the corresponding implementation lands.

Date: 2026-09-17

## Summary

Pibbl will make professional 3D asset rendering useful before attempting to
become a modeling system. The first feature is one complete public path from a
static binary glTF (`.glb`) asset to a correctly shaded Pibbl WebGL island:

```text
Blender or another content tool
  -> self-contained static GLB
  -> useGLTF()
  -> immutable PibblWebGLAsset
  -> Model
  -> settled Pibbl scene
  -> linear rendering, PBR, shadows, environment light, and final output
```

The first feature includes the core metallic-roughness PBR material model,
texture-backed geometry, linear color processing, an HDR environment-lighting
path, and final tone mapping. It preserves the existing synchronous component
model, frame-local scene declarations, transactional renderer, event bridge,
focus geometry, and exact ownership rules. Asset loading is asynchronous, but
component evaluation and scene composition remain synchronous.

Printable-model interoperability follows through separate format adapters.
3MF is Pibbl's preferred modern additive-manufacturing format; STL is a
compatibility format. They compile into the same immutable render-asset seam,
but manufacturing units, parts, and metadata remain distinct from visual PBR
materials. 3MF and STL are explicitly not part of the first implementation
plan.

This design does not add editable topology, a retained public scene graph,
constructive solid geometry, CAD surfaces, or ray tracing. Those are separate
systems that may consume or produce immutable render assets later.

## Why this is the first professional 3D feature

More built-in primitives improve examples and programmatic diagrams, but they
do not unlock the existing ecosystem of authored 3D content. A file parser by
itself is also insufficient: a loaded model still looks wrong without UVs,
textures, a portable material model, environment response, and correct color
processing.

The first outcome is therefore experiential rather than checklist-based:

> A developer can export a representative static model from Blender as one
> GLB, load it through public Pibbl APIs, orbit it, light it from an HDR
> environment, receive shadows, and get a result recognizably close to the
> authoring tool without writing shaders.

glTF 2.0 is selected because it is an open, runtime-oriented delivery format
for scenes, hierarchy, meshes, materials, textures, skins, and animation. Its
core material is metallic-roughness PBR. It is intentionally not an authoring
format. The normative basis is the
[glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
and the
[glTF extension registry](https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md).

3MF is selected for later printable-model work because it defines additive-
manufacturing units, meshes, objects, components, build items, materials, and
an extension system. The current specification suite includes materials,
production, beam-lattice, slice, boolean-operation, displacement, and
volumetric extensions. The normative basis is the
[3MF specification suite](https://3mf.io/spec/). STL remains necessary for
compatibility, but only describes triangle surfaces and normals; it has no
standard units, material system, texture model, hierarchy, or manufacturing
metadata.

## Relationship to current Pibbl WebGL contracts

The current renderer already supplies the essential control points:

- `createWebGLGeometry()` creates immutable CPU geometry descriptors.
- `Mesh`, `Cube`, and `Sphere` submit frame-local mesh declarations.
- `Group3D` composes transforms without retaining application scene nodes.
- scene settlement produces immutable render, pick, focus, light, and shadow
  records before WebGL commands execute;
- renderer resource caches acquire GPU objects transactionally and release
  omitted generations exactly;
- one `WebGLLayer` owns one WebGL context, committed bitmap, pick generation,
  focus generation, and shadow cache;
- context loss invalidates context-owned resources and restoration recreates
  them from CPU declarations; and
- `useOrbitCamera()` already supplies ordinary event handlers around the plain
  perspective-camera descriptor.

This design extends those seams. It does not introduce another renderer,
application-visible WebGL handles, mutable scene nodes, or asynchronous
component continuations.

The prior lighting design deliberately reserved UVs, tangents, textures, PBR,
environment lighting, HDR, and tone mapping for a separately validated
contract. This is that contract.

## Delivery boundaries

### Milestone 1: slice ready for feedback

The first runnable slice loads one vendored, self-contained static GLB through
the public API and renders its default scene with:

- node transforms and triangle mesh primitives;
- positions, normals, UV set zero, tangents when supplied, and indices;
- base-color factors and embedded PNG/JPEG base-color textures;
- metallic and roughness factors;
- one analytic Pibbl light;
- the existing perspective and orbit-camera path;
- whole-model picking and focus bounds; and
- deterministic load, error, replacement, removal, and disposal behavior.

The slice is presented in Studio at one exact example URL and is verified with
focused parser, renderer, browser, ownership, and packed-consumer checks. It is
not called feature complete: normal/occlusion/emissive maps, generated
tangents, environment lighting, output tone mapping, the broader glTF core
matrix, and conformance hardening still remain.

### Milestone 2: professional static GLB feature complete

The accepted slice is then hardened to the complete scope in this document:

- the supported static glTF core subset described below;
- all five core PBR texture roles;
- deterministic missing-normal and missing-tangent generation;
- vertex colors, the second UV set, sampler behavior, alpha modes, and
  double-sided materials;
- HDR environment lighting and optional matching environment background;
- a linear intermediate target, exposure, and final output mapping;
- texture-aware alpha-cutout shadows;
- exact CPU/GPU ownership and context restoration;
- public documentation and a representative learning example; and
- proportional aggregate verification.

### Later independent projects

The following require their own design approval and implementation plan:

1. 3MF Core viewing and print-oriented presentation.
2. ASCII and binary STL compatibility loading.
3. glTF animation, skins, morph targets, instancing, and compression.
4. Advanced glTF PBR extensions and post-processing.
5. Procedural geometry creators.
6. Mesh analysis, repair, editable topology, CSG, and modeling operations.
7. A WebGPU renderer or ray/path-tracing experiment.

## Goals

- Deliver one end-to-end static Blender-to-Pibbl workflow through public APIs.
- Add an immutable asset representation reusable by later GLB, 3MF, and STL
  adapters without exposing a mutable retained scene graph.
- Preserve glTF node hierarchy, transforms, primitive/material assignment,
  names, and stable source ordering in one asset.
- Add validated UV, tangent, and vertex-color attributes to immutable geometry.
- Add texture resources and sampler state with deterministic decoded-image and
  GPU ownership.
- Add a closed metallic-roughness PBR material beside the existing Lambert
  material.
- Preserve `style.color` as a local base-color tint and `style.opacity` as a
  final opacity multiplier.
- Add correct color-space interpretation for color and data textures.
- Add image-based diffuse and specular environment lighting, including roughness
  prefiltering and a BRDF integration lookup.
- Separate visible environment background from environment illumination.
- Render lighting into a linear intermediate target and perform final exposure,
  tone mapping, and display encoding once per island.
- Preserve ordinary Pibbl scheduling, transforms, picking, focus, events,
  shadows, Canvas ordering, and transactional bitmap commits.
- Give unsupported files, required extensions, capabilities, and malformed
  resources actionable deterministic diagnostics.
- Keep format adapters optional so a basic `@pibbl/webgl` consumer does not
  acquire every parser.

## Non-goals

- Text `.gltf` files with external buffers or images in the first release.
- OBJ, FBX, COLLADA, USD/USDZ, STEP, AMF, PLY, or other loaders.
- Skeletal animation, morph targets, animation clips, or imported cameras.
- Draco, meshopt, KTX2/Basis, WebP, AVIF, or GPU instancing extensions.
- Advanced glTF material extensions such as clearcoat, transmission, volume,
  sheen, anisotropy, iridescence, or dispersion.
- A general shader language, shader callbacks, render-pass plugins, or raw
  WebGL access.
- Editable imported nodes, vertices, edges, faces, UVs, or materials.
- Mesh repair, slicing, tool paths, supports, infill, or printer control.
- CSG, boolean editing, extrusion, beveling, subdivision, remeshing, or UV
  unwrapping.
- NURBS, boundary representations, STEP semantics, or a CAD geometry kernel.
- Screen-space reflections, reflection probes, planar reflections, bloom,
  ambient occlusion, depth of field, or a general post-processing graph.
- Ray tracing or path tracing in the WebGL2 renderer.
- Automatic model fitting, unit conversion, camera replacement, or hidden
  changes to imported transforms.
- An unbounded primitive catalog.

## Public package and authoring model

### Optional format adapter

The GLB parser is a public optional subpath rather than part of the root module:

```ts
import {
  EnvironmentLight,
  Model,
  WebGLBackground,
  WebGLLayer,
} from "@pibbl/webgl";
import { useGLTF } from "@pibbl/webgl/gltf";
import { useHDREnvironment } from "@pibbl/webgl/hdr";
```

Later adapters may use `@pibbl/webgl/3mf` and `@pibbl/webgl/stl`. The HDR decoder
similarly stays in `@pibbl/webgl/hdr`. These are public application subpaths,
unlike the version-coupled `@pibbl/webgl/internal` friend surface. Each model
adapter compiles its input into the same opaque root asset type.

### Asset loading hook

`@pibbl/webgl/gltf` exports a component-owned hook:

```ts
export type PibblWebGLAssetLoadResult =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly asset: PibblWebGLAsset;
    }
  | {
      readonly status: "error";
      readonly error: Error;
    };

export function useGLTF(
  source: string | URL | ArrayBuffer,
): PibblWebGLAssetLoadResult;
```

The initial call returns `loading` and starts one component-owned source
generation after successful render. Completion publishes one immutable result
through normal scheduled hook state. Changing `source` cancels or retires the
old generation, returns `loading`, and ignores stale completion. Removal,
failed component evaluation, root disposal, and source replacement release the
hook's exact asset lease.

Load failures are values rather than asynchronously thrown render errors. An
application can show its own Canvas or WebGL fallback and choose whether to
throw during a later synchronous render. The hook does not add Suspense,
promise-throwing components, or an async component contract.

The first release performs no implicit process-wide or realm-wide URL cache.
One hook result may be rendered by multiple `Model` instances and multiple
WebGL layers. Applications that need one fetch must call `useGLTF` once at the
common component owner. Cross-hook URL caching requires a later policy for
freshness, credentials, memory limits, and eviction.

String and URL sources use browser `fetch` and browser CORS behavior. The hook
does not invent a proxy, credential store, or image CORS exception. `ArrayBuffer`
sources are identified by object identity and copied before asynchronous work,
so later caller mutation cannot alter a published asset. The GLB JSON and BIN
chunks, buffer views, accessors, and embedded image bytes are validated before
the asset is published.

### Asset value

`PibblWebGLAsset` is an opaque immutable descriptor. Its public inspection
surface in this release is intentionally small:

```ts
declare const pibblWebGLAssetBrand: unique symbol;

export interface PibblWebGLAsset {
  readonly [pibblWebGLAssetBrand]: true;
  readonly bounds: Readonly<{
    readonly min: PibblWebGLVector3;
    readonly max: PibblWebGLVector3;
  }>;
}
```

The implementation privately retains the selected immutable scene, nodes, mesh
primitives, material bindings, textures, names, and source metadata. A later
inspection or override design may add stable node paths and scene selection,
but the first release does not freeze an authoring graph around glTF's schema.

### Model component

The root package exports one general asset instance:

```ts
export interface ModelProps extends PibblWebGLTargetProps {
  readonly asset: PibblWebGLAsset;
}

export interface ModelStyle extends PibblWebGLTransformStyle {
  readonly opacity?: number;
  readonly color?: string;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly cursor?: string;
}
```

The adapter selects the declared default glTF scene, or scene zero when the
file contains scenes but declares no default; a file with no renderable scene
fails loading. `style.color` is parsed as a CSS color and decoded into a linear
base-color multiplier; omission means white. Its alpha contributes to the
instance opacity. `style.opacity` multiplies every imported primitive's final
alpha. Shadow flags provide instance-wide overrides while omission preserves
material/primitive defaults.

One `Model` is one logical Pibbl event/focus target backed by the union of all
participating imported mesh geometry. Nearest-triangle picking still chooses
the visible depth hit, but dispatch targets the `Model` component rather than
inventing application components for file nodes. `pointerEvents="none"` opts
out the entire instance. Focus bounds are the union of projected primitive
bounds. Per-node targets and overrides are later explicit features.

During synchronous composition, `Model` expands the selected immutable asset
into ordinary mesh submissions in stable node-preorder and primitive order.
Each submission snapshots the composed model transform and resolved material.
The asset is not one flattened draw call: opaque, cutout, and blended
primitives still enter the appropriate global settled queues and interact
correctly with external Pibbl meshes.

Rendering the same asset twice creates two component instances with independent
world transforms, target identity, focus geometry, and shadow invalidation,
while sharing immutable CPU data and context-local GPU resources.

## Geometry contract

`PibblWebGLGeometryInput` gains optional, separately validated vertex streams:

```ts
export interface PibblWebGLGeometryInput {
  readonly positions: ArrayLike<number>;
  readonly normals?: ArrayLike<number>;
  readonly tangents?: ArrayLike<number>;
  readonly textureCoordinates0?: ArrayLike<number>;
  readonly textureCoordinates1?: ArrayLike<number>;
  readonly colors0?: Readonly<{
    readonly values: ArrayLike<number>;
    readonly size: 3 | 4;
  }>;
  readonly indices?: ArrayLike<number>;
}
```

- positions and normals retain their current XYZ contracts;
- tangents contain XYZW values, where W is the bitangent handedness;
- each texture-coordinate stream contains UV pairs;
- colors contain RGB or RGBA values selected unambiguously by `size`;
- all stored numeric values are finite Float32 values;
- every present per-vertex stream has exactly the geometry vertex count; and
- index validation and triangle-only topology retain the current contract.

The public `createWebGLGeometry()` path accepts only deinterleaved logical
arrays and continues to copy them. A format adapter may use a trusted internal
constructor after performing equivalent accessor, stride, normalization,
bounds, and immutability validation. There is still no public GPU buffer view,
mutable vertex array, or borrowed source array.

When a glTF primitive lacks normals, the adapter creates deterministic
triangle normals, duplicating vertices where necessary to preserve flat
facets. When a normal texture is present and tangents are absent, feature
completion generates a deterministic MikkTSpace-compatible tangent basis from
positions, normals, and the referenced UV set. Degenerate UV triangles receive
the geometric-normal result for normal mapping rather than producing
non-finite tangent values. The first feedback slice may require supplied
tangents for normal-map use; feature completion may not.

Imported glTF triangle primitives preserve their numeric coordinates. Pibbl does
not auto-center, normalize, scale, or rotate them. glTF's coordinate and unit
conventions remain asset metadata; camera framing is an application decision.

## Textures and samplers

Textures are opaque immutable CPU descriptors. Each contains one decoded image
generation and one immutable sampler descriptor. The core sampler vocabulary
matches glTF/WebGL behavior: horizontal and vertical wrap, minification,
magnification, and mip filtering. Texture dimensions and device limits are
validated before GPU upload.

Color-space interpretation belongs to a material binding, not the image:

- base-color and emissive RGB samples are decoded from sRGB to linear;
- metallic-roughness, normal, and occlusion samples are linear data; and
- alpha is always linear coverage.

This permits one decoded image to be referenced by bindings with different
semantic interpretations without duplicating the source. The renderer uploads
compatible GPU encodings and uses shader decoding where WebGL formats cannot
express the complete binding contract.

GLB images in the first release must be buffer-view-backed PNG or JPEG
resources. The adapter decodes with `createImageBitmap`, requesting no browser
color-space conversion, premultiplication, or orientation change, and fixes
remaining orientation through explicit upload state rather than mutable
ambient pixel-store state. Unsupported MIME types fail before asset
publication. Mipmaps are generated only when the sampler requires them;
non-power-of-two textures use normal WebGL2 behavior.

A later public `useTexture()` hook may construct the same descriptor for
manually authored textured meshes. It is not required for the first GLB slice,
and this design does not prematurely choose its source/cache API.

## Material contract

The existing Lambert descriptor remains supported. A new closed material is
added:

```ts
export interface PibblWebGLPBRMetallicRoughnessMaterial {
  readonly type: "pbr-metallic-roughness";
  readonly baseColorFactor?: readonly [number, number, number, number];
  readonly baseColorTexture?: PibblWebGLTextureBinding;
  readonly metallicFactor?: number;
  readonly roughnessFactor?: number;
  readonly metallicRoughnessTexture?: PibblWebGLTextureBinding;
  readonly normalTexture?: PibblWebGLNormalTextureBinding;
  readonly occlusionTexture?: PibblWebGLOcclusionTextureBinding;
  readonly emissiveFactor?: readonly [number, number, number];
  readonly emissiveTexture?: PibblWebGLTextureBinding;
  readonly alphaMode?: "opaque" | "mask" | "blend";
  readonly alphaCutoff?: number;
  readonly doubleSided?: boolean;
}
```

Public binding types identify texture, UV set zero or one, and the glTF-defined
normal scale or occlusion strength where applicable. Unknown fields and
material types reject. Factors use the glTF defaults and ranges. Imported
material values are snapshotted into immutable descriptors; mutating parsed
JSON or source buffers cannot affect a published asset.

`Mesh.style.color` remains the common local tint and multiplies the PBR base
color in linear space. `Mesh.style.opacity` multiplies final alpha. Omitted
`style.material` remains Lambert, so existing manually authored scenes do not
silently become metallic-roughness materials.

The PBR implementation follows glTF's dielectric/metallic workflow and
energy-conserving microfacet split between diffuse and specular response.
Metallic surfaces receive no dielectric diffuse term. Roughness is clamped to
the renderer's documented nonzero numerical floor without changing the public
factor. Normal textures perturb the transformed geometric normal through the
tangent basis. Occlusion affects indirect/environment contribution, not direct
punctual lights. Emission remains self-illumination and does not light adjacent
geometry or imply bloom.

Pibbl ambient and hemisphere lights contribute artist-oriented diffuse fill to
PBR nonmetals; they do not synthesize physically based reflections and do not
make metals visible. Directional, point, and spot lights use the PBR direct
BRDF and retain their existing attenuation, cone, and shadow contracts.
Environment lighting supplies the indirect diffuse and specular response.

## Alpha, culling, and shadow behavior

glTF alpha intent determines queue behavior:

- `opaque` ignores sampled base-color alpha and enters the opaque queue;
- `mask` discards fragments below `alphaCutoff`, then depth-tests and writes as
  opaque geometry; and
- `blend` uses sampled alpha, enters the existing object-level transparent
  sort, depth-tests, and does not write depth.

An instance or mesh opacity multiplier below one promotes `opaque` and `mask`
materials into the blended queue; a promoted mask still applies its cutoff
before blending. Exact zero final instance opacity skips color and shadow
raster while retaining the existing geometry-backed interaction behavior.

`doubleSided: false` culls back faces and is the default. `doubleSided: true`
disables culling and flips the shading normal on back-facing fragments as glTF
requires. Picking follows rendered sidedness so an invisible culled back face
does not become a coordinate target. Focus bounds remain geometric bounds.

Opaque PBR primitives retain the existing cast/receive defaults. Masked
casters sample the base-color texture and apply the same cutoff in the shadow
depth pass. Blended primitives do not cast by default, while an explicit
instance or mesh override may cast an opaque silhouette consistent with the
existing transparency override. Environment illumination is not shadowed by
the current direct-light shadow maps.

## Shadow texture-unit migration

The current Lambert implementation reserves sixteen fragment texture units:
eight 2D shadow samplers and eight cube shadow samplers. WebGL2 guarantees only
sixteen fragment texture units, so that layout cannot coexist with material and
environment textures.

Before PBR texture rendering, Pibbl will migrate direct-light depth storage to
one renderer-owned 2D depth-texture array. Directional and spot lights consume
one layer; point lights consume six face layers. The whole `WebGLLayer` already
uses one shadow quality/resolution, so all layers have compatible dimensions.
Point-light direction is converted to cube face and UV coordinates in the
shader before sampling the corresponding array layer.

The texture array uses one sampler unit. Stable light identity and face index
determine layer assignments for a committed generation. Invalid light-space
plans update only their layers; camera-only changes reuse them. Candidate array
growth or layer reassignment rerenders every affected layer because depth data
is not copied between candidate arrays. Layer rendering and assignment changes
remain transactional. Context loss discards the array and recreates it from
retained CPU shadow plans.

One PBR draw then fits inside the WebGL2 minimum budget:

- one shadow-array sampler;
- five core material texture samplers;
- diffuse and specular environment samplers;
- one BRDF lookup sampler; and
- remaining units reserved for renderer implementation needs.

Pibbl validates actual fragment and combined texture-unit limits once per context
generation and reports an actionable capability error before partial drawing.

## Environment lighting and reflections

The HDR subpath adds a component-owned environment hook, while the root package
adds the environment asset type and scene declarations:

```ts
export type PibblWebGLEnvironmentLoadResult =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly environment: PibblWebGLEnvironment;
    }
  | { readonly status: "error"; readonly error: Error };

export function useHDREnvironment(
  source: string | URL | ArrayBuffer,
): PibblWebGLEnvironmentLoadResult;

export interface EnvironmentLightProps {
  readonly environment: PibblWebGLEnvironment;
}

export interface EnvironmentLightStyle {
  readonly intensity?: number;
  readonly rotationYDegrees?: number;
}
```

`EnvironmentLight` illuminates every PBR mesh in the settled scene regardless
of JSX order. It creates no geometry, target, direct-light shadow, or visible
background. `WebGLBackgroundProps` gains an optional `environment` reference;
its style gains optional `rotationYDegrees`. Existing color backgrounds retain
required `style.color`; an environment background omits color. Color and
environment inputs are mutually exclusive on one declaration, and the scene
still permits at most one background.

The first environment source format is Radiance RGBE `.hdr`. It is decoded to
finite linear values. A renderer context generation derives and owns:

- an environment cube map;
- a diffuse irradiance representation;
- a roughness-prefiltered specular cube mip chain; and
- a BRDF integration lookup texture.

`useHDREnvironment()` follows the same source-generation, copied-`ArrayBuffer`,
stale-completion, error-value, internal-lease, and final-release rules as
`useGLTF()`. It has no implicit cross-hook URL cache in this release.

Generation is lazy and transactional on first use. The CPU environment asset
is context-independent and may be used by multiple layers; every layer owns
its own GPU derivation. Environment changes invalidate the affected color
render but do not invalidate direct-light shadow maps. Rotation changes sample
orientation without regenerating the prefilter.

These are image-based reflections. This release does not promise local
reflection probes, screen-space reflections, planar mirrors, recursive scene
capture, or ray tracing.

## Linear output, exposure, and tone mapping

`WebGLLayer.style` gains:

```ts
readonly toneMapping?: "none" | "pbr-neutral";
readonly exposure?: number;
```

`toneMapping` defaults to `"pbr-neutral"`; `exposure` defaults to `1` and must
be finite and nonnegative. The `"pbr-neutral"` implementation follows the
[Khronos PBR Neutral reference](https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral)
for faithful glTF, product, architecture, and CAD color. `"none"` is the
explicit compatibility/debug choice for exposure, clamp, and display encoding
without highlight compression.

The renderer shades and blends the color scene into a linear intermediate
target. When `EXT_color_buffer_float` is available, Pibbl uses an RGBA16F target.
HDR environments require that capability and fail with a clear layer
diagnostic when it is unavailable. A non-HDR scene may use a portable RGBA8
linear fallback, accepting per-pass clamping while retaining the selected final
mapping.

After scene rendering, one full-layer output pass applies exposure, the chosen
tone mapper, linear-to-sRGB encoding, and the alpha conversion required by the
Canvas bitmap path. `"none"` clamps after exposure and performs only display
encoding. This preserves exact unlit CSS colors within framebuffer rounding
when exposure is one and `toneMapping` is `"none"`, while moving light
accumulation and blending to the correct linear domain.

The intermediate target is renderer-owned, follows backing dimensions, and is
recreated transactionally on size, capability, or context-generation changes.
It participates in the same candidate bitmap transaction; failure never
commits a partially tone-mapped frame.

Pibbl requests a device-clamped multisample intermediate where the chosen color
format supports it, resolves before the final output pass, and records the
resolved sample count in structural evidence. This design does not add a
public sample-count control or promise identical edge pixels across devices.

This is an intentional output-contract migration. Existing opaque unlit colors
remain exact within framebuffer rounding when authors select `"none"` and use
exposure one. Default PBR Neutral mapping may compress highlights, and moving
light accumulation plus alpha blending from display space to linear space may
change existing lit or translucent pixels. Implementation must update the
current contracts and migration notes, inspect every affected visual baseline,
and explain each intentional difference; it must not rewrite baselines merely
to pass.

## Asset and GPU ownership

Decoded asset resources and GPU resources have different owners.

### CPU asset generation

One `useGLTF()` source generation owns its fetch, parsed buffers, generated
vertex streams, decoded image bitmaps, and initial asset lease. Publication is
all-or-nothing. Cancellation or failure closes every decoded image and drops
every buffer created by that generation.

An asset maintains deterministic internal leases:

- the creating hook holds one lease while that result is current;
- a renderer candidate acquires at most one provisional lease per distinct
  asset used in that candidate scene;
- commit transfers provisional leases into the renderer's resident asset set;
- rollback releases only provisional leases;
- a later successful scene releases omitted resident leases; and
- layer disposal releases every resident lease.

When the final lease ends, image bitmaps close exactly once and the descriptor
becomes unusable; a later attempt to submit an expired descriptor reports a
deterministic `Model` diagnostic. This permits a committed renderer to retain
restoration data briefly after its creating hook changes, without relying on
garbage collection or a stale component closure.

Context loss releases context-owned GPU objects but retains resident CPU asset
leases required for restoration. Final disposal after context loss does not
issue invalid GL deletes, but it still releases CPU leases.

### Context-local GPU resources

The existing renderer resource transaction grows texture, sampler,
environment, output-target, and material-program ledgers. Geometry and texture
descriptors are keys, never public GPU handles. Two instances using the same
asset in one layer share buffers and textures. The same asset in two layers is
uploaded once per context because WebGL contexts cannot share those objects.

Every candidate-created buffer, vertex array, texture, sampler, framebuffer,
renderbuffer, and program is deleted on rollback unless it was already
resident. Commit deletes omitted resident resources after the candidate is
complete. Context replacement clears ownership records and recreates resources
from retained immutable inputs.

No source image, parser object, or application callback is retained by a GPU
resource after its asset lease ends.

## GLB support contract

Feature completion supports one self-contained glTF 2.0 binary container with:

- exactly one valid JSON chunk and an optional valid BIN chunk;
- the declared default scene, or scene zero when no default is declared;
- node trees using matrix or TRS transforms under glTF composition rules;
- meshes with `TRIANGLES` primitives;
- positions, normals, tangents, UV sets zero and one, vertex color zero, and
  indices;
- valid core accessor component types, normalization, byte offsets, byte
  strides, and sparse accessors;
- multiple primitives and materials per mesh;
- embedded PNG and JPEG images;
- core samplers and texture bindings;
- core metallic-roughness, normal, occlusion, and emissive material behavior;
- opaque, mask, and blend alpha modes plus double-sided materials; and
- unknown optional extension data ignored without changing the core fallback.

`KHR_materials_unlit` is included because it maps directly onto Pibbl's existing
unlit path and is a ratified, common semantic. Other extensions are deferred.
Any name in `extensionsRequired` that Pibbl does not support rejects the asset
before publication and lists the unsupported names. Unknown `extensionsUsed`
entries are tolerated only when the core fallback remains valid.

Imported cameras, lights, animations, skins, morph targets, non-triangle
primitive modes, external URIs, and non-selected scenes remain parsed only as
needed to validate references; they are not rendered in this release. A file
whose selected scene requires unsupported geometry or deformation fails rather
than silently omitting visible content.

The decoder validates chunk lengths, JSON types, integer ranges, buffer and
buffer-view bounds, accessor counts and strides, alignment, index ranges,
image references, acyclic selected node traversal, and multiplication/addition
overflow before allocating or reading. Diagnostics identify the glTF JSON path
and source URL when available. Parser failures never reach WebGL.

## Scene settlement and rendering

The frame lifecycle remains:

```text
Begin
  -> Advance
  -> Commit
  -> Plan
  -> execute each dirty WebGLLayer child tree once
  -> compose CPU-only declarations
  -> close and settle the complete scene
  -> acquire candidate GPU resources
  -> update invalid shadow/environment generations
  -> render linear color queues
  -> resolve and map output
  -> transfer candidate ImageBitmap
  -> composite to Canvas
  -> transactionally commit bitmap, pick, focus, and resource generations
  -> Complete
```

Loading completion only requests ordinary scheduled work. It does not draw,
upload, settle, or transfer a bitmap from an asynchronous callback. Asset and
environment declarations remain CPU-only during component traversal.

Imported primitive bounds, transformed triangles, and material sidedness feed
the same settlement used by raster, picking, focus projection, and shadow
planning. Textures and visual shading never alter layout or focus bounds.

## Printable-model adapters after GLB

3MF and STL use the common immutable asset and `Model` component, but each gets
its own later format contract.

The 3MF project should begin with Core mesh, units, objects, components,
transforms, build items, names, and base materials/colors. A print-oriented
example should expose source units, dimensions, part count, build transforms,
and diagnostics rather than silently auto-normalizing the model. Manufacturing
materials are preserved as typed source metadata and mapped to an explicitly
documented preview appearance; they are not reclassified as physically based
rendering materials.

STL should support both binary and ASCII forms, preserve raw coordinates,
require an application-selected unit interpretation when physical dimensions
matter, and generate reliable render normals. Loader success does not imply
printability. Manifold, boundary, winding, self-intersection, thickness, and
repair analysis are separate later capabilities and must not be claimed by a
viewer.

Advanced 3MF extensions are independently gated. In particular, the 3MF
Boolean Operations extension is a serialized manufacturing operation model;
supporting it does not automatically define Pibbl's interactive CSG API or
editable topology representation.

STEP remains outside the mesh-adapter roadmap. Faithful STEP support requires
precise curves, surfaces, topology, tolerances, and a CAD geometry kernel. It
should be considered only for a concrete CAD-grade use case.

## Procedural geometry and future modeling

Procedural shapes should be immutable geometry creators usable with `Mesh`,
not a large set of renderer-special-case draw paths. Candidate later creators
include plane, disk/ring, cylinder, cone/frustum, torus, capsule, and rounded
box, with explicit segment, cap, sweep, and normal choices.

A modeling tool requires a separate editable authoring model containing stable
vertex/edge/face identity, adjacency, selections, commands, undo/redo, and
conversion to immutable render geometry. CSG, extrusion, beveling, subdivision,
repair, and UV editing belong there. The render asset in this design is a
compiled output, not that editable model.

The separation is intentional:

```text
editable authoring topology or manufacturing document
  -> evaluate / triangulate / compile
  -> immutable PibblWebGLAsset
  -> Model declarations
  -> settled renderer scene
```

This leaves Pibbl capable of hosting a future modeling application without
forcing today's renderer to retain or mutate application geometry.

## Failure behavior

- A malformed or unsupported GLB produces `status: "error"` for that source
  generation and never publishes a partial asset.
- A stale fetch, decode, or preprocessing completion is ignored and releases
  everything it created.
- Invalid material, texture, environment, or geometry data fails before the
  first affected GL command.
- Unsupported required glTF extensions list every unsupported extension.
- Capability failures identify the missing WebGL2 limit or extension and the
  feature that requires it.
- Candidate upload, environment derivation, shadow update, PBR draw, resolve,
  or output-pass failure rolls back candidate GPU resources and does not commit
  bitmap, pick, or focus state.
- Context loss uses the existing no-delete invalidation path and retains only
  the CPU leases required for restoration.
- Model removal, source replacement, failed component cleanup, layer disposal,
  and root disposal release exact target, asset, and renderer ownership.

## Verification and evidence

### Parser and asset semantics

- GLB header/chunk, reference, bounds, stride, normalization, sparse-accessor,
  node-cycle, and overflow matrices;
- valid interleaved and deinterleaved accessor fixtures;
- stale source, cancellation, decode error, removal, and disposal races;
- unsupported-required versus ignored-optional extension behavior;
- deterministic generated normals and MikkTSpace-compatible tangents; and
- source-order, scene selection, transform, bounds, material, and name facts.

### Renderer semantics

- exact geometry attributes and texture/sampler uploads;
- PBR factor and texture-channel behavior;
- sRGB versus linear texture interpretation;
- normal, occlusion, and emissive maps;
- opaque, cutout, blend, culling, and promoted-opacity queues;
- alpha-tested color and shadow silhouettes;
- analytic-light, environment diffuse, and environment specular response;
- exposure, no-tone-map, PBR Neutral, final encoding, and alpha behavior;
- mixed imported and manually authored Pibbl meshes in global depth order; and
- unchanged pointer coordinates, nearest-depth picking, focus bounds, event
  propagation, and Canvas/WebGL composition.

### Ownership and failure

Deterministic counters cover fetch generations, parsed assets, CPU image
resources, asset leases, buffers, vertex arrays, textures, samplers,
framebuffers, renderbuffers, programs, environment derivations, shadow-array
layers, intermediate targets, and candidate/committed bitmaps. Evidence covers
successful replacement, rollback at each acquisition stage, context loss and
restoration, repeated mount/dispose, multiple model instances, multiple layers,
and final root disposal. Garbage collection is never the oracle.

### Public and experiential evidence

- one minimal synthetic GLB fixture for deterministic semantic tests;
- one licensed representative public model vendored for the Studio learning
  example and visual evidence;
- a public example showing loading, error, orbit, environment light, matching
  background, and shadows;
- Bundler and NodeNext imports for the root and `@pibbl/webgl/gltf` subpath;
- packed consumer execution with no private imports;
- source and built browser modes;
- Studio declarations, API reference, search, and navigation; and
- visual expected/actual/diff inspection for every intentional baseline
  change.

The first feedback milestone runs focused checks only. Feature-complete claims
require the proportional final gate and fresh recorded output; dated test totals
in documentation are not evidence.

## Documentation

Feature completion updates:

- the `@pibbl/webgl` README and public API inventory;
- the WebGL island and lighting guides;
- a new guide for loading and presenting 3D assets;
- material, texture, environment, asset, model, and hook API references;
- one learning example based on a licensed representative GLB;
- package-consumer and Studio declaration fixtures; and
- the drawing, style, canvas-surface, scheduling, hook, event, and resource-
  ownership contracts.

The guide clearly distinguishes runtime delivery (`glTF/GLB`), additive
manufacturing (`3MF` and compatibility STL), and editable CAD/source formats.
It does not present a successful preview as evidence that a mesh is printable.

## Rejected alternatives

### Add many primitives before asset loading

Primitives are useful and should follow, but they do not unlock authored asset
ecosystems or force the renderer foundations needed for professional output.

### Parse GLB directly into public Pibbl elements

Returning a large public element tree would tie parsed assets to one mounted
component identity, duplicate CPU data for repeated instances, make decoded
resource ownership unclear, and expose glTF's schema as Pibbl's retained scene
API. The opaque asset plus `Model` boundary keeps data reusable and rendering
declarative.

### One magic `Model src=` loader

Inferring a parser from a file extension hides loading/error state, makes
format-specific options ambiguous, prevents clean optional bundles, and becomes
especially misleading for manufacturing formats. Explicit format hooks plus a
common `Model asset=` value keep concerns visible.

### Put glTF parsing in the `@pibbl/webgl` root bundle

Applications using only procedural meshes should not acquire format parsing and
image-decoding code. Public adapter subpaths provide an intentional capability
boundary without creating many packages.

### Treat 3MF as another rendering format

3MF materials, units, build items, and extensions describe manufacturing
intent. Flattening them into PBR would discard meaning and make round-tripping
or future inspection unreliable.

### Start with STL because it is simpler

STL would prove triangle parsing but would not establish textures, PBR,
hierarchy, reusable asset materials, or professional presentation. It is a
valuable compatibility adapter after the common asset seam exists.

### Make the imported asset publicly mutable

Mutation would introduce adoption, aliasing, dirty tracking, teardown,
cross-context synchronization, undo, and stable topology identity before Pibbl
has an editing use case. Immutable assets fit the current scheduler and
transactional renderer.

### Expose raw shaders for professional materials

Raw shaders shift portability, color, light, shadow, texture-unit, context-loss,
and ownership obligations to applications. Pibbl instead grows a closed portable
material vocabulary and may later add a separately designed contained extension
point if real use cases require it.

### Pursue ray tracing in WebGL2

Ray tracing would require a different acceleration, material, denoising, and
performance model and would compete with the asset/PBR foundations needed by
ordinary applications. A later WebGPU backend may reuse asset and material
values without changing this WebGL2 contract.

## Decisions reserved for later designs

- URL cache, preload, eviction, persistence, and offline asset policies.
- External `.gltf` resource graphs and credential/base-URL control.
- Per-node inspection, visibility, targeting, material replacement, and stable
  path semantics.
- Imported animation ownership and its integration with Pibbl animation.
- Texture compression and mesh decompression dependencies.
- Advanced PBR extensions and environment formats beyond Radiance HDR.
- Print-analysis tolerances, unit policies, and diagnostic vocabulary.
- Editable topology, CSG representation, and undo/redo ownership.
- Export or round-trip fidelity for any asset or manufacturing format.
- WebGPU renderer parity and any ray/path-tracing contract.
