# WebGL orbit camera and genuine shadows design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved design; current shipped behavior remains governed by `docs/design/`
> until implementation lands.

Date: 2026-09-15

Status: design and written specification approved on 2026-09-15.

## Summary

CRC will add an explicit `crcOrbitCamera()` hook and genuine geometry-based
shadow maps to `@crc/webgl`.

`crcOrbitCamera()` does not create a camera object or change the
`WebGLLayer.camera` contract. The hook owns spherical interaction state and
returns current `position` and `lookAt` values plus a stable bundle of ordinary
CRC event handlers. Authors attach those handlers to whichever CRC event
participant should control the view. `WebGLLayer` continues to receive one
plain perspective-camera descriptor and remains unaware of controls.

Shadow quality is one local rendered-behavior setting on `WebGLLayer.style`:
`false | "low" | "medium" | "high"`. Omission means `"medium"` so ordinary
lit scenes cast genuine shadows without a separate opt-in. Directional, point,
and spot lights cast by default; opaque meshes cast and receive by default.
Ambient and hemisphere lights cannot cast directional shadows. Per-light and
per-mesh style flags provide explicit opt-outs and transparency overrides.

The renderer uses conventional depth shadow maps. Directional and spot lights
render one depth view; point lights render the conventional six cube
directions. Shadow maps are renderer-owned, context-local, and cached
independently of the presentation camera. Orbiting a camera therefore reuses
valid shadow maps. A shadow-casting light change, caster change, quality
change, context replacement, or relevant surface-capability change invalidates
the affected cache.

This design extends
`2026-09-14-webgl-lighting-materials-and-background-design.md` and supersedes
only its shadow deferral. It does not add textures, image environments, bloom,
PBR, custom shaders, or a retained application scene graph.

## Goals

- Let users rotate around a chosen world-space point and zoom without teaching
  `WebGLLayer` about control schemes.
- Keep the existing plain `CRCWebGLPerspectiveCamera` descriptor as the only
  camera input to `WebGLLayer`.
- Make orbit interaction use the same public CRC event handlers, propagation,
  pointer capture, scheduling, hook identity, and teardown model as other CRC
  interaction.
- Make cast shadows work by default in an ordinary lit scene.
- Offer familiar `low`, `medium`, and `high` quality choices instead of
  exposing shadow-map implementation knobs.
- Produce genuine geometry-based shadows for directional, point, and spot
  lights.
- Let opaque, unlit, and emissive objects occlude light independently of
  whether analytic lighting affects their own color.
- Cache shadow work so a camera-only change does not regenerate unchanged
  light-space depth.
- Preserve settled-scene composition, transactional bitmap/pick/focus commits,
  interaction geometry, transparent ordering, context restoration, and exact
  GPU ownership.
- Make every public lighting example inspectable from different angles and
  make cast shadows visible against the same shared ground plane.

## Non-goals

- Replacing the plain perspective-camera descriptor with a retained public
  camera class.
- Passing controls, controllers, or input configuration to `WebGLLayer`.
- Camera panning, roll, inertia, damping, autorotation, keyboard navigation,
  multi-touch pinch, or multiple simultaneous orbit pointers in the first
  release.
- Orthographic cameras, multiple cameras, split-screen viewports, or camera
  entities inside the WebGL scene.
- Cascaded directional shadow maps, contact shadows, screen-space shadows,
  ray-traced shadows, stencil shadow volumes, or baked light maps.
- Colored or transmissive shadows, alpha-tested texture shadows, soft area
  sources, penumbra-size controls, cookies, or IES profiles.
- Public shadow cameras, map sizes, bias values, filter kernels, atlases,
  texture units, or render-pass callbacks.
- A guarantee that shadow-map texel density is independent of scene size.
- Making `WebGLBackground` receive pointer events or shadows.
- Textures, image environments, HDR, tone mapping, bloom, PBR, or raw WebGL
  access.

## Alternatives considered

### Selected: pose-producing orbit hook

`crcOrbitCamera()` returns data required by the existing camera descriptor and
the event handlers that update that data:

```tsx
const orbit = crcOrbitCamera({
  orbitPoint: [0, 0.75, 0],
  initialPosition: [6, 4, 8],
  minDistance: 3,
  maxDistance: 20,
});

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
>
  {scene}
</WebGLLayer>;
```

This keeps camera projection declarative and keeps input ownership explicit.
The hook name describes the interaction behavior it provides rather than a
new renderer-side camera identity.

### Rejected: `WebGLLayer.controls`

A controls property would make the renderer layer own a particular input
scheme even though controls only derive camera pose. It would obscure event
scope, complicate multiple independently controlled regions, and couple future
control schemes to `WebGLLayer`.

### Rejected: retained perspective and orbit camera classes

The renderer already accepts a complete immutable-looking value each render.
A public camera instance would introduce identity, mutation, sharing, adoption,
and disposal semantics without solving a renderer requirement. Component-owned
hook state is sufficient.

### Rejected: hook returns only opaque callbacks or a `bind()` function

A named `handlers` object visibly follows CRC's existing event vocabulary,
supports normal JSX spreading, and can be composed with application handlers.
A binding function would add an abstraction and allocate or cache property
objects without providing a needed capability.

### Selected: conventional shadow maps

Depth shadow maps are the established fit for CRC's raster renderer. They
support directional, spot, and omnidirectional point lights, hard or filtered
edges, renderer-owned caching, and simple quality scaling.

### Rejected: stencil shadow volumes

Volumes can produce exact hard silhouettes but require additional geometry
construction, do not naturally provide filtered edges, and complicate custom
meshes and clipping at infinity.

### Rejected: screen-space shadows

Screen-space methods cannot represent occluders outside the presentation
camera and visibly break as the user orbits. They are unsuitable for the
default correctness promise.

### Rejected: dual-paraboloid point shadows

Two paraboloid views reduce point-light rendering passes but introduce seam
and projection distortion. CRC chooses the conventional six-direction result
for predictable quality. Caching addresses static-scene cost; the quality tier
does not substitute an approximate projection.

## Public API

### Orbit camera hook

`@crc/webgl` exports:

```ts
export interface CRCOrbitCameraOptions {
  readonly orbitPoint: CRCWebGLVector3;
  readonly initialPosition: CRCWebGLVector3;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly rotateSpeed?: number;
  readonly zoomSpeed?: number;
}

export type CRCOrbitCameraHandlers = Required<Pick<
  CRCEventHandlers,
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onLostPointerCapture"
  | "onWheel"
>>;

export interface CRCOrbitCameraResult {
  readonly position: CRCWebGLVector3;
  readonly lookAt: CRCWebGLVector3;
  readonly handlers: CRCOrbitCameraHandlers;
}

export function crcOrbitCamera(
  options: CRCOrbitCameraOptions,
): CRCOrbitCameraResult;
```

`orbitPoint` and `initialPosition` are required to avoid a hidden initial
framing convention. `minDistance` defaults to `0.1`, `maxDistance` defaults to
positive infinity, and both speeds default to `1`. `minDistance` and a provided
`maxDistance` must be finite and strictly positive, and the maximum must not be
less than the minimum. The initial camera-to-orbit-point distance is clamped to
those bounds. Speeds must be finite and nonnegative. Every vector component
must be finite, and `initialPosition` must not equal `orbitPoint`.

`initialPosition` is read only when the hook slot mounts. The current spherical
azimuth, polar angle, and distance then belong to that mounted hook slot.
`orbitPoint`, distance bounds, and speed options are live inputs. Each render's
returned pose uses that render's validated candidate options, while the slot
adopts them for later event callbacks only after the render succeeds. Moving
`orbitPoint` translates the current spherical offset rather than resetting its
angles or distance. Tighter distance bounds clamp the candidate distance in
that render and commit the clamped distance only when the render succeeds.

The result's `lookAt` equals the current `orbitPoint`. `position` is the point
plus the current spherical offset. Returned vector snapshots change only when
their values change. The `handlers` object and its function identities remain
stable for the hook-slot lifetime and read the latest successfully adopted
options.

The hook follows normal CRC hook ordering and ownership. Calling it during
every component render retrieves the same component-owned slot; it does not
create another camera or event subscription. Removal, remount, render failure,
and root disposal use ordinary hook teardown semantics.

### Orbit input semantics

The handler bundle uses only ordinary public CRC events:

- A primary `pointerdown` begins one orbit gesture and captures that pointer on
  `event.currentTarget`.
- Moves from the captured pointer use root-logical `x` and `y` deltas. At the
  default speed, each logical pixel changes the corresponding angle by `0.01`
  radians; `rotateSpeed` multiplies that delta. The polar angle is clamped to
  `0.001..(pi - 0.001)` radians so the camera never flips.
- `pointerup`, `pointercancel`, and `lostpointercapture` end the matching
  gesture. Events from other pointers do not steal it.
- `wheel` changes radial distance exponentially so zoom direction and feel do
  not depend on current scene scale. Pixel deltas are used directly, line
  deltas use 16 pixels per line, and page deltas use the root logical viewport
  height. The distance multiplier is
  `exp(normalizedDeltaY * 0.001 * zoomSpeed)`. The result is clamped to the
  current bounds, and the handler prevents the corresponding page-scroll
  default when it changes the camera.
- Pointer and wheel changes publish ordinary hook-owned reactive state and ask
  CRC for a scheduled render. The hook owns no independent animation loop and
  requests no idle frames.

The handler bundle may be spread onto any CRC component that accepts event
handlers:

```tsx
<Cube {...orbit.handlers} style={{ color: "#f472b6" }} />
```

Structural components remain propagation listeners rather than independent
hit geometry. To make an entire viewport draggable, the author supplies a
viewport-sized target beneath the island and attaches the handlers to a common
ancestor:

```tsx
<Group {...orbit.handlers}>
  <Rectangle
    style={{
      width: 960,
      height: 540,
      fill: "rgba(0, 0, 0, 0)",
    }}
  />
  <WebGLLayer style={{ width: 960, height: 540 }} camera={camera}>
    {scene}
  </WebGLLayer>
</Group>
```

WebGL geometry hit events and empty-space events from the backing Rectangle
bubble through the Group. This preserves the existing rule that a transparent
WebGL background is not itself a target. Applications that need their own
handlers compose them explicitly in normal callbacks; JSX spread order does
not merge callbacks automatically.

### Shadow quality

`WebGLLayerStyle` gains:

```ts
export type CRCWebGLShadowQuality = false | "low" | "medium" | "high";

export interface WebGLLayerStyle {
  readonly shadows?: CRCWebGLShadowQuality;
}
```

Omission resolves to `"medium"`. `false` allocates no shadow targets, performs
no shadow depth passes, and makes `castShadow` and `receiveShadow` visually
inert without making them invalid.

The tiers define intent and minimum algorithm shape:

| Quality | Requested square resolution per view | Depth comparisons |
| --- | ---: | ---: |
| `"low"` | 512 | 1, hard edge |
| `"medium"` | 1024 | 4, filtered |
| `"high"` | 2048 | 9, filtered |

The renderer clamps the requested resolution to the WebGL2 context's supported
maximum. A device clamp does not change the selected comparison count. The
tier applies uniformly to every shadow-casting light in one `WebGLLayer`; CRC
does not silently select only some eligible lights.

Map layout, texture arrays or atlases, depth format, sampling pattern, and bias
remain private implementation details. CRC selects deterministic internal near
planes and depth bias from the resolved light projection and settled scene
bounds. This release exposes no per-light quality or tuning escape hatch.

### Light participation

`DirectionalLightStyle`, `PointLightStyle`, and `SpotLightStyle` gain:

```ts
readonly castShadow?: boolean;
```

Omission means `true`. Ambient and hemisphere light styles do not expose the
field because those lights have no singular direction or position from which
to form a direct-light shadow projection.

Every eligible direct light casts when the layer quality is not `false`; CRC
does not choose a primary light or silently truncate shadow participation. The
existing eight-total-light scene limit remains unchanged. Authors control a
dynamic scene's cost by choosing the layer quality or explicitly setting
`castShadow: false` on individual direct lights.

Containing `Group3D` transforms affect the light-space pose exactly as they
affect visible illumination. A directional or spot light's transformed local
`-Z` remains its direction. A point or spot light's transformed local origin
remains its position. Group scale does not change optical intensity, light
range, cone angle, or shadow resolution.

### Mesh participation

`MeshStyle`, and therefore `CubeStyle` and `SphereStyle`, gains:

```ts
readonly castShadow?: boolean;
readonly receiveShadow?: boolean;
```

The effective defaults depend on final mesh alpha, which remains parsed color
alpha multiplied by `style.opacity`:

| Final alpha | Default cast | Default receive |
| --- | --- | --- |
| `1` | yes | yes when lit |
| greater than `0` and less than `1` | no | yes when lit |
| `0` | no | no |

`castShadow` is independent of `style.lit`. An opaque unlit or emissive mesh
therefore occludes direct lights by default. `receiveShadow` affects only a
lit material's direct-light contribution; setting it on `lit: false` is valid
but has no visible effect. Ambient, hemisphere, and emissive contributions are
not reduced by direct-light shadowing.

An explicit `castShadow: true` on a partially transparent mesh writes an opaque
depth silhouette. Colored and fractional light transmission are non-goals.
Final-alpha-zero geometry never writes a color or shadow depth value even when
explicitly enabled, preserving the existing zero-alpha raster rule and its
separate pick/focus eligibility.

A mesh does not need normals merely to cast into a depth map. Existing normal
requirements for lit color rendering remain unchanged.

## Settled scene and render flow

Shadow declarations extend the existing frame-local settled scene; they do not
perform GL work during component execution:

```text
beginFrame
  -> execute retained WebGLLayer children once
  -> compose CPU-only mesh, light, material, and background declarations
  -> close and validate the complete scene
  -> settle world transforms, bounds, render queues, and shadow participants
  -> reuse or render required light-space depth generations
  -> render opaque and transparent color queues with shadow sampling
  -> transfer one candidate bitmap
  -> Canvas composite
  -> commit bitmap, pick, and focus generations together
```

A light declared after a mesh shadows that mesh in the same frame. Group and
component source order remain identity, event/focus order, and stable tie
evidence rather than an immediate shadow-render order.

Directional shadow projection is an orthographic fit of the settled
shadow-relevant scene bounds in light space. Spot projection uses the settled
position, direction, outer cone, and finite range when present; otherwise its
far distance encloses relevant settled bounds. Point projection uses six
90-degree views from the settled light position and likewise uses finite range
when present or relevant settled bounds otherwise. Lights with no relevant
caster/receiver bounds require no depth pass.

Each light shadow factor attenuates only that light's diffuse direct
contribution. Multiple direct lights therefore remain independently visible:
occlusion from one light does not darken contributions from another.

Opaque and transparent main-camera queues retain their current depth and sort
rules. Shadow-map generation is a prior renderer pass, not another public
paint entry. Shadows change pixels only; pick rays, focus bounds, pointer
coordinates, cursor regions, layout, and Canvas composition geometry remain
based on the original mesh and camera geometry.

## Shadow cache and ownership

The `WebGLLayer` renderer owns every shadow framebuffer, depth texture,
comparison sampler or equivalent state, cache generation, and shader program.
No component or public hook owns GL resources.

A cached light-space generation is reusable only when all of the following are
unchanged:

- quality tier and resolved device resolution;
- light kind, world pose, range, and cone projection inputs;
- the identity, geometry generation, world transform, final-alpha class, and
  effective `castShadow` state of every relevant caster;
- any receiver bounds and effective `receiveShadow` state used to derive the
  light's automatic projection extent;
- context generation and renderer shadow-program generation.

Material base color, emissive values, background, presentation camera position,
and presentation camera projection do not by themselves invalidate shadow
depth. Receiver-only changes invalidate only the lights whose automatic
projection extents change. A camera-only orbit thus reuses depth maps and only
reruns the main color render.

Cache replacement is transactional. Allocation, framebuffer completeness,
depth rendering, color rendering, bitmap transfer, or later frame failure
cannot publish a partial bitmap/pick/focus generation. Failed candidate shadow
resources are released; previously valid owned generations remain reusable
when they were not invalidated by context loss. Context replacement recreates
all programs, buffers, targets, and shadow generations in the new context.
Layer and root disposal release them exactly once.

The renderer may share private physical shadow storage among logical lights,
but reuse must not make results dependent on source traversal order or leak
stale depth between lights or frames.

## Validation and errors

Public values are validated before GL work. Unknown style keys retain the
current closed-style error behavior. Invalid quality strings, vectors,
distances, speeds, or boolean participation fields fail the candidate render
with the component and field named in the diagnostic.

Renderer capability or allocation failures use the current `WebGLLayer`
failure and rollback boundary. CRC does not silently disable all shadows or
substitute screen-space/fake shadows when genuine depth resources cannot be
created. Device resolution clamping is the one documented capability
adaptation because it preserves the selected algorithm.

## Examples and documentation

Every public lighting demonstration keeps the same camera framing, cube,
sphere, custom-normal ground plane, base materials, and background. The shared
example scene uses one `crcOrbitCamera()` call and one common viewport event
region so primary drag rotates and wheel input zooms in every example.

Every direct-light and combined-light example visibly casts onto the ground
plane. Ambient-only and hemisphere-only examples retain the same scene but
document that those lights cannot produce direct-light shadows. The shadow
quality example presents the same scene with one editable
`shadows: "medium"` line. The multiple-lights example remains the primary
browser-visible vertical slice.

Learn and API documentation will explicitly cover:

- why the camera remains a plain descriptor;
- why calling `crcOrbitCamera()` every component render is stable and cheap;
- how to attach handlers to a mesh, a structural ancestor, or a viewport-sized
  target;
- why a structural component alone does not create hit geometry;
- default shadow behavior and per-light/per-mesh opt-outs;
- the six-view cost of invalidated point-light shadows and cache reuse;
- transparent-caster behavior and current shadow non-goals;
- quality-tier intent and device resolution clamping.

## Verification strategy

Implementation follows the repository trust gates: observable contracts and
failing tests precede production behavior, while full aggregate verification
is intentionally deferred to the final pass.

Focused semantic evidence will cover:

- stable hook-slot/result-handler identity and transactional option adoption;
- primary-pointer ownership, capture, cancellation, unrelated-pointer
  rejection, polar clamping, distance clamping, and wheel normalization;
- no idle animation requests and one coalesced scheduled update per input
  change;
- handler use on a geometry target and on a viewport ancestor with backing hit
  geometry;
- default and explicit light/mesh shadow participation, including unlit,
  emissive, partially transparent, and zero-alpha cases;
- directional and spot single-view projections and point six-view projection;
- independent per-light attenuation of direct contribution;
- low, medium, high, disabled, and device-clamped plans;
- camera-only shadow-cache hits and precise caster/light invalidation;
- no GL work during component composition or scene settlement;
- rollback after allocation, depth pass, color pass, and bitmap-transfer
  failures;
- context restoration and exact shadow-resource teardown;
- unchanged pick/focus/event geometry and opaque/transparent queue behavior;
- runtime exports, declarations, editor types, packed consumers, NodeNext and
  bundler consumers, source/built browser modes, documentation links, example
  catalog consistency, and visual browser evidence.

The final verification pass runs the aggregate repository gate and records its
fresh environment and result. Intermediate implementation steps use only the
narrow evidence needed to keep forward progress, honoring the requested
verification budget.

## Approved decisions

- `WebGLLayer` receives no controls property.
- The perspective camera remains a plain data descriptor.
- `crcOrbitCamera()` returns `{ position, lookAt, handlers }`.
- Orbit handlers are ordinary, stable CRC event handlers attachable wherever
  the author chooses.
- Shadows use `false | "low" | "medium" | "high"`; omission is `"medium"`.
- Shadows are conventional geometry-based depth maps, never fake blobs or
  screen-space substitutes.
- Directional and spot shadows use one view; point shadows use six directions.
- Every eligible direct light casts by default; CRC does not silently choose a
  primary shadow light.
- Opaque meshes cast and receive by default; transparent defaults follow the
  final-alpha table.
- Camera-only movement reuses valid shadow depth generations.
- Examples retain one shared scene and expose camera inspection through code.
