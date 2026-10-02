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
    CRCBlurFilterOptions,
    CRCBrightnessFilterOptions,
    CRCContrastFilterOptions,
    CRCDisplacementFilterOptions,
    CRCDropShadowFilterOptions,
    CRCFilter,
    CRCGrayscaleFilterOptions,
    CRCHueRotateFilterOptions,
    CRCInvertFilterOptions,
    CRCOpacityFilterOptions,
    CRCSaturateFilterOptions,
    CRCSepiaFilterOptions,
    displacement,
    dropShadow,
    grayscale,
    hueRotate,
    invert,
    opacity,
    saturate,
    sepia,
  ]
keywords: [filter, blur, drop shadow, Canvas, tree shaking]
---

# Filters

Import each effect from `@crc/core/filters`. Every primitive accepts one opaque
`CRCFilter` value or a readonly ordered list in `style.filter`.

```tsx
import { Group, Rectangle } from "@crc/core";
import { blur, dropShadow } from "@crc/core/filters";

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

The factories and their option types are exported from `@crc/core/filters`.
Declared numeric fields accept a number or a numeric signal. Drop-shadow color
also accepts a string signal. The receiving primitive owns these signal reads;
calling `.get()` yourself makes the enclosing component the consumer instead.

| Factory      | Option type                  | Fields                                                                                                           |
| ------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `blur`       | `CRCBlurFilterOptions`       | `radius`: finite nonnegative Gaussian standard deviation in local logical units                                  |
| `brightness` | `CRCBrightnessFilterOptions` | `amount`: finite nonnegative ratio; values above 1 are preserved                                                 |
| `contrast`   | `CRCContrastFilterOptions`   | `amount`: finite nonnegative ratio; values above 1 are preserved                                                 |
| `dropShadow` | `CRCDropShadowFilterOptions` | Signed finite `offsetX` and `offsetY`; nonnegative `blurRadius` defaults to 0; concrete browser-accepted `color` |
| `grayscale`  | `CRCGrayscaleFilterOptions`  | Nonnegative finite `amount`, clamped to 1                                                                        |
| `hueRotate`  | `CRCHueRotateFilterOptions`  | Any finite `degrees`, without modulo normalization                                                               |
| `invert`     | `CRCInvertFilterOptions`     | Nonnegative finite `amount`, clamped to 1                                                                        |
| `opacity`    | `CRCOpacityFilterOptions`    | Nonnegative finite `amount`, clamped to 1                                                                        |
| `saturate`   | `CRCSaturateFilterOptions`   | Nonnegative finite `amount`; values above 1 are preserved                                                        |
| `sepia`      | `CRCSepiaFilterOptions`      | Nonnegative finite `amount`, clamped to 1                                                                        |

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

## CRCBlurFilterOptions

`CRCBlurFilterOptions` describes the validated inputs to `blur`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCBrightnessFilterOptions

`CRCBrightnessFilterOptions` describes the validated inputs to `brightness`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCContrastFilterOptions

`CRCContrastFilterOptions` describes the validated inputs to `contrast`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCDisplacementFilterOptions

`map` is a mounted `TexturePaint`; `strength` is a finite nonnegative logical
maximum offset; and `region` supplies finite local coordinates with positive width
and height for texture placement. A zero strength validates the map identity but
does not acquire GPU processing or subscribe to map pixel revisions.

## CRCDropShadowFilterOptions

`CRCDropShadowFilterOptions` describes the validated inputs to `dropShadow`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCFilter

`CRCFilter` is the opaque factory result, also available as a type from
`@crc/core`. The receiving primitive and its descendants form one raster. Lists
run in declaration order; nested boundaries run inside out. Adjacent native
filters compile into one Canvas filter operation. An empty list is a direct-path
no-op. Active native filters require `OffscreenCanvas` and Canvas `filter` support.

Filters change pixels only. Layout, measurement, hit testing, focus bounds, pointer
coordinates, cursor regions, physics and source paint order use the original
logical geometry. A shadow or blurred fringe does not extend the target area.

## CRCGrayscaleFilterOptions

`CRCGrayscaleFilterOptions` describes the validated inputs to `grayscale`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCHueRotateFilterOptions

`CRCHueRotateFilterOptions` describes the validated inputs to `hueRotate`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCInvertFilterOptions

`CRCInvertFilterOptions` describes the validated inputs to `invert`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCOpacityFilterOptions

`CRCOpacityFilterOptions` describes the validated inputs to `opacity`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCSaturateFilterOptions

`CRCSaturateFilterOptions` describes the validated inputs to `saturate`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## CRCSepiaFilterOptions

`CRCSepiaFilterOptions` describes the validated inputs to `sepia`, shown in the
field table above. Numeric fields support signals owned by the receiving primitive.

## displacement

`displacement(options)` samples the captured scene through a numeric texture map.
It changes pixels only; the receiving primitive retains its original hit geometry.

## dropShadow

`dropShadow(options)` creates an opaque filter for a shadow of the combined silhouette.

## grayscale

`grayscale(options)` creates an opaque filter for grayscale conversion.

## hueRotate

`hueRotate(options)` creates an opaque filter for hue rotation in degrees.

## invert

`invert(options)` creates an opaque filter for color inversion.

## opacity

`opacity(options)` creates an opaque filter for combined-raster opacity.

## saturate

`saturate(options)` creates an opaque filter for saturation scaling.

## sepia

`sepia(options)` creates an opaque filter for sepia conversion.
