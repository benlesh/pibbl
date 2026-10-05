# Three.js full pivot design

> **Historical status: This approved design records the completed Three.js pivot and is not current guidance.** This record completes the
> replacement approved in the 2026-09-18 generic render-layer and Three.js
> design. The user's explicit instruction is to finish the pivot, remove the
> old WebGL product, merge it to `main`, and push it.

Date: 2026-09-28

## Decision

Pibbl is a Canvas 2D component runtime with framework-neutral external render
layers. Three.js is the official 3D integration and remains ordinary Three.js.
Pibbl does not own a competing scene graph, material system, lighting system,
asset loader, camera controller, shadow renderer, particle renderer, or 3D JSX
vocabulary.

The completed public 3D surface is:

- `defineRenderLayer()` in `@pibbl/core` for integrating any external renderer;
- `defineThreeLayer()` in `@pibbl/three` for Three-owned scenes, cameras,
  resources, rendering, raycasting, controls, input arbitration, focus, and
  deterministic teardown;
- normal imports from `three` and `three/addons/*` for all Three capabilities;
- renderer-independent 3D math and collision geometry from
  `@pibbl/physics/3d/geometry`.

The following active surfaces are removed without compatibility aliases:

- the complete `@pibbl/webgl` package and its root, GLTF, and internal entries;
- Pibbl WebGL scene components, materials, lights, shadows, loaders, orbit hook,
  frame hook, custom geometry, and renderer internals;
- `@pibbl/particles/webgl`, `Particles3D`, and `defineParticleEffect3D`;
- the WebGL-coupled `@pibbl/physics/3d` runtime, component attachments,
  presentation components, and hooks;
- all current website lessons, guides, API pages, fixtures, tests, visual
  routes, declarations, and package-consumer assertions that teach or require
  those surfaces.

Pibbl retains `@pibbl/particles` Canvas particles, `@pibbl/physics/2d`,
`@pibbl/physics/2d/geometry`, and `@pibbl/physics/3d/geometry`. Keeping the existing
3D runtime would require a new retained-object binding API and would expand the
pivot beyond the approved thin Three adapter. A future Three physics binding
can be designed independently against ordinary `THREE.Object3D` values.

## Public experience

The website teaches a small, direct lifecycle:

1. Define a reusable layer component once with `defineThreeLayer()`.
2. Create ordinary Three scene resources in `create()`.
3. Copy current Pibbl props into those resources in `update()`.
4. resize the camera in `resize()`;
5. render through Pibbl's frame callback and invalidate only when another frame
   is needed;
6. declare optional Three object targets for Pibbl events and focus;
7. dispose application-owned GPU resources in `dispose()`.

The existing adapted Three instancing/raycasting example remains the advanced
showcase. A smaller introductory example becomes the primary Three guide and
demonstrates one Three object covering a clickable Pibbl rectangle: a hit blocks
the rectangle even without a Pibbl handler, a registered object receives Pibbl
events and focus, and empty pixels obey the layer's miss policy.

Website navigation and search describe the section as Three.js, not Pibbl
WebGL. Lighting, materials, shadows, GLTF, controls, post-processing, and other
features are described as ordinary Three or Three-addon capabilities that can
be used inside the same layer lifecycle; Pibbl does not mirror their APIs.

## Runtime contracts kept from the prototype

- Pibbl owns the only ordinary animation-frame scheduler. Composited layers do
  not call `requestAnimationFrame()` or `renderer.setAnimationLoop()`.
- One mounted layer identity creates one `WebGLRenderer` and one application
  resource value. Component updates do not recreate either.
- One rendered bitmap plus its matching interaction generation is published
  transactionally into Canvas paint order.
- Default Three raycasting resolves a visible hit as block or as the nearest
  registered ancestor target. Empty pixels use `pass-through`, `block`, or
  `target-layer`.
- Pibbl remains authoritative for capture/target/bubble propagation, pointer
  capture, logical focus, keyboard navigation, layout, clips, outer filters,
  transforms, and teardown.
- Three controls receive input through the adapter bridge; their event system
  does not bypass Pibbl's hit arbitration.
- The application owns Three resources returned from `create()` and disposes
  them explicitly. The adapter always disposes its input bridge and renderer.

## Repository migration

Active code and distribution metadata must have no `@pibbl/webgl` or
`@pibbl/particles/webgl` reference. `packages/webgl` is deleted. Particles build
only its Canvas root. Physics publishes 2D runtime/geometry plus 3D geometry,
without WebGL peers or runtime exports.

Studio source and built modes expose `@pibbl/three`, `three`, and the explicitly
supported Three addon modules used by editable examples. Their editor
declarations and runtime identities must match. Packed consumers prove
Bundler/NodeNext declarations and a single external Three identity.

Historical specs, plans, and field notes may retain old names as history, but
must carry truthful historical/superseded status where they could be mistaken
for current guidance. Active contracts, README copy, AGENTS context, public
docs, and generated indexes describe only the surviving architecture.

## Completion evidence

The pivot is complete only when all of the following are true:

- targeted searches find no legacy package specifiers or removed public
  symbols in active source, manifests, tooling, public docs, or built assets;
- the simple Three introduction and advanced instancing example are both
  runnable in the Studio and their interaction masking is observable;
- focused Three lifecycle, picking, input, focus, catalog, and package tests
  pass;
- the complete `corepack pnpm@11.21.0 trust` gate passes on Node 24.15+;
- the feature branch is committed, merged locally into `main`, and `main` is
  pushed successfully.
