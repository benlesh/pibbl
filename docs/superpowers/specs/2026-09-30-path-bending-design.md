# Along Arc and Along Path geometry transformations

Status: approved by the user, 2026-09-30. Implementation is in progress; this
document does not claim shipped behavior. This document uses the repository's
existing design directory.

Implementation plan: [Path bending implementation](../plans/2026-09-30-path-bending-implementation.md).

## Recommendation

Add two standalone public utilities to `@crc/core`:

- `bendPathAlongArc(source, options)` bends geometry around a circular guide.
- `bendPathAlongPath(source, guide, options)` bends geometry along a supplied
  PathGeometry, using distance along the guide rather than its curve parameter.

Both return independent PathGeometry values. Use the UI labels **Along Arc**
and **Along Path**. Keep `PathGeometry.transform()` affine and mutating, and
keep the separately proposed four-corner `warpPath()` distinct.

The shape itself bends, including the interiors of lines and curves. This is
useful for lettering outlines, ribbons, logos, and diagram shapes. It is not
rigid placement of individual letters or repeated objects along a path.

Separate the two alignment questions:

1. **Along the guide:** start, center, or end, plus a distance offset.
2. **Across the guide:** the source baseline that lies on it, plus a normal offset.

Use `baseline: 'center' | 'top' | 'bottom' | number`. A numeric value means an
explicit source-space Y coordinate, making `baseline: 0` useful for font outlines.
This avoids requiring a font or text layout abstraction in the geometry API.

For a left-to-right horizontal guide in Canvas coordinates:

| Desired appearance            | Baseline   | Meaning                                      |
| ----------------------------- | ---------- | -------------------------------------------- |
| Centered on guide             | `'center'` | Source frame's vertical center follows guide |
| Above guide                   | `'bottom'` | Source frame's bottom follows guide          |
| Below guide                   | `'top'`    | Source frame's top follows guide             |
| Typographic baseline on guide | `0`        | Source Y=0 follows guide                     |

Top and bottom name the **source edge**, not a fixed screen direction. On curved
or reversed guides there is no consistent global above or below. Positive normal
offset moves toward the right-hand side of traversal (visually below for a
rightward horizontal guide); negative moves toward its left-hand side. A UI may
use Above/Centered/Below for the conventional rightward preview, but must show
guide direction and explain this relationship.

## Proposed public API

```ts
export interface PathBendFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PathBendArc {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly startAngle: number;
  readonly sweep: number;
}

export type PathBendAlign = "start" | "center" | "end";
export type PathBendBaseline = "center" | "top" | "bottom" | number;
export type PathBendFit = "none" | "stretch";
export type PathBendOverflow = "error" | "extend" | "wrap";

export interface PathBendOptions {
  readonly source: PathBendFrame;
  readonly align?: PathBendAlign; // default 'start'
  readonly baseline?: PathBendBaseline; // default 'center'
  readonly fit?: PathBendFit; // default 'none'
  readonly offset?: number; // default 0; guide-distance units
  readonly normalOffset?: number; // default 0; output coordinate units
  readonly overflow?: PathBendOverflow; // default 'error'
  readonly tolerance: number; // required; output coordinate units
  readonly maxSegments?: number; // default 1,000,000, includes Move/Close
}

export interface BendPathAlongArcOptions extends PathBendOptions {
  readonly arc: PathBendArc;
}

export function bendPathAlongArc(
  source: PathGeometry,
  options: Readonly<BendPathAlongArcOptions>,
): PathGeometry;

export function bendPathAlongPath(
  source: PathGeometry,
  guide: PathGeometry,
  options: Readonly<PathBendOptions>,
): PathGeometry;
```

Require an explicit source frame, consistent with the proposed four-corner warp.
It is an alignment reference, not a clip or inferred ink bound. All source
contours share this frame. Geometry may extend outside it, including negative
text bearings. The overflow policy governs actual mapped geometry, not merely
the frame. Width must be positive; height may be zero for line-only geometry.
No dependency on the proposed warp types is required to ship bending first.

`fit: 'none'` preserves source X distances along the baseline. `fit: 'stretch'`
maps the frame's full width to the guide's full length, scaling only along the
guide; it does not scale thickness. These statements concern the reference
baseline: bending can stretch or compress geometry away from that baseline.
For uniform source scaling, transform a clone explicitly before bending.

## Authoring examples

```ts
const arched = bendPathAlongArc(outline, {
  source: { x: 0, y: -40, width: 240, height: 50 },
  arc: {
    cx: 300,
    cy: 260,
    radius: 180,
    startAngle: (-3 * Math.PI) / 4,
    sweep: Math.PI / 2,
  },
  align: "center",
  baseline: 0,
  tolerance: 0.25,
});

const guide = new PathGeometry();
guide.moveTo(20, 140);
guide.bezierCurveTo(120, 20, 220, 260, 340, 140);

const bent = bendPathAlongPath(outline, guide, {
  source: { x: 0, y: -40, width: 240, height: 50 },
  fit: "stretch",
  baseline: "bottom",
  normalOffset: -8,
  tolerance: 0.25,
});
// <Path style={{ d: bent, fill: 'purple' }} />
// Also usable with Clip, path hit regions, toPath2D(), and toSvgPathData().
```

The text-outline proposal uses baseline origin (0,0), Y down. Numeric baseline
zero preserves that relationship. Choose a source frame based on ink bounds for
visual centering or layout advance for layout centering; these are intentionally
different. Bending needs only the outline and the caller's chosen frame, not
glyph records. An empty text run need not be bent using a zero-width frame.

## Shared mapping contract

Let B(s) be the guide position at arc length s, T(s) its unit tangent in traversal
direction, and N(s)=(-T.y,T.x). Let L be guide length, W the source frame width,
and a be 0, 1/2, or 1 for start, center, or end. Resolve the baseline b to:

- `top`: source.y
- `center`: source.y + source.height / 2
- `bottom`: source.y + source.height
- numeric: the supplied absolute source Y coordinate

For every point (x,y) on the continuous source geometry:

```text
k = fit == 'stretch' ? L / W : 1
s = a * (L - k*W) + k * (x - source.x) + offset
d = y - b + normalOffset
F(x,y) = B(s) + d * N(s)
```

Offsets are applied after fitting. Stretch consumes the full guide, so all
three longitudinal alignments coincide in that mode. Source X always follows
guide traversal. Reversing the guide reverses the tangent and normal; CRC never
auto-flips geometry to keep text upright. Reverse arc traversal by changing its
start and sweep; arbitrary guides follow their authored segment order.

All measurements are local geometry coordinates. Device pixel ratio, layout,
Group transforms, and Canvas state are not consulted. No inverse mapping is
provided: rendering and hit testing consume the resulting bent geometry.

### Along Arc

Require finite center and start angle, positive finite radius r, and finite
nonzero signed sweep with magnitude at most 2π. Angles are radians, matching
Canvas. Positive sweep appears clockwise in a Y-down coordinate system.

```text
q = sign(sweep)
L = r * abs(sweep)
theta(s) = startAngle + q*s/r
B(s) = (cx + r*cos(theta), cy + r*sin(theta))
T(s) = q * (-sin(theta), cos(theta))
```

Use analytic positions, tangents, and length. Do not approximate the circle as
a polyline before mapping. For positive sweep, positive normal offset points
inward; negative points outward. For negative sweep the relationship reverses.
Partial arcs have endpoints. A full ±2π arc is a closed guide for wrapping.
Elliptical guides are available through Along Path; the arc convenience API
deliberately uses one circular radius.

### Along Path

Accept an inspectable PathGeometry, not native Path2D. Require exactly one
nonempty continuous guide contour with positive finite length. Reject multiple
Move-delimited contours, including extra move-only contours, rather than
silently selecting or joining them. Source geometry can have any number of
contours. The guide may use lines, quadratics, cubics, or canonical ellipse arcs.

Use arc-length parameterization of the actual curves. Equal Bézier parameter
steps are not equal distances. Segment joins must have matching directed unit
tangents; curvature may be discontinuous. A sharp corner has no unique continuous
normal, so reject sharp joins, reversals, and cusps in this version. This is a
deliberate limitation: a polygonal guide with corners needs an explicit future
corner treatment, not accidental gaps, miters, or a silently smoothed guide.

Zero-length segments can be ignored for guide measurement. A zero derivative
does not automatically mean a cusp: accept removable stationary points or
stationary endpoints when the required limiting unit tangent can be established.
Reject cases whose tangent or numerical accuracy cannot be established within
the work budget. Numerical comparisons must account for floating-point error,
without treating a visibly sharp corner as a smooth join.

Close contributes its actual closing edge, and a closed contour must also have
a matching tangent at its seam. Explicit Close marks a path guide closed;
coincident open endpoints alone do not enable wrap. Validate the whole guide,
including portions unused by the source. Geometric self-intersections are
allowed: distance and traversal identify the branch unambiguously.

### End behavior

- `error` (default): reject if any traced source point maps to s outside [0,L].
  Check complete segments, closing edges, and isolated Moves, not only stored
  endpoints. Do not reject solely because a control point lies out of range.
- `extend`: outside [0,L], extend the corresponding endpoint tangent as a ray
  with constant normal. This applies to both utilities, including full circles;
  extension does not continue circular curvature or implicitly repeat a guide.
- `wrap`: require a closed, smooth guide and evaluate distance modulo L,
  including negative distances. Preserve traversal through the seam and across
  multiple laps; no artificial seam chord. A full-circle arc qualifies.

No clamping or clipping is included: clamping can collapse geometry at endpoints,
and clipping needs its own contour/fill contract.

## Geometry, accuracy, and ownership

Return a fresh line-only PathGeometry (Move/Line/Close), even in straight-guide
special cases. Preserve source contour order, moves, open/closed status, and
parameter traversal. Do not promise an exact adaptive vertex count. Bend lines,
quadratic/cubic curves, ellipse arcs (including singular bases), and the complete
closing edge. Respect canonical arc connections and continuation after Close.
Moving only stored endpoints and control handles is incorrect for this map.

`tolerance` is a positive finite bound on centerline approximation error in
output coordinates, excluding unavoidable floating-point error. It is not an
input flattening tolerance, guide lookup resolution, stroke bound, or pixel
threshold. A later display transform may magnify it. The total bound must include
guide arc-length inversion, guide position and normal error, and output chord
approximation. Normal error is amplified by the source's distance from the
baseline; a small guide-position error alone is insufficient.

Use a conservative error bound against a parameter-matched chord, or an
equivalent traversal-preserving certificate. A few midpoint samples cannot
establish this bound or rule out loops and collinear backtracking. Preserve
traversal across guide seams and repeated laps even when endpoints coincide.
Reject unachievable tolerance or numerical nonprogress rather than relaxing it.

Self-intersections, offset folds, and collapse at a circle's center are allowed
where the forward map remains defined. Do not clamp normal distance to a radius
of curvature. Bending is not topology repair; neither hole preservation nor
invertibility is promised. Fill rules operate on the returned contours as usual.
Stroke widths are applied afterward: bending a stroked centerline does not bend
the original stroke outline. Actual outlines must be supplied for that effect.

Input and guide contents and revisions remain unchanged on success or failure.
The same geometry may be supplied as source and guide if guide constraints hold.
Outputs own independent storage; later input edits do not change earlier results.
Read options once and retain no user options or guide references after return.
No observers, persistent resources, implicit caching, or scheduler work is added.
Recompute from the original source for each edit, then publish through existing
state/signals. Repeated bending of earlier approximations accumulates error.

Validate options and guide even for empty source; valid empty source returns new
empty geometry. Require finite frame coordinates/offsets, positive width,
nonnegative height, positive tolerance, and positive safe-integer maxSegments.
Reject malformed structures, input kinds, and unsupported enum values with
TypeError; reject numeric domains, unsupported guide geometry, overflow,
out-of-range mapping, and exhausted precision/work/output budgets with RangeError.
Include a useful guide/source segment location in diagnostic messages where
possible. Return no partial geometry and perform no mutation on failure.

## Implementation approach and feasibility gate

Share the placement formula, source traversal, output collector, and adaptive
subdivision driver internally. Keep guide evaluation specialized: analytic for
circles, measured curve spans for general paths. Do not expose a generic mapping
callback or public path-measurement class just to implement this feature.

For Along Path, partition the guide into regular spans, establish limiting
tangents, and build bounded arc-length intervals. Bézier chord/control-polygon
length bounds and positive-weight rational representations for ellipse spans
are useful building blocks. Use interval refinement and safeguarded distance
inversion rather than assuming a uniformly sampled lookup table is accurate.
Bound position and unit-normal variation as well as arc length.

Evaluate source subspans with conservative coordinate/derivative bounds and
compose those with the applicable guide bounds. Partition at guide-span,
extension, and wrapping boundaries as necessary; source X need not be monotonic
and can cross a boundary repeatedly. Include uncertainty in fitted length L and
alignment in the error budget. An analytic arc evaluator avoids the general
guide's length-inversion error, but still needs bounded source approximation.

Before committing to the general-path implementation, demonstrate a conservative
combined bound for a regular cubic guide and an offset curved source. This is a
required numerical feasibility check, not a claim that current flattenPath
already supplies the machinery. If a proposed implementation only establishes
a sampled heuristic, revise the accuracy contract explicitly before shipping.

Use bounded iterative work with internal subdivision, guide-measurement, and
nonprogress limits as well as maxSegments. Count Move and Close toward the public
output limit. Limits must throw, not silently return lower quality. Record actual
guard constants during implementation; they are not compatibility promises.

## Delivery and evidence

The current request delivers this proposed design only. Later implementation
follows thin vertical slices:

1. Add one failing public test for a rectangle bent into an annular sector,
   including its bent closing edge and numeric alignment. Implement Along Arc
   and a manually usable Studio example with the original outline, guide,
   direction arrow, baseline, output, and alignment/fit controls.
2. Report the exact running Studio URL as **slice ready for feedback**. Offer
   baseline presets and numeric baseline, plus signed offsets. Keep invalid
   control states visible with useful errors and the last successful preview.
3. Incorporate feedback, then deliver Along Path with an editable smooth cubic
   guide and the same controls. This slice also requires its accuracy proof.
4. After feedback, complete boundary/ownership evidence, documentation, public
   declarations/exports, packaged consumers, and proportional final verification.
   Both utilities and the supported contract are required for **feature complete**.

Required final evidence includes:

- Straight rightward guide identity with an explicitly matching frame/baseline;
  translation, vertical/reversed guides, all alignment anchors and signed offsets.
- Arc radius/sweep/length formulas; inward/outward alignment for both directions;
  annular-sector thickness; center collapse and folds; full-circle wrapping.
- None versus stretch fitting, nonzero frame origins, zero-height frames,
  text-like negative bearings and source geometry outside its reference frame.
- Uneven-speed Béziers measured by distance, regular curves and inflections,
  smooth joins, stationary endpoints, removable stationary points, rejected
  corners/cusps, and self-intersecting guides with unambiguous traversal.
- Error/extend/wrap behavior, negative distance, repeated laps, closed seams,
  and nonmonotonic source X crossing the same boundary repeatedly.
- All source segment kinds, multi-contour sources, closure and post-Close
  semantics, backtracking, extreme scale and normal offset, and independent
  analytical/bounded output-error checks. Dense samples supplement those checks.
- Arc/general-path agreement for equivalent circle guides within their combined
  tolerances; empty/move-only inputs, invalid guides/options, precision/budget
  failures, immutable inputs/revisions, independent results, and no frame requests.
- Public paint, Clip, hit regions, SVG/native export, Bundler/NodeNext consumers,
  packed output, source/built browser modes, and Studio editor declarations.

## Deliberate boundaries and references

Defer guide corners/joins, guide trimming, auto bounds, vertical source axes,
thickness scaling, per-glyph rigid placement, pattern repetition, curve fitting,
inverse mapping, image deformation, stroke outlining, and deformation between
two guide paths. Wrapping one continuous source over a closed guide is not a
pattern-copying facility. Callers may rotate source geometry before bending.

Microsoft's documented analogue is
[System.Drawing.Drawing2D.GraphicsPath.Warp](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.drawing2d.graphicspath.warp),
which provides bilinear/perspective rectangle warping. That documentation does
not establish a built-in Along Arc or Along Path operation. The closer conceptual
reference is [Inkscape Bend Path](https://wiki.inkscape.org/wiki/Bend_Path), which
describes an arc-length guide with normal displacement. CRC's API, validation,
alignment, and accuracy policies above are proposed CRC decisions.

Related repository context:

- [PathGeometry API](../../site/api/functions/path-geometry.md)
- [Drawing contract](../../design/drawing-components-contract.md)
- [Four-corner warp proposal](2026-09-30-path-warp-design.md)
- [Text-to-geometry proposal](2026-09-30-text-path-geometry-design.md)
