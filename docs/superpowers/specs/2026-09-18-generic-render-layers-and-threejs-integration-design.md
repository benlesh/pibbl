# Generic render layers and first-class Three.js integration design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved replacement direction. Current shipped behavior remains governed by
> the code and `docs/design/` contracts until this design is implemented.

Date: 2026-09-18

Status: design decisions approved in conversation on 2026-09-18; written
specification awaiting user review before implementation planning.

## Summary

CRC will stop developing a competing 3D renderer. The custom `@crc/webgl`
scene, material, lighting, camera, shadow, geometry, and GPU-resource model will
be removed and replaced by two deliberately smaller layers:

1. `@crc/core` will expose `defineRenderLayer()`, a framework-neutral lifecycle
   component for compositing an externally rendered `OffscreenCanvas` into
   CRC's Canvas 2D paint tree.
2. A new official `@crc/three` package will expose `defineThreeLayer()`, a thin
   Three.js adapter implemented with `defineRenderLayer()`.

Three.js remains Three.js. Applications create and retain ordinary Three
scenes, cameras, objects, materials, loaders, controls, composers, and other
addons. CRC contributes only the integration that it is unusually well placed
to own: Canvas composition, layout, transforms, clipping, outer filters,
scheduling, invalidation, event arbitration, focus, component identity, and
deterministic teardown.

`defineRenderLayer()` and `defineThreeLayer()` are definition functions called
once at module scope. Each returns a normal CRC component. Rendering that
component does not redeclare its lifecycle functions and does not recreate its
resources. One mounted CRC component identity owns one resource set until it
unmounts.

The replacement is a hard break. The completed change will not retain
`@crc/webgl` compatibility aliases, translate its JSX scene vocabulary into
Three objects, or maintain two 3D architectures. `@crc/particles` remains a
Canvas 2D package, while its `@crc/particles/webgl` entry is removed.

Immersive WebXR and WebAR are explicitly out of scope. A composited Three layer
never calls `renderer.setAnimationLoop()`; CRC owns its frame admission and
invokes its lifecycle through the realm scheduler.

## Why CRC is pivoting

The current WebGL island proved several valuable integration contracts, but its
public renderer duplicates a small and necessarily incomplete portion of a
mature 3D ecosystem. Continuing that path would require CRC to maintain its own
scene vocabulary, materials, texture system, loaders, post-processing,
animation system, controls, shader extension model, renderer optimizations,
asset pipeline, and future GPU backends. That effort would still leave users
with less capability and less community compatibility than direct Three.js.

The keepable work is not the custom 3D renderer. It is the boundary around an
external renderer:

- one composited entry in Canvas paint order;
- shared layout, transforms, clipping, and Canvas filters;
- one realm scheduler instead of competing animation loops;
- miss, block, or target arbitration with content behind the layer;
- CRC event ancestry, pointer capture, focus, and keyboard policy;
- stable component ownership, exact teardown, and failure isolation;
- transactional publication of pixels and matching interaction state.

Those capabilities are useful to Three.js and to other Canvas/WebGL/WebGPU
frameworks. They therefore belong in a generic core lifecycle rather than in a
new collection of CRC-specific 3D primitives.

## Goals

- Let an application use ordinary Three.js APIs and addons directly inside a
  CRC application.
- Make the common layer definition readable as setup, updates, resize, render,
  and teardown rather than as hook machinery hidden inside a component body.
- Create expensive application resources exactly once per mounted CRC
  component identity.
- Keep CRC's scheduler authoritative for ordinary composited rendering.
- Composite a rendered frame at one precise point in CRC paint order so 2D
  content can appear both below and above it.
- Preserve CRC layout, outer transforms, clips, filters, events, focus,
  keyboard navigation, signals, animation, and teardown semantics around the
  layer.
- Make visible 3D geometry block pointer interaction with covered CRC shapes
  even when that geometry has no event handler.
- Let explicitly registered Three objects become normal CRC logical event and
  focus targets without converting the Three scene into CRC JSX.
- Provide explicit behavior for empty pixels: pass through, block, or target
  the layer.
- Allow advanced applications to replace default raycasting without replacing
  the lifecycle or composition machinery.
- Keep the generic lifecycle usable by renderers other than Three.js.
- Remove the complete custom CRC WebGL renderer and its active public surface.
- Classify the full Three.js example catalog by integration route rather than
  pretending every browser/platform demonstration is the same kind of layer.
- Deliver the pivot first as a runnable mixed 2D/3D vertical slice, then remove
  the old renderer and harden the accepted design.

## Non-goals

- Reimplementing Three's scene graph as CRC components.
- Wrapping Three geometries, materials, lights, loaders, controls, exporters,
  animation mixers, or post-processing passes in a CRC vocabulary.
- Reconciling a declarative JSX tree into `THREE.Object3D` instances.
- Hiding Three objects behind CRC-specific descriptors.
- Supporting Canvas children inside the Three scene or interleaving individual
  Three objects with individual Canvas primitives. One render layer remains
  one flattened Canvas paint entry.
- Sharing a WebGL context or GPU resources between independent layers.
- Promising pixel-perfect hit testing through arbitrary shaders,
  post-processing, transparency, or displacement.
- Making Three's `EventDispatcher` act as a browser input system.
- Allowing an embedded renderer to start an independent
  `requestAnimationFrame()` or `setAnimationLoop()`.
- Supporting asynchronous lifecycle callbacks in the initial contract.
- Adding WebGPU-specific lifecycle semantics in the first slice.
- Supporting immersive WebXR, WebAR, headset presentation, or controller
  input.
- Making CSS2DRenderer or CSS3DRenderer pixels part of CRC's Canvas paint order.
- Preserving source compatibility with `@crc/webgl` or
  `@crc/particles/webgl`.
- Porting every Three.js example into the CRC repository.

## Alternatives considered

### Selected: generic lifecycle layer plus a thin Three adapter

`defineRenderLayer()` owns the general composition and lifecycle contract.
`defineThreeLayer()` uses it to provide a Three-owned renderer, default scene
rendering, Three raycasting, Three-object target registration, and Three-aware
cleanup.

This division keeps the core abstraction honest. CRC does not need to know what
a scene, camera, mesh, material, composer, or mixer is. The adapter can remain
convenient without turning Three-specific assumptions into core policy.

### Rejected: a Three-specific layer only

A single `defineThreeLayer()` could ship faster, but it would strand the useful
composition, scheduling, interaction, and ownership work inside another 3D
package. Other renderers would either copy that machinery or depend on Three
terminology. The generic lifecycle is small enough to justify as a core public
capability.

### Rejected: a CRC JSX reconciler for Three scenes

A reconciler could offer declarations such as `<mesh>` and `<pointLight>`, but
CRC would then own a second component vocabulary, mutation/reconciliation
rules, object adoption, disposal inference, addon escape hatches, and ongoing
coverage of Three's API. It would reproduce the strategic problem of
`@crc/webgl` in a different form. Applications that want a Three JSX reconciler
can use an ecosystem built for that model; CRC's integration keeps raw Three
objects first class.

### Rejected: only expose a raw Canvas callback

A callback receiving a canvas is superficially minimal, but it leaves every
application to rediscover mount identity, resize ordering, invalidation,
resource teardown, frame timing, event arbitration, focus, stale async work,
and failed-frame publication. The lifecycle component makes those contracts
explicit once without wrapping the renderer's own API.

## Architectural boundary

The system has four ownership layers:

1. **CRC root and Canvas tree.** Core owns layout, paint order, outer
   transforms, clips, filters, logical events, focus policy, and the realm
   scheduler.
2. **Generic render-layer controller.** One mounted component owns one
   `OffscreenCanvas`, the lifecycle state, invalidation state, committed bitmap,
   committed interaction generation, and teardown gate.
3. **Framework adapter.** `@crc/three` owns the Three renderer and translates
   Three raycasting and registered objects into the generic interaction
   protocol.
4. **Application resources.** The value returned by `create()` belongs to that
   mounted application layer. It can contain a Three scene, camera, meshes,
   controls, mixers, composers, render targets, loaders, subscriptions, and any
   other application state.

The generic controller treats application resources as opaque. It never walks
or clones them. The Three adapter understands only the minimum stable facts
needed for its defaults: the renderer it created, the returned scene and
camera, registered object identities, and an optional custom picker.

`defineThreeLayer()` is implemented by constructing a
`defineRenderLayer()` definition. It is not an independent scheduler,
component runtime, or composition implementation.

## Public authoring model

### A definition is a reusable component type

Definitions normally live at module scope:

```ts
const ProductScene = defineThreeLayer<ProductSceneProps, ProductSceneResources>(
  {
    create(context, initialProps) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45,
        context.size.width / context.size.height,
        0.1,
        100,
      );
      const product = createProduct(initialProps.model);
      scene.add(product);

      return { scene, camera, product };
    },

    update(resources, props) {
      resources.product.rotation.y = props.rotation;
    },

    resize(resources, size) {
      resources.camera.aspect = size.width / size.height;
      resources.camera.updateProjectionMatrix();
    },

    render(resources, frame, context) {
      resources.product.rotation.y += frame.deltaSeconds * 0.4;
      context.renderer.render(resources.scene, resources.camera);
      frame.invalidate();
    },

    dispose(resources) {
      disposeObjectTree(resources.scene);
    },
  },
);
```

The returned value is used like any other CRC component:

```tsx
<ProductScene
  model={model}
  rotation={rotation.get()}
  missBehavior="pass-through"
  style={{
    width: "100%",
    height: 360,
    filter: [{ type: "drop-shadow", x: 0, y: 8, blur: 18, color: "#0008" }],
  }}
/>
```

The callbacks in the definition object are created once with the component
type. CRC component rerenders pass current props into `update()`; they do not
redeclare the lifecycle or rerun `create()`.

### `create()` returns resources, not a renderer protocol

`create()` returns any synchronous value selected by the application. CRC
stores that value unchanged and passes it back to later lifecycle callbacks.
It is not interpreted as a renderer and is not required to implement methods.

For `defineThreeLayer()`, `context.renderer` is the Three renderer owned by the
adapter. The application may retain it in its resource object if convenient,
but that is ordinary application state rather than a return-value convention.
The adapter remains the renderer's sole lifecycle owner and disposes it after
the application's `dispose()` callback.

For `defineRenderLayer()`, core supplies the target canvas but creates no
framework renderer. The application commonly creates its framework renderer
inside `create()` and returns it among its resources.

## Generic `defineRenderLayer()` contract

The public contract is:

```ts
export interface CRCRenderLayerSize {
  readonly width: number;
  readonly height: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly pixelRatioX: number;
  readonly pixelRatioY: number;
}

export interface CRCRenderLayerFrame {
  readonly frameId: number;
  readonly time: number;
  readonly delta: number;
  readonly deltaSeconds: number;
  invalidate(): void;
}

export interface CRCRenderLayerContext {
  readonly canvas: OffscreenCanvas;
  readonly size: CRCRenderLayerSize;
  invalidate(): void;
}

export type CRCRenderLayerHit<Target extends object> =
  | { readonly kind: "miss" }
  | { readonly kind: "block" }
  | { readonly kind: "target"; readonly target: Target };

export interface CRCRenderLayerTarget<Target extends object> {
  readonly target: Target;
  readonly handlers?: CRCEventHandlers;
  readonly pointerEvents?: CRCPointerEvents;
  readonly cursor?: string;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

export interface CRCRenderLayerStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle {}

export interface CRCRenderLayerComponentProps
  extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions {
  readonly style?: CRCRenderLayerStyle;
  readonly missBehavior?: "pass-through" | "block" | "target-layer";
}

export interface CRCRenderLayerInteraction<
  Props,
  Resources,
  Target extends object,
> {
  settle(
    resources: Resources,
    props: Readonly<Props>,
    size: Readonly<CRCRenderLayerSize>,
  ): CRCRenderLayerInteractionSnapshot<Target>;
}

export interface CRCRenderLayerInteractionSnapshot<Target extends object> {
  readonly targets: Iterable<CRCRenderLayerTarget<Target>>;
  hitTest(point: Readonly<{ x: number; y: number }>): CRCRenderLayerHit<Target>;
}

export interface CRCRenderLayerDefinition<
  Props,
  Resources,
  Target extends object = object,
> {
  create(
    context: Readonly<CRCRenderLayerContext>,
    initialProps: Readonly<Props>,
  ): Resources;
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  resize?(
    resources: Resources,
    size: Readonly<CRCRenderLayerSize>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  render(
    resources: Resources,
    frame: Readonly<CRCRenderLayerFrame>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  dispose?(
    resources: Resources,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  interaction?: CRCRenderLayerInteraction<Props, Resources, Target>;
}

export function defineRenderLayer<
  Props,
  Resources,
  Target extends object = object,
>(
  definition: CRCRenderLayerDefinition<Props, Resources, Target>,
): CRCComponent<Props & CRCRenderLayerComponentProps>;
```

`CRCRenderLayerComponentProps` reserves CRC's ordinary `key`, `style`, event,
focus, `pointerEvents`, and `missBehavior` fields. A custom `Props` type cannot
redeclare those names. Its style is a local closed style containing box/layout
participation and `filter`; width and height resolve through the same allocation
rules as `Layer`.

`time` and `delta` are CRC scheduler logical milliseconds.
`deltaSeconds` is exactly `delta / 1000` for Three mixers and controls that use
seconds. `delta` is zero for the first render. No callback receives the host's
raw `requestAnimationFrame` timestamp as an independent clock.

Every callback is synchronous. Returning a Promise is a development error.
Loaders and other asynchronous work may start inside `create()` or `update()`;
their completion mutates application-owned resources and calls the stable
`context.invalidate()`. Invalidation after teardown is a no-op. Applications
still cancel or ignore stale asynchronous work in `dispose()` when the
underlying API permits it.

When `interaction` is omitted, core commits an empty target list whose hit test
always returns miss; the component's `missBehavior` then decides whether that
local point passes through, blocks, or targets the complete layer. A settled
target result must refer to one target identity present in the same snapshot.
An unknown identity fails settlement rather than producing a partially valid
generation. Explicit `keyboardNavigationBounds` use layer-local logical
coordinates and are projected through the outer CRC transform at commit.

The first generic layer requires browser `OffscreenCanvas` and
`transferToImageBitmap()`. The Three adapter also requires a WebGL2 context
accepted by its `THREE.WebGLRenderer`. Missing capabilities and
invalid/nonrepresentable backing dimensions fail during mount with a
component-specific diagnostic before application `create()` runs.

### Lifecycle ordering

For one mounted identity:

1. Core allocates the backing `OffscreenCanvas` at the resolved backing size.
2. `create(context, initialProps)` runs exactly once.
3. `update(resources, currentProps, context)` runs after each later admitted
   reevaluation of the mounted component. `create()` already received the
   initial props, so CRC does not immediately repeat them through `update()`.
4. `resize(resources, size, context)` runs after creation and whenever logical
   or backing dimensions change. The initial call is deliberate so one callback
   owns all projection and viewport sizing.
5. `render(resources, frame, context)` runs after any admitted update and
   resize work and on explicit invalidation.
6. After a successful render callback, `interaction.settle()` produces the
   target declarations and hit-test snapshot for that exact candidate bitmap.
7. On removal or root disposal, `dispose(resources, context)` runs at most once
   if and only if `create()` completed successfully. Core then releases the
   committed bitmap, target registrations, canvas, and controller state.

The component definition itself has no lifecycle. Calling
`defineRenderLayer()` allocates no canvas, renderer, event target, or scheduler
registration.

### Invalidation and continuous animation

Props, subscribed signal changes, size changes, focus-generation changes, and
explicit invalidation mark the exact layer dirty. Multiple invalidations before
the next frame coalesce.

`context.invalidate()` can be retained by loaders, application services, or
resources. `frame.invalidate()` schedules the same next-frame work from inside
the render transaction, but it does not gate the generation that is about to
commit. Calling it during render is the explicit continuous-animation pattern:

```ts
render(resources, frame, context) {
  resources.mixer.update(frame.deltaSeconds);
  resources.controls.update(frame.deltaSeconds);
  context.renderer.render(resources.scene, resources.camera);
  frame.invalidate();
}
```

No layer starts or owns another browser frame loop. Work stops naturally when
the callback stops invalidating and no other input changes the layer.

## `defineThreeLayer()` contract

`@crc/three` has a peer dependency on `three`; it does not bundle a private
copy. Applications import Three and its addons through their ordinary public
paths. The package does not re-export Three.

The first adapter owns one transparent `THREE.WebGLRenderer` per mounted layer.
It forces the supplied `OffscreenCanvas`, an alpha-capable context, and backing
dimensions compatible with CRC composition. Safe renderer construction options
such as antialiasing and power preference remain configurable, while an
application cannot replace the adapter-owned canvas or disable the alpha
contract.

The resource value must expose the scene and camera used by the adapter's
defaults:

```ts
export interface CRCThreeLayerResources {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
}
```

Additional resource fields are unconstrained. The definition mirrors the
generic lifecycle and adds Three-specific renderer options, target declarations,
and an optional picker:

```ts
export interface CRCThreeTarget {
  readonly object: THREE.Object3D;
  readonly handlers?: CRCEventHandlers;
  readonly pointerEvents?: CRCPointerEvents;
  readonly cursor?: string;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

export type CRCThreePickResult = CRCRenderLayerHit<THREE.Object3D>;

export type CRCThreeRendererOptions = Omit<
  THREE.WebGLRendererParameters,
  "canvas" | "alpha"
>;

export interface CRCThreeInputBridge {
  connect<Control>(create: (element: HTMLElement) => Control): Control;
}

export type CRCThreePicker = (
  point: Readonly<{ x: number; y: number }>,
) => CRCThreePickResult;

export interface CRCThreeLayerContext extends CRCRenderLayerContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly input: CRCThreeInputBridge;
}

export interface CRCThreeLayerDefinition<
  Props,
  Resources extends CRCThreeLayerResources,
> {
  readonly renderer?: CRCThreeRendererOptions;
  create(
    context: CRCThreeLayerContext,
    initialProps: Readonly<Props>,
  ): Resources;
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: CRCThreeLayerContext,
  ): void;
  resize?(
    resources: Resources,
    size: CRCRenderLayerSize,
    context: CRCThreeLayerContext,
  ): void;
  render?(
    resources: Resources,
    frame: CRCRenderLayerFrame,
    context: CRCThreeLayerContext,
  ): void;
  targets?(
    resources: Resources,
    props: Readonly<Props>,
  ): Iterable<CRCThreeTarget>;
  pick?(resources: Resources, context: CRCThreeLayerContext): CRCThreePicker;
  dispose?(resources: Resources, context: CRCThreeLayerContext): void;
}
```

If `render()` is omitted, the adapter calls
`renderer.render(resources.scene, resources.camera)`. An application using
`EffectComposer`, multiple cameras, scissor views, render targets, or custom
pass order supplies `render()` and remains fully in charge of those Three
operations.

`resize()` remains explicit because cameras, composers, custom render targets,
and split viewports have different correct resize behavior. The adapter resizes
its renderer to the backing dimensions before invoking application resize work;
it does not guess camera projection policy.

`context.input.connect()` is the narrow control-addon bridge described below.
It passes one layer-local compatibility element to the supplied factory and
returns the factory's result. The application owns and disposes that result as
part of its resources. Calling `connect()` outside `create()` is an error so
listener identity and teardown ownership cannot drift across updates.

The adapter calls application `dispose()` first, then disposes its renderer and
adapter-owned raycaster/input resources exactly once. It does not attempt to
infer ownership of application-created geometries, materials, textures, render
targets, composers, controls, loaders, or subscriptions. The application's
callback releases those resources.

## Composition and visual semantics

A render layer is a retained raster boundary, not a retained CRC scene graph.
After a successful render, core transfers or snapshots the layer canvas into a
new committed bitmap generation. The parent Canvas draws that bitmap once at
the component's source position.

Consequences:

- CRC 2D content declared before the layer appears below it; content declared
  after the layer appears above it.
- `Group` transforms, `Clip`, layout placement, and `style.filter` apply outside
  the complete layer bitmap.
- A filter sees the combined Three output, not individual Three objects.
- Three depth, blending, stencil, render-target, composer, and post-processing
  behavior stays entirely inside the layer.
- Individual Three objects cannot interleave with sibling CRC primitives.
- The backing surface is transparent unless the Three application renders a
  background.
- The application can render an opaque background, but opacity alone does not
  decide interaction behavior; hit resolution remains explicit.

After rendering, the generic interaction's `settle()` method returns one
candidate snapshot containing its target declarations and a synchronous
hit-test function. The bitmap and that interaction/focus snapshot commit
together. CRC therefore never publishes new pixels with stale targets or new
targets over the old bitmap.

The committed hit-test function may close over application resources only while
those resources remain in the committed state. Mutating them outside a
lifecycle callback requires an immediate `context.invalidate()` before control
returns to the browser; that external invalidation temporarily gates coordinate
resolution to block until the next successful commit. Lifecycle callbacks run
synchronously inside the transaction, so event dispatch cannot observe their
intermediate mutations. `frame.invalidate()` schedules another animation frame
without gating the generation that just committed, allowing continuously
animated layers to remain interactive between frames.

## Interaction arbitration

Three's `EventDispatcher` is an object-to-listener utility. It does not observe
browser pointer input, raycast a scene, arbitrate with Canvas paint behind the
renderer, or participate in CRC propagation. CRC therefore does not forward
input into every Three `EventDispatcher` automatically.

The adapter uses `THREE.Raycaster` by default. It maps the root-logical pointer
through the layer's outer inverse transform and local bounds, converts the
point to normalized device coordinates, and casts through the committed camera
and scene state. The nearest eligible intersection determines one of three
outcomes:

- **miss** — no Three geometry was intersected; resolution follows the layer's
  `missBehavior`;
- **block** — geometry was intersected but no registered CRC target owns it;
  underlying CRC paint cannot receive the event and no logical leaf is
  dispatched;
- **target** — the intersected object or its nearest registered ancestor owns a
  `CRCThreeTarget`; that stable object identity maps to a CRC logical target.

This is the crucial default: visible, raycastable Three geometry blocks CRC
shapes behind it even when it has no handlers. Registration is required for
logical dispatch, cursor, focus, or keyboard behavior, not for occlusion.

The Three adapter settles targets and picker state after each successful render
callback. Fresh target descriptor objects are allowed; `THREE.Object3D`
identity retains the CRC target identity. An object marked
`pointerEvents: "none"` and its object subtree are skipped so a ray may continue
behind it. An object removed from the target list loses logical target and
focus registration but still blocks if the scene's picker intersects it.

The default committed picker uses the camera, object transforms, visibility,
raycast configuration, geometry, and registered-object mapping left by the
successful candidate. Application code must not mutate that raycast-relevant
state outside a lifecycle callback without immediately calling the external
`context.invalidate()` gate. A later failed lifecycle attempt leaves the gate
closed, so the previously committed bitmap cannot respond as though the failed
scene had been published.

The default raycaster follows Three geometry rather than final fragment output.
Custom shaders, alpha maps, post-processing, procedural displacement, GPU
particles, and render-target composition can make pixels differ from raycast
geometry. Advanced applications use the optional `pick()` override to create a
synchronous picker for the candidate generation. The returned picker must
either capture the state it needs or obey the same
invalidate-before-observation rule for retained resources. It returns the same
miss/block/target result from the application's CPU or already-settled GPU
picking strategy. The lifecycle, paint-order arbitration, propagation, pointer
capture, and transactional commit remain unchanged.

### Empty-space behavior

Every layer instance has an explicit `missBehavior`:

- `"pass-through"` is the default. A raycast miss allows the next lower CRC
  paint entry to resolve the event.
- `"block"` stops resolution without a logical target.
- `"target-layer"` selects the layer's own logical target, allowing viewport
  controls or layer-wide handlers to receive otherwise empty-space input.

An opaque Three background does not silently turn a miss into a hit. Authors
choose `"block"` or `"target-layer"` when the complete rectangular viewport is
intended to intercept input.

### Propagation, capture, and focus

A registered Three object is a normal CRC logical target. Its event path crosses
the Three layer component and then ordinary CRC component ancestry. Capture,
target, and bubble ordering; cancellation; pointer capture; touch ownership;
cursor selection; and related-target calculations use the existing CRC event
contract.

Layer-level event props are structural listeners under `"pass-through"` and
`"block"`: they participate when a registered descendant is targeted but do
not invent empty hit geometry. Under `"target-layer"`, the layer also owns an
explicit viewport target for misses.

Registered objects become focus candidates only when requested. Their default
focus and directional-navigation bounds are a projection of their committed
Three world bounds through the committed camera. Applications with shader-only
or otherwise unbounded visuals can supply explicit projected bounds. A blocked
unregistered object is never focusable.

Applications may call `object.dispatchEvent()` from a CRC handler when they
want a Three-domain notification. That dispatch is explicit application code;
CRC does not create a second hidden event propagation system.

## Three controls and browser-input addons

Many Three examples pass an `HTMLCanvasElement` to addons such as
`OrbitControls`. A CRC render layer uses an `OffscreenCanvas` and occupies only
a transformed subregion of the root Canvas, so binding those addons directly to
the root DOM canvas would give them the wrong coordinate space and let them
bypass CRC arbitration.

`@crc/three` will therefore provide a layer-local input bridge backed by CRC's
event system. The bridge exposes the DOM-style listener, bounds, pointer-capture,
and focus subset required by supported Three controls while mapping coordinates
to the layer's committed local viewport. It does not create a visible DOM node
or an overlay that intercepts the root Canvas. Its public construction pattern
keeps the compatibility element scoped to a factory:

```ts
create(context) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const controls = context.input.connect(
    element => new OrbitControls(camera, element),
  );
  return { scene, camera, controls };
}
```

The adapter delivers bridge input only after the layer wins CRC coordinate
arbitration: a registered target hit, an unregistered geometry block, or a miss
under `missBehavior="target-layer"`. A pass-through miss delivers nothing.
Delivered input retains CRC cancellation and pointer-capture ownership and
invalidates the layer after the control handles it. Controls intended to operate
over the complete viewport therefore use `missBehavior="target-layer"`.

The compatibility element is valid only inside the factory and as the retained
control's private event source. It must not escape as application DOM, be
inserted into a document, or be used for arbitrary layout. The first supported
matrix covers `OrbitControls` and `TransformControls`; additional controls are
admitted by focused compatibility tests rather than by claiming that the bridge
is a general-purpose browser `HTMLElement`.

Addons that fundamentally require document-level behavior—pointer lock,
fullscreen ownership, drag-and-drop files, editable DOM, or real CSS
layout—keep that browser integration in application code. CRC must not fake a
complete DOM element to make an incompatible addon appear supported.

## Scheduling

One loaded `@crc/core` runtime continues to own one realm scheduler. Three
layers participate in the same Begin, Advance, Commit, Plan, Render, and
Complete frame as CRC roots, signals, animations, and managed Canvas layers.

Three applications embedded in CRC do not call any of the following:

- `requestAnimationFrame()` for layer rendering;
- `renderer.setAnimationLoop()`;
- a private timer whose only purpose is continuous painting.

Animation mixers, controls, simulations, and composers advance from the
supplied `CRCRenderLayerFrame`. An active animation requests its next frame with
`frame.invalidate()`. CRC can consequently coalesce Three work with 2D work,
stop idle rendering, preserve nested-layer ordering, and publish all affected
state in one scheduled transaction.

`renderer.setAnimationLoop()` remains appropriate for a standalone Three
application. Immersive WebXR has a different presentation host and is outside
this product scope; it is not a dormant exception inside `defineThreeLayer()`.

## Failure and teardown semantics

Lifecycle work is isolated to the owning layer transaction.

- If `create()` throws, no resource value exists, `dispose()` is not called,
  and core releases the partially created controller state.
- If `update()`, `resize()`, `render()`, target collection, or picking-state
  settlement throws, the candidate bitmap and interaction generation are
  discarded. The last successfully committed bitmap remains compositable, but
  coordinate input fail-closes to block until a later successful generation
  commits.
- Arbitrary mutation inside application-owned resources is not rolled back.
  Transactionality covers CRC publication, not the internals of a mutable Three
  scene.
- A failed renderer transaction does not prevent independent roots, layers,
  animation completions, or scheduler cleanup from running. Errors are reported
  after Complete according to the existing realm error contract.
- Failed dirty work retains its revision for a later explicit or already-pending
  retry; CRC does not create a tight synchronous retry loop.
- `dispose()` runs once in a teardown `finally` path. A throwing application
  disposer does not prevent adapter-owned renderer, bitmap, target, and
  scheduler resources from being released.
- Calling an old `invalidate()` closure after teardown does nothing.

Context loss and restoration remain renderer-specific. The Three adapter
listens only where necessary to invalidate the affected layer and lets Three
recreate its renderer-owned state. Applications remain responsible for custom
resources and any restoration work required by the Three APIs they use.

## Three.js example-catalog accommodation

The [Three.js examples catalog](https://threejs.org/examples/) was reviewed on
2026-09-18 as a capability inventory, not as a set of demos CRC should copy.
The reviewed snapshot contained 608 example entries. They fall into five
integration routes. Every entry must be assigned one route in the implementation
inventory; unsupported platform demonstrations must be named rather than
silently treated as ordinary layers.

### Route 1: direct composited layer

Most WebGLRenderer examples mount directly. Application resources hold the
ordinary scene and addons; `render()` calls either the renderer or composer.
This covers, among others:

- geometry, materials, textures, lights, shadows, fog, clipping, helpers, and
  cameras;
- GLTF, DRACO, KTX2, OBJ, FBX, Collada, STL, PLY, SVG, font, image, video, and
  other loader-driven assets supported by the browser;
- skeletal and morph animation, `AnimationMixer`, instancing, batching, level
  of detail, sprites, points, lines, and custom `ShaderMaterial` scenes;
- render targets, cube cameras, reflections, refractions, portals, stencil
  effects, scissor views, multiple cameras, and manual pass order;
- `EffectComposer` and WebGL post-processing passes;
- CPU and GPU simulation whose render entry remains synchronous;
- exporters, geometry utilities, math demonstrations, and inspector helpers
  that do not require their own visible DOM surface.

Asynchronous loaders call `context.invalidate()` when usable state arrives.
Video, audio, or other external clocks request frames only while their content
actually changes.

### Route 2: composited layer with CRC input bridge

Examples using orbit, transform, drag, map, fly, first-person, or similar
controls use the layer-local input bridge when the addon's required DOM subset
is supported. Raycast selection uses registered Three targets or an application
picker. Pointer-lock and fullscreen-specific controls stay application-managed
until a focused browser integration is designed.

### Route 3: composited layer with application DOM companions

Stats panels, lil-gui controls, file inputs, color pickers, editors, source
views, and ordinary HTML labels remain DOM owned by the surrounding
application. They can drive CRC signals or layer props but are not rasterized
into the Canvas automatically.

CSS2DRenderer and CSS3DRenderer output is also DOM. It can be positioned as a
coordinated sibling overlay by application code, but it cannot participate
between CRC Canvas primitives or inherit CRC filters/clips as though it were
part of the bitmap. A future explicit DOM-overlay facility would require its own
accessibility, transform, clipping, stacking, and ownership design.

### Route 4: exclusive or specialized presentation host

Examples that require ownership of the visible canvas, multiple browser canvas
elements, a worker transfer, pointer lock, fullscreen presentation, or an
asynchronous renderer may use Three outside the composited layer while sharing
application state with CRC. They do not receive CRC paint-order interleaving.

WebGPURenderer and TSL examples belong here for the first release because their
initialization/render lifecycle is asynchronous and must not be forced into the
synchronous committed-frame contract. The generic layer is intentionally
backend-neutral so a later async-safe or direct WebGPU host can be designed
without changing Three scene authoring.

### Route 5: explicitly out of scope

Immersive WebXR, WebAR, headset presentation, XR controllers, and related
examples are out of scope by product decision. They are documented as such and
do not complicate the composited lifecycle with a dormant XR exception.

## Package and dependency surface

The completed workspace contains:

- `@crc/core`, exporting `defineRenderLayer()` and its public lifecycle,
  sizing, frame, interaction, style, and component types;
- `@crc/three`, exporting `defineThreeLayer()` and only the Three-specific
  adapter types and supported input helpers;
- `@crc/particles`, exporting the existing Canvas 2D particle system without a
  WebGL subpath.

`@crc/three` depends on the exact compatible CRC core range and peers on Three.
Its build externalizes both packages so an application receives one Three
realm and one CRC runtime. Browser bundler, NodeNext type-resolution, packed
consumer, source-mode Studio, and built-mode Studio checks all exercise the
same public entries.

The generic lifecycle is public from `@crc/core`; applications do not import
`@crc/core/internal`. Version-coupled internal seams may implement it, but they
remain non-contractual.

## Removal boundary

The implementation deletes the complete custom renderer surface:

- the `packages/webgl` package and `@crc/webgl` package entry;
- `WebGLLayer`, `Group3D`, `Mesh`, `Cube`, `Sphere`, custom WebGL geometry,
  camera descriptors, materials, lights, backgrounds, shadows,
  `useOrbitCamera()`, and `useAnimationFrame()`;
- custom shader programs, GL resource caches, shadow passes, scene settlement,
  ray math, backend mounts, and renderer-specific ownership code used only by
  that package;
- `@crc/particles/webgl`, `Particles3D`, WebGL particle submissions, and the
  dependency from particles to the old renderer;
- every active custom-WebGL learning example rather than translating those
  examples one-for-one to Three, along with their scenario catalog entries,
  API pages, guides, browser tests, visual baselines, package-consumer fixtures,
  and verification rules that advertise or require the removed surface.

The implementation keeps and generalizes only behavior that remains useful to
the new boundary:

- core OffscreenCanvas surface and bitmap composition machinery;
- scheduler participation and invalidation;
- component and hook ownership infrastructure;
- fixed miss/block/target arbitration;
- nested event/focus ancestry and projected-bounds support;
- Canvas layout, transforms, clipping, filters, and paint ordering;
- generic lifecycle/error/teardown evidence.

Historical specs, plans, field notes, and trust evidence are not erased. They
receive a concise superseded-status banner pointing to this design and remain
dated records of why the reusable integration contracts exist. Current
`docs/design/`, public site documentation, strategy descriptions, repository
instructions, and generated preservation baselines are updated to describe the
new shipped system when implementation lands.

There is no deprecated façade, translation layer, or compatibility alias. An
application using `@crc/webgl` must migrate to ordinary Three objects and
`@crc/three`.

## Replacement proving example

One polished mixed CRC/Three scene replaces the complete old WebGL learning
gallery as the initial public showcase. It adapts Three.js's official
[WebGL instancing and raycasting example](https://threejs.org/examples/webgl_instancing_raycast.html)
and credits its
[upstream source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_instancing_raycast.html)
under the Three.js
[MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE).

The source is a strong integration proof because it is small, visually
distinctive, procedural, and free of model or texture asset licensing. Its
recognizable field of lit icosahedron instances exercises
`THREE.InstancedMesh`, instance colors, lighting, `THREE.Raycaster`,
`OrbitControls`, animation, resize, and disposal without hiding the lifecycle
under asset-loading code.

The adaptation keeps the visual idea and ordinary Three APIs while replacing
the standalone browser shell:

- `defineThreeLayer()` owns the renderer instead of constructing and appending
  a visible renderer canvas;
- CRC resize updates the camera projection and adapter-owned renderer instead
  of installing a window listener;
- the local input bridge replaces document-level mouse listeners and the root
  canvas passed directly to `OrbitControls`;
- CRC's supplied frame and `frame.invalidate()` replace
  `renderer.setAnimationLoop()`;
- CRC foreground controls and an on-canvas event readout replace Stats and
  lil-gui DOM panels;
- the instance count may be tuned for the Studio viewport, but the scene keeps
  the procedural lattice, lit icosahedrons, orbit interaction, raycast hover,
  and per-instance color changes that identify the upstream example.

The scene deliberately contains all three interaction outcomes:

1. A grid of numbered CRC tiles is painted behind the transparent Three layer.
   Empty gaps between projected instances return miss, so the exposed CRC tile
   beneath receives hover and click input.
2. Ordinary unregistered instances return block. They may recolor through the
   Three input bridge and raycaster, but a click never reaches the obscured CRC
   tile and produces no CRC logical object target.
3. One visually distinct Three icosahedron is registered as a CRC target. It
   receives normal CRC capture/target/bubble events while still blocking the
   tile beneath it.

A compact CRC toolbar and status readout are painted after the Three layer.
They remain interactive above every Three object and report the last resolution
as `CRC tile`, `Three target`, or `Three blocked`. A control switches empty-space
behavior among pass-through, block, and target-layer so the policy can be
inspected without changing code.

The `Three blocked` readout is updated by the layer-local Three input bridge
after its raycaster identifies an unregistered instance. It is not a CRC target
event: the underlying CRC tile receives nothing, and the blocked Three object
does not acquire a logical target merely for diagnostics.

This is a learning example, not a bespoke test fixture. A matching deterministic
scenario drives exact coordinates for all three outcomes and verifies the same
public API headlessly. Later Three examples are added only when they teach a
materially different integration category; the removed CRC renderer gallery is
not recreated feature by feature.

## Delivery sequence

### Milestone 1: slice ready for feedback

The shortest public vertical slice includes:

1. the generic `defineRenderLayer()` lifecycle through its public core export;
2. `defineThreeLayer()` implemented on that lifecycle;
3. the adapted official instancing/raycasting scene as the one mixed Studio
   showcase, with CRC tiles below and CRC controls above the Three bitmap;
4. control damping and per-instance color updates driven by CRC frame timing
   and local input rather than an independent browser loop;
5. one registered Three icosahedron, unregistered blocking instances, and empty
   gaps passing through to CRC tiles below;
6. the visible event-resolution readout and empty-space policy control;
7. layer resize, outer clip/filter, invalidation, and exact disposal;
8. focused semantic and browser checks for that path.

The old package may remain temporarily in the working branch only while this
slice is evaluated. The exact Studio URL and inspection checklist are provided
as soon as the focused slice passes.

### Milestone 2: accepted replacement

After hands-on API feedback, the implementation removes the old packages and
all old WebGL examples and active references in the same landing change, keeps
the adapted Three showcase, and makes the workspace build with only the new
architecture.

### Milestone 3: feature complete

Hardening adds the broader lifecycle, failure, interaction, focus, controls,
packaging, ownership, documentation, and representative example-category
matrix. Aggregate verification occurs after the accepted slice rather than
delaying experiential feedback with speculative coverage.

## Verification strategy

### Focused core evidence

- `create()` once per mount identity and never at definition time;
- changed-prop `update()` ordering without a duplicate initial update;
- initial and changed-size `resize()` ordering with logical/backing dimensions;
- dirty-only render, coalesced invalidation, and explicit continuous frames;
- outer layout, transform, clip, filter, and paint order;
- first-frame and subsequent frame timing;
- successful bitmap/interaction pair commit and failed candidate discard;
- failed create/update/resize/render/target/dispose isolation;
- exact bitmap, target, scheduler, canvas, and application disposal ownership;
- late invalidation becoming inert after teardown;
- generic miss, block, target, pointer capture, and focus ancestry.

### Focused Three evidence

- adapter ownership and disposal of one transparent WebGLRenderer;
- default scene/camera render and custom composer render;
- renderer resize before application resize;
- loader-style asynchronous invalidation;
- nearest raycast geometry, registered ancestor targets, unregistered blocking,
  `pointerEvents="none"`, and all three miss behaviors;
- bitmap-matched camera/scene picking and fail-closed blocking after a failed
  render;
- projected focus bounds and keyboard activation;
- at least OrbitControls and TransformControls against the local input bridge;
- no call to `requestAnimationFrame()` or `setAnimationLoop()` from a layer;
- one Three peer and one CRC runtime in packed consumer output.

### Public scenario evidence

The proving scenario must be understandable without an internal test harness.
It adapts the official Three instancing/raycasting example inside a field of
clickable CRC tiles:

- hovering or clicking an exposed tile updates the readout to `CRC tile`;
- hovering an unregistered instance can recolor it through Three's raycaster;
- clicking that unregistered instance updates the readout to `Three blocked`
  without invoking the obscured CRC tile;
- clicking the distinct registered icosahedron updates the readout to
  `Three target` and follows normal CRC propagation;
- clicking a transparent gap reaches the CRC tile under the default
  pass-through policy;
- switching miss behavior demonstrates empty rectangular blocking and layer
  targeting;
- the CRC toolbar painted afterward remains interactive above the instances;
- orbit input, resize, animation, clipping, filtering, and disposal are visibly
  inspectable;
- the example contains its upstream attribution and no separately licensed
  model, texture, HDR, font, audio, or video asset.

### Catalog evidence

The repository does not duplicate hundreds of Three demos. Instead, one
maintained inventory maps every audited example to one of the five routes and
records the capability responsible for that classification. Representative
public examples exercise materially different integration paths: assets and
animation, post-processing, custom shaders, multiple views, controls, picking,
DOM companions, and an explicitly exclusive host. Catalog validation ensures a
newly inventoried example cannot remain unclassified. Active catalog and public
documentation checks also reject old WebGL example IDs, `@crc/webgl` imports,
and `@crc/particles/webgl` imports while requiring the attributed Three
instancing/raycasting showcase.

### Final trust gate

After the feature is accepted and hardened, run verification proportional to
the final change, ending with the repository aggregate trust command on the
documented Node and pnpm versions. Fresh output, not historical totals, is the
only basis for reporting completion.

## Resulting product position

CRC specializes in its strong surface: functional Canvas 2D composition,
layout, eventing, focus, scheduling, signals, animation, filters, and 2D
effects. Three.js supplies the 3D scene and renderer ecosystem. The integration
does not ask either project to impersonate the other.

The resulting mental model is intentionally small:

> Define one persistent external-renderer layer, let CRC decide when and where
> its bitmap participates, and use the external framework normally inside it.

That boundary is broad enough to accommodate mature Three.js applications and
small enough for CRC to maintain honestly.
