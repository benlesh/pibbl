# Rounded shapes and public path creators design

Status: approved for implementation on 2026-09-08.

## Summary

CRC will add rounded corners to `Rectangle`, `Polygon`, and two new drawing
leaves, `RegularPolygon` and `Star`. Rounded polygon corners are true circular
arcs tangent to their incident edges. A uniform radius provides the default,
and an optional sparse per-corner array overrides individual corners by index.
When neighboring corners cannot fit on their shared edge, CRC proportionally
reduces every requested radius by one common scale factor.

CRC will also expose focused pure functions that create the same `Path2D`
geometry used by its built-in drawing components. These creators let callers
reuse standard geometry with `Clip`, `Path`, custom primitives, and explicit
event targets without reproducing CRC's formulas. Components, public creators,
and existing memoized path hooks will share one canonical implementation per
shape.

This design deliberately supersedes two non-goals in the implemented
2026-09-06 standard-shape design: rounded `Rectangle` geometry and a public
geometry-helper API. It does not supersede that design's immediate-mode,
layout, interaction, or lifecycle contracts.

## Goals

- Add true circular corner rounding to `Rectangle`, `Polygon`,
  `RegularPolygon`, and `Star`.
- Support both one default radius and sparse per-corner overrides.
- Prevent adjacent rounded corners from overlapping while preserving the
  proportions between requested radii.
- Add a regular-polygon component that can be sized by circumradius, inradius,
  or side length.
- Add an alternating-radius star component with an explicit number of points.
- Expose public pure `Path2D` creators for CRC's standard path geometry.
- Ensure built-in rendering, coordinate targeting, clipping, and caller-created
  paths use the same canonical geometry implementation.
- Preserve CRC's local style language, declared-box layout, immediate-mode
  traversal, source paint order, identity rules, and resource ownership.
- Ship public-package, scenario, documentation, and trust-gate evidence.

## Non-goals

- Rounded joins for `Wedge`, `Arc`, `Line`, `HorizontalLine`, or
  `VerticalLine`. Line caps and joins are a separate paint-style concern;
  rounding a curve-to-line wedge junction requires a separate fillet contract.
- Corner-radius behavior for `Circle` or `Ellipse`, which have no corners.
- Automatic rounded clipping for `Image`, `Text`, `Group`, `Layer`, or `Clip`.
  Callers compose a creator-produced path with `Clip` when they need it.
- Elliptical corner radii, CSS slash syntax, smoothing, splines, or arbitrary
  Bézier corner profiles.
- Compound or internally crossing star paths. `Star` is one concave,
  alternating-radius silhouette.
- A generic `Shape` component, shape discriminator, public shape registry,
  retained geometry graph, path cache, or display list.
- Intrinsic measurement inferred from drawing geometry.
- New memoized hooks for every creator. Callers can combine a pure creator with
  `crcMemo`; the existing path hooks remain supported.

## Public surface

The root `@crc/core` entry will add these component exports:

- `RegularPolygon`, `RegularPolygonProps`, and `RegularPolygonStyle`
- `Star`, `StarProps`, and `StarStyle`

It will add these pure creator exports and their named `...PathOptions` types:

- `createRectanglePath`
- `createCirclePath`
- `createEllipsePath`
- `createArcPath`
- `createWedgePath`
- `createLinePath`
- `createPolygonPath`
- `createRegularPolygonPath`
- `createStarPath`
- `createSvgPath`

`Path` already consumes a caller-supplied `Path2D` and therefore has no
corresponding creator. `HorizontalLine` and `VerticalLine` reuse
`createLinePath` after resolving their endpoints.

Every creator accepts one readonly options object and returns a fresh
`Path2D`. Creator geometry is numeric because a standalone call has no layout
context in which to resolve CRC percentages. Component styles continue to
accept CRC lengths and resolve them before delegation.

```ts
export interface RoundedCornerPathOptions {
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
}

export interface RectanglePathOptions extends RoundedCornerPathOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface CirclePathOptions {
  cx?: number;
  cy?: number;
  radius: number;
}

export interface EllipsePathOptions {
  cx?: number;
  cy?: number;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

export interface ArcPathOptions {
  cx?: number;
  cy?: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterclockwise?: boolean;
}

export type WedgePathOptions = ArcPathOptions;

export interface LinePathOptions {
  coords: readonly (readonly [number, number])[];
  closePath?: boolean;
}

export interface PolygonPathOptions extends RoundedCornerPathOptions {
  coords: readonly (readonly [number, number])[];
}

export interface RegularPolygonPathPosition {
  sides: number;
  cx?: number;
  cy?: number;
  rotation?: number;
}

export type RegularPolygonNumericSize =
  | { circumradius: number; inradius?: never; sideLength?: never }
  | { circumradius?: never; inradius: number; sideLength?: never }
  | { circumradius?: never; inradius?: never; sideLength: number };

export type RegularPolygonPathOptions = RegularPolygonPathPosition &
  RegularPolygonNumericSize &
  RoundedCornerPathOptions;

export interface StarPathOptions extends RoundedCornerPathOptions {
  points: number;
  cx?: number;
  cy?: number;
  outerRadius: number;
  innerRadius: number;
  rotation?: number;
}

export interface SvgPathOptions {
  d: string;
}

export function createRectanglePath(
  options: Readonly<RectanglePathOptions>,
): Path2D;
export function createCirclePath(options: Readonly<CirclePathOptions>): Path2D;
export function createEllipsePath(
  options: Readonly<EllipsePathOptions>,
): Path2D;
export function createArcPath(options: Readonly<ArcPathOptions>): Path2D;
export function createWedgePath(options: Readonly<WedgePathOptions>): Path2D;
export function createLinePath(options: Readonly<LinePathOptions>): Path2D;
export function createPolygonPath(
  options: Readonly<PolygonPathOptions>,
): Path2D;
export function createRegularPolygonPath(
  options: Readonly<RegularPolygonPathOptions>,
): Path2D;
export function createStarPath(options: Readonly<StarPathOptions>): Path2D;
export function createSvgPath(options: Readonly<SvgPathOptions>): Path2D;
```

The options types remain separate from component style types so pure geometry
does not accidentally acquire layout, paint, cursor, or event fields.

## Rounded-corner style contract

The public style vocabulary adds a reusable structural type:

```ts
export interface RoundedCornerStyle {
  cornerRadius?: Exclude<Length, "auto">;
  cornerRadii?: readonly (Exclude<Length, "auto"> | null | undefined)[];
}
```

`RectStyle` and `PolygonStyle` extend this type. `RegularPolygonStyle` and
`StarStyle` include it from their introduction.

For actual corner index `i`, the specified value is selected with nullish
fallback semantics:

```ts
const specified = cornerRadii?.[i] ?? cornerRadius ?? 0;
```

Consequently:

- a literal zero overrides the default and keeps that corner sharp;
- an omitted array, sparse hole, `undefined`, or `null` falls back to
  `cornerRadius`;
- omitting both properties preserves the current sharp geometry;
- `cornerRadii.length` must not exceed the shape's actual corner count, even
  when trailing entries are nullish.

The index order is:

- `Rectangle`: `(x, y)`, `(x + width, y)`,
  `(x + width, y + height)`, `(x, y + height)`. This directed order remains
  stable for signed width and height and agrees with Canvas rounded-rectangle
  corner remapping.
- `Polygon`: the order of `coords`.
- `RegularPolygon`: generated vertex order.
- `Star`: every generated vertex in traversal order. Even indices are outer
  tips and odd indices are inner valleys.

Each specified component radius resolves against the smaller dimension of the
component's current percentage basis, matching `Circle.radius`. The standalone
creator equivalents accept finite numeric logical Canvas units only.

Negative or non-finite radii fail. CRC never silently clamps an individually
invalid radius to zero. Oversized but otherwise valid radii are proportionally
reduced by the geometry algorithm described below.

## Rounded rectangle geometry

`createRectanglePath` defaults `x` and `y` to zero. It creates a normal
`Path2D.rect` when every effective radius is zero and otherwise creates a
`Path2D.roundRect` with four fully expanded numeric radii.

Canvas owns signed-width and signed-height traversal, physical-corner
remapping, and the scaling rule that prevents adjacent corner curves from
overlapping. CRC validates and expands its fallback vocabulary before calling
Canvas; it does not reimplement the browser's rounded-rectangle algorithm.

`Rectangle` retains its existing pixel-grid behavior. It first adjusts its
numeric `x`, `y`, `width`, and `height`, then passes that effective box and its
resolved radii to `createRectanglePath`. `crcRectPath` performs the same
existing pixel adjustment and then calls the creator. Its existing positional
arguments remain source compatible, while its optional config object gains
numeric `cornerRadius` and `cornerRadii` fields using the same fallback rules.
Its memo identity includes the effective per-corner radii. Pixel alignment does
not alter the requested radii, but Canvas can reduce them to fit the adjusted
box.

Rectangle paint, stroke, cursor, coordinate targeting, focus metadata,
updates, and replacement continue through `renderPath` with the creator's
exact path.

## Rounded polygon geometry

`createPolygonPath` preserves source coordinate order and closes arrays with
three or more points. Fewer than three points produce an empty `Path2D` after
argument validation, matching the current `Polygon` contract.

When every effective corner radius is zero, it uses the existing closed-line
path construction. Otherwise it builds circular fillets as follows for each
vertex `P[i]` with predecessor `P[prev]` and successor `P[next]`:

1. Form unit vectors from `P[i]` toward its predecessor and successor.
2. Let `theta` be the smaller angle between those vectors, clamped to the
   inclusive range from zero to pi before `acos`.
3. For requested circular radius `r[i]`, compute the tangent demand along each
   incident edge as `d[i] = r[i] / tan(theta / 2)`.
4. A vertex with a zero-length incident edge, exactly collinear incident edges,
   or zero radius is unrounded and has tangent demand zero.
5. For every edge from `P[i]` to `P[next]`, compare its length with
   `d[i] + d[next]`.
6. Compute one global factor equal to the minimum of `1` and every positive
   edge ratio `edgeLength / (d[i] + d[next])`.
7. Multiply every nonzero requested radius and tangent demand by that factor.

Using one factor matches the proportional behavior of Canvas rounded
rectangles and preserves the relative differences between per-corner values.
No pair of neighboring tangent sections can then cross on their shared edge.

Path construction moves to the incoming tangent point of vertex zero, calls
`arcTo` for every vertex in source order, and closes the path. Including vertex
zero in the loop makes the last-to-first junction a real rounded corner rather
than a sharp `closePath` seam. Canvas `arcTo` supplies the shortest true circle
arc tangent to both incident edge rays and follows the traversal's convex or
concave turn.

Duplicate and exactly collinear vertices remain present in the traversal but
are sharp at that index. Near-collinear finite vertices use the ordinary
formula and may cause the global factor to become small. Self-intersecting
coordinate lists are not rejected; rounding is local to traversal order, and
painting and hit testing retain browser `Path2D` fill behavior.

`Polygon` calls this creator after resolving and validating its style. Its
default keyboard bounds remain the extrema of the specified coordinates.
Rounding removes or replaces material near vertices but cannot expand those
bounds.

## RegularPolygon component

`RegularPolygon` is the mathematically correct name: unlike "equilateral," it
promises both equal side lengths and equal interior angles.

It is a drawing leaf with the same paint, cursor, layout-item, event, and focus
surface as `Polygon`. Its props extend `CRCEventHandlers` and
`CRCEventFocusOptions`. Its style contains:

```ts
interface RegularPolygonCommonStyle extends RoundedCornerStyle {
  sides: number;
  cx?: Exclude<Length, "auto">;
  cy?: Exclude<Length, "auto">;
  rotation?: number;
  lineInteractionWidth?: number;
}

type RegularPolygonSizeStyle =
  | {
      circumradius: Exclude<Length, "auto">;
      inradius?: never;
      sideLength?: never;
    }
  | {
      circumradius?: never;
      inradius: Exclude<Length, "auto">;
      sideLength?: never;
    }
  | {
      circumradius?: never;
      inradius?: never;
      sideLength: Exclude<Length, "auto">;
    };

export type RegularPolygonStyle = RegularPolygonCommonStyle &
  RegularPolygonSizeStyle &
  SystemStyle &
  PaintStyle &
  CursorStyle &
  BoxStyle &
  LayoutItemStyle;
```

`sides` must be an integer of at least three. Exactly one size field is
required both statically and at runtime. All three size fields resolve against
the smaller percentage-basis dimension and normalize to circumradius `R` for
`n = sides`:

```ts
// Circumradius supplied
R = circumradius;

// Inradius (apothem) supplied
R = inradius / Math.cos(Math.PI / n);

// Side length supplied
R = sideLength / (2 * Math.sin(Math.PI / n));
```

`cx` and `cy` default to zero and use their normal axis percentage bases.
`rotation` is a finite radian angle defaulting to `-Math.PI / 2`, placing
vertex zero above the center. Increasing angles generate vertices clockwise in
Canvas coordinates:

```ts
angle[i] = rotation + (i * 2 * Math.PI) / sides;
x[i] = cx + R * Math.cos(angle[i]);
y[i] = cy + R * Math.sin(angle[i]);
```

The generated vertices and resolved corner options flow through the same
canonical rounded-polygon builder used by `createPolygonPath`. A normalized
size of zero produces an empty path. Default keyboard bounds use the generated
vertex extrema; explicit caller bounds still win.

## Star component

`Star` is a drawing leaf with the same paint, cursor, layout-item, event, and
focus surface as `Polygon`. Its props extend `CRCEventHandlers` and
`CRCEventFocusOptions`. Its style adds:

```ts
export interface StarStyle
  extends
    RoundedCornerStyle,
    SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  points: number;
  cx?: Exclude<Length, "auto">;
  cy?: Exclude<Length, "auto">;
  outerRadius: Exclude<Length, "auto">;
  innerRadius: Exclude<Length, "auto">;
  rotation?: number;
  lineInteractionWidth?: number;
}
```

`points` counts outer tips and must be an integer of at least three. Both radii
resolve against the smaller percentage-basis dimension, must be finite and
nonnegative, and must satisfy `innerRadius <= outerRadius`. Equal radii are
allowed and produce a regular `points * 2`-gon. If either radius is zero, the
creator returns an empty path rather than a degenerate multiply-traversed
center.

`cx` and `cy` default to zero. `rotation` is a finite radian angle defaulting to
`-Math.PI / 2`, placing outer tip zero above the center. The creator emits
`points * 2` clockwise vertices, alternating the outer radius at even indices
and inner radius at odd indices:

```ts
angle[i] = rotation + (i * Math.PI) / points;
radius[i] = i % 2 === 0 ? outerRadius : innerRadius;
```

The vertices and corner values flow through the canonical rounded-polygon
builder. Default keyboard bounds use all generated vertex extrema. A
six-pointed star is the concave twelve-corner silhouette only; the component
does not add the internal crossing strokes of two overlaid triangles.

## Other path creators

The remaining creators expose the numeric geometry already owned by current
components:

- `createCirclePath` defaults its center to zero and returns an empty path for
  radius zero.
- `createEllipsePath` defaults its center and rotation to zero and returns an
  empty path when either radius is zero.
- `createArcPath` and `createWedgePath` accept raw angles and direction, share
  the existing circular-sweep normalization, and retain zero-span,
  full-circle, and seam behavior.
- `createLinePath` preserves ordered coordinates and optionally closes them,
  retaining `crcLinePath`'s existing `closePath` capability.
- `createSvgPath` calls the `Path2D` string constructor. Browser parsing and
  syntax failures remain authoritative.

Current internal functions with these responsibilities are moved, promoted,
or adapted rather than copied. `Circle`, `Ellipse`, `Arc`, `Wedge`, `Line`,
`Polygon`, `Rectangle`, and `SvgPath` obtain their path from the corresponding
canonical creator. Existing `crcRectPath`, `crcLinePath`, and `crcSvgPath`
retain their public signatures and memoization identities but delegate path
allocation to the same creators.

## Validation and diagnostics

All creator option numbers and coordinate entries must be finite. Width and
height retain signed rectangle support. Shape radii and size fields must be
nonnegative. Structural counts, mutually exclusive regular-polygon sizes,
star radius ordering, and `cornerRadii` length are validated before allocating
or traversing geometry.

Standalone creators throw `RangeError` with the offending option path for
invalid numeric or structural input. `createSvgPath` alone delegates malformed
path-data failure to the browser's `Path2D` constructor.

Component style resolution raises the existing contextual `LayoutDiagnostic`
family, including component name, property path, value, algorithm, and
constraints. Shared validation predicates and geometry normalizers accept the
appropriate error factory so the standalone and component entry points do not
maintain separate rules.

Zero-size behavior remains intentional rather than erroneous:

- zero circle radius, either zero ellipse radius, zero arc/wedge radius, or a
  zero angular span produces empty geometry under current contracts;
- fewer than three polygon points produces empty geometry;
- a zero normalized regular-polygon size produces empty geometry;
- either zero star radius produces empty geometry;
- zero corner radii preserve sharp corners and do not empty an otherwise valid
  shape.

A component validation failure retains CRC's render-failure behavior: runtime
resources are torn down, component refs are cleared, pixels painted earlier in
the failed frame are not rolled back, and a later valid mount can recover.

## Rendering, interaction, and focus

All affected drawing leaves pass their canonical creator-produced path to
`renderPath`. Fill, stroke, opacity, cursor, line interaction width, event
targeting, clipping-stack intersection, transforms, layers, and source paint
order therefore observe the exact same geometry.

The creators themselves have no rendering or runtime side effects beyond
allocating and populating a fresh `Path2D`. They register no events, own no
resources, and do not depend on CRC render state. Callers can safely construct
a path outside a component and supply it to `Clip`, `Path`,
`crcEventTarget`, or a custom primitive.

Explicit `keyboardNavigationBounds` always wins. Otherwise:

- rounded `Rectangle` keeps its resolved rectangle box;
- rounded `Polygon` keeps coordinate extrema;
- `RegularPolygon` and `Star` use generated vertex extrema;
- existing shapes keep their current component-specific calculations.

Corner rounding cannot expand those original vertex or rectangle extrema.

## Layout and measurement

`RegularPolygon` and `Star` participate in the existing `BoxStyle` and
`LayoutItemStyle` vocabulary. Their centers, radii, rotation, points, sides,
and corner values describe local drawing geometry; declared `width`, `height`,
and placement fields describe layout allocation.

Neither component supplies intrinsic measurement. A circumradius, side length,
or outer radius does not claim a layout box because offsets, rotations,
negative local coordinates, and parent constraints make that inference
ambiguous. Automatic layout that requires measurement must receive a declared
box, matching the other shape primitives.

Pure path creators do not accept CRC layout lengths, allocations,
constraints, or percentages.

## Architecture and ownership

Focused modules under `packages/core/src/lib/geometry` will own public path
construction. Private shared modules will own:

- finite numeric guards and context-specific error production;
- regular-polygon and star vertex normalization;
- nullish corner fallback, tangent-demand calculation, global scaling, and
  rounded closed-polygon traversal;
- circular-sweep normalization shared by arcs and wedges.

Component modules continue to own style types, style resolution, paint/event
props, and default focus-bound selection. Hook modules continue to own hook
slot identity and memoization. No path formula is independently reimplemented
in a component or hook.

An internal builder returns ephemeral normalized vertices, path, and bounds to
avoid recalculating generated vertices inside a component. That record is not
public, is not retained across traversal, and does not introduce a scene graph
or resource owner. The public creator wrapper returns only its fresh `Path2D`.

## Evidence strategy

Implementation proceeds test-first in vertical slices. Each production change
is preceded by a focused failing test that is run and confirmed to fail for the
intended missing behavior.

Pure creator tests use recorded `Path2D` commands plus browser geometry checks
to cover:

- default values and exact command order for every creator;
- uniform, sparse, nullish-fallback, zero, and per-index corner values;
- the closing first/last polygon corner;
- proportional radius reduction on the most-constrained edge;
- convex, concave, duplicate-point, exactly collinear, near-collinear, and
  self-intersecting polygons;
- signed rounded rectangles and native corner remapping;
- equality of all three regular-polygon sizing modes;
- regular-polygon rotation, orientation, vertex order, and zero size;
- star point count, alternating vertex order, rotation, equal radii, and zero
  radii;
- finite-number, nonnegative-radius, count, exclusivity, ordering, and
  overlong-array errors;
- current arc, wedge, line, and SVG parsing behavior after extraction.

Direct component evidence covers:

- numeric and percentage style resolution with exact bases;
- contextual diagnostics and recovery;
- fill, stroke, opacity, cursor, and interaction width;
- pointer targeting inside and outside rounded cuts;
- default and explicitly overridden keyboard bounds;
- updates, replacement, removal, transforms, layout placement, clips, and
  layers where representative;
- `Rectangle` pixel-grid interaction with rounding;
- leaf child rejection for `RegularPolygon` and `Star`.

Public-surface evidence covers root exports and declarations, JSX and
`createElement` authoring, Bundler and NodeNext consumers, packed output, and
Studio editor declarations.

The learning catalog gains focused `RegularPolygon` and `Star` examples. The
existing Rectangle and Polygon lessons gain rounded variants. A deterministic
public-API test-lab scenario uses `createRegularPolygonPath` to clip content to
a perfect hexagon and proves semantic geometry, interaction, and clip behavior
before adding visual evidence.

Documentation updates include the drawing-component and style-system
contracts, API reference, relevant authoring/composition guides, scenario
catalogs, library status, documentation-preservation fixtures, and dated field
notes. Visual changes require inspection of expected, actual, and diff output;
baselines are not rewritten merely to make checks pass.

Focused tests run during development. Final verification runs a fresh
`corepack pnpm@11.21.0 trust` on the documented Node 24.15-or-newer Node 24 LTS
environment with pnpm 11.21.0 and Playwright Chromium. Reported results come
from that fresh run rather than historical documentation totals.
