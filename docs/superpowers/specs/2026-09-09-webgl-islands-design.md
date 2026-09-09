# WebGL islands design

> **Historical status: APPROVED DESIGN RECORD.** This document records the approved design; current shipped behavior remains governed by `docs/design/` until implementation lands.

Status: design approved in conversation on 2026-09-09; written-spec review
pending.

Date: 2026-09-09

## Summary

CRC will add an official `@crc/webgl` package for composing declarative WebGL2
scenes as transparent islands inside the existing Canvas 2D renderer. A
`WebGLLayer` owns one persistent WebGL2 `OffscreenCanvas`, renders CRC elements
with a WebGL backend, and composites the resulting bitmap at one ordinary
Canvas 2D paint position. Canvas 2D content may appear before or after the
island, and existing outer layout, transforms, clips, filters, focus, and event
propagation remain authoritative.

WebGL authoring uses the same branded `CRCElement` protocol, automatic JSX
runtime, synchronous component functions, hooks, keys, and component identity
as `@crc/core`. The initial WebGL vocabulary is `WebGLLayer`, `Group3D`,
`Mesh`, `Cube`, and `Sphere`, plus `defineWebGLPrimitive`,
`crcWebGLContext`, and `crcAnimationFrame`. `WebGLLayer` accepts one optional
camera descriptor and supplies a documented perspective camera when it is
omitted.

Canvas 2D and WebGL use one recursive interaction-resolution protocol. Every
candidate writes the same fixed-shape result record: miss, block, or target.
Canvas paths use the existing `Path2D` test; nested CRC layers recurse; WebGL
islands delegate to their committed scene picker. Drawing primitives become
logical event targets and occlude by default even when they have no handlers.
Structural containers contribute propagation ancestry but no hit geometry.
`pointerEvents="none"` is the explicit opt-out.

The packages are maintained and released together. `@crc/core` exposes a
documented-as-internal `@crc/core/internal` friend entry for official sibling
packages. The entry is not an application compatibility promise, and
`@crc/webgl` must consume the application's one installed core instance rather
than bundle another copy.

## Goals

- Render transparent WebGL2 islands among ordinary CRC Canvas 2D content.
- Author basic 3D scenes with the same JSX, `createElement`, component, hook,
  key, and lifecycle model as CRC Canvas 2D scenes.
- Ship useful first primitives: `Cube` and `Sphere`, built on a lower-level
  `Mesh` and transform-only `Group3D`.
- Keep one synchronous execution of each invalidated component subtree per
  scheduled CRC frame; never preflight or repeat a component subtree merely to
  discover camera, draw, or picking data.
- Make the camera available before WebGL child traversal so drawing stays
  immediate rather than requiring a retained scene graph or preliminary pass.
- Integrate WebGL objects into the existing global paint-order and DOM-aligned
  event system, including clips, transforms, propagation, pointer capture,
  cursor behavior, focus, and keyboard navigation.
- Make transparent island background pass through to lower Canvas 2D targets
  while visible default-participating WebGL geometry occludes them.
- Pair every WebGL draw primitive with corresponding pick geometry or an
  explicit event-participation opt-out.
- Preserve exact ownership and deterministic release of WebGL contexts,
  programs, shaders, buffers, textures, framebuffers, listeners, targets, and
  animation requests.
- Verify the feature through public package consumers, semantic browser
  scenarios, geometry assertions, visual evidence, failure injection, and
  structural performance evidence.

## Non-goals

- Reimplementing existing Canvas 2D primitives on WebGL.
- Canvas 2D children inside a WebGL island.
- Arbitrary alternation between Canvas 2D and WebGL within one island.
- Interleaving an external Canvas 2D primitive between two objects inside one
  flattened WebGL pass.
- Multiple cameras, viewports, portals, shadow passes, or render-to-texture
  graphs inside one `WebGLLayer`.
- A complete scene engine, material system, lighting system, model loader,
  physics engine, or animation timeline.
- Automatic semantic inference from arbitrary shader output.
- Alpha-readback or GPU ID-buffer picking as the default event path.
- Pixel-accurate hit testing for texture alpha, fragment discard, procedural
  displacement, blending, or user-controlled stencil behavior.
- WebGL1 fallback, WebGPU, workers, or cross-context GPU-resource sharing.
- A stable third-party renderer-plugin API in `@crc/core`.
- A retained cross-frame scene graph or retained cross-frame draw-command list.

## Package architecture

### Public packages

`@crc/core` remains the Canvas 2D runtime and owns the shared component,
scheduler, layout, composition, and event semantics. `@crc/webgl` is an
optional official package and owns WebGL-specific authoring, camera math,
rendering, picking, context handling, and GPU resources.

```text
Application
   |
   +-- @crc/core -------------- Canvas 2D public API
   |
   +-- @crc/webgl ------------- WebGL public API
             |
             +-- @crc/core/internal
                   renderer, ownership, scheduling,
                   composition, and interaction friend API
```

`@crc/webgl` declares the matching `@crc/core` release as a peer dependency
and externalizes every `@crc/core` import in its published build. Packed and
bundler-consumer verification must prove that an application has one core
module instance and therefore one renderer-global state. Bundling a private
copy of core into `@crc/webgl` is an error because it would split current
instance, element metadata, event-root, and scheduler identity.

### Official friend entry

`@crc/core` adds an explicit `./internal` package export. Its documentation
states that it is reserved for official CRC packages, version-coupled to core,
and has no independent semantic-versioning guarantee. Applications can resolve
the entry but do not receive compatibility support for it.

The entry exposes focused capabilities rather than requiring sibling packages
to import source files or `@crc/core/lib/*` paths. It includes the facilities
needed to:

- register and read backend-specific primitive definitions;
- traverse children under a selected backend while retaining core identity and
  hook semantics;
- acquire component-owned resource slots and teardown ownership;
- read the current allocation, render transaction, surface density, world
  transform, clipping stack, component refs, and frame timestamp;
- register nested interaction resolvers and logical targets;
- request a coalesced frame on the owning CRC instance;
- composite one owned bitmap at the current Canvas 2D paint position.

The entry may expose internal types and symbols required to preserve one
protocol identity. It does not expose mutable global state merely for
convenience when a narrower operation can maintain invariants.

## Authoring model

### One element protocol and JSX runtime

WebGL components use the existing `@crc/core/jsx-runtime` and produce ordinary
branded `CRCElement` values. A source file can freely compose imports from both
packages without selecting another JSX runtime.

```tsx
import { crc, Rectangle, Text } from "@crc/core";
import { Cube, Group3D, Sphere, WebGLLayer } from "@crc/webgl";

crc(
  canvas,
  <>
    <Rectangle
      style={{ width: 640, height: 360, fill: "#101827" }}
      onClick={() => selectBackground()}
    />

    <WebGLLayer style={{ width: 640, height: 360 }}>
      <Group3D style={{ rotationYDegrees: rotation }}>
        <Cube
          style={{ size: 2, color: "#8b5cf6" }}
          onClick={() => selectCube()}
        />
        <Sphere
          style={{ radius: 1, translateX: 3, color: "#22c55e" }}
          onClick={() => selectSphere()}
        />
      </Group3D>
    </WebGLLayer>

    <Text style={{ x: 20, y: 20, fill: "white" }}>Canvas 2D overlay</Text>
  </>,
);
```

Ordinary component functions are backend-neutral. They may use CRC hooks and
return elements supported by the currently active backend. Their function
identity, parent path, key, and unkeyed occurrence retain the current core
rules. WebGL descendants live in a private backend child instance owned by
`WebGLLayer`; an event-parent bridge preserves logical ancestry to the
`WebGLLayer` component in the parent instance, matching the existing `Layer`
model.

Platform primitive values are backend-specific. A WebGL primitive rendered
outside `WebGLLayer` reports that it requires a WebGL boundary. A Canvas 2D
primitive rendered as a WebGL child reports that Canvas 2D content inside a
WebGL island is unsupported. Both diagnostics name the component and JSX
development source when available.

### Initial public surface

The `@crc/webgl` root exports:

- `WebGLLayer` and its prop, style, and camera types;
- `Group3D` and its prop and style types;
- `Mesh`, `createWebGLGeometry`, and their prop, style, and geometry types;
- `Cube` and `Sphere` and their prop and style types;
- `defineWebGLPrimitive` and its public capability types;
- `crcWebGLContext` and its returned context type;
- `crcAnimationFrame`;
- the public vector, matrix, camera, geometry, and WebGL primitive
  types used by those values.

The package does not provide a second `createElement`, fragment, JSX runtime,
state hook, memo hook, ref hook, or event vocabulary. Those values come from
`@crc/core`.

### `WebGLLayer`

`WebGLLayer` is a Canvas 2D composition primitive whose children are traversed
under the WebGL backend. Its style accepts the existing compatible box and
layout-participation fields, `width`, `height`, and the core system filter.
Each omitted dimension uses the current logical Canvas allocation, matching
the existing `Layer` rule.

Its program props are:

```ts
interface WebGLLayerProps extends CRCEventHandlers {
  children: CRCNode;
  camera?: CRCWebGLPerspectiveCamera;
  pointerEvents?: "auto" | "none";
}
```

Handler props on `WebGLLayer` are propagation listeners. The boundary has no
independent rectangle target. `pointerEvents="none"` disables hit resolution
for its complete WebGL subtree while leaving painting unchanged.

### Camera

One `WebGLLayer` has exactly one camera. The camera is pass configuration, not
a JSX child, component identity, lifecycle owner, paint entry, or event node.
It is resolved before WebGL child traversal and the same immutable per-frame
camera snapshot drives rendering and picking.

The initial camera descriptor is perspective-only:

```ts
type CRCWebGLVector3 = readonly [x: number, y: number, z: number];

interface CRCWebGLPerspectiveCamera {
  type: "perspective";
  position: CRCWebGLVector3;
  lookAt: CRCWebGLVector3;
  up: CRCWebGLVector3;
  fieldOfViewDegrees: number;
  near: number;
  far: number;
}
```

Every numeric member must be finite. `fieldOfViewDegrees` is greater than zero
and less than 180. `near` is positive and `far` is greater than `near`.
`position` must differ from `lookAt`; `up` must be nonzero and not collinear
with the view direction. Diagnostics name the invalid camera field and
`WebGLLayer`.

When `camera` is omitted, CRC uses this exact logical camera:

```ts
{
  type: "perspective",
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
  fieldOfViewDegrees: 50,
  near: 0.1,
  far: 1000,
}
```

The projection aspect ratio derives from the current logical layer width and
height. Backing density does not change the logical camera. A unit cube at the
origin is visible with the default camera. CRC does not inspect scene bounds or
automatically fit the camera.

WebGL world coordinates use positive Y up. The default camera looks toward
negative Z. Canvas 2D retains positive Y down outside the raster boundary;
the composite and inverse event mapping provide the coordinate-system seam.

### `Group3D`

`Group3D` is a nonpainting transform and propagation boundary. It returns its
children under a composed 3D model transform and creates no geometry or
independent hit target. Its local transform vocabulary includes translation,
rotation in degrees, and scale on all three axes. Transform order is fixed and
documented as translation multiplied by Z, Y, and X rotations, then scale;
child local transforms follow the parent transform.

The shared transform style is:

```ts
interface CRCWebGLTransformStyle {
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  rotationXDegrees?: number;
  rotationYDegrees?: number;
  rotationZDegrees?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
}
```

Translations and rotations default to zero; scales default to one. Every value
must be finite and scales must be nonzero. Negative scale is supported.

Handler props on `Group3D` register propagation listeners. They fire only when
a descendant logical target is selected. Empty projected space inside any
conceptual group bounds does not target the group.

### `Mesh`, `Cube`, and `Sphere`

`Mesh` is the fundamental built-in draw-and-pick primitive. It consumes one
opaque `CRCWebGLGeometry`, applies its local 3D transform and paint style, draws
once in source order, and registers the same geometry and committed model
transform for picking. GPU resources derived from geometry belong to the
current `WebGLLayer` WebGL context.

`createWebGLGeometry()` validates and copies application-owned position and
optional index arrays into an immutable branded descriptor. Positions are a
nonempty finite XYZ triangle list. When supplied, indices are nonnegative
integers in range and have a length divisible by three; without indices the
vertex count is divisible by three. Mutating the caller's arrays after creation
cannot change rendering or picking.

The initial mesh surface is intentionally small:

```ts
interface MeshProps extends CRCEventHandlers {
  geometry: CRCWebGLGeometry;
  pointerEvents?: "auto" | "none";
}

interface MeshStyle extends CRCWebGLTransformStyle {
  color?: string;
  opacity?: number;
}
```

`color` defaults to `"#ffffff"` and must be a concrete color accepted by CRC's
browser-authoritative color normalization. `opacity` defaults to one and must
be finite between zero and one. Opacity does not change hit geometry.

The initial surface is an opaque or alpha-bearing unlit solid color. The
initial release does not imply a general light or material graph. Depth testing
is enabled for the built-in WebGL pass; source order remains the tie-breaker
where the supported depth semantics do not establish a nearer fragment.

`Cube` and `Sphere` expose convenient typed size and color styles and use the
same internal mesh pipeline. `Cube` supplies indexed box geometry centered at
the local origin; `size` defaults to one and must be finite and positive.
`Sphere` supplies deterministic indexed sphere geometry centered at the local
origin; `radius` defaults to `0.5` and must be finite and positive. Both inherit
the mesh transform, color, and opacity fields. Their picking uses the
corresponding local geometry transformed by the same committed model matrix as
rendering.

All three accept the shared CRC event-handler, cursor, keyboard-focus, and
`pointerEvents` props appropriate to a logical target. `pointerEvents` defaults
to `"auto"`.

### Custom WebGL primitives

`defineWebGLPrimitive` is the WebGL counterpart of core's `definePrimitive`.
It associates one component function with WebGL-only normalization,
resolution, render, and hit capabilities without attaching public mutable
fields to the function.

An ordinary default-participating custom WebGL primitive must supply hit
geometry or a custom synchronous hit resolver. A deliberately decorative
primitive declares its hit capability as `"none"`; its public input then fixes
`pointerEvents` to `"none"`. A definition that can paint with default event
participation but supplies no hit capability is rejected by TypeScript where
expressible and by an actionable runtime definition diagnostic otherwise.

Custom hit resolution may use analytic geometry, mesh raycasting, projected
`Path2D` broad-phase geometry, or application-owned synchronous logic. It must
not call hooks, render components, mutate CRC state, retain the shared hit
request/result records, or perform asynchronous resolution.

`crcWebGLContext()` returns the current WebGL render environment only while a
WebGL primitive is rendering. It reports a targeted error from Canvas 2D
rendering, ordinary code outside render, and pure measurement. The returned
environment provides the `WebGL2RenderingContext`, current camera and model
matrices, logical and backing viewport, density, frame timestamp, and
component-owned resource operations. Raw context access does not exempt the
primitive from the paired hit-capability rule.

### Animation

`crcAnimationFrame()` is an `@crc/webgl` hook that returns the current CRC frame
timestamp and requests the next frame while its component remains mounted.
Multiple callers share core's existing coalescing scheduler. Canvas 2D and
WebGL components in one root therefore observe the same render timestamp.
Removing the component or disposing the root releases its continuing-frame
request exactly once; a stale callback cannot schedule a replacement mount.

Static WebGL content requests no continuing frames. A `WebGLLayer` may reuse
its committed image snapshot and pick ledger when its private child instance
has no invalidated state and its retained child root, props, camera,
dimensions, density, and owned resource generations are unchanged. A state
update inside the private child instance invalidates that instance and requests
parent recomposition, matching the existing `Layer` scheduling direction.
Cache comparison does not consume opaque nested iterables more than once.

## Backend traversal and rendering

### Backend dispatch

Core's renderer tracks a backend and backend environment in each CRC instance's
temporary render state. The public root backend is Canvas 2D. A mounted
`WebGLLayer` owns a private child CRC instance whose root backend is WebGL. The
child shares the parent's event root and installs an explicit event-parent
bridge, but owns its component refs, scheduler state, GPU resources, transient
ledgers, and cache generation.

On a required child render, `WebGLLayer` synchronously enters that child
instance and restores every temporary renderer slot in `finally`. Plain
components run identically under either backend. Primitive definitions declare
their supported backend. Core still prepares component scope, identity, hooks,
style resolution, enhancers, listener ancestry, after-render work, and
teardown. The selected backend invokes only the primitive-specific render and
hit capabilities.

Each invalidated subtree executes once per rendered frame. A parent render may
synchronously render an invalidated WebGL child instance; an update originating
inside the child renders that child and requests the necessary parent
recomposition without executing the child a second time. WebGL primitives
issue their supported draw operations during their traversal. They do not
cause a preflight component traversal, and camera placement cannot make
component source order affect whether the camera is available.

### Surface and composition

Each mounted `WebGLLayer` owns one persistent `OffscreenCanvas`, one
`WebGL2RenderingContext`, and at most one committed `ImageBitmap` snapshot. The
context requests `{ alpha: true, depth: true, premultipliedAlpha: true,
preserveDrawingBuffer: false }`; CRC validates the actual attributes required
by the built-in pass. Its backing dimensions are the finite positive logical
layer size multiplied independently by the current root or parent-Layer
backing density using the same rounding policy as managed Canvas 2D layers.

At the start of a required WebGL render, CRC resets framework-owned WebGL state,
sets the backing viewport, clears color to transparent black, clears supported
depth state, and begins fresh transient draw and pick ledgers. Successful child
traversal transfers the current `OffscreenCanvas` bitmap to a new
`ImageBitmap` and pairs it with the completed pick ledger. CRC first composites
that candidate snapshot to the layer's declared logical destination in the
parent Canvas 2D context. Only successful composition commits the new
bitmap/ledger pair and closes the previously committed bitmap. Failure closes
the candidate and leaves the previous pair owned until ordinary render-failure
teardown. A cache hit composites the committed bitmap without reading an
unpreserved WebGL drawing buffer or executing child components.

The WebGL surface is an upright local raster target. Parent layout placement,
Canvas 2D `Group` transforms, clips, alpha, compositing, and filters apply when
the bitmap is drawn into the parent. A `style.filter` on `WebGLLayer` filters
the combined island bitmap through the existing core filter boundary. Inner
WebGL primitives do not accept core Canvas filter descriptors in the initial
release.

The composition order is:

```text
WebGL child draw and depth
-> committed ImageBitmap snapshot
-> receiving WebGLLayer filter
-> receiving outer CRC clip and transform
-> ancestor Canvas 2D composition
```

Canvas 2D source order treats the complete island as one entry. Individual
WebGL objects cannot alternate around an external Canvas 2D sibling. Authors
who need `WebGL back -> Canvas 2D -> WebGL front` use two `WebGLLayer` passes.

### GPU resource ownership

Every GPU handle belongs to exactly one `WebGL2RenderingContext`. The committed
`ImageBitmap` belongs to the `WebGLLayer` generation that produced it and is
closed on successful replacement, invalidation that discards visible output,
layer removal, or root disposal. A component resource slot owns
application-specific programs, shaders, buffers, textures, vertex arrays,
renderbuffers, or framebuffers acquired for that component.
Component removal, key/type replacement, layer removal, context loss, render
failure that closes the component, or root disposal releases or invalidates
the exact owned generation.

Built-in immutable geometry and programs may use a context-owned cache with
deterministic reference counts. The `WebGLLayer` owns the cache; component
slots own leases. The last release deletes the GPU handle, and layer disposal
deletes every remaining owned handle before dropping context references.
No GPU object crosses WebGL contexts.

Temporary framework state, draw ledgers, pick ledgers, camera snapshots, and
resource-acquisition scopes restore in `finally`. User code cannot retain
mutable framework scratch objects.

### WebGL state isolation

WebGL has no Canvas-style `save()` and `restore()`. The backend therefore owns
an explicit baseline for every core state category used by the initial pass:
framebuffer, viewport and scissor, program, vertex-array and buffer bindings,
active texture and texture bindings, color/depth/stencil masks, blend, depth,
cull, stencil, polygon offset, clear values, and pixel-store values.

Before each primitive callback CRC installs the baseline or the complete state
required by that primitive. In `finally` it reinstalls the baseline without
performing broad `getParameter()` readback. Built-ins set every state value they
depend on and cannot inherit ambient state from a sibling.

A custom primitive using `crcWebGLContext()` must set every state value it
depends on and must not expect its bindings or enable flags to survive its
callback. CRC restores the framework baseline after it returns or throws.
Extension-specific state outside the initial backend's declared state set is
application-owned and must be restored by the custom primitive in `finally`;
later framework behavior never depends on that extension state.

## Unified interaction model

### Compatibility change for Canvas 2D

This design intentionally revises the current rule that a purely painted
Canvas 2D primitive is absent from the event ledger. Every drawing built-in
primitive now contributes its existing explicit interaction geometry and a
stable logical target when `pointerEvents` is `"auto"`, even if it has no
handler, cursor, or focus option.

Consequently, a passive front primitive occludes a target painted behind it.
It can still become the leaf target of an event whose handler exists only on a
logical ancestor. `pointerEvents="none"` removes that primitive from coordinate
hit resolution and permits targets behind it to win. Paint opacity and filter
pixels do not change the declared interaction geometry.

This change applies uniformly to Canvas 2D and WebGL drawing primitives. It is
not a WebGL-only exception.

### Structural listener props

Core's child-bearing structural built-ins `Group`, `Clip`, `Layer`, `Absolute`,
`Overlay`, `Flow`, `Flex`, and `Grid` accept the shared DOM-style handler props
as propagation listeners. They contribute no target geometry. The equivalent
rule applies to `WebGLLayer` and `Group3D`.

For example:

```tsx
<Group onClick={handleGroup}>
  <Star />
</Group>
```

Clicking the star selects the star as the logical target and bubbles to
`Group`. Clicking empty space that merely lies inside a layout allocation or
conceptual group extent does not select the group. A spatially overlapping
target from another branch may therefore win, and the unrelated group's
listener is not on that event path.

`crcEventListener` remains the custom-component mechanism. Structural handler
props have its listener semantics rather than creating implicit rectangular
targets.

### Fixed-shape resolver protocol

All coordinate hit resolution uses one internal request shape, one reusable
result shape, and numeric dispositions:

```ts
const enum CRCHitDisposition {
  Miss = 0,
  Block = 1,
  Target = 2,
}

interface CRCHitTestInput {
  rootX: number;
  rootY: number;
}

interface CRCHitTestOutput {
  disposition: CRCHitDisposition;
  target: CRCEventTargetRegistration | null;
}
```

Core creates or borrows one input/output pair for one coordinate resolution.
Every candidate resets and writes both output fields in a fixed order. Nested
resolvers receive scratch state whose lifetime ends with the synchronous root
resolution. They may not retain it.

The semantic algorithm is:

```text
walk global paint entries front to back
  -> Miss: continue behind
  -> Block: stop without a logical target
  -> Target: stop and dispatch to that target
```

Built-in drawing primitives normally return `Target`, including passive
primitives. `Block` remains available for an official composition resolver
that has definite occluding coverage but no finer logical component identity.
An unpainted island background returns `Miss`.

Core uses a centralized numeric-kind dispatch for Canvas paths, nested CRC
instances, and backend resolvers rather than requiring a distinct closure on
every paint entry. This stable internal representation avoids per-candidate
result allocation and permits engine optimization without making object-shape
behavior a public contract. Structural counters and benchmarks validate the
implementation; the design does not claim a particular V8 optimization.

### Canvas and WebGL resolution

Canvas 2D path entries continue to use isolated `Path2D` fill/stroke testing
with their captured world transform, line interaction width, and complete clip
stack. Nested Canvas `Layer` entries recursively invoke the same resolver over
their child entries.

A `WebGLLayer` contributes one nested resolver at its exact Canvas 2D composite
position. When reached, core:

1. rejects the point if it fails an outer CRC clip or the layer bounds;
2. maps the root-logical point through the inverse outer world transform into
   layer-local coordinates;
3. maps the local point into normalized device coordinates using the committed
   logical viewport and camera;
4. delegates to the layer's committed scene picker;
5. consumes the picker's fixed-shape miss, block, or target result.

The default scene picker constructs one camera ray and intersects supported
geometry using the model and camera snapshots committed with the visible
WebGL frame. Intersections are considered nearest first. A primitive with
`pointerEvents="none"` is skipped, allowing the next intersection or the
Canvas 2D content behind the island to win. A selected target returns to core's
existing propagation, related-target, pointer-capture, cursor, focus, keyboard,
editing, clipboard, and drag/drop machinery.

Projected `Path2D` geometry may serve as an optional broad-phase rejection but
is not the WebGL ground truth. A 2D path cannot encode depth or identify the
nearest overlapping 3D object. The default path performs no `readPixels`,
alpha readback, or hidden GPU ID-buffer render.

### Paint-order examples

If a WebGL island is painted after a clickable Canvas 2D rectangle, a cube hit
returns the cube target and prevents the rectangle from receiving the event.
A point over transparent island background returns miss and permits the
rectangle to win.

If a Canvas 2D star is painted after the WebGL island, the star's existing path
entry resolves first. With default event participation it becomes the target
and the WebGL picker is not called. With `pointerEvents="none"`, resolution
continues to the island.

Within one island, supported WebGL depth determines which intersected object is
frontmost. The island as a whole is either before or after an external Canvas
2D entry. No hit-test rule pretends an external 2D object lies between two
objects in one already-flattened WebGL bitmap.

## Render transactions, caching, and failure

### Matching visible and pick state

Each required WebGL render begins a fresh uncommitted pick ledger. Every
default-participating primitive records target identity, geometry, model
transform, camera generation, and relevant supported depth state. A complete
island traversal creates a candidate `ImageBitmap`; successful parent
composition commits bitmap and pick ledger together. The visible snapshot and
committed pick state therefore describe the same completed frame.

If the complete root render later fails, normal CRC fail-closed teardown clears
logical targets and component refs. CRC retains its established rule that
pixels painted earlier in a failing frame are not rolled back.

A cache hit reuses both the committed `ImageBitmap` and its matching pick
ledger without executing child components. Focus metadata is replayed through
the same retained-layer mechanism used by Canvas 2D `Layer`.

### Validation and render errors

Before WebGL child execution, `WebGLLayer` validates finite positive logical
and backing dimensions, the camera descriptor, `OffscreenCanvas`, WebGL2
context acquisition, `transferToImageBitmap`, and required alpha/depth
capabilities. Errors name `WebGLLayer`, the failed field or capability, and JSX
development source where available.

Shader compilation and program-link failures include the owning component,
stage, sanitized platform log, and source label supplied by the application.
CRC deletes failed intermediate handles and does not publish the generation.
WebGL API error polling is not added to every production draw call; focused
development diagnostics and explicit framework-controlled operation checks
cover owned setup and composition boundaries.

Invalid custom primitive definitions, missing hit capability, backend mismatch,
resource acquisition failure, draw failure, and composite failure restore all
temporary renderer state and release transient ownership in `finally`. The
failed island result is not composited.

### Context loss and restoration

One `WebGLLayer` owns its context-loss and context-restoration listeners. On
loss it invalidates every GPU handle generation, closes and removes the
committed bitmap, prevents stale resources and pick state from participating,
and marks the layer for rebuilding. It does not silently move resources to
another context.

On restoration, the layer schedules one ordinary CRC frame. Component state
and public descriptors recreate resources under the restored generation. The
new bitmap and pick ledger become live only after a complete successful
render. Removal or root disposal detaches listeners, suppresses stale restore
notifications, and releases every logical owner exactly once.

## Evidence and verification

### Public scenarios

`@crc/scenarios` adds separate learning examples and deterministic test-lab
fixtures without mixing their catalogs.

The introductory example renders a default-camera cube and sphere over a
Canvas 2D background, animates a `Group3D`, changes state from clicks, and
places Canvas 2D text above the island.

The deterministic interaction fixture proves:

- default-camera geometry and explicit-camera updates;
- transparent island background clicking through to a lower Canvas rectangle;
- a cube occluding that lower rectangle;
- a later Canvas star occluding the cube;
- `pointerEvents="none"` on Canvas and WebGL primitives;
- nearest-object selection for overlapping cube and sphere geometry;
- passive primitive targeting and propagation to `Group` and `Group3D`;
- empty structural-container space producing no target or ancestor dispatch;
- outer layout placement, `Group` transforms, `Clip`, `Layer`, and filters;
- pointer capture, hover transitions, cursor, focus, keyboard activation, and
  projected navigation bounds for a WebGL target;
- animation using the same timestamp and matching rendered/pick transforms;
- cache hits and invalidation from state, props, camera, dimensions, density,
  focus metadata, and context generation.

The example modules are consumed by both the Studio and headless browser tests
through public package imports.

### Unit and structural evidence

Focused tests cover camera validation and matrix inversion, local-to-NDC and
ray construction, cube and sphere intersection, nearest-depth selection,
fixed-shape miss/block/target output, outer transform and clip rejection,
backend mismatch diagnostics, custom primitive capability validation, hook
order, keyed identity, and failed-render restoration.

Structural counters prove:

- one component traversal for one rendered WebGL frame;
- one WebGL draw and one matching pick registration per built-in primitive;
- one `ImageBitmap` transfer per updated island, no transfer on a cache hit,
  and exact closure on replacement and disposal;
- no per-candidate hit-result allocation in the default resolver;
- no `readPixels`, image-data readback, or GPU ID pass in default picking;
- one compositing draw for one island;
- static cache hits do not rerun child components;
- sibling and nested ownership returns to exact baselines;
- animation requests coalesce through the core scheduler;
- context loss, restoration, component removal, and final disposal pair every
  acquired owned generation with one release or invalidation.

Wall-clock and heap measurements remain diagnostic. Correctness does not depend
on a particular V8 hidden-class optimization, GPU vendor, or garbage-collection
schedule.

### Package and browser gate

The feature is verified through root exports and declarations, NodeNext and
bundler consumers, packed tarballs, source and built Studio modes, built smoke,
Chromium WebGL2 browser tests, lifecycle cleanup, and the aggregate trust gate.
The packed consumer checks one shared core identity between `@crc/core` and
`@crc/webgl` and rejects accidental core bundling.

Semantic state, target identity, geometry, and WebGL call evidence precede
visual assertions. Stable pixels cover transparent composition, outer clips,
Canvas/WebGL order, default camera framing, and basic cube/sphere output.
Platform-sensitive WebGL raster edges may use narrow documented masks; masks
must not hide surrounding Canvas 2D order, transparency, layout, or interaction
evidence. Visual baselines are inspected rather than rewritten merely to pass.

## Required contract updates

Implementation updates the current normative contracts rather than treating
this dated design as permanent runtime authority. At minimum it revises:

- the Canvas surface contract for WebGL-owned offscreen islands;
- the runtime/hooks contract for backend traversal and animation;
- the drawing contract for `WebGLLayer` composition;
- the style contract for WebGL styles and Canvas filter boundaries;
- the layout contract for `WebGLLayer` allocation;
- the user-event and mouse-interaction contracts for default passive occlusion,
  structural listener props, and delegated resolvers;
- the focus and keyboard-navigation contract for projected WebGL bounds;
- the event and runtime resource-ownership contracts for WebGL targets,
  contexts, resources, animation requests, and context loss;
- the public API reference, JSX and non-JSX guides, Studio declarations,
  package manifests, and supported consumer matrices.

The existing statement that a purely painted Canvas 2D object does not occlude
a target underneath is superseded only when the implementation, migration
note, and complete public evidence for the new default ship together.
