---
id: api-types-styles
title: Style and primitive types
summary: Local drawing styles, shared paint vocabularies, and primitive-extension contracts.
kind: api
slug: styles
apiCategory: types
typeDomain: styles
symbols:
  [
    ArcStyle,
    CircleStyle,
    ClipStyle,
    CRCResponsiveStyle,
    CRCSizeQuery,
    CRCStyleRule,
    CursorStyle,
    EllipseStyle,
    FillStyle,
    GStyle,
    HorizontalLineStyle,
    ImgStyle,
    LayerStyle,
    LineStyle,
    NormalizedStyle,
    PaintStyle,
    PathStyle,
    PixelGridAlignment,
    PolygonStyle,
    PrimitiveCapabilities,
    PrimitiveInput,
    PrimitiveInputOf,
    PrimitiveProgramProps,
    PrimitiveRender,
    RectStyle,
    RegularPolygonStyle,
    ResolvedStyle,
    RoundedCornerStyle,
    SpecifiedStyle,
    StarStyle,
    StrokeStyle,
    StyleResolutionContext,
    SvgPathStyle,
    SystemStyle,
    TextStyle,
    VerticalLineStyle,
    WedgeStyle,
  ]
keywords: [style, paint, primitive, stroke, fill]
---

# Style and primitive types

Styles are local, closed contracts: there is no inheritance or cascade. Author
input is specified, then normalized, then resolved against a finite allocation.
`definePrimitive` exposes the extension seam without turning CRC into a retained
scene graph.

## ArcStyle

`ArcStyle` is the stroke-only local style for an open circular sweep: radius,
finite radian angles, optional center/direction, paint, and interaction fields.

## CircleStyle

`CircleStyle` requires `radius` and accepts optional `cx`/`cy`, local paint,
events, focus geometry, and applicable declared-box fields.

## ClipStyle

`ClipStyle` supplies a clipping `Path2D`, fill rule, local composition fields,
and applicable filter behavior for `Clip`.

## CRCResponsiveStyle

`CRCResponsiveStyle<S>` is the primitive's ordinary signal-capable style plus an
optional readonly `when` list. Required base fields stay required. Whole-style
signals and signals in base or patch fields are supported; conditions and lists
are plain values. Use `satisfies CRCResponsiveStyle<FlowStyle>` for reusable
styles. Unmatched patch signals are not read. No styles cascade or inherit.

The [responsive local styles guide](#/learn/guides/responsive-styles) explains
outer placement versus inner content. Custom primitives must leave `when` out
of their specified, normalized, and resolved styles: CRC supplies that field on
inputs and removes it before callbacks.

## CRCSizeQuery

`CRCSizeQuery` requires at least one inclusive, finite nonnegative bound:
`minWidth`, `maxWidth`, `minHeight`, or `maxHeight`. All bounds must match the
available containing size in logical units. A direct Grid item's rules see the
Grid content box; rules inside the placed component see its assigned cell.

## CRCStyleRule

`CRCStyleRule<S>` pairs a `query` with a partial local `style` patch. Matching
patches apply in list order, with the last assignment winning. Patches cannot
contain another `when`; objects and arrays replace rather than deep-merge.

## CursorStyle

`CursorStyle` is the local CSS cursor vocabulary used by primitives and the
cursor hook; cursor regions use original logical geometry.

## EllipseStyle

`EllipseStyle` requires `radiusX` and `radiusY` and accepts optional center and
finite radian rotation with local paint and interaction fields.

## FillStyle

`FillStyle` is the shared local fill-paint vocabulary.

## GStyle

`GStyle` is the local transform/composition style for `Group`.

## HorizontalLineStyle

`HorizontalLineStyle` is the local stroke and allocation-aware endpoint style
for `HorizontalLine`.

## ImgStyle

`ImgStyle` is the local geometry, border, paint, and interaction style for
browser-decoded images.

## LayerStyle

`LayerStyle` is the local presentation style for persistent offscreen `Layer`
content, including its composition-boundary filter behavior.

## LineStyle

`LineStyle` is the local numeric-coordinate and stroke-interaction style for a
polyline `Line`.

## NormalizedStyle

`NormalizedStyle` is CRC's immutable parsed style stage: shorthands and
component defaults are resolved, but no parent-derived geometry is retained.

## PaintStyle

`PaintStyle` is the shared local paint vocabulary, including opacity and
applicable Canvas painting settings.

## PathStyle

`PathStyle` is the local paint and interaction style for a caller-owned `Path2D`.

## PixelGridAlignment

`PixelGridAlignment` is `"none" | "round" | "ceil" | "floor"`, the supported
numeric alignment modes for path helpers and applicable primitive geometry.

## PolygonStyle

`PolygonStyle` requires finite numeric coordinate pairs and supports local
paint, interaction, and rounded-corner fields; fewer than three points are
safe empty geometry.

## PrimitiveCapabilities

`PrimitiveCapabilities` declares the optional normalization, resolution, and
pure measurement capabilities of a primitive made with `definePrimitive`.

## PrimitiveInput

`PrimitiveInput` is the public element input shape for a primitive's props and
local style.

## PrimitiveInputOf

`PrimitiveInputOf<T>` derives that public input shape from a primitive type.

## PrimitiveProgramProps

`PrimitiveProgramProps` is the props portion of a primitive input after CRC's
reserved `key` and `style` metadata are separated.

## PrimitiveRender

`PrimitiveRender` is the render callback contract supplied to `definePrimitive`.
It executes in CRC's isolated render traversal, not as a standalone function.

## RectStyle

`RectStyle` is the local signed-box, paint, interaction, and rounded-corner
style for `Rectangle`.

## RegularPolygonStyle

`RegularPolygonStyle` requires integer sides and exactly one of circumradius,
inradius, or side length, with local paint and rounded-corner fields.

## ResolvedStyle

`ResolvedStyle` is CRC's immutable finite style stage for the current containing
box and allocation; it is passed to primitive rendering.

## RoundedCornerStyle

`RoundedCornerStyle` is the shared component corner vocabulary. Per-corner
entries fall back through `cornerRadii?.[i] ?? cornerRadius ?? 0`.

## SpecifiedStyle

`SpecifiedStyle` is the immutable author-supplied local style stored on an
element before parsing and resolution.

## StarStyle

`StarStyle` requires integer points and ordered nonnegative outer/inner radii,
forming one concave alternating outline rather than intersecting triangles.

## StrokeStyle

`StrokeStyle` is the shared local stroke-paint and interaction-width vocabulary.

## StyleResolutionContext

`StyleResolutionContext` gives primitive style resolution its allocation,
percentage basis, constraints, component identity, and algorithm context.

## SvgPathStyle

`SvgPathStyle` is the local paint and interaction style for browser-parsed SVG
path-data geometry.

## SystemStyle

`SystemStyle` is the opt-in base style with optional `custom` and framework-
owned `filter`. It has no index signature, so component styles remain closed.

## TextStyle

`TextStyle` is the local paint, wrapping, fitting, and measurement style for
recursive textual content.

## VerticalLineStyle

`VerticalLineStyle` is the local stroke and allocation-aware endpoint style for
`VerticalLine`.

## WedgeStyle

`WedgeStyle` is the local center-closed circular-sector style. Partial sweeps
include radial edges; full turns omit them for a seam-free circular stroke.
