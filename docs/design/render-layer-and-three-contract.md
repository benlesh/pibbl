# External render layer and Three.js contract

Status: current implemented contract, 2026-09-28.

CRC is a Canvas 2D component runtime. External renderers join a CRC tree through
the public `defineRenderLayer()` lifecycle; Three.js is the official integration
through `defineThreeLayer()` from `@crc/three`. CRC does not define a parallel
3D scene graph, material, light, camera, loader, control, shadow, particle, or
post-processing vocabulary.

## Generic render layers

`defineRenderLayer(definition)` defines one reusable uppercase CRC component.
One mounted component identity owns one `OffscreenCanvas`, one resource value
returned by `create()`, one last committed bitmap, and one matching interaction
generation. Re-rendering the CRC component does not recreate those resources.

The lifecycle is synchronous and ordered:

1. `create(context, initialProps)` runs once for a mounted identity.
2. `update(resources, props, context)` copies each successful render's live
   props into the external resources when supplied.
3. `resize(resources, size, context)` runs on the initial finite allocation and
   whenever its logical or backing size changes.
4. `render(resources, frame, context)` draws the candidate generation.
5. `interaction.settle(resources, props, size)` optionally publishes the exact
   targets, hit test, and input bridge for that generation.
6. CRC transfers and commits the bitmap plus interaction generation together.
7. `dispose(resources, context)` runs once on removal, failure teardown, or root
   disposal when supplied.

All callbacks must return synchronously. `create()` returns application-defined
resources; it is not a cleanup callback. `context.invalidate()` and
`frame.invalidate()` request another CRC-scheduled frame. External renderers do
not start an ordinary `requestAnimationFrame()` loop. `frame` supplies CRC's
shared `time`, `delta`, and `deltaSeconds`.

The component accepts the shared box/layout style plus CRC event/focus props and
`missBehavior`. A render layer is one flattened entry in Canvas paint order.
Parent layout, transforms, clips, opacity, and filters apply outside the
completed bitmap; Canvas and external-renderer subprimitives cannot interleave.

Interaction snapshots return `miss`, `block`, or `target`. Registered targets
provide ordinary CRC handlers, pointer participation, cursor, focusability, and
optional navigation bounds. The default layer miss policy is `pass-through`;
`block` prevents a lower Canvas target, and `target-layer` targets the layer's
own handler/focus props. CRC remains authoritative for reverse paint-order hit
resolution, capture/target/bubble propagation, pointer capture, cursor, logical
focus, and keyboard navigation.

The application owns and disposes resources created for its external renderer.
CRC owns the layer surface, committed bitmap generations, scheduling entry,
event resolver, and teardown sequence. A failed candidate never publishes a
bitmap with interaction data from another generation.

## Three.js adapter

`defineThreeLayer(definition)` is implemented with `defineRenderLayer()` and
creates one transparent `THREE.WebGLRenderer` for each mounted layer identity.
The application imports Three.js and addons directly and returns resources that
include an ordinary `THREE.Scene` and `THREE.Camera`.

The Three lifecycle adds:

- `context.renderer`, the adapter-owned `THREE.WebGLRenderer` configured by the
  definition's optional `renderer` options;
- `context.input.connect(factory)`, which supplies Three controls with a DOM-like
  input target backed by CRC's routed pointer, wheel, context-menu, and click
  events;
- optional `targets(resources, props)`, which registers `THREE.Object3D` values
  with CRC handlers and focus metadata;
- optional `pick(resources, context)`, which replaces the default raycaster.

When `render` is omitted, the adapter calls
`renderer.render(resources.scene, resources.camera)`. The default picker
raycasts the scene from layer-local coordinates and returns `block` for the
nearest visible object unless that object or its nearest registered ancestor is
a CRC target. Empty pixels return `miss`; the layer then applies
`missBehavior`. A visible Three object can therefore block a clickable Canvas
shape behind it even when that object has no CRC handler.

Three controls never install independent Canvas listeners. The input bridge
delivers only events CRC routed through the committed layer generation and
maps pointer capture back to CRC. Controls, mixers, simulations, and composers
advance from the supplied CRC frame and call `invalidate()` only when another
frame is needed. Applications do not call `renderer.setAnimationLoop()` for
ordinary non-XR scenes. WebXR is outside the current adapter contract.

The adapter disposes its input bridge and renderer. The application's
`dispose()` callback releases geometries, materials, textures, controls,
composer targets, loaders, and other values it created. `@crc/three` peers on
the application's `three` installation and does not re-export or bundle a
second copy.

## Deliberate boundaries

- Three objects are not CRC elements and do not use the CRC JSX runtime.
- CRC does not reconcile or retain a Three object tree.
- `@crc/particles` remains Canvas 2D only.
- `@crc/physics/3d/geometry` remains pure renderer-independent geometry; there
  is no renderer-coupled `@crc/physics/3d` runtime.
- Multiple cameras, scissor views, post-processing, asset loading, environment
  maps, shadows, instancing, and particles are ordinary Three application code
  inside one layer rather than CRC wrappers.
- The layer requires browser `OffscreenCanvas`, `transferToImageBitmap()`, and
  the capabilities required by the selected external renderer.

## Evidence

Focused render-layer and Three suites prove one create/dispose lifetime,
successful update adoption, size/backing propagation, shared scheduled frames,
transactional bitmap and interaction publication, miss policies, blocking and
registered-target raycasts, event propagation, focus bounds, controls input,
renderer disposal, and inert stale callbacks. The simple `three-layer` lesson
and advanced `three-instancing` lesson exercise the same public surface in the
Studio. Packed Bundler and NodeNext consumers prove one external Three identity
and the declared package boundary.
