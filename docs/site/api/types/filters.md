---
id: api-types-filters
title: Filter types
summary: Typed Canvas filter descriptors and their validated numeric fields.
kind: api
slug: filters
apiCategory: types
typeDomain: filters
symbols:
  [
    CRCBlurFilter,
    CRCBrightnessFilter,
    CRCContrastFilter,
    CRCDropShadowFilter,
    CRCFilter,
    CRCGrayscaleFilter,
    CRCHueRotateFilter,
    CRCInvertFilter,
    CRCOpacityFilter,
    CRCSaturateFilter,
    CRCSepiaFilter,
  ]
keywords: [filter, blur, drop shadow, Canvas]
---

# Filter types

Every primitive accepts one `CRCFilter` descriptor or an ordered readonly list.
CRC compiles the list into one native Canvas filter operation. An empty list is
a no-op; nonempty filters require browser `OffscreenCanvas` and Canvas `filter`
support. Filter pixels never alter layout, measurement, hit testing, focus
bounds, pointer coordinates, cursor regions, or source paint order.

## CRCBlurFilter

`CRCBlurFilter` has discriminator `"blur"` and finite nonnegative `radius`, a
Gaussian standard deviation compiled as density-scaled `blur(...px)`.

## CRCBrightnessFilter

`CRCBrightnessFilter` has discriminator `"brightness"` and a finite
nonnegative `amount` ratio. Values above `1` are preserved.

## CRCContrastFilter

`CRCContrastFilter` has discriminator `"contrast"` and a finite nonnegative
`amount` ratio. Values above `1` are preserved.

## CRCDropShadowFilter

`CRCDropShadowFilter` has discriminator `"dropShadow"`, signed finite
`offsetX`/`offsetY`, optional nonnegative finite `blurRadius` (default `0`),
and a concrete browser-accepted CSS `color`. Offsets and blur are density-scaled
pixels; contextual colors such as `currentColor` and `var(...)` reject.

## CRCFilter

`CRCFilter` is the closed union of the ten named descriptors. A receiver and
all of its recursive output form one filtered raster silhouette; nested
boundaries resolve inside out.

## CRCGrayscaleFilter

`CRCGrayscaleFilter` has discriminator `"grayscale"` and a finite nonnegative
ratio `amount`, clamped to `1` when compiled.

## CRCHueRotateFilter

`CRCHueRotateFilter` has discriminator `"hueRotate"` and any finite `degrees`;
the value is not modulo-normalized before `hue-rotate(...deg)` compilation.

## CRCInvertFilter

`CRCInvertFilter` has discriminator `"invert"` and a finite nonnegative ratio
`amount`, clamped to `1` when compiled.

## CRCOpacityFilter

`CRCOpacityFilter` has discriminator `"opacity"` and a finite nonnegative
ratio `amount`, clamped to `1` when compiled.

## CRCSaturateFilter

`CRCSaturateFilter` has discriminator `"saturate"` and a finite nonnegative
ratio `amount`. Values above `1` are preserved.

## CRCSepiaFilter

`CRCSepiaFilter` has discriminator `"sepia"` and a finite nonnegative ratio
`amount`, clamped to `1` when compiled.
