# Four-corner path warp design

<<<<<<< HEAD
=======
> **Historical status: Approved design record; it does not define current shipped behavior.**

>>>>>>> origin/main
Status: approved by the user, 2026-09-30, including the interactive demo contract.
The API, mode defaults, and validation policies below are the approved target,
not shipped behavior. This document does not authorize implementation of
unrelated features. See the [implementation plan](../plans/2026-09-30-path-warp-implementation.md).

## Purpose and scope

Map a rectangle in a PathGeometry's local coordinate space onto four destination
corners, deforming the complete path according to that mapping. Support shape
editors, font outlines, and subsequent geometry operations without introducing
a renderer effect, another transform tree, or a scheduling mechanism.

The operation is commonly called a four-corner warp. The historical reference is
System.Drawing.Drawing2D.GraphicsPath.Warp, which offers bilinear and perspective
modes. CRC adopts those mathematical choices, not .NET API compatibility.

Provide `warpPath` alongside `flattenPath`, `subdividePath`, and `simplifyPath`.
Keep the existing mutating, affine-only `PathGeometry.transform()` unchanged.
Warping returns independent line geometry with an explicit destination-space
accuracy bound. Moving only stored endpoints and Bézier controls is not a
correct implementation of this operation.

## Proposed public API

Export these values and types from `@crc/core`:

```ts
export interface PathWarpPoint {
  readonly x: number;
  readonly y: number;
}

export interface PathWarpRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PathWarpCorners {
  readonly topLeft: PathWarpPoint;
  readonly topRight: PathWarpPoint;
  readonly bottomLeft: PathWarpPoint;
  readonly bottomRight: PathWarpPoint;
}

export type PathWarpMode = "bilinear" | "perspective";

export interface WarpPathOptions {
  readonly source: PathWarpRect;
  readonly destination: PathWarpCorners;
  readonly mode?: PathWarpMode;
  readonly tolerance: number;
  readonly maxSegments?: number;
}

export function warpPath(
  path: PathGeometry,
  options: Readonly<WarpPathOptions>,
): PathGeometry;
```

Example, using an existing outline:

```ts
const warped = warpPath(outline, {
  source: { x: 0, y: 0, width: 200, height: 100 },
  destination: {
    topLeft: { x: 20, y: 10 },
    topRight: { x: 240, y: 30 },
    bottomLeft: { x: 0, y: 140 },
    bottomRight: { x: 180, y: 110 },
  },
  mode: "bilinear",
  tolerance: 0.25,
});
// Render with <Path style={{ d: warped, fill: 'purple' }} />,
// pass to Clip or interaction hooks, or export with toSvgPathData(warped).
```

Named corners avoid array-order ambiguity. Names express correspondence to the
source rectangle; they do not require those destination points to be visually
uppermost or leftmost after rotation or reflection. No inferred fourth corner
or implicit source bounds are included.

Bilinear is the proposed default because the originating request describes
interpolation between four handles. Perspective is an explicit alternative.
Tolerance is mandatory; maxSegments defaults to 1,000,000 and counts all
output segments, including Move and Close, consistently with existing utilities.

## Coordinates and mapping

The source rectangle and path share local coordinates. Destination points define
coordinates of the returned path in the same authoring space. Group transforms,
layout offsets, device pixel ratio, and Canvas transforms are not consulted.
The source rectangle is a reference frame, not a clip or automatically computed
bounding box. Points outside it are extrapolated, without clamping.

For each point P = (x, y), normalize:

```text
u = (x - source.x) / source.width
v = (y - source.y) / source.height
```

Let A, B, C, D denote topLeft, topRight, bottomLeft, bottomRight respectively.
Both modes map (0,0) to A, (1,0) to B, (0,1) to C, and (1,1) to D.

### Bilinear mode

```text
F(u,v) = (1-u)(1-v) A + u(1-v) B + (1-u)v C + uv D
```

This is an affine map plus a mixed `uv` term. Lines of constant u or v remain
straight; arbitrary lines can become quadratic curves. When A + D = B + C,
the mixed term vanishes and the mapping is affine. The normalized center maps
to the arithmetic mean of the four destination corners.

Allow all finite corner arrangements, including concave, crossed, coincident,
and collinear destinations. These are well-defined forward maps and can fold
or collapse geometry. Do not silently sort points, convexify a destination, or
reject it merely because it is not invertible.

### Perspective mode

Solve the projective homography mapping the four normalized rectangle corners
to the supplied points:

```text
X = (h00*u + h01*v + h02) / (h20*u + h21*v + h22)
Y = (h10*u + h11*v + h12) / (h20*u + h21*v + h22)
```

Use a numerically normalized solve; homogeneous coefficients are defined only
up to a common nonzero scale. Avoid correctness rules tied to an arbitrary
coefficient normalization. Straight source lines remain straight wherever the
map is finite; spacing along them generally changes. Curves generally become
rational curves, not ordinary polynomial Béziers of their original degree.

Require a strictly convex, nondegenerate destination in perimeter order
A, B, D, C. Either orientation is valid, including reflections. Reject concave,
crossed, collinear, and duplicate-corner destinations in this mode. This gives a
finite continuous projective map over the complete source rectangle.

Extrapolated geometry may approach or cross the homography's denominator-zero
line. Reject a path if any traced point reaches a pole, including a closing
edge or isolated Move point. Finite geometry wholly outside the rectangle is
allowed, including a separate contour on the other side of the pole. Never
bridge a pole with a finite line, clip at it, or return partial geometry.
If numerical methods cannot certify finiteness and accuracy within limits,
throw explicitly. There is no arbitrary user-visible epsilon or implicit
coordinate clamp that changes the mapping.

## Geometry and approximation contract

Return a fresh PathGeometry containing only Move, Line, and Close segments in
source traversal order. This applies even for identity and affine special
cases: callers can rely on line-only output, but not on a particular adaptive
segment count or subdivision pattern. Preserve contour order, open versus
closed status, and mapped endpoints, subject to floating-point arithmetic.

For every accepted source parameter interval, its exact warped locus must be
within tolerance of the emitted finite chord in destination coordinate units.
The approximation must also preserve traversal through reversals: do not use
distance to an infinite line or a few sample points as a proof of flatness.
Use a conservative bound on deviation from the chord's corresponding linear
parameterization, or an equivalent bound that preserves traversal, rather than
allowing a collinear backtracking interval to disappear.

Tolerance concerns centerline geometry, not raster pixels, stroke outlines,
area, tangent angle, or topology. It excludes unavoidable floating-point error;
if that error prevents a reliable bound, fail instead of claiming success.
No preservation of holes, tiny features, winding regions, or absence of new
intersections is promised at finite tolerance. Bilinear folding can itself
change those properties even before approximation.

Destination-space tolerance is essential: flattening in source coordinates with
the same numeric tolerance and then moving vertices does not satisfy it.
A later display transform can magnify error; callers choose tolerance to account
for their display scale. General screen-space metrics are deferred.

### Segments, arcs, and closure

- Moves map directly and remain moves. Preserve empty contours.
- Lines must participate in approximation: a bilinear warp can bend them.
- Quadratic and cubic curves are evaluated as continuous source curves before
  mapping. Warping their original control points alone is insufficient.
- Elliptical arcs include general affine ellipse bases, signed sweeps, full
  revolutions, and rank-deficient ellipses. Preserve their parameter traversal.
- Treat Close as the full current-point-to-contour-start edge. Warp and subdivide
  that edge as needed, then retain Close. An unchanged straight chord between
  the warped endpoints would be wrong for a nonlinear closing edge.
- Honor canonical arc connection and post-Close current-point semantics from
  PathGeometry. Do not join separate contours or invent new closures.

Stroke width remains a later rendering choice. Warping a centerline and then
stroking it does not warp the original stroke outline. Applications needing
that effect must supply actual outline geometry.

## Implementation approach and proof obligations

Keep the mapper and subdivision engine internal. Do not add a public arbitrary
point callback, homography class, inverse mapper, or rational segment type.
A correct bounded approximation is the prerequisite for the first slice.

A feasible approach is to represent each source span internally as a polynomial
or rational Bézier and compose it algebraically with the chosen mapping:

1. Lines and polynomial Béziers already have bounded-degree representations.
2. Split arcs into spans of at most a quarter turn and represent each exactly
   as a rational quadratic with positive weights. Applying the stored ellipse
   basis accommodates skew, reflection, and singular bases.
3. Bilinear composition produces bounded-degree rational/polynomial curves;
   perspective composition is a linear operation on homogeneous coordinates.
4. Subdivide with de Casteljau in homogeneous coordinates. For each span,
   certify denominator sign and bound approximation error before accepting it.
5. Emit mapped endpoints only when the bound meets tolerance; otherwise split
   and continue in parameter order.

For a positive-denominator rational span R(t) = N(t)/W(t), one useful bound is
formed by subtracting the parameter-matched chord L(t):

```text
R(t) - L(t) = (N(t) - W(t)*L(t)) / W(t)
```

Express the numerator in Bernstein form, degree-elevating as necessary. Its
control-vector norm maximum bounds the numerator; the smallest positive
Bernstein coefficient of W bounds the denominator below. Their ratio is a
conservative positional error bound that detects collinear reversals. Flip all
homogeneous signs for wholly negative weights. Mixed-sign coefficients require
subdivision or a stronger denominator certificate; they do not alone prove a
pole. Include numerical conditioning in acceptance decisions.

This approach avoids introducing an unaccounted source-flattening error and
handles bilinear-warped lines and rational perspective curves uniformly. Other
algorithms are acceptable only if they establish the same observable bounds.
Midpoint/quarter-point sampling can aid diagnostics but cannot replace proof.

Use bounded iterative traversal, a numerical-nonprogress guard, and explicit
internal depth/work limits as well as maxSegments. A maximum output size alone
does not prevent runaway attempts to isolate a pole. Limits must throw rather
than relax tolerance. Document the chosen internal guard constants and exercise
them during implementation; their exact values are not compatibility promises.
Do not retain an intermediate flattened copy of the entire input unnecessarily.

## Validation, failures, and ownership

Validate options even for empty input; valid empty input returns a fresh empty
geometry. Require finite coordinates, positive finite source width and height,
positive finite tolerance, and a positive safe-integer maxSegments. Negative
source dimensions are rejected; reflection is expressed by corner mapping.
Reject unknown mode values and malformed required option shapes.

Use TypeError for invalid input kinds, malformed structures, or unsupported
mode values. Use RangeError for numeric-domain failures, invalid perspective
quadrilaterals, singular/uncertifiable mappings, coordinate overflow, exceeded
budgets, or unachievable precision. Messages identify the cause and, where
useful, the source segment. Exact wording is not contractual.

Read option values once into internal numeric state. Retain no references to
options or destination handles. Inputs, their revisions, and previously returned
outputs remain unchanged on success and failure. Return no partial geometry.
The output has its own storage and revision history; no exact initial revision
value is promised. There are no geometry observers, native-path caches, frame
requests, retained layers, or persistent resources owned by warpPath.

For interactive editing, retain the original geometry and recompute from it
when corners change. Repeatedly warping the previous approximation accumulates
error and is not the intended editing model. Publish the new geometry through
existing CRC state/signals; scheduling remains the application's responsibility.
Do not add automatic memoization or an implicit render-time warp.

## Interactive demo contract

The user explicitly requires a hands-on demo with movable corner points and
live switching between bilinear and perspective modes. A static comparison or
an automatically animated warp does not satisfy this requirement.

Use an interesting, asymmetric compound path: a stylized rocket silhouette with
a curved nose, swept fins, and a circular porthole cutout. Its curves, diagonal
edges, and interior contour make distortion and differences between modes easy
to see. Construct it with public PathGeometry builders; no external image or
font dependency is needed. Use contrasting fill and a thin outline, with the
original shape and source rectangle visible as a subdued reference.

- Display four large draggable handles labeled by their source-corner names,
  connected by the destination quadrilateral outline. Update the warped shape
  continuously while dragging using CRC's supported pointer interactions.
- Provide a clearly labeled Bilinear / Perspective selector. Switching modes
  preserves all four handle positions and immediately recomputes from the same
  original geometry, making the mathematical difference directly comparable.
- Start with a valid, visibly non-parallelogram destination so both modes are
  usable and produce distinguishable results immediately.
- Provide Reset to restore the initial corners and default bilinear mode.
- Allow handles to cross rather than silently rearranging or constraining them.
  When perspective becomes invalid, keep the handles responsive, show a clear
  explanation, and visibly mark the retained last successful shape as a previous
  valid preview. Returning to valid corners or switching to bilinear recovers
  immediately. Never present stale geometry as the current successful result.

The completed demo must expose both modes. A bilinear-only first slice is an
intermediate feedback milestone. Browser evidence must exercise dragging a
corner, changing modes without resetting corners, invalid-state recovery, and
Reset through the same public example that is usable manually.

## Delivery sequence

This request delivers the design only. Implement later using thin vertical
slices and public-API evidence:

1. Add a focused failing public test for bilinear mapping of an outline with a
   curved closing edge and destination-space tolerance. Implement that slice
   through the public utility and a manually usable Studio example.
2. Provide the exact running Studio URL for feedback. Follow the interactive
   demo contract above, adding its mode selector when perspective is available.
   Keep example controls separate from exhaustive test-lab metadata.
3. Incorporate feedback, add perspective as the next complete slice, then
   broaden degeneracy, numeric, ownership, and compatibility evidence.
4. Harden documentation and run proportional final verification, including the
   aggregate trust gate before reporting feature completion.

Label the first runnable milestone “slice ready for feedback.” Both modes,
complete segment coverage, documented failures, and final verification are
required for “feature complete.” Do not present a bilinear-only slice as the
whole capability.

## Evidence required before completion

Semantic tests lead; screenshots supplement visible behavior only.

- Four corner correspondences, nonzero source origin, center behavior, identity,
  affine destinations, reflection, and extrapolation without clipping.
- Bilinear diagonal curvature with a midpoint visibly off the endpoint chord;
  the same obligation on a Close edge, not just an explicit Line.
- Known projective mappings verified independently of the implementation's
  solver, straight-line preservation, and different interior positions between
  modes for a non-parallelogram destination.
- Quadratics, cubics, loops, cusps, inflections, and collinear backtracking;
  skewed/singular arcs, full turns, signed sweeps, and contour boundaries.
- Analytical or independently bounded destination-space error under strong
  magnification; dense sampling is supplementary regression evidence, not the
  sole proof of the claimed tolerance guarantee.
- All bilinear corner degeneracies; both valid perspective orientations;
  rejected invalid perspective quadrilaterals; actual poles and near-pole
  finite paths; separate finite contours across the pole; denominator controls
  with mixed signs despite a finite curve.
- Empty/move-only paths, repeated closes and continuation after Close,
  invalid options, overflow, budgets, and numerical nonprogress.
- Independent output/storage, unchanged input contents and revision after
  failures and successes, and independence from later corner/input mutations.
- Public Path paint, Clip, hit testing, and native/SVG export of warped output.
  Existing snapshot and scheduler semantics continue to apply unchanged.
- Runtime exports/types, Bundler and NodeNext consumers, packed output,
  source/built browser modes, and Studio editor declarations.

Performance evidence should cover repeated handle dragging of a representative
outline, with output count and work/allocation measurements. Avoid a correctness
gate based on uncontrolled wall-clock time. Defer caching, workers, pooling,
and alternative output representations until measurements justify them.

## Deliberate boundaries

No inverse hit-coordinate transform, source-to-output segment correspondence,
editable control-handle preservation, curve fitting, automatic bounds inference,
mesh/envelope warp, image warp, stroke outlining, topology repair, GPU warp,
resampling, or morph correspondence is added. The returned geometry already
works with CRC's existing path consumption surfaces.

## References

- [Existing path geometry design](2026-09-29-path-geometry-design.md)
- [Current public PathGeometry documentation](../../site/api/functions/path-geometry.md)
- [Drawing contract](../../design/drawing-components-contract.md)
- [Runtime resource ownership](../../design/runtime-resource-ownership.md)
- [Signals and scheduling](../../design/signals-and-scheduling-contract.md)
- [Microsoft GraphicsPath.Warp](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.drawing2d.graphicspath.warp)
- [Microsoft WarpMode](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.drawing2d.warpmode)
