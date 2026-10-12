# WebGL settled-scene rendering design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved design; current shipped behavior remains governed by `docs/design/`
> until implementation lands.

Status: design and written specification approved on 2026-09-13.

Date: 2026-09-13

## Summary

Pibbl will change `@pibbl/webgl` from primitive-at-a-time immediate drawing to a
settled-scene renderer. One `WebGLLayer` is one declarative 3D scene. Its child
components execute once to compose a frame-local description; only after the
complete child tree succeeds does the WebGL backend settle that description,
plan its passes, and issue framebuffer-mutating WebGL commands.

The first delivery deliberately stops before lighting. It migrates `Mesh`,
`Cube`, and `Sphere` to scene submissions, preserves their current unlit color
appearance and interaction behavior, adds correct opaque/transparent pass
planning, and proves the new composition/render boundary. Lighting, materials,
environments, shadows, emissive surfaces, bloom, and their examples form the
next design and implementation project.

Breaking changes are acceptable because this package is local and unpublished.
The current public raw-GL-during-traversal surface conflicts with the new
invariant and will be removed rather than retained as a second rendering model.

## Context and problem

The shipped backend currently performs these operations together while core
walks the component tree:

1. evaluate a WebGL primitive;
2. acquire or create its GPU resources;
3. install WebGL state;
4. draw it immediately; and
5. record corresponding pick information.

That architecture is sufficient for a positions-only unlit pass, but it makes
component order double as GPU command order. A later sibling cannot contribute
information needed to shade an earlier sibling. Lighting, shadows,
environmental illumination, transparent ordering, and post-processing all need
the renderer to know the complete scene before choosing and executing passes.

The problem is not the `Cube`, `Sphere`, `Mesh`, `Group3D`, camera, picking, or
Canvas-island concepts. The problem is the point at which rasterization occurs.

Core already supplies the required lifecycle seam. `beginFrame()` runs before
child traversal, `runPrimitive()` invokes each backend primitive exactly once
during traversal, and `finishFrame()` runs after the complete child tree and
component-removal cleanup. The WebGL backend can therefore collect in
`runPrimitive()` and render in `finishFrame()` without a preliminary traversal,
a repeated component evaluation, or a retained cross-frame scene graph.

## Goals

- Make one `WebGLLayer` one scene-composition and rendering boundary.
- Execute every invalidated component and primitive program exactly once per
  required WebGL frame.
- Prevent framebuffer clears, draws, shader compilation, and geometry uploads
  until scene composition has completed successfully.
- Produce a privately owned, immutable settled-scene snapshot before rendering.
- Derive rasterization and picking from the same geometry, model transform,
  camera, source index, and participation data.
- Render opaque objects before transparent objects and transparent objects
  back-to-front.
- Keep zero-alpha geometry pickable while omitting it from rasterization.
- Preserve Canvas/WebGL island order, outer transforms, clips, filters, layout,
  events, focus, caching, context restoration, and bitmap/pick transactions.
- Replace component-owned arbitrary GPU access with deterministic
  renderer-owned resource transactions.
- Establish an internal scene model that later accepts lights, environment
  configuration, materials, shadow casters, and effects without changing the
  composition lifecycle again.
- Supply public, structural, browser, ownership, package-consumer, and visual
  evidence for the changed contract.

## Non-goals

- Lighting, normals, physical materials, textures, environment maps, shadows,
  tone mapping, emission, bloom, or area-light approximation in this delivery.
- A `Scene3D` wrapper or a separate `lights` property on `WebGLLayer`.
- A mutable or retained game-engine scene graph.
- Retaining frame-local mesh submissions after their WebGL render finishes.
- Multiple cameras, viewports, portals, render-to-texture graphs, or nested
  WebGL scenes inside one `WebGLLayer`.
- Canvas 2D children inside a WebGL scene or Canvas/WebGL subprimitive
  interleaving.
- A public raw WebGL callback, custom shader API, render-pass plugin API, or
  custom analytic hit API. Those require a later scene-aware design.
- Pixel-alpha picking, `readPixels`, or a hidden GPU ID pass.
- WebGL1, WebGPU, workers, or cross-context GPU-resource sharing.
- Optimizing away ordinary component evaluation beyond the existing clean-layer
  bitmap cache.

## Alternatives considered

### Selected: `WebGLLayer` always composes a scene

Every WebGL child contributes to one frame draft. `finishFrame()` settles and
renders it. This creates one coherent authoring model, gives future passes the
whole scene, and matches the user's mental model of constructing a 3D
environment and then rendering it.

### Rejected: an opt-in `Scene3D` child

An explicit wrapper could preserve immediate raw primitives beside a managed
scene. It would also create two incompatible meanings for children of
`WebGLLayer`, make the wrapper redundant in the common case, and leave authors
responsible for selecting the mode required by lights. The package is
unpublished, so compatibility does not justify that split.

### Rejected: keep lights in a separate layer property

Collecting a `lights` subtree before drawable children would make analytic
lighting possible without changing immediate draws, but it would not solve
shadows, transparent planning, environment processing, or post-processing. It
would also make lights unlike other transformed scene objects.

### Rejected: retain a cross-frame scene graph

A retained graph could support incremental object-level updates, but it would
introduce a second identity and lifecycle system beside Pibbl's component tree.
The existing whole-`WebGLLayer` cache already avoids work for clean scenes. A
frame-local snapshot is enough to choose correct passes when a scene is dirty.

## Public authoring model

`WebGLLayer` itself is the only scene boundary:

```tsx
<WebGLLayer camera={camera} style={{ width: 640, height: 360 }}>
  <Group3D style={{ rotationYDegrees: rotation }}>
    <Cube style={{ size: 2, color: "#8b5cf6" }} />
    <Sphere
      style={{ radius: 1, translateX: 3, color: "rgb(34 197 94 / 60%)" }}
    />
  </Group3D>
</WebGLLayer>
```

Moving either object before or after a future light will not determine whether
the light affects it. Component position continues to determine Pibbl identity,
event ancestry, global focus order, and an exact source index used only where
the 3D renderer needs a stable tie-breaker.

The existing camera remains one optional `WebGLLayer` prop. It is scene-level
configuration resolved before child traversal, included in the settled scene,
and shared by rendering, picking, and projected focus bounds. This delivery
does not make cameras child nodes or add multiple views.

## Public surface changes

The public values retained by `@pibbl/webgl` are:

- `WebGLLayer`;
- `Group3D`;
- `Mesh`;
- `Cube`;
- `Sphere`;
- `createWebGLGeometry`; and
- `useAnimationFrame`.

The public types retained are:

- `PibblWebGLVector3`;
- `PibblWebGLPerspectiveCamera`;
- `PibblWebGLGeometryInput`;
- `PibblWebGLGeometry`;
- `PibblWebGLTransformStyle`;
- `WebGLLayerProps` and `WebGLLayerStyle`;
- `Group3DProps` and `Group3DStyle`;
- `MeshProps` and `MeshStyle`;
- `CubeProps` and `CubeStyle`; and
- `SphereProps` and `SphereStyle`.

The following immediate-mode values and their dedicated public types are
removed:

- `defineWebGLPrimitive`;
- `pibblWebGLContext`;
- `PibblWebGLContext`;
- `PibblWebGLCameraSnapshot`;
- `PibblWebGLHitCapability`;
- `PibblWebGLPrimitiveCapabilities`;
- `PibblWebGLPrimitiveHitInput`;
- `PibblWebGLPrimitiveInput`;
- `PibblWebGLPrimitiveRender`; and
- `PibblWebGLProgramProps`.

An application-defined shape is an ordinary Pibbl component that returns
`<Mesh geometry={geometry} />`. The package does not promise arbitrary shaders,
GPU resources, decorative raw draws, or custom analytic hits after this change.
No compatibility alias or legacy immediate mode is added.

The implementation may use a package-private primitive-definition helper, but
it exposes no `WebGL2RenderingContext`, GPU handle, mutable scene draft, or
resource operation to application code.

## Four-phase lifecycle

The exact required sequence for one dirty scene is:

```text
WebGLLayerController decides the child is dirty
  -> beginFrame creates an empty scene draft
  -> core traverses the child tree exactly once
       -> components and hooks evaluate normally
       -> Group3D pushes and pops CPU model scopes
       -> Mesh/Cube/Sphere append scene submissions
       -> no framebuffer mutation or GPU-resource construction
  -> finishFrame(true) closes composition
       -> settle and validate the complete draft
       -> plan opaque, transparent, and picking output
       -> render the settled scene
       -> publish completed render metadata to the controller
  -> controller transfers one candidate ImageBitmap
  -> parent Canvas composites the candidate
  -> bitmap, pick ledger, and focus metadata commit together
```

These stages are named **scene composition**, **settling**, **WebGL rendering**,
and **Canvas compositing**. Documentation uses those distinct terms rather than
calling every step "rendering."

`beginFrame()` may read context availability and create CPU-owned frame state.
It does not clear a framebuffer, install draw state, compile shaders, create
programs or buffers, upload geometry, or execute a draw.

`runPrimitive()` must still invoke core's supplied primitive program exactly
once. A drawable primitive validates and normalizes its CPU values, obtains its
logical event-target slot, snapshots its model transform, and submits a record.
A structural primitive such as `Group3D` changes composition scope and submits
no drawable record.

`finishFrame(frame, false)` closes and discards the draft without settling or
rendering it. `finishFrame(frame, true)` is the only entry to settling and
rendering. A frame cannot be settled, rendered, or finished twice.

## Scene draft and submissions

One private `WebGLSceneComposer` belongs to one backend frame. Its initial
state contains:

- the resolved camera snapshot;
- logical and backing viewport dimensions and density;
- the frame timestamp;
- the current context generation;
- one identity model matrix at the bottom of a strict model stack;
- an initially empty ordered mesh-submission list; and
- the candidate event/pick participation required by those submissions.

The initial scene-entry union contains only mesh records. It is intentionally
extensible so the later lighting project can add light and environment records
without changing the lifecycle.

Each mesh submission privately owns or snapshots:

- component diagnostic name and JSX source when available;
- immutable `PibblWebGLGeometry` identity;
- an owned copy of the fully composed model matrix;
- parsed unlit RGBA color after `style.opacity` multiplication;
- monotonically increasing scene source index;
- the live logical target registration when `pointerEvents` participates;
- optional explicit keyboard-navigation bounds; and
- the geometry-backed picking capability implied by `Mesh`.

`Cube` and `Sphere` resolve their size/radius into their local model matrix and
submit their canonical geometry through this same record. Render and pick code
must not independently recompute a second model transform.

Submission data is not exposed publicly. Caller-owned numeric arrays are
already copied by `createWebGLGeometry`; matrices and other mutable records are
copied again at submission or settlement. The composer rejects submissions
after it closes.

`Group3D` keeps its current translation × Z/Y/X degree rotations × scale order.
It pushes one composed CPU matrix before its children and uses component
after-render work to pop it after all descendants complete. Settlement requires
the model stack to contain exactly its root identity entry. Stack imbalance is
an internal invariant failure and publishes no frame.

## Settling the scene

Settlement is synchronous and CPU-only. It closes the draft against mutation,
validates its invariant state, and creates one privately owned
`SettledWebGLScene` with:

- the exact camera and viewport snapshots;
- ordered mesh submissions;
- an opaque render queue;
- a transparent render queue;
- geometry-backed pick entries; and
- projected focus metadata derived from those same entries.

Color parsing and style validation continue to fail before GPU resources are
created. Final alpha is the parsed color alpha multiplied by `style.opacity`:

- alpha exactly `1` enters the opaque queue;
- alpha greater than `0` and less than `1` enters the transparent queue; and
- alpha exactly `0` enters neither raster queue but retains declared pick and
  focus geometry.

The settled scene is immutable by ownership: no application reference can
reach it, every mutable input is copied, and renderer code receives readonly
records. It lives only through the current `finishFrame()` call. The completed
frame retained afterward contains the rendered generation and candidate pick
entries, not a renderable scene list.

## Render planning and draw semantics

The first settled-scene renderer preserves the current unlit solid-color
shader, concrete Canvas-color parsing, model/view/projection math, triangle
geometry, transparent island surface, disabled face culling, and `LEQUAL`
depth comparison. It changes when and in which pass those draws occur.

Rendering begins only after settlement:

1. install the complete framework WebGL baseline;
2. bind the default framebuffer and clear transparent color and depth once;
3. acquire the unlit program and referenced geometry through the current
   renderer resource transaction;
4. draw opaque submissions in ascending source order with blending disabled,
   depth testing enabled, and depth writes enabled;
5. draw transparent submissions farthest-to-nearest with source order as the
   exact equal-depth tie-breaker, standard source-alpha blending, depth testing
   enabled, and depth writes disabled;
6. restore the framework baseline; and
7. commit or roll back the resource transaction.

Transparent sort depth is the view-space depth of the submitted geometry
bounds center after its model transform. More distant centers draw first.
Equal sort depths retain ascending source order so a later equal-depth object
is blended later. This is deterministic object-level transparency, not
order-independent transparency; intersecting or very large transparent meshes
may still require a future explicit render-order or advanced transparency
design.

Picking remains nearest-geometry based rather than following transparent blend
order. Equal pick depth uses the later source index, preserving the current
deterministic tie rule.

No `readPixels`, image-data readback, preliminary depth pass, hidden ID pass,
or second component traversal is introduced.

## GPU-resource ownership

Removing public raw GL access also removes component-owned arbitrary WebGL
resource slots and `WebGLResourceGenerationRegistry`. Built-in GPU resources
become the sole responsibility of one renderer/cache owned by one
`WebGLLayer` context generation.

The cache uses a transactional resident-set model:

1. the previous successful WebGL render owns a resident set of program and
   immutable-geometry handles;
2. one render attempt opens a candidate resource transaction;
3. every settled submission marks the program/geometry keys it uses and lazily
   creates missing handles during the render phase;
4. successful rendering adopts the candidate set and deletes resident handles
   no longer referenced by the settled scene;
5. failed rendering deletes handles created only for the candidate and leaves
   the previous resident set internally valid; and
6. every transaction closes in `finally`.

At most one GPU handle exists for one program key or immutable geometry
descriptor in one context generation. During a candidate render, live handles
are bounded by the union of the previous resident set and the candidate set.
This is a GPU cache, not a retained object graph: it stores no component,
transform, event target, light, or draw-order record.

Partial shader, program, buffer, or vertex-array creation cleans up every
successfully created intermediate before propagating the error. Context loss
invalidates all handles without issuing deletion calls against the lost
generation. Layer removal or disposal deletes every still-live handle exactly
once when the context remains valid.

Because no application resource can mutate independently of the scene,
`ownedResourceGeneration` is removed from layer cache validity. Retained child
input, camera, surface/density, focus revision, and WebGL context generation
remain authoritative.

## Picking, events, and focus

The shared Canvas/WebGL event model remains unchanged:

- `Mesh`, `Cube`, and `Sphere` own geometry-backed targets by default;
- `pointerEvents="none"` removes one object from hit and focus participation
  without changing paint;
- `WebGLLayer pointerEvents="none"` skips the complete nested resolver;
- `Group3D` and `WebGLLayer` handlers remain listener-only ancestry;
- transparent scene background returns miss; and
- one island remains one Canvas paint-ledger entry.

The implementation changes the source of pick records. Settlement derives each
record from the same mesh submission used by the renderer. Geometry, composed
model matrix, camera, source index, and explicit navigation override therefore
cannot drift between separate draw and pick paths.

The candidate pick ledger commits only with the candidate bitmap after
successful parent Canvas compositing. A WebGL render failure, bitmap-transfer
failure, Canvas-composite failure, context loss, component removal, or disposal
cannot leave a committed picker referring to a different visible generation.

Geometry-backed focus projection uses the settled geometry/model/camera
snapshot. Global Tab order remains Pibbl component source order, even though the
raster renderer groups opaque and transparent queues. Raster sorting never
reorders component identity, event ancestry, focus order, or pick source
indices.

## Bitmap transactions and failure behavior

The controller retains the existing three ownership states: no candidate,
pending candidate, and committed generation. A successful settled-scene render
produces backend completion metadata; only then may the controller call
`transferToImageBitmap()` and build a pending bitmap/pick pair. Parent Canvas
composition commits that pair and closes the replaced bitmap.

If composition fails before `finishFrame(true)`, the backend discards the draft
without clearing or drawing the WebGL surface. If settling or rendering throws,
the backend:

- closes the draft;
- rolls back candidate-only GPU handles;
- releases uncommitted pick participation through the existing idempotent
  ownership path;
- restores the WebGL baseline as far as the context permits;
- records the failed timestamp needed by the existing retry guard; and
- publishes no completed frame.

A preexisting committed bitmap/pick pair is never overwritten by a partial
candidate. Pibbl's broader fail-closed render contract still applies: an error
propagating through the root tears down runtime-owned component resources and
may consequently release that prior committed pair. Pixels already composited
earlier in the failing Canvas frame are not rolled back.

`finishFrame(true)` owns its own rollback before rethrowing because core has
already selected the success completion path when it invokes that method.
`finishFrame(false)` remains safe after any failure before the success call.
No cleanup path renders a draft or calls a user component.

Diagnostics retain component and JSX-source context where available. Shader
and program errors identify the stage and sanitized platform log; geometry
upload errors identify the submission's component. Internal composer-state
errors name the violated WebGL scene invariant.

## Scheduling and caching

The realm scheduler and private backend mount remain unchanged. Static scenes
request no continuing frames. `useAnimationFrame()` still requests the shared
realm frame and exposes the current logical timestamp to its owning component.

An invalidated WebGL child executes once and produces one settled scene and at
most one bitmap transfer. A clean `WebGLLayer` reuses its committed bitmap,
pick ledger, and focus metadata without:

- executing child components;
- constructing a scene draft;
- settling or rendering a scene;
- reading the unpreserved drawing buffer; or
- transferring another bitmap.

An independently scheduled WebGL child render uses the same backend completion
slot already consumed by its parent `WebGLLayer` on recomposition. The scene
snapshot itself does not cross that boundary; only completion metadata and pick
entries do.

Camera, retained child input, logical/backing dimensions, density, focus
revision, or context generation changes invalidate the layer under the existing
rules. Resource-cache contents do not independently schedule or invalidate a
frame.

## Context loss and restoration

One `WebGLLayer` continues to own its `OffscreenCanvas`, WebGL2 context, listener
pair, renderer, and cache.

Context loss:

- prevents a draft from settling or rendering through the lost generation;
- invalidates the active resource cache without deleting lost handles;
- releases pending and committed pick/focus participation;
- closes pending and committed bitmaps;
- cancels pending private-mount work; and
- marks the layer for reconstruction.

Restoration creates a new context-generation renderer/cache on the next
ordinary scheduled frame. Pibbl component state and immutable geometry
descriptors remain the CPU source of truth. Nothing becomes visible or
interactive until a complete new scene render, bitmap transfer, and parent
composition commit.

Stale drafts, resource transactions, completion records, and restoration
callbacks verify their exact context and operation generation before
publication.

## Implementation boundaries

The first project is organized around five private units with narrow roles:

1. **Scene composer** — owns frame-local composition state, model scopes, and
   mesh submissions; it never owns `WebGL2RenderingContext` draw access.
2. **Scene settler/planner** — closes and validates a draft, derives render
   queues, pick entries, focus projection, and transparent sort keys.
3. **Scene renderer** — owns WebGL state and executes only settled queues.
4. **Renderer resource cache** — owns transactional program and geometry
   handles for one context generation.
5. **Layer controller** — retains surface, scheduling, bitmap transaction,
   Canvas composition, context lifecycle, and nested resolver ownership.

The existing `render-environment.ts` responsibilities are split accordingly.
It must no longer combine public GL context, model traversal, pick registration,
component resource hooks, and frame state in one mutable object.

Core's `PibblBackendDriver` lifecycle does not need a preliminary traversal or a
new public API. Any small friend-seam adjustment must remain backend-neutral and
must not change Canvas 2D behavior.

## Implementation sequence

The implementation plan will preserve this dependency order:

1. Add failing structural tests for no WebGL work before completed traversal,
   one traversal, late-sibling inclusion, and finish-time failure rollback.
2. Introduce the private scene composer and immutable mesh submission.
3. Introduce settlement, opacity classification, transparent sorting, and
   pick/focus derivation.
4. Replace immediate built-in drawing with the scene renderer.
5. Replace component-owned leases with transactional renderer resources.
6. Migrate `Mesh`, `Cube`, `Sphere`, and `Group3D` while preserving their public
   authoring and interaction behavior.
7. Remove the raw primitive/context public surface and migrate all internal,
   scenario, Studio, documentation, and package-consumer references.
8. Update failure, cache, context-loss, ownership, browser, and visual evidence.

Every production behavior change receives a failing test before its
implementation, following the repository contract.

## Evidence and verification

### Composition and structural evidence

Focused tests must prove:

- every component and primitive program executes exactly once;
- all component evaluation completes before the first `clear`, shader/program
  creation, buffer/vertex-array creation, upload, or draw call;
- a later sibling is present in the scene rendered by the same frame;
- `Group3D` scopes snapshot exact descendant model matrices and unwind in LIFO
  order on success and failure;
- one dirty scene clears once and transfers at most one bitmap;
- one clean cache hit performs no traversal, scene construction, GPU render, or
  bitmap transfer;
- opaque, transparent, zero-alpha, and equal-depth classifications follow this
  design exactly;
- transparent queue sorting is stable and deterministic; and
- no default path calls `readPixels` or executes a hidden picking pass.

### Semantic and interaction evidence

Tests and the existing public WebGL laboratory must prove:

- current isolated unlit color output and opaque `Mesh`, `Cube`, and `Sphere`
  pixels and transforms;
- transparent overlap follows the new back-to-front pass rather than the old
  immediate source-order/depth-write behavior;
- transparent island pass-through and visible geometry occlusion;
- nearest-depth and equal-depth pick selection;
- zero-alpha geometry remains pickable without modifying depth pixels;
- `pointerEvents` object and layer opt-out;
- `Group3D`/`WebGLLayer` propagation ancestry;
- pointer capture, cursor, focus, keyboard activation, and projected bounds;
- outer layout, Canvas transforms, clips, Layers, and filters; and
- matching bitmap, pick, and focus generations across updates and cache hits.

The learning example continues to show an animated cube and sphere between
Canvas content. It teaches `WebGLLayer` as a settled scene rather than a sequence
of WebGL draw callbacks.

### Ownership and failure evidence

Deterministic counters and injected failures cover:

- partial shader, program, vertex-array, and buffer construction;
- failed scene composition, settlement, rendering, bitmap transfer, and Canvas
  composition;
- candidate resource commit, rollback, and resident-set sweep;
- geometry sharing across multiple submissions;
- context loss during composition and rendering;
- restoration under a new generation;
- component/key replacement, layer removal, root failure, and disposal; and
- zero live or duplicate-released GPU, bitmap, target, resolver, listener, and
  backend-frame ownership after final disposal.

### Public/package evidence

The change updates and verifies:

- `@pibbl/webgl` root runtime exports and declarations;
- removal of all raw primitive/context exports;
- Bundler and NodeNext consumers;
- packed tarball consumers and one shared `@pibbl/core` identity;
- Studio editor declarations and runtime export inventory;
- source and built Studio modes;
- Chromium WebGL2 browser scenarios and visual baselines;
- lifecycle cleanup and structural performance checks; and
- the aggregate repository trust gate on the documented Node/pnpm/Chromium
  environment.

Visual baselines are inspected, not rewritten merely to pass. Semantic state,
WebGL call order, geometry, and interaction assertions precede screenshot
evidence.

## Required documentation and contract updates

Implementation updates the normative documents that currently describe draws
during primitive traversal or public raw context access. At minimum:

- `docs/design/drawing-components-contract.md`;
- `docs/design/style-system-contract.md`;
- `docs/design/canvas-surface-contract.md`;
- `docs/design/user-events-contract.md`;
- `docs/design/mouse-interaction-contract.md`;
- `docs/design/focus-and-keyboard-navigation-contract.md`;
- `docs/design/event-resource-ownership.md`;
- `docs/design/runtime-resource-ownership.md`;
- the public WebGL API and learning documentation under `docs/site/`;
- `packages/webgl/README.md`;
- Studio editor declarations and export inventories; and
- package-consumer examples and verifiers.

The 2026-09-09 WebGL-islands design remains historical evidence for the island,
interaction, and ownership decisions that this design preserves. This document
supersedes its immediate child drawing, raw context, custom primitive,
component-owned GPU resource, and source-order raster-pass decisions.

## Lighting project boundary

After this project is implemented and verified, a separate approved design will
extend the scene-entry union and renderer. Its intended scope is:

- unlit, Lambert, and metallic-roughness materials;
- geometry normals and later texture coordinates/tangents where required;
- ambient, hemisphere, directional, point, spot, and optionally rectangular
  area lights;
- emissive materials and HDR bloom;
- color/sky backgrounds and independent image-based environment lighting;
- optional shadow passes; and
- one focused public demo per light/effect plus outdoor, indoor, and night-time
  composed scenes.

Lights and environment declarations will be ordinary children of
`WebGLLayer`, transformed by `Group3D` where applicable. Their source position
will not determine which mesh they affect. That future work may add new render
targets and passes, but it cannot weaken the compose → settle → render → commit
invariant established here.
