# First-class filters design

> **Historical status: IMPLEMENTED DESIGN RECORD.** Original approved wording below is preserved; current behavior lives in the linked design contracts and API reference.

Status: approved for implementation on 2026-09-08.

## Summary

CRC will add a typed, local `style.filter` capability to every CRC primitive.
It covers the ten standardized CSS filter functions that can be represented by
Canvas 2D: blur, brightness, contrast, drop shadow, grayscale, hue rotation,
invert, opacity, saturation, and sepia. A filter applies to the combined
rendered silhouette of the receiving primitive and all descendants it returns,
not independently to each fill, stroke, line, glyph, image, or child draw.

The renderer implements a filter as an immediate-mode composition boundary.
It renders the receiving subtree once into an upright local `OffscreenCanvas`,
uses the browser's native Canvas `filter` pipeline while drawing that source to
a second local surface, and transforms the filtered result exactly once when it
is composited into its parent. No retained display list, JavaScript pixel loop,
`getImageData`, shrink-and-resize blur, or `ImageBitmap` conversion is added.

This feature also establishes a renderer-wide invariant for runtime-created
offscreen surfaces: each surface represents content in its own upright local
coordinate system; effects run there; the result receives its parent-facing
transform only when composited. The existing persistent `Layer` surface follows
the same invariant, while filter surfaces are transient and reusable.

## Goals

- Add CSS-like filters to path, text, image, composition, layout, and custom
  primitives through one typed local style property.
- Derive drop shadows and every other filter from the combined subtree output.
- Preserve ordered CSS filter-list behavior and inside-out nested filtering.
- Make filter direction, radius, and offsets local to the receiving primitive,
  so rotation and nonuniform scaling affect the filtered result naturally.
- Preserve immediate-mode execution, one component traversal per frame, source
  paint order, component identity, root-logical interaction coordinates, and
  exact resource ownership.
- Use native browser filter rasterization without pixel readback.
- Provide public-package, browser, learning-example, deterministic-scenario,
  lifecycle, and structural-performance evidence.

## Non-goals

- CSS `box-shadow`, including border-box geometry, spread radius, inset shadows,
  multiple shadow stacking rules, or box-decoration semantics.
- CSS `url()` filters, SVG filter graphs, external filter resources, or custom
  shader/filter registration.
- `backdrop-filter`, which samples already-composited content behind an element
  and requires a different rendering architecture.
- Raw CSS filter strings, CSS variables, `currentColor`, cascade, inheritance,
  or a general CSS parser.
- Filter pixels contributing to measurement, layout allocation, hit testing,
  focus bounds, or pointer geometry.
- A retained scene graph, retained drawing commands, automatic subtree caching,
  or a public offscreen-surface API.
- Exact cross-browser pixel identity for browser-owned blur and color math.

## Public API

The root `@crc/core` entry exports the union and each named descriptor type:

```ts
export interface CRCBlurFilter {
  type: "blur";
  radius: number;
}

export interface CRCBrightnessFilter {
  type: "brightness";
  amount: number;
}

export interface CRCContrastFilter {
  type: "contrast";
  amount: number;
}

export interface CRCDropShadowFilter {
  type: "dropShadow";
  offsetX: number;
  offsetY: number;
  blurRadius?: number;
  color: string;
}

export interface CRCGrayscaleFilter {
  type: "grayscale";
  amount: number;
}

export interface CRCHueRotateFilter {
  type: "hueRotate";
  degrees: number;
}

export interface CRCInvertFilter {
  type: "invert";
  amount: number;
}

export interface CRCOpacityFilter {
  type: "opacity";
  amount: number;
}

export interface CRCSaturateFilter {
  type: "saturate";
  amount: number;
}

export interface CRCSepiaFilter {
  type: "sepia";
  amount: number;
}

export type CRCFilter =
  | CRCBlurFilter
  | CRCBrightnessFilter
  | CRCContrastFilter
  | CRCDropShadowFilter
  | CRCGrayscaleFilter
  | CRCHueRotateFilter
  | CRCInvertFilter
  | CRCOpacityFilter
  | CRCSaturateFilter
  | CRCSepiaFilter;

export interface SystemStyle {
  custom?: unknown;
  filter?: CRCFilter | readonly CRCFilter[];
}
```

Because every public primitive style extends `SystemStyle`, no built-in needs a
separate filter property. Ordinary component functions do not independently
receive style metadata; authors put the filter on a primitive returned by the
component, including a `Group` when they need one boundary around several
siblings.

One descriptor is normalized to a one-item list. An empty list is exactly a
no-op: it performs no capture and does not require `OffscreenCanvas` or Canvas
filter support. Descriptor objects and caller-owned arrays are not mutated.

Example:

```tsx
<Group
  style={{
    rotationDegrees: 20,
    filter: [
      { type: "grayscale", amount: 1 },
      {
        type: "dropShadow",
        offsetX: 8,
        offsetY: 8,
        blurRadius: 6,
        color: "rgb(0 0 0 / 45%)",
      },
      { type: "blur", radius: 3 },
    ],
  }}
>
  <Rectangle style={{ x: 20, y: 20, width: 80, height: 60, fill: "coral" }} />
  <Text style={{ x: 32, y: 56, fill: "white" }}>CRC</Text>
</Group>
```

## Validation and normalization

Filter validation is framework-owned and runs during render style resolution,
before the receiving primitive callback executes. Custom `normalizeStyle` and
`resolveStyle` callbacks cannot accidentally discard the system filter:
render dispatch extracts it from the authoritative specified or pre-normalized
system style and carries the canonical list alongside the custom style stages.
The primitive callback continues to see the public descriptor representation;
private compiled data stays in renderer metadata.

The numeric rules are:

- `blur.radius` is finite and nonnegative.
- `dropShadow.offsetX` and `offsetY` are signed finite numbers.
- `dropShadow.blurRadius` defaults to `0` and is finite and nonnegative.
  Both blur fields represent Gaussian standard deviation, matching CSS filter
  functions rather than CSS `box-shadow` blur-radius semantics.
- `brightness.amount`, `contrast.amount`, and `saturate.amount` are finite and
  nonnegative; values greater than `1` are preserved.
- `grayscale.amount`, `invert.amount`, `opacity.amount`, and `sepia.amount` are
  finite and nonnegative; values greater than `1` normalize to `1`.
- `hueRotate.degrees` is any finite number and is not modulo-normalized.
- Amounts are ratios, so `1` means 100 percent.

The drop-shadow color must be a concrete CSS color accepted by the active
browser's Canvas filter parser. `currentColor`, `var(...)`, and other contextual
CSS references are rejected. Native parsing remains authoritative for supported
color syntaxes. Validation identifies `filter`, the list index when present,
the descriptor field, the received value, and the receiving component in an
actionable `LayoutDiagnostic`-family message.

CRC compiles a valid list to one native Canvas filter string. It emits `px` for
blur radii and offsets, `deg` for hue rotation, and unitless ratios for amounts.
The generated string is assigned only to a local result context that CRC owns.
The runtime verifies the `filter` property exists and that the browser accepts
the generated value. An unsupported or rejected value fails before the
primitive callback and names the missing Canvas filter capability.

Pure measurement ignores `filter`: it neither validates browser filter support
nor allocates an offscreen surface. Filters do not turn unsupported intrinsic
measurement into supported measurement and do not change a measured size.

## Filter-list and nested-boundary semantics

The functions in one list consume the output of the preceding function in
declaration order. CRC passes the complete list to one native Canvas filter
operation; it does not allocate an intermediate surface per function.

These are deliberately order-sensitive:

```ts
filter: [
  { type: "grayscale", amount: 1 },
  { type: "dropShadow", offsetX: 8, offsetY: 8, color: "black" },
  { type: "blur", radius: 3 },
];
```

The example first grayscales the combined input, derives a shadow from that
result, and finally blurs both subject and shadow. Reordering the descriptors
changes the output.

Nested filtered primitives create distinct composition boundaries and resolve
from the inside out. Given a blurred parent, a drop-shadowed child, and a
grayscaled grandchild, traversal is:

```text
grandchild content
-> grayscale result
-> child source, together with the child's other local content
-> drop-shadow result
-> parent source, together with the parent's other local content
-> blur result
-> parent canvas
```

An inner boundary is fully composited into the next outer source before the
outer filter executes. This distinction matters when the levels add siblings,
painting, transforms, clips, opacity, or compositing between effects. Component
functions and primitive callbacks still execute once per ordinary traversal;
nested filters add bitmap composition, not repeated component execution.

## Rendering architecture

### Upright local-surface invariant

Every runtime-created offscreen surface represents an upright local coordinate
space. The renderer separates two concepts that the current context transform
previously represented together:

- the paint transform maps local drawing into the current target surface;
- the world transform maps the same local geometry into the owning CRC
  instance's root-logical interaction space.

Internal event targets, focus bounds, clipping entries, and `Layer` bridges use
the world transform. Primitive callbacks receive the real current paint
context. Inside a filtered boundary that context belongs to an
`OffscreenCanvas`; its `canvas` and `getTransform()` truthfully describe that
local target rather than pretending to be the root canvas. This is consistent
with the existing behavior inside a `Layer`.

The world-transform stack is private renderer state, restored in `finally` on
success or failure. Existing direct fast paths use the same helper so filtered
and unfiltered interaction geometry cannot drift.

### One filter boundary

For one primitive with a non-empty filter list, the renderer:

1. Resolves and validates the system filter before invoking the primitive.
2. Computes the receiving primitive's local output window, reverse-influence
   source window, and shared raster density.
3. Atomically checks out an empty source/result pair from the current CRC
   instance's scratch pool.
4. Copies inheritable drawing state needed by descendant paint into the source
   context and installs the local paint/world-transform split.
5. Invokes the primitive once and renders all returned descendants into the
   source, including already-filtered nested boundaries.
6. Draws the source once into the result with the compiled native Canvas filter
   list and identity local presentation transform.
7. Applies the receiving boundary's deferred presentation transform and clip,
   then draws the result once into the parent context.
8. Restores renderer globals and returns both scratch slots in `finally`.

There is no `getImageData`, `putImageData`, JavaScript recoloring, resampling
blur, `transferToImageBitmap`, or per-filter buffer. A source `OffscreenCanvas`
is passed directly to `drawImage`.

### Combined silhouette

The source surface contains all paint produced by the receiving primitive and
the recursive children it returns. A path's fill and stroke, multiline text,
an image's transparent pixels and border, and all descendants of a composition
or layout primitive are therefore filtered as one raster group. In particular,
`dropShadow` derives its mask from the alpha channel of that combined result.
Transparent pixels cast no shadow; overlapping descendants do not produce
separate shadow stacks.

### Presentation transforms and clips

Runtime-owned placement transforms and the receiving built-in `Group`
transform are outside that receiving filter boundary: the subtree is captured
upright, filtered, and the result is then placed/scaled/rotated/skewed. A local
circular blur therefore becomes elliptical after a nonuniform Group scale, and
a local shadow offset rotates with the Group.

An unfiltered descendant `Group` remains part of an ancestor's source and is
therefore transformed before the ancestor filter. A descendant Group with its
own filter captures in its own local coordinates, filters there, and applies its
transform when it composites into the ancestor source.

The receiving built-in `Clip` applies after its receiving filter. An ancestor
clip applies when the filtered result reaches that ancestor, while a descendant
clip is part of the captured source. The resulting order is:

```text
local subtree paint -> receiving filter -> receiving clip -> receiving transform
-> ancestor clip/alpha/compositing -> parent target
```

To support this without public API, `Group` and `Clip` publish private
presentation metadata consumed by render dispatch. Their unfiltered fast path
applies the same metadata directly and retains existing behavior. Arbitrary
transform or clip calls made from a custom primitive callback remain drawing
operations inside that custom primitive's source; CRC cannot reinterpret
imperative Canvas calls as declarative presentation properties.

### Canvas state

The source context receives relevant drawing state such as fill and stroke
styles, line settings, text state, image smoothing, and other ordinary
transform-aware paint attributes. Its transform is rebuilt for the local
capture rather than copied verbatim.

State that governs how the completed group meets its parent remains on the
parent context and applies once during final compositing. This includes the
parent's active clip, `globalAlpha`, `globalCompositeOperation`, native Canvas
`filter`, and native Canvas shadow state. Descendant state changes stay inside
the capture and retain component save/restore isolation.

The mutable default Canvas current path is not copyable between contexts.
Cross-component continuation of one implicit current path through a filter or
other offscreen boundary is unsupported. CRC's built-ins and documented custom
primitive examples use self-contained operations or `Path2D` and are unaffected.

The existing primitive `style.opacity` behavior is unchanged. The new
`{ type: 'opacity' }` filter is a separate ordered raster effect and can produce
different overlap semantics because it operates on the combined result.

## Capture windows and raster density

CRC remains immediate-mode and does not retain paint bounds. A filter boundary
therefore derives a conservative finite local capture window from the current
visible parent target:

1. Start with the parent surface's visible logical rectangle.
2. Project its corners back through the boundary's invertible parent-facing
   transform and take an axis-aligned local output window.
3. Resolve the uniform local raster density and snap the output window outward
   to an integer backing-pixel rectangle.
4. Walk the filter list backward in backing-pixel coordinates, expanding for
   blur influence and taking the union of original and reverse-offset shadow
   influence. Color-only functions require no spatial expansion. The resulting
   integer rectangle is the source window.
5. Derive exact pixel-aligned logical source/output bounds and the integer
   source-to-output offset from those two backing rectangles.

The blur guard band uses the Filter Effects Level 1 ink-overflow extent for the
common three-pass box approximation:
`BLUR_EXTENT_FACTOR = (3 * Math.sqrt(2 * Math.PI)) / 4`. Each affected edge
expands outward by
`Math.ceil(standardDeviation * density * BLUR_EXTENT_FACTOR)` backing pixels.
Drop-shadow offsets are likewise scaled to backing pixels before reverse
influence and outward rounding. Tests lock that constant and prove that content
just outside the unexpanded viewport can still affect visible edge pixels. The
finite guard band is a practical raster boundary, not a promise of
mathematically infinite Gaussian support.

A non-invertible parent-facing transform cannot contribute an area to the
parent bitmap. The renderer executes the subtree once against a minimal local
discard surface so hooks, resource reconciliation, context access, and identity
remain correct, then skips filtering and parent compositing. Interaction
behavior retains the existing transform contract.

The local surfaces use a uniform backing-pixel density equal to the largest
singular scale of the boundary's direct local-to-parent-backing matrix. That
matrix already includes the active root or Layer backing density exactly once;
the renderer does not multiply by a second independent pixel ratio. Uniform
density preserves circular local filter kernels; the later affine composite
supplies rotation or nonuniform scaling. Source and result share that density
but use their distinct source/output windows. The source is positioned relative
to the result when filtered, so blur/shadow input outside the visible output
remains available without allocating a second copy of the larger source window.
This follows the [HTML Canvas drawing model](https://html.spec.whatwg.org/multipage/canvas.html#drawing-model),
which forms the input image, applies the filter, and only then composites it
within the output bitmap's clip. Native filter lengths are scaled to backing
pixels before compilation because Canvas filter coordinates operate in the
target bitmap rather than following the draw context's current transform.

Surface dimensions must be finite positive integers within the browser's
accepted `OffscreenCanvas` range. Allocation or context acquisition failure is
an actionable render error naming the component and requested logical/backing
dimensions; CRC does not silently lower resolution or fall back to a DOM canvas.
The windows are conservative axis-aligned bounds. Large rotations, blur radii,
or distant shadows can therefore dominate memory even when visible ink is
sparse. CRC preflights finite/safe-integer edge and area arithmetic, but does not
tile an ordered native filter chain, introduce seam-prone partial kernels, or
silently reduce resolution.

## Layer integration

`Layer` remains a persistent cached child CRC instance with explicit logical
width and height. It is not replaced by the transient filter pool. Its child
surface remains upright, inherits root density, and receives the Layer's
parent-facing transform only at composite time.

A caller-provided root `OffscreenCanvas` is already the root target rather than
a child composition boundary. Its logical origin remains upright with no
invented parent transform; filtered descendants use the same target/world split
as descendants of an HTML Canvas root.

A filter outside a cached Layer consumes the Layer's cached bitmap as ordinary
source content. Changing only the outer filter recomposites the cached image
without rerunning the Layer child tree. A filter on the Layer primitive filters
the combined cached Layer output. Filters inside the Layer are owned and pooled
by the child CRC instance and preserve global interaction paint order through
the existing Layer bridge.

## Interaction, layout, and visual overflow

Filters affect pixels only. Layout parents normalize and place the same direct
child style, and `measureElement` returns the same result it would without a
filter. Blur and shadow pixels do not enlarge declared boxes, intrinsic sizes,
layout overflow calculations, keyboard-navigation bounds, event paths, or
cursor regions.

Coordinate targets are registered from original logical geometry using the
world-transform and logical clipping stacks. A shadow-only or blurred-only
pixel outside that geometry is not clickable. Existing focus order, press
focus, pointer capture, related targets, source paint order, and root-logical
event coordinates are unchanged.

Filter output may paint outside the primitive's declared layout box. Existing
ancestor clipping boundaries, including layout `overflow: 'clip'`, clip the
completed result normally. CRC adds no new overflow measurement or scrolling.

## Ownership, cleanup, and failure behavior

Each `CRCInstance` owns one transient filter scratch pool. A simultaneously
active boundary atomically checks out two depth-indexed slots, source and
result. Nested boundaries use the next pair; completed siblings reuse the same
pair. Checkout and LIFO return are constant-time, and capacity therefore tracks
maximum active filter nesting depth rather than the count of filtered elements
rendered over time.

Each checkout clears pixels and resets all Canvas state before use. Backing
dimensions resize lazily to the exact current snapped window when that size
differs; the newly transparent bitmap is not redundantly cleared, but it still
receives complete state reinitialization. A same-size reuse clears exactly the
active bitmap before resetting state. Exact current dimensions keep
`useCanvasContext().canvas` deterministic and prevent one large historical
capture from becoming retained high-water memory. A returned slot retains only
its reusable canvas/context and no component, element, image, event, hook, or
callback references. The owning instance's main teardown clears the pool and
releases backing-store references. Deterministic counters track acquisition,
checkout, return, resize, and final release; test-local Canvas spies track clear
and draw area without shipping a per-pixel-area telemetry path. Heap or
garbage-collection timing is not a pass condition.

Filter capture does not create a nested CRC mount, component identity, render
frame, event root, or lifecycle. `Layer` remains the only built-in composition
primitive here that owns a nested CRC instance.

All changes to render context, paint/world transform state, clipping metadata,
and scratch checkout live inside `try`/`finally`. If filter validation,
allocation, primitive execution, descendant execution, or compositing fails,
every checked-out slot is returned and temporary globals return to their prior
baseline. The normal render-failure contract still tears down runtime-owned
component resources and clears refs; pixels already painted earlier in the
frame are not rolled back, and the failed filtered boundary is not composited.

## Performance contract

One active boundary adds two reusable backing stores, one native filtered
`drawImage` from the source window to the result window, and one unfiltered
`drawImage` from result to parent. Same-size slot reuse also clears each active
bitmap once; creation or resize already produces transparent pixels and skips
that redundant clear. A list of ten functions costs the same number of CRC
surfaces and draw steps as a list of one function; native browser implementation
determines the internal filter cost. Nested boundaries necessarily add one pair
and two bitmap composites per active level.

CRC performs no automatic content caching for filters. An ordinary filtered
subtree rerenders on each scheduled root render, exactly as an unfiltered
subtree does. Existing `Layer` is the explicit retained-cache boundary when an
author needs one. Structural tests assert one component execution, no pixel
readback, direct `OffscreenCanvas` sources, sibling pool reuse, nesting-based
capacity, and stable Layer cache hits. Controlled wall-clock thresholds remain
optional diagnostics rather than correctness gates.

Memory is proportional to the physical areas of the current source and output
windows at every simultaneously active nesting level. Documentation will show
the approximate RGBA lower bound of
`(sourceWidth * sourceHeight + outputWidth * outputHeight) * 4` bytes per level
while not presenting browser allocation overhead as deterministic.

## Evidence and documentation

Implementation proceeds test-first in reviewable vertical slices.

Pure filter tests cover all descriptors, numeric boundaries, clamping,
defaults, immutability, single/list normalization, empty lists, order-preserving
compilation, contextual diagnostics, concrete color parsing, and unsupported
Canvas capabilities.

Renderer and browser evidence covers:

- a combined fill-and-stroke path shadow;
- combined multiline text and transparent image silhouettes;
- custom primitive output;
- a Group whose descendants produce one shadow rather than per-child shadows;
- every standardized filter function;
- visibly different ordered lists;
- grayscale-inside-drop-shadow-inside-blur nesting;
- rotation and nonuniform scaling after local filtering;
- receiving, descendant, and ancestor Clip order;
- filters across persistent Layer cache hits and child-instance boundaries;
- unchanged layout, measurement, hit, focus, and pointer geometry;
- capture expansion at viewport edges and non-invertible transforms;
- scratch reuse, nested depth, resize, failure cleanup, and disposal;
- structural absence of pixel readback and repeated subtree execution.

A focused learning example demonstrates the typed list, reordering, Group
silhouettes, and local transforms. A deterministic public-API filter laboratory
drives all functions, nesting, clipping, Layer interaction, and lifecycle in
the Studio and headless browser. Semantic Canvas calls, state, geometry, and
selected pixels precede screenshot evidence. Browser-rendered blur/color regions
use narrow documented masks or tolerant assertions; visual baselines are
inspected as expected, actual, and diff before any intentional update.

The root exports, package declarations, Bundler and NodeNext consumers, packed
artifact, built browser mode, and Studio editor declarations must all expose the
new public types consistently. The style, drawing/composition, Canvas surface,
runtime resource ownership, API reference, custom primitive guidance, scenario
index, and library status documentation will describe the new behavior and the
upright-local-surface invariant.

Focused checks run throughout implementation. Final evidence is a fresh
`corepack pnpm@11.21.0 trust` run on Node 24.15 or newer, pnpm 11.21.0, and
Playwright Chromium. Historical test totals are not reused as current evidence.

## Standards basis

- [Filter Effects Module Level 1](https://drafts.csswg.org/filter-effects-1/)
  defines the supported function set, ordered-list processing, combined element
  and descendant grouping, local filter coordinate system, and alpha-derived
  drop shadow.
- [HTML Canvas filters](https://html.spec.whatwg.org/multipage/canvas.html#filters)
  defines the Canvas 2D `filter` state and filter drawing model used by both
  Canvas and OffscreenCanvas rendering contexts.
- [CSS Backgrounds and Borders box shadows](https://drafts.csswg.org/css-backgrounds/#box-shadow)
  documents the deliberately excluded box-decoration, spread, and inset model.
