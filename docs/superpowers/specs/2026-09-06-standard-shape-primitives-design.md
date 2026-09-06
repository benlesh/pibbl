# Standard shape primitives design

Status: approved for implementation on 2026-09-06.

## Summary

CRC will add five descriptive drawing leaves: `Circle`, `Ellipse`, `Arc`,
`Wedge`, and `Polygon`. Each value is a dedicated public `definePrimitive`
component with its own props and style types. The implementations construct
immediate `Path2D` geometry and reuse the existing `renderPath` paint and
interaction pipeline.

The additions expand CRC's conventional drawing vocabulary without creating a
retained shape system, a generalized public path builder, or data-visualization
semantics. Line interpolation, pie-chart data transformation, annular sectors,
and other chart marks remain future work built above these primitives.

## Goals

- Provide discoverable JSX and `createElement` values for five conventional
  shapes currently possible only through `Path2D` or SVG path strings.
- Preserve CRC's local closed style language, declared-box layout,
  immediate-mode traversal, source paint order, and shared paint/interaction
  geometry.
- Resolve percentage geometry predictably against the primitive's existing
  percentage basis.
- Provide deterministic validation, empty-geometry behavior, interaction
  targeting, and logical keyboard bounds.
- Ship complete public-package, example, documentation, and trust-gate
  evidence.

## Non-goals

- Line smoothing, spline selection, or data-to-mark transformation.
- `Pie`, chart, scale, axis, legend, or other visualization components.
- Annular wedges or an `innerRadius` option.
- Rounded `Rectangle` geometry.
- A retained geometry graph, public shape registry, or generic `Shape` value.
- New fill, stroke, shadow, gradient, compositing, or pixel-alignment features.
- Intrinsic measurement inferred from drawing geometry.

## Public surface

The root `@crc/core` entry will export these values and types:

- `Circle`, `CircleProps`, and `CircleStyle`
- `Ellipse`, `EllipseProps`, and `EllipseStyle`
- `Arc`, `ArcProps`, and `ArcStyle`
- `Wedge`, `WedgeProps`, and `WedgeStyle`
- `Polygon`, `PolygonProps`, and `PolygonStyle`

All five values are drawing leaves and reject children. Their props extend the
same DOM-aligned event and focus options as the current path-based drawing
values. Geometry and paint remain under `style`; events remain props.

Every style participates in the existing declared-box layout vocabulary and
supports `cursor`, `opacity`, `stroke`, `strokeWidth`, and
`lineInteractionWidth`. `Circle`, `Ellipse`, `Wedge`, and `Polygon` also
support `fill`. `Arc` is stroke-only, matching `Line`; filling an open arc
would implicitly create different chord geometry.

### Circle

`CircleStyle` adds:

- required `radius: Exclude<Length, "auto">`
- optional `cx: Exclude<Length, "auto">`, default `0`
- optional `cy: Exclude<Length, "auto">`, default `0`

### Ellipse

`EllipseStyle` adds:

- required `radiusX: Exclude<Length, "auto">`
- required `radiusY: Exclude<Length, "auto">`
- optional `cx: Exclude<Length, "auto">`, default `0`
- optional `cy: Exclude<Length, "auto">`, default `0`
- optional finite `rotation: number`, in radians, default `0`

### Arc

`ArcStyle` adds:

- required `radius: Exclude<Length, "auto">`
- required finite `startAngle: number`, in radians
- required finite `endAngle: number`, in radians
- optional `cx: Exclude<Length, "auto">`, default `0`
- optional `cy: Exclude<Length, "auto">`, default `0`
- optional `counterclockwise: boolean`, default `false`

The angles and direction follow `Path2D.arc`. The path remains open. An
absolute angular difference of at least one full turn follows Canvas full-circle
behavior.

### Wedge

`WedgeStyle` has the same center, radius, angle, and direction fields as
`ArcStyle`, but creates a center-closed path with two radial edges. It has no
`innerRadius`.

A partial wedge moves from the center to the arc start, follows the circular
sweep, and closes to the center. A full-circle wedge creates circle geometry
without radial edges, preventing a visible radial stroke seam.

### Polygon

`PolygonStyle` adds required `coords: [number, number][]`, reusing the public
coordinate vocabulary of `Line`. The implementation connects the ordered
points and closes the path. Arrays with fewer than three points produce empty
geometry.

Polygon coordinates remain numeric in this design. Unlike named axis geometry,
an arbitrary tuple has no unambiguous percentage basis. Percentage placement
can use `Group`, layout, or pre-resolved coordinates.

## Style resolution and validation

Named position and radius fields use the existing immutable specified,
normalized, and resolved style stages:

- `cx` percentages resolve against percentage-basis width.
- `cy` percentages resolve against percentage-basis height.
- `radiusX` percentages resolve against percentage-basis width.
- `radiusY` percentages resolve against percentage-basis height.
- Circular `radius` percentages resolve against the smaller of the
  percentage-basis width and height.

Numeric geometry is expressed in local logical Canvas units. Percentage
resolution retains the existing finite and definite-basis diagnostics.

Radii must resolve to finite nonnegative numbers. Negative radii fail during
style resolution with a `LayoutDiagnostic`; CRC does not expose a native
`Path2D` radius exception as the validation contract. Angles and ellipse
rotation must be finite and fail with the same contextual diagnostic family.

A zero radius, a zero ellipse radius, or a zero angular span produces safe
empty geometry. Empty geometry paints nothing while preserving the normal
resource and replacement semantics. Every polygon coordinate must be finite;
an invalid tuple value fails style resolution with a property path identifying
the offending coordinate. The tuple representation and ordered traversal
otherwise retain the existing `Line` coordinate behavior.

## Rendering architecture

Each public value lives in a focused component module under
`packages/core/src/lib/components`. It owns its style resolver and primitive
definition. Renderers create a fresh `Path2D` for the current traversal and
delegate common paint and interaction behavior to `renderPath`.

Shared internals are limited to reusable geometry operations proven by at
least two components:

- circular sweep normalization and angle containment;
- arc and wedge path construction;
- nonnegative radius resolution;
- axis-aligned geometry-bound calculations.

There is no public geometry-helper API, shape discriminator, path cache,
retained command object, or new resource owner. Fresh path construction follows
the current `Rectangle` implementation and avoids new equality and teardown
contracts.

The new primitives do not support pixel-grid alignment. Curved and arbitrary
edges do not have the axis-aligned snapping contract implemented by
`Rectangle`, `HorizontalLine`, and `VerticalLine`.

## Layout and measurement

Drawing geometry and layout allocation remain separate. Centers, radii,
angles, and polygon coordinates describe local drawing geometry. Existing
`width`, `height`, and layout-item fields describe layout participation.

The five primitives provide no intrinsic `measure` capability. In particular,
`radius: 20` does not claim a 40-by-40 layout box: offset, rotation, partial
sweeps, and negative local coordinates make that inference ambiguous.
Percentage geometry resolves against the allocation provided by the parent.
Automatic layout paths that require measurement must receive a declared box,
as with other non-measuring drawing primitives.

## Interaction and focus geometry

Paint and coordinate-event targeting share the exact generated `Path2D`.
Filled shapes register their fill geometry when fill interaction is active;
strokes use the existing `strokeWidth` and `lineInteractionWidth` rules.
`Arc` exposes only its curved stroke. `Wedge` exposes its curved and radial
strokes and its filled interior when filled.

Explicit caller-provided `keyboardNavigationBounds` always wins. Otherwise the
primitive supplies deterministic local axis-aligned bounds:

- circle bounds use the center and radius;
- ellipse bounds account for rotation;
- arc bounds include its endpoints and every cardinal extremum in its sweep;
- wedge bounds include the arc bounds and center;
- polygon bounds use the finite point extrema.

These bounds are derived directly from geometry rather than Canvas pixel
rasterization. Group transforms, clips, layers, focus policies, and the shared
paint ledger continue to transform and route them through existing machinery.

## Failure and lifecycle behavior

Style-resolution failures follow the existing render-failure contract: the
failed render tears down runtime-owned resources and clears component refs;
pixels painted earlier in the frame are not rolled back. A later valid mount
can recover normally.

The primitives acquire no asynchronous or persistent resources. Updates replace
the prior frame's pixels, path geometry, targets, cursor ownership, and focus
metadata after the scheduled render settles. Removal and root disposal use the
existing primitive and event teardown paths.

## Evidence strategy

Implementation proceeds test-first in vertical slices. Shared helpers are
extracted only after a second primitive demonstrates the common behavior.

Direct component evidence will cover:

- numeric and percentage style resolution, including exact percentage bases;
- defaults, updates, and replacement geometry;
- zero, negative, non-finite, and indefinite-basis behavior;
- fill, stroke, opacity, cursor, and interaction width as applicable;
- computed and explicitly overridden keyboard-navigation bounds;
- transforms, clips, layout placement, and layers where representative;
- Canvas-compatible direction, wrap, zero-span, and full-circle arc behavior;
- seam-free full-circle wedges;
- rotated ellipse bounds;
- polygon closure and fewer-than-three-point behavior;
- failure teardown and recovery.

Public-surface evidence will cover JSX and `createElement` authoring, leaf child
rejection, root exports and declarations, package-consumer checks for Bundler
and NodeNext resolution, packed output, and Studio editor declarations.

The scenarios catalog will gain one focused learning example per primitive.
A deterministic public-API test-lab scenario will exercise the primitives
together, with semantic Canvas-call, geometry, and interaction assertions
before visual evidence. Expected, actual, and diff images will be inspected
before accepting any intentional baseline.

The drawing contract, API reference, relevant authoring material, scenario
catalog records, and library status will describe the expanded public surface.
Focused tests will run during development, followed by a fresh
`corepack pnpm@11.21.0 trust` aggregate gate on the documented environment.
