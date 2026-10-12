---
id: api-types-filters
title: Filters
summary: Import appearance-only filter factories without including unused effects.
kind: api
slug: filters
apiCategory: types
typeDomain: filters
symbols:
  [
    blur,
    brightness,
    contrast,
    displacement,
    dropShadow,
    emboss,
    grayscale,
    hueRotate,
    invert,
    opacity,
    PibblBlurFilterOptions,
    PibblBrightnessFilterOptions,
    PibblContrastFilterOptions,
    PibblDisplacementFilterOptions,
    PibblDropShadowFilterOptions,
    PibblEmbossFilterOptions,
    PibblFilter,
    PibblGrayscaleFilterOptions,
    PibblHueRotateFilterOptions,
    PibblInvertFilterOptions,
    PibblOpacityFilterOptions,
    PibblReflectedLightFilterOptions,
    PibblReflectedLightSource,
    PibblSaturateFilterOptions,
    PibblSepiaFilterOptions,
    reflectedLight,
    saturate,
    sepia,
  ]
keywords: [filter, blur, drop shadow, Canvas, tree shaking]
---

# Filters

Import each effect from `@pibbl/core/filters`. Every primitive accepts one opaque
`PibblFilter` value or a readonly ordered list in `style.filter`.

```tsx
import { Group, Rectangle } from "@pibbl/core";
import { blur, dropShadow } from "@pibbl/core/filters";

const scene = (
  <Group
    style={{
      filter: [
        blur({ radius: 2 }),
        dropShadow({ offsetX: 0, offsetY: 4, color: "#0008" }),
      ],
    }}
  >
    <Rectangle style={{ width: 120, height: 80, fill: "coral" }} />
  </Group>
);
```

A factory creates an immutable value. It does not allocate a surface, start an
animation, or require browser capabilities at import time. Optimizing ESM bundlers
can remove unused effects. A string object such as `{ type: 'blur', radius: 2 }`
is no longer a filter; use `blur({ radius: 2 })`.

The factories and their option types are exported from `@pibbl/core/filters`.
Declared numeric fields accept a number or a numeric signal. Drop-shadow color
also accepts a string signal. The receiving primitive owns these signal reads;
calling `.get()` yourself makes the enclosing component the consumer instead.

| Factory      | Option type                    | Fields                                                                                                           |
| ------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `blur`       | `PibblBlurFilterOptions`       | `radius`: finite nonnegative Gaussian standard deviation in local logical units                                  |
| `brightness` | `PibblBrightnessFilterOptions` | `amount`: finite nonnegative ratio; values above 1 are preserved                                                 |
| `contrast`   | `PibblContrastFilterOptions`   | `amount`: finite nonnegative ratio; values above 1 are preserved                                                 |
| `dropShadow` | `PibblDropShadowFilterOptions` | Signed finite `offsetX` and `offsetY`; nonnegative `blurRadius` defaults to 0; concrete browser-accepted `color` |
| `grayscale`  | `PibblGrayscaleFilterOptions`  | Nonnegative finite `amount`, clamped to 1                                                                        |
| `hueRotate`  | `PibblHueRotateFilterOptions`  | Any finite `degrees`, without modulo normalization                                                               |
| `invert`     | `PibblInvertFilterOptions`     | Nonnegative finite `amount`, clamped to 1                                                                        |
| `opacity`    | `PibblOpacityFilterOptions`    | Nonnegative finite `amount`, clamped to 1                                                                        |
| `saturate`   | `PibblSaturateFilterOptions`   | Nonnegative finite `amount`; values above 1 are preserved                                                        |
| `sepia`      | `PibblSepiaFilterOptions`      | Nonnegative finite `amount`, clamped to 1                                                                        |

Drop-shadow offsets and blur radii scale with backing density. Contextual colors
such as `currentColor`, system colors, and `var(...)` reject. The opacity filter
acts on the captured combined raster; it is distinct from a primitive's ordinary
paint opacity.

Invalid input is diagnosed during receiving-primitive preparation, before its
render callback. Custom style normalization cannot remove or reinterpret filters.
Pure measurement ignores their appearance and acquires no raster resources.

## blur

`blur(options)` creates an opaque filter for Gaussian blur with a logical radius.

## brightness

`brightness(options)` creates an opaque filter for brightness scaling.

## contrast

`contrast(options)` creates an opaque filter for contrast scaling.

## displacement

`displacement(options)` samples the captured scene through a numeric texture map.
It changes pixels only; the receiving primitive retains its original hit geometry.

## dropShadow

`dropShadow(options)` creates an opaque filter for a shadow of the combined silhouette.

## emboss

`emboss(map, options)` lights a receiving primitive and its descendants using a
mounted grayscale height texture. Luminance times alpha supplies height; white
is high. Neighboring height samples one logical pixel apart give the surface
slopes. A directional diffuse light brightens facing slopes and darkens opposing
slopes; flat heights preserve the original color. Alpha and logical geometry are
preserved. Repeat, offset, rotation, and tile scale follow the map's paint placement.
Processing uses the optional WebGL2 filter surface without scene pixel readback.

## grayscale

`grayscale(options)` creates an opaque filter for grayscale conversion.

## hueRotate

`hueRotate(options)` creates an opaque filter for hue rotation in degrees.

## invert

`invert(options)` creates an opaque filter for color inversion.

## opacity

`opacity(options)` creates an opaque filter for combined-raster opacity.

## PibblBlurFilterOptions

`PibblBlurFilterOptions` describes the validated inputs to `blur`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblBrightnessFilterOptions

`PibblBrightnessFilterOptions` describes the validated inputs to `brightness`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblContrastFilterOptions

`PibblContrastFilterOptions` describes the validated inputs to `contrast`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblDisplacementFilterOptions

`map` is a mounted `TexturePaint`; `strength` is a finite nonnegative logical
maximum offset; and `region` supplies finite local coordinates with positive width
and height for texture placement. Optional `blurRadius` is a finite nonnegative
logical support radius (default 0). Blue × alpha scales the local blur radius;
red/green × alpha still control displacement. A bounded mip-filtered 5×5 binomial kernel
softens the refracted scene; this radius is not native Gaussian blur sigma.
Only when both strength and blur radius are zero does the filter validate the
map without acquiring GPU processing or subscribing to map pixel revisions.

## PibblDropShadowFilterOptions

`PibblDropShadowFilterOptions` describes the validated inputs to `dropShadow`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblEmbossFilterOptions

`region` supplies finite local x/y coordinates and positive width/height.
`depth` is the height range in logical pixels (0–32, default 3); `strength` is
0–1 (default 1). Both accept signals. Zero depth or strength bypasses processing.
`direction` is a finite nonzero pair pointing toward the light (default
`[-0.6, -0.8]`); it is normalized. The filter uses a fixed light elevation.
A flat surface remains neutral instead of receiving a uniform brightness change.

## PibblFilter

`PibblFilter` is the opaque factory result, also available as a type from
`@pibbl/core`. The receiving primitive and its descendants form one raster. Lists
run in declaration order; nested boundaries run inside out. Adjacent native
filters compile into one Canvas filter operation. An empty list is a direct-path
no-op. Active native filters require `OffscreenCanvas` and Canvas `filter` support.

Filters change pixels only. Layout, measurement, hit testing, focus bounds, pointer
coordinates, cursor regions, physics and source paint order use the original
logical geometry. A shadow or blurred fringe does not extend the target area.

## PibblGrayscaleFilterOptions

`PibblGrayscaleFilterOptions` describes the validated inputs to `grayscale`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblHueRotateFilterOptions

`PibblHueRotateFilterOptions` describes the validated inputs to `hueRotate`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblInvertFilterOptions

`PibblInvertFilterOptions` describes the validated inputs to `invert`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblOpacityFilterOptions

`PibblOpacityFilterOptions` describes the validated inputs to `opacity`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblReflectedLightFilterOptions

The map, region, source, opacity, threshold, softness, and direction accepted by
`reflectedLight`. Numeric controls and the map/source accept signals.

## PibblReflectedLightSource

A concrete CSS color, Pibbl texture paint, decoded HTMLImageElement, or ImageBitmap.

## PibblSaturateFilterOptions

`PibblSaturateFilterOptions` describes the validated inputs to `saturate`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## PibblSepiaFilterOptions

`PibblSepiaFilterOptions` describes the validated inputs to `sepia`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## reflectedLight

`reflectedLight({ map, region, source, opacity, threshold, softness, direction })`
adds translucent light only on selected wave slopes. `source` accepts a concrete
CSS color, a Pibbl texture paint, or a caller-owned, already-decoded HTML image or
ImageBitmap. It does not load URLs or close caller-owned images. A changed image
requires ordinary Pibbl invalidation; Pibbl texture revisions update automatically.

Opacity defaults to 0.15 (0–1). Threshold defaults to 0.1 (-1–1), softness to 0.25
(positive, at most 2), and direction to `[-0.6, -0.8]`. Map and region use the same
coordinates as displacement. Scene alpha and all logical geometry are preserved.
Place this directly after `displacement()` to fuse the two into one GPU draw and
one final bitmap transfer. This is an image-space surface-light approximation.

## saturate

`saturate(options)` creates an opaque filter for saturation scaling.

## sepia

`sepia(options)` creates an opaque filter for sepia conversion.
