# Auxiliary outputs and canvas image sources

> **Historical status: Deferred design direction; not implemented or normative.**

Status: saved design direction from the 2026-10-06 discussion; implementation
deferred. This is not an implementation commitment or a shipped behavior contract.
The user may choose to implement only selected parts; confirm that scope before
starting implementation. The delivery section records a possible future sequence,
not authorization to execute it. Performance and bundle-size statements below are
acceptance requirements for any adopted capabilities, not measured results.

## Intent and boundaries

One Pibbl mount evaluates one component tree and owns one state, layout, scheduler,
interaction ledger, and animation timeline. Auxiliary canvases receive alternate
rasterizations of that same logical drawing. Components, hooks, custom primitive
callbacks, and simulation advancement are not repeated per output.

The primary canvas retains existing sizing, event, focus, and layout behavior.
Auxiliary outputs are passive. They do not add event listeners for user input,
independent layouts, mounts, or animation loops.

A magnifier uses a separate application-owned HTMLCanvasElement positioned above
the primary canvas with CSS. Set pointer-events: none for input pass-through;
CSS can provide a circular clip, border, and shadow. It is never part of the
scene it magnifies. No PrimaryOutput, CanvasImage, Magnifier, or routing component
is added. Existing Image gains canvas sources and source cropping independently.

## Public APIs

### Optional auxiliary-output installation

Tree shaking is a first-class requirement: applications must pay only for the
capabilities they import and use. An ordinary config property cannot by itself
make its implementation tree-shakeable if pibbl statically imports that service.
Therefore mount-time registration uses an explicit opt-in factory:

```tsx
import { pibbl, auxiliaryOutputs } from "@pibbl/core";

pibbl(primaryCanvas, <App />, {
  auxOutputs: auxiliaryOutputs([
    previewCanvas,
    {
      canvas: detailCanvas,
      width: 200,
      height: 200,
      pixelRatio: "device",
      zoom: 4,
      sourceX: 100,
      sourceY: 80,
    },
  ]),
});
```

This refines the earlier raw-array configuration to avoid coupling the feature
implementation into every mount. The descriptor carries its private installer;
the baseline runtime contains only a small generic optional-service seam, with
no imports of the auxiliary renderer. No global registration side effects.

```ts
type PibblAuxOutput =
  HTMLCanvasElement | OffscreenCanvas | PibblAuxOutputOptions;

interface PibblAuxOutputOptions {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly width: SignalValue<number>;
  readonly height: SignalValue<number>;
  readonly pixelRatio?: SignalValue<PibblPixelRatio>;
  readonly zoom?: SignalValue<number>;
  readonly sourceX?: SignalValue<number>;
  readonly sourceY?: SignalValue<number>;
}

// Opaque immutable definition, with no public lifecycle methods.
interface PibblAuxOutputsDefinition {
  /* private brand */
}

function auxiliaryOutputs(
  outputs: readonly PibblAuxOutput[],
): PibblAuxOutputsDefinition;

// New optional PibblConfig member:
// auxOutputs?: PibblAuxOutputsDefinition

function useAuxOutput(output: PibblAuxOutput): void;
```

The factory captures membership without allocating surfaces, subscribing,
compiling WASM, or starting work. Each mount owns its installed registrations.
The same canvas cannot have multiple live writers. Public selectors do not
change return types or capability sets; these are one coherent output contract.

### Sizing and projection

Bare HTML canvases mirror the primary logical viewport into their measured CSS
content box with centered contain fitting and device pixel ratio. Bare
OffscreenCanvas dimensions at attachment establish its logical output size;
device pixel ratio supplies backing density. Capture those initial dimensions
once so runtime resizing cannot feed back into logical sizing. OffscreenCanvas
has no CSS resize observation. Primary viewport changes update mirror fitting.

Explicit descriptors use width/height as output logical dimensions, independent
of primary layout. pixelRatio defaults to 'device', zoom to 1, sourceX/sourceY
to 0. Source coordinates are root-logical, not component-local or backing pixels.

```text
outputX = (rootX - sourceX) * zoom
outputY = (rootY - sourceY) * zoom
backingWidth  = max(1, round(width  * pixelRatio))
backingHeight = max(1, round(height * pixelRatio))
```

A 200-by-200 output at zoom 4 views 50-by-50 source units. At density 2 it owns
400-by-400 backing pixels. Increasing zoom narrows the view, not the bitmap.
Explicit sizing does not set application-owned HTML CSS. Width/height are finite
and nonnegative; a zero axis suspends paint. Zoom and numeric density are finite
and positive. Source coordinates are finite. No automatic resolution reduction.

### Hook ownership and scheduling

useAuxOutput installs the service only for mounts that use the hook. One hook
slot owns one attachment. Equivalent option objects cause no detach or extra
frame. Canvas replacement retires the old registration and activates the new one
at the next safe frame boundary. Mount-config membership is mount-time only;
its descriptor signals remain live.

Registration commits only after successful traversal and requests one following
frame. A newly attached output has a one-frame warmup; its pixels are not valid
as a new mirror until it first paints. Each active frame freezes its destination
list and projection settings before paint. Direct signal settings are sampled
before paint; changes discovered during component evaluation apply next frame.
No half-frame attachment or projection change. Unchanged settings do not cause
continuing frames.

Unmount, root disposal, and fail-closed owner teardown automatically unregister
the output, remove signal and size/density subscriptions, release output-owned
intermediates and observers, and invalidate queued activation/update work.
Unmount before activation must never leave a later attachment. Cleanup is
idempotent. Caller-owned canvases survive with their last pixels; shared fonts,
textures, physics worlds, and other application resources are not disposed by
output removal. Removed destinations receive no paint in subsequent frames.

### Existing Image extensions

```tsx
<Image
  style={{
    src: externalCanvas,
    sourceRect: { x: 100, y: 80, width: 200, height: 150 },
    x: 20,
    y: 20,
    width: 400,
    height: 300,
  }}
/>
```

Extend the existing Image style src from string to
string | HTMLCanvasElement | OffscreenCanvas. Add optional style.sourceRect with
finite numeric x/y and nonnegative width/height in source-image pixels. It crops
the source before mapping into the ordinary logical destination box. Omission
uses the complete source. Zero source extent paints nothing; out-of-source
sampling follows native drawImage clipping. Cropping does not change destination
hit geometry or layout. For URL sources, units refer to decoded natural image
pixels. For canvases, units refer to backing pixels.

Preserve existing natural-size behavior: when destination dimensions are omitted,
the selected source rectangle supplies natural dimensions, or the entire source
if uncropped. Canvas dimensions become available synchronously during painting;
pure measurement still must not acquire resources or execute rendering. Explicit
destination dimensions are recommended when the source has high-density backing.

Add optional Image prop revision: SignalValue<number>. External producers update
it after changing canvas pixels to request repaint. It is an invalidation token,
not a snapshot ID. Source pixels are read at paint time. Source identity changes
also update paint; arbitrary canvas mutation does not itself notify Pibbl.
Canvas sources are borrowed: Image never resizes, transfers, or disposes them.
Existing URL loading, race handling, and source replacement cleanup remain intact.

No automatic routing: ordinary canvas images paint into all active destinations.
Image rejects a source that is the primary or an active auxiliary canvas of the
same mount. Validate new output attachments against existing source dependencies
as well, so an attachment cannot silently introduce feedback. Raw-context
self-copy operations under multiplexing also require a clear unsupported-operation
diagnostic. Cross-mount canvas dependencies are externally scheduled; no automatic
cross-mount render propagation or cycle resolution is promised.

## Floating magnifier example

```tsx
import {
  pibbl,
  signal,
  useAuxOutput,
  useComputed,
  type Signal,
} from "@pibbl/core";

const center = signal({ x: 300, y: 200 });
const zoom = signal(4);

function LensOutput({
  canvas,
  center,
  zoom,
}: {
  canvas: HTMLCanvasElement;
  center: Signal<{ x: number; y: number }>;
  zoom: Signal<number>;
}) {
  const sourceX = useComputed(
    () => center.get().x - 100 / zoom.get(),
    [center, zoom],
  );
  const sourceY = useComputed(
    () => center.get().y - 100 / zoom.get(),
    [center, zoom],
  );
  useAuxOutput({
    canvas,
    width: 200,
    height: 200,
    pixelRatio: "device",
    zoom,
    sourceX,
    sourceY,
  });
  return null;
}

// Both elements are application-owned, in a positioned HTML wrapper.
pibbl(
  primaryCanvas,
  <>
    <Scene />
    <LensOutput canvas={lensCanvas} center={center} zoom={zoom} />
  </>,
);
```

```css
.canvas-wrapper {
  position: relative;
}
.lens {
  position: absolute;
  width: 200px;
  height: 200px;
  left: 20px;
  top: 20px;
  border-radius: 50%;
  pointer-events: none;
}
```

Application event handling updates center/zoom and, if desired, CSS lens position.
Root-logical source coordinates and wrapper-local CSS position are different
spaces; use the primary surface projection when converting between them.
Conditionally mounting LensOutput toggles attachment without conditional hooks.
The auxiliary output itself is the lens; Image is not needed for this example.

## Rendering architecture and compatibility

With no active auxiliary outputs, useCanvasContext returns the actual current
native context exactly as today, including existing local filter/Layer contexts.
No proxy, forwarding wrapper, fan-out list, or per-draw auxiliary check is added
to that path. Select the rendering path at frame/render-target entry. Detaching
the final output restores the direct path on the next render.

With outputs, reuse an explicit multiplexing context. Forward paint, path,
property writes, save/restore, clipping, and transforms. Reads use the primary
logical context as authority. setTransform/resetTransform must preserve each
destination's base projection. Native-resource creation needs destination-aware
handling, rather than blindly returning one context's resource. Never duplicate
component or primitive callback execution.

The wrapper is not a native context instance. Contexts cannot be retained across
renders. Establish and test a compatibility matrix before feature completion:
transform reads, text measurement, gradients/patterns and their mutations, paths,
pixel read/write methods, .canvas, native method binding, and self-copying.
Unsupported cases must fail explicitly, not silently produce incorrect mirrors.
This design approves that explicit compatibility boundary; it does not claim
universal native-context emulation has already been demonstrated.

Layers and filters must render at sufficient destination resolution or retain
per-output intermediates; primary-resolution bitmap enlargement is insufficient.
Preserve logical layout and events, paint order, clips, opacity, blend operations,
filter overflow, and resource ownership. No retained command list is introduced.
Projection-only changes can require a normal source traversal; clipping alone
does not eliminate draw submissions. Output failures follow existing fail-closed
render recovery; no multi-canvas pixel rollback or atomic browser presentation
is promised. Scope restores and registration cleanup must remain exact.

## WASM and raster limits

HarfBuzz geometry is shared and painted at each output resolution. Rapier and
texture simulations advance once per scheduled state update, independent of output
count. Share the same committed state/raster generation. Do not create WASM
instances or duplicate memories just to attach outputs.

Generated texture pixels, source images, and external render-layer bitmaps remain
limited by their source resolution. Increasing simulation grid density may change
simulation behavior and is not an automatic magnifier operation. Three alternate
camera/detail rendering requires a future external-render-layer extension.
HtmlBox/native DOM content is not mirrored. Sharpness means rerasterizing supported
vector content at output density, not recovering missing raster detail.

## Tree-shaking and pay-for-use requirements

- Root barrel exports remain side-effect free. Importing pibbl or unrelated
  primitives must not retain auxiliary context forwarding, projection services,
  hook registration, or canvas-image-only helpers.
- auxiliaryOutputs and useAuxOutput explicitly carry/install their shared feature
  implementation; baseline runtime must not statically import it. Types erase.
- Importing Image may include its canvas-source and cropping branches; applications
  not using Image must not retain that component or those helpers. Source-type
  branches inside a used Image are not promised to shake independently.
- No auxiliary feature imports textures, text shaping, physics, Three, their WASM
  bytes, or optional filter processors. Sharing an existing resource does not
  justify eager installation of that resource's feature.
- No module-evaluation Canvas allocation, WASM compilation, listeners, or scheduler
  registration. With no active outputs there is no fan-out execution overhead.
- Add production bundle probes for minimal core, Image-only, mount-config outputs,
  hook-only outputs, and combined use. Assert absence of unused implementation
  markers and WASM modules; record bundle deltas, not merely source import claims.
- Verify root/subpath packaging, packed consumers, Bundler and NodeNext types,
  and Studio declarations. Do not rely on sideEffects metadata alone as evidence.

## Use cases and exclusions

Supported patterns include floating loupes, precision drawing inspection, chart
region detail on a separate canvas, overview/minimap canvases, multiple inspection
panels, passive presentation mirrors, synchronized tiled displays, thumbnails,
resolution comparisons, and high-density raster export sources. Browser recording
or export uses existing browser APIs after an output has painted; this feature
does not add capture/export orchestration or a frame-ready API.

Image canvas sources independently support externally drawn diagrams, simulation
rasters, canvas-based picture-in-picture, and cropped sprite/atlas regions.

No per-output content exclusion is provided. A clean recording can exclude
application-owned DOM controls, but cannot omit controls painted inside the shared
Canvas scene. No independent responsive layout, mirrored DOM, lens input forwarding,
interactive secondary mount, feedback renderer, or new worker architecture.

## Delivery and evidence

First deliver a runnable public scenario: one floating HTML magnifier, sharp shapes
and text, moving source window, hook attach/detach, and native-context fallback.
Begin with a focused failing public test, implement the slice, then provide its
exact Studio URL for hands-on feedback. Do not begin broad hardening before that
feedback unless needed to make the slice correct.

After feedback, cover frame-consistent signals, source coordinates and density,
zero sizes, ownership conflicts, mount failure, unmount before activation, canvas
replacement, root disposal, last-output native fallback, and no post-detach paint.
Prove one component/hook evaluation independent of output count and unchanged
physics/texture advancement and WASM ownership. Add Image canvas/crop/revision and
feedback tests, transforms/clips/Layer/filter evidence, compatibility diagnostics,
and the tree-shaking probes above. Inspect sharpness pixels only after semantic
geometry and counters pass. Benchmark fan-out and lens movement with representative
scenes; report measured results separately from design expectations.

Update shipped contracts only when implementation exists. Complete proportional
package/browser verification and public declarations before calling the feature
complete. Preserve unrelated work in this checkout.
