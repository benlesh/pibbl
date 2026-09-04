# CRC responsive high-density Canvas surface design

> **Historical status: IMPLEMENTED DESIGN RECORD.** Original proposal or approval wording below is preserved; current behavior lives in `docs/design/`.

Status: approved for implementation on 2026-08-19

Date: 2026-08-19

## Summary

CRC will own the relationship between a Canvas scene's logical coordinate
space, the element's displayed CSS size, and its physical backing-store
resolution. A mount will render at the effective device-pixel density by
default, observe display-size and density changes, and preserve one coherent
geometry model across paint, layout, clipping, interaction, and offscreen
layers.

The default is a fixed logical viewport captured from the Canvas element's
initial `width` and `height` attributes. CRC fits that viewport into the CSS
content box with `contain` and renders it at `window.devicePixelRatio`. Callers
can instead request a responsive viewport whose logical dimensions follow the
CSS content box exactly. Fixed viewports also support the familiar `cover`,
`fill`, `none`, and `scale-down` projection modes.

After mount, `canvas.width` and `canvas.height` are physical backing-store
dimensions owned by CRC. They are no longer the public source of logical scene
dimensions. Components obtain logical allocations through normal layout and
`crcLayoutBox()`.

## Goals

- Make crisp rendering the default on high-density and responsively sized
  displays.
- Keep logical geometry independent from backing-store pixels.
- Preserve a fixed-design workflow for scenes such as the Studio's 720×420
  lessons without requiring configuration.
- Offer an explicit responsive workflow in which one logical unit equals one
  CSS pixel and layout reflows as the Canvas display size changes.
- Keep paint, interaction, clipping, layout placement, and layers aligned under
  every supported fit mode.
- Coalesce surface changes into CRC's scheduled render lifecycle and release
  every observer/listener deterministically.
- Provide a numeric pixel-ratio override for deterministic tests, screenshots,
  and applications that choose a rendering-cost cap.

## Non-goals

- CSS layout ownership beyond measuring the Canvas content box and stabilizing
  a Canvas whose display size otherwise feeds back from its backing attributes.
- Automatic choice between fixed and responsive application layout.
- Configurable projection alignment in the first release. Fixed projections
  are centered on both axes.
- Physically snapping every logical stroke after an arbitrary fractional or
  anisotropic fit transform. Existing logical pixel-grid alignment remains in
  force; Canvas rasterization remains authoritative.
- Re-rasterizing a `layer` for arbitrary component-local scale, rotation, or
  skew. Layers inherit root surface density, while additional transforms retain
  the normal limitations of transformed raster content.
- Pointer, touch, keyboard, accessibility, worker rendering, or WebGL changes.

## Public API

The public mount configuration becomes a discriminated union:

```ts
export type CRCFit = "contain" | "cover" | "fill" | "none" | "scale-down";

export type CRCPixelRatio = "device" | number;

export interface CRCFixedViewportConfig {
  signal?: AbortSignal;
  viewport?: Readonly<{
    width: number;
    height: number;
  }>;
  fit?: CRCFit;
  pixelRatio?: CRCPixelRatio;
}

export interface CRCResponsiveViewportConfig {
  signal?: AbortSignal;
  viewport: "responsive";
  pixelRatio?: CRCPixelRatio;
}

export type CRCConfig = CRCFixedViewportConfig | CRCResponsiveViewportConfig;
```

`crc(canvas, root)` is equivalent to capturing this configuration before the
first backing-store mutation:

```ts
{
  viewport: {
    width: canvas.width,
    height: canvas.height,
  },
  fit: "contain",
  pixelRatio: "device",
}
```

The initial Canvas dimensions used for a default fixed viewport must both be
positive; a zero-valued initial attribute requires an explicit viewport instead.
An explicitly supplied fixed viewport requires finite positive dimensions. A
numeric pixel ratio must be finite and greater than zero. Invalid values throw
actionable mount-time errors before CRC acquires observers or mutates the
Canvas.

`fit` is absent from the responsive union because it has no coherent effect
when the logical viewport already equals the CSS content box. TypeScript rejects
that meaningless combination, and runtime validation rejects it for untyped
callers.

The surface configuration belongs to the initial mount, like `signal` does
today. Later `crc(canvas, root, config?)` calls update the root but do not replace
the mounted surface configuration. Changing surface policy requires disposing
and remounting. This prevents an omitted configuration on an ordinary update
from resetting the surface accidentally.

The public index exports `CRCConfig`, `CRCFit`, `CRCPixelRatio`,
`CRCFixedViewportConfig`, and `CRCResponsiveViewportConfig`.

## Surface state

Every root `CRCInstance` owns one surface record. Internal layer instances own
derived records without DOM observers.

```ts
interface CRCSurface {
  mode: "fixed" | "responsive";
  logicalWidth: number;
  logicalHeight: number;
  displayWidth: number;
  displayHeight: number;
  backingWidth: number;
  backingHeight: number;
  requestedPixelRatio: "device" | number;
  backingPixelsPerCssPixelX: number;
  backingPixelsPerCssPixelY: number;
  backingPixelsPerLogicalUnitX: number;
  backingPixelsPerLogicalUnitY: number;
  fit: CRCFit;
  renderTransform: DOMMatrix;
  inverseRenderTransform: DOMMatrix;
}
```

The display dimensions are fractional CSS-pixel content-box dimensions. The
backing dimensions are integer physical-pixel dimensions:

```text
backingWidth  = round(displayWidth  × requested pixel ratio)
backingHeight = round(displayHeight × requested pixel ratio)
```

For a visible surface, each backing dimension is at least one. Backing-per-CSS
ratios use the rounded backing dimensions divided by the exact display
dimensions, so the render transform covers the backing bitmap without a
fractional unpainted edge. Backing-per-logical-unit ratios additionally include
the selected fit scale. Internal raster layers use the latter values so a fixed
scene enlarged by `contain` receives enough source pixels.

The record is immutable per committed surface revision. A render reads one
coherent snapshot; observer callbacks cannot change its geometry during tree
traversal.

## Display-size ownership and observation

Root HTML Canvas mounts install one `ResizeObserver`. Its content-box size is
authoritative. The initial synchronous measurement uses the computed content
box so the first scheduled render does not wait for an observer delivery.
Borders and padding are excluded from scene dimensions and pointer conversion.

Changing `canvas.width` or `canvas.height` resets the Canvas 2D context. CRC
writes those attributes only when the desired backing dimensions changed and
then reconstructs the render state for that frame.

An unstyled Canvas derives its CSS intrinsic size from the same backing
attributes. Blindly increasing those attributes would therefore enlarge the
element, trigger another resize, and create a feedback loop. CRC handles this
case as follows:

1. Measure the content box before changing the backing dimensions.
2. Change the backing attributes.
3. Measure again in the same layout turn.
4. If an axis changed as a direct intrinsic-size consequence, set that axis's
   inline CSS size to the pre-mutation display size.

CRC records any inline style it owns. Disposal restores the prior inline value
only if the application has not replaced CRC's owned value. Stylesheet-driven
responsive sizes such as `width: 100%` do not change when backing attributes
change, so CRC does not freeze them.

Device-density mode reads `window.devicePixelRatio`. CRC observes density
changes with a resolution media query and a window resize fallback, recreating
the media query after each change. Numeric pixel-ratio mode installs no density
observer. All observer/listener resources belong to the root mount and release
exactly once on abort, disposal, or render-failure teardown as appropriate.

A ResizeObserver or density callback never renders synchronously. It records
the latest surface input and requests the same coalesced animation-frame update
used by state and root changes.

## Fixed viewport projection

Let the fixed logical viewport be `(Lw, Lh)` and the CSS content box be
`(Dw, Dh)`. The CSS-space scene scale is:

| Fit mode     | CSS scale                                   |
| ------------ | ------------------------------------------- |
| `contain`    | `s = min(Dw / Lw, Dh / Lh)` on both axes    |
| `cover`      | `s = max(Dw / Lw, Dh / Lh)` on both axes    |
| `fill`       | `sx = Dw / Lw`, `sy = Dh / Lh`              |
| `none`       | `sx = sy = 1`                               |
| `scale-down` | `s = min(1, Dw / Lw, Dh / Lh)` on both axes |

The projected scene is centered:

```text
offsetX = (Dw - Lw × sx) / 2
offsetY = (Dh - Lh × sy) / 2
```

The backing transform first converts CSS pixels to rounded backing pixels, then
applies the projection:

```text
renderTransform = backingPerCss × translate(offsetX, offsetY) × scale(sx, sy)
```

`contain`, `none`, and `scale-down` may leave transparent letterbox space.
`cover` may paint beyond the content box and is clipped by the backing bitmap.
`fill` can distort geometry deliberately. The root layout allocation remains
exactly `(0, 0, Lw, Lh)` in every fixed fit mode.

## Responsive viewport projection

For `viewport: "responsive"`, the logical root allocation is
`(0, 0, displayWidth, displayHeight)`. One logical unit equals one CSS pixel.
The render transform only converts CSS pixels to rounded backing pixels:

```text
renderTransform = scale(
  backingWidth / displayWidth,
  backingHeight / displayHeight
)
```

A CSS resize therefore changes layout allocations and percentage bases. It does
not scale a previously laid-out fixed scene. State and keyed component identity
remain mounted across the reflow.

## Zero-size behavior

CSS can legitimately collapse or hide a Canvas. A surface with a zero display
width or height has no invertible projection. CRC records the latest root and
surface inputs but defers rendering until both axes are positive. Existing
component state and resources remain mounted; a temporary zero size is not a
removal or disposal signal. When the surface becomes visible, the latest
coalesced root renders once against the new allocation.

Mouse events received while either display axis is zero have no CRC region
target. Canvas-wide native observers still receive their original event through
the existing observer contract.

## Render pipeline

Each root render performs these surface steps before component traversal:

1. Resolve the latest display size and requested pixel ratio into one immutable
   surface snapshot.
2. If needed, update the backing attributes, reacquire/reset the 2D context,
   and stabilize intrinsic CSS sizing.
3. Reset the context transform to identity and clear the entire physical
   backing bitmap.
4. Install `surface.renderTransform`.
5. Set the root layout box to the fixed viewport or responsive display size.
6. Traverse the component tree with the existing save/restore isolation and
   source paint order.

The root transform is therefore present when every component begins. `g`
continues composing from `ctx.getTransform()`, so component-local transforms
remain relative to the surface transform. Render completion restores the
context to a known identity state; later hit testing never depends on leftover
paint state.

A surface resize is an update, not a remount. Component refs, hook state, keyed
identity, cursor ownership, and event registrations survive. Render failure
retains the existing fail-closed semantics: it releases the component tree but
leaves the mount-owned surface observers live. A later explicit root update can
therefore recover against the latest surface, matching the existing runtime
recovery contract.

## Interaction coordinates and transform normalization

Public `CRCMouseEvent.x` and `.y` become logical root coordinates, independent
of backing-store dimensions.

Mouse-coordinate conversion proceeds through the same surface model as paint:

1. Convert `clientX/Y` to Canvas CSS content-box coordinates, excluding border
   and padding.
2. Convert CSS coordinates to backing coordinates with the effective rounded
   backing-per-CSS ratios.
3. Apply `surface.inverseRenderTransform` to obtain logical root coordinates.

In responsive mode this reduces to CSS content-box coordinates. In fixed modes
it reverses fit scale and centering. Points in `contain` letterboxing can
therefore have negative or greater-than-viewport logical coordinates and cannot
hit a viewport-contained region.

Paint-time interaction transforms and clip transforms must not retain the root
backing transform. Whenever CRC captures `ctx.getTransform()`, it stores:

```text
logicalTransform = inverse(renderTransform) × currentContextTransform
```

Hit testing then uses logical points and logical transforms only. The hit-test
context sets its transform unconditionally, including identity, so no root
paint transform can leak into geometry tests. Layout placement, `g`, `clip`, and
layer composition continue multiplying in their existing source order.

This replaces the old public promise that event coordinates equal intrinsic
backing-Canvas coordinates. The new promise is stable logical-root coordinates;
backing resolution is deliberately unobservable geometry.

## Offscreen layers

A `layer`'s declared width and height remain logical. Its internal
`OffscreenCanvas` receives a derived surface with that logical viewport and the
root surface's backing-pixels-per-logical-unit X/Y values. It owns no
`ResizeObserver`, media query, or window listener.

The layer backing dimensions are the rounded products of its logical dimensions
and inherited logical-unit densities. Layer rendering installs its own density
transform. Parent composition uses the full-source/full-destination overload:

```ts
ctx.drawImage(
  offscreen,
  0,
  0,
  offscreen.width,
  offscreen.height,
  0,
  0,
  logicalWidth,
  logicalHeight,
);
```

Interaction and clipping transforms captured inside the layer are normalized
against the layer's render transform. The parent layer entry stores its own
normalized logical transform, so root density is neither omitted nor applied
twice during recursive hit testing.

A root density or fit-scale change resizes and rerenders live layers in the same
root frame. Arbitrary transforms applied outside a layer can still magnify its
rasterized result; dynamically choosing a layer resolution from general affine
transforms is outside this design.

## Pixel-grid alignment

Existing `alignToPixelGrid` modes continue snapping in logical Canvas units
before the surface transform. They do not promise physical-device-pixel
alignment after fractional `contain`, `cover`, `fill`, or `scale-down`
projection. Rendering at the correct backing density removes bitmap
upscaling blur; browser Canvas antialiasing still handles fractional physical
edges.

A future physical-grid feature would need to account for the complete current
transform and is deliberately separate from this surface design.

## Updates, ownership, and errors

- Surface observers and any CRC-owned inline sizing belong to the root mount.
- Internal layer surfaces belong to their layer component refs.
- Repeated observer reports with equal effective inputs do not schedule
  additional work.
- Multiple CSS-size, density, state, and explicit-root changes before a frame
  coalesce; the latest inputs win and the parent-update flag remains OR-sticky.
- Disposal cancels pending animation work, disconnects the ResizeObserver,
  removes density listeners, restores still-owned inline styles, clears
  interaction ownership, and disposes layers through existing teardown paths.
- Unsupported or invalid explicit surface configuration throws before external
  resource acquisition.
- A missing platform `ResizeObserver` produces a targeted mount error rather
  than silently promising responsive behavior CRC cannot maintain. Unit tests
  provide the platform mock; supported browsers provide the native API.

## Studio and scenario adoption

The learning Studio and its sandbox runner require no per-example configuration.
Their existing `width="720" height="420"` attributes define the fixed logical
viewport, while responsive CSS determines display size. Default `contain` and
device density make those lessons crisp without changing example geometry.

The Studio hero Canvas receives the same default behavior. Deterministic test
laboratories retain their declared logical sizes. A new focused surface
laboratory demonstrates fixed fits, responsive reflow, DPR/backing dimensions,
and logical mouse coordinates through the public API. Learning-example and
test-laboratory catalogs remain separate.

## Verification strategy

### Pure geometry tests

A pure surface resolver proves exact logical size, projection scale, offsets,
backing dimensions, effective ratios, render transform, and inverse transform
for:

- every fixed fit mode;
- responsive mode;
- fractional CSS dimensions;
- numeric and device pixel ratios;
- portrait/landscape aspect mismatches; and
- equal inputs that should preserve surface identity.

### Runtime ownership tests

Controlled Canvas, ResizeObserver, media-query, and animation-frame fixtures
prove:

- default initial-dimension capture before backing mutation;
- explicit fixed and responsive allocations;
- backing changes and full identity-space clears;
- root transform installation and composition with `g`;
- intrinsic CSS feedback stabilization and disposal restoration;
- observer/density update coalescing;
- zero-size deferral and recovery;
- invalid-config fail-fast behavior;
- stable controller/component identity across surface changes; and
- exact observer/listener teardown on dispose, abort, and failure.

### Interaction and composition tests

Public-API geometry tests prove logical event coordinates and topmost targeting
under CSS scale, border/padding, letterboxing, every fit transform, layout
placement, `g`, `clip`, and nested `layer`. Layer tests also assert physical
backing size and single application of logical transforms.

### Browser and visual evidence

The surface laboratory runs headlessly with numeric pixel ratio 2 and asserts:

- CSS display size;
- doubled physical backing dimensions;
- fixed logical layout and responsive reflow;
- pointer coordinates returned in logical units; and
- stable output after a live CSS resize.

A browser case using device density checks the backing/display relationship
against the actual `window.devicePixelRatio`. Existing Studio baselines remain
at their controlled environment density unless an intentional geometry change
requires inspected updates. A visual comparison adds value only if it proves
the absence of browser resampling beyond the semantic backing and transform
assertions; baselines must not be rewritten merely to turn the gate green.

Final verification runs the repository's aggregate trust gate with the
documented Node 24 and pnpm 11.21.0 environment.

## Contract documentation updates

Implementation updates these normative contracts alongside code:

- `docs/design/runtime-hooks-contract.md` for mount configuration, surface
  lifecycle, root allocation, and render scheduling;
- `docs/design/mouse-interaction-contract.md` for logical root coordinates and
  fit inversion;
- `docs/design/drawing-components-contract.md` for density-aware layers and the
  logical pixel-grid boundary;
- `docs/design/layout-system-contract.md` for fixed versus responsive root
  percentage bases; and
- `AGENTS.md` for the compact current runtime model and verification-relevant
  surface behavior.

## Success criteria

The work is complete when:

1. Default CRC mounts render a fixed initial logical viewport into their CSS
   content box at device density with centered `contain` projection.
2. Every declared fit mode follows the exact projection table.
3. Responsive mode uses CSS content-box dimensions as logical root dimensions
   and reflows without remounting state.
4. CSS-size and device-density changes coalesce into scheduled rerenders.
5. Backing dimensions, render transforms, mouse coordinates, clips, layout,
   and nested layers agree under the same surface revision.
6. Zero-size, intrinsic-sizing feedback, invalid configuration, teardown, and
   render-failure behavior are deterministic and tested.
7. The Studio lessons render sharply at responsive sizes without per-example
   surface configuration.
8. Public exports, declarations, package consumers, source/built browser modes,
   Studio editor declarations, scenarios, and contract documents agree.
9. Focused tests and the fresh aggregate trust gate pass without weakening
   visual safeguards.
