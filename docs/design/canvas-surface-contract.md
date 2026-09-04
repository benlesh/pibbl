# CRC canvas surface contract

Status: current implemented contract, updated for JSX-era authoring on
2026-09-03.

This document defines how a root CRC mount maps logical drawing units to the
Canvas CSS content box and physical backing store. The mapping is owned by the
runtime so drawing, layout, interaction, clipping, and offscreen layers use one
coordinate model.

## Public configuration

`crc(canvas, root, config?)` accepts one branded recursive `CRCNode` root and
one mount-time surface configuration:

```ts
type CRCFit = "contain" | "cover" | "fill" | "none" | "scale-down";
type CRCPixelRatio = "device" | number;

type CRCConfig =
  | {
      signal?: AbortSignal;
      viewport?: Readonly<{ width: number; height: number }>;
      fit?: CRCFit;
      pixelRatio?: CRCPixelRatio;
    }
  | {
      signal?: AbortSignal;
      viewport: "responsive";
      pixelRatio?: CRCPixelRatio;
    };
```

JSX and `createElement` create the same opaque branded elements; fragments,
arrays, finite synchronous iterables, and empty nodes are also valid roots.
The configuration belongs to the first live mount. Later `crc()` calls update
the root node but do not replace the surface configuration or mount signal.
Dispose and remount to select a different surface mode.

The defaults are:

- a fixed logical viewport captured from the Canvas `width` and `height`
  attributes at mount time;
- centered `contain` fitting into the current CSS content box; and
- the live `window.devicePixelRatio`.

An explicit fixed `viewport` decouples logical scene size from the initial
backing attributes. `viewport: 'responsive'` instead makes the current CSS
content-box width and height the logical root allocation. Responsive mode does
not accept `fit`, because its logical and display extents are identical.

`pixelRatio` may be `'device'` or any finite number greater than zero. The
default `'device'` mode observes density changes. A numeric value is stable and
does not acquire device-density listeners.

Invalid viewports, pixel ratios, and fit values throw synchronously on mount.
A root mount also requires `ResizeObserver`.

## Three coordinate spaces

CRC distinguishes:

1. **logical space**, used by components, styles, layout boxes, paths, and
   `CRCMouseEvent.x/y`;
2. **display space**, measured from the Canvas CSS content box in CSS pixels;
3. **backing space**, stored by `canvas.width` and `canvas.height` in physical
   pixels.

The backing dimensions are independently rounded:

```text
backingWidth  = max(1, round(displayWidth  * pixelRatio))
backingHeight = max(1, round(displayHeight * pixelRatio))
```

CRC derives the effective backing density from those rounded dimensions and
installs one root transform before rendering. Component-local transforms then
compose after that root transform. The bitmap is cleared in backing space
before the root transform is installed.

CSS borders and padding are excluded when measuring display space. If changing
backing attributes would otherwise feed intrinsic Canvas dimensions back into
CSS sizing, CRC temporarily owns an equivalent inline CSS width and/or height
to stabilize the original content box. Disposal restores only inline values
still owned by that mount and never overwrites a later external change.

## Fixed viewport fitting

Fixed fitting is centered on both axes:

| Fit          | Scale behavior                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `contain`    | Uniformly scale until the whole logical viewport fits; unused display space remains around it. |
| `cover`      | Uniformly scale until the display is covered; logical edges may be outside the display.        |
| `fill`       | Scale each axis independently to fill the display exactly.                                     |
| `none`       | Preserve one logical unit per CSS pixel and center the viewport without scaling.               |
| `scale-down` | Use `none` when the viewport fits; otherwise use `contain`.                                    |

Centering offsets may be fractional. CRC does not currently expose alignment
or background/letterbox paint options. Content outside the Canvas bitmap is
naturally clipped by the platform.

## Responsive viewport behavior

For `viewport: 'responsive'`, one logical unit equals one CSS content-box pixel.
A CSS resize updates the root `crcLayoutBox()` allocation and schedules one
coalesced frame without remounting component identity. Backing dimensions still
follow the requested pixel ratio, so responsive layout and high-density paint
remain independent concerns.

A zero-sized display axis temporarily suppresses rendering rather than
inventing a logical size or one-pixel layout. A later positive resize resumes
the same live mount.

## Interaction and composition

Native pointer, mouse, touch, wheel, and drag positions are first measured
relative to the Canvas content box, then mapped through backing space and the
inverse root render transform. Their public coordinate facades therefore report
logical positions for every fit and density. Letterboxed points can be outside
the fixed logical viewport; only registered logical paths that actually
contain the mapped point can become targets.

Every captured interaction transform and clip omits the already-applied root
surface transform. Hit testing maps the native point back to logical space and
installs each captured logical transform on its isolated test context, so paint
and targeting do not double-apply density or fit.

Managed `Layer` backing stores inherit the root's current backing pixels per
logical unit on both axes. A density or projection change rerenders a layer at
the new physical size and composites its complete backing source into its
logical destination. Layer-local layout and interaction remain expressed in
logical units.

## Scheduling and lifetime

Resize and density notifications use the ordinary animation-frame scheduler.
Multiple notifications while a frame is pending coalesce without canceling and
moving that frame later. Device-density observation uses both the current
resolution media query and window resize as platform signals, rebinding after a
density change.

The root surface owns its `ResizeObserver`, density listeners, resolution media
query listener, and any intrinsic-size stabilization. Abort, controller
disposal, and failed-mount cleanup release the exact owned resources. A stale
observer or controller cannot mutate a replacement mount.

## Evidence

Pure projection tests cover every fit, responsive resolution, independent
rounding, invalid input, default capture, layer density, and zero display size.
Root lifecycle tests cover fixed and responsive resize, identity preservation,
device density, intrinsic-size stabilization, and disposal. Interaction and
layer suites prove logical coordinates and nested high-density composition.

The public `canvas-surface` laboratory is loaded by both the Studio and
headless Chromium. It proves fixed 2x backing, fixed CSS resize without logical
reflow, responsive logical reflow without remount, and logical mouse
coordinates. Full-page Studio baselines provide the corresponding sharpness
and composition evidence.
