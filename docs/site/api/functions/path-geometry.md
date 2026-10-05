---
id: api-function-path-geometry
title: PathGeometry
summary: Build and edit packed path geometry and export independent native or SVG snapshots.
kind: api
slug: path-geometry
apiCategory: function
symbols:
  [
    PathGeometry,
    PathSegment,
    toPath2D,
    toSvgPathData,
    flattenPath,
    flattenPathWang,
    simplifyPathRadial,
    simplifyPath,
    subdividePath,
    FlattenPathOptions,
    SimplifyPathOptions,
    SubdividePathOptions,
  ]
---

# PathGeometry

`PathGeometry` is mutable, inspectable geometry backed by private typed arrays.
It supports the Canvas path-building vocabulary, segment editing, 2D affine
transforms, and independent native/SVG conversion.

## Operations at a glance

This is the operation map for editable `PathGeometry`. All functions below are
public exports of `@pibbl/core`; methods belong to a geometry instance.

### Build and edit

| Goal                                | API                                                                  | Result                                                |
| ----------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Draw contours                       | `moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `closePath` | Mutates this geometry; returns void                   |
| Add curved and rectangular shapes   | `arc`, `arcTo`, `ellipse`, `geometry.rect()`, `roundRect`            | Mutates this geometry; returns void                   |
| Copy without sharing edits          | `new PathGeometry(source)`, `clone()`                                | Independent `PathGeometry`                            |
| Append another path                 | `addPath(other, matrix?)`                                            | Mutates this geometry; optionally transforms the copy |
| Inspect segments                    | `segmentCount`, `getSegment(index)`, iteration                       | Count or independent segment values                   |
| Replace, insert, or remove segments | `setSegment`, `spliceSegments`                                       | Mutates this geometry                                 |
| Empty and reuse storage             | `clear()`                                                            | Mutates this geometry                                 |
| Detect edits                        | `revision`                                                           | Mutation counter, not a reactive signal               |

See [construction and editing](#construction-and-editing) and the
[editable geometry example](#/examples/drawing/path-geometry).

### Move, bend, and warp

Mapping constructors return a reusable `PathTransform`, not geometry.
`transformPath(geometry, mapping, { tolerance })` applies one and returns an
independent `PathGeometry`. `composeTransforms(...)` combines mappings left to
right before that final approximation. A mapping's `mapPoint(...)` also maps
individual points, useful for handles and annotations.

| Goal                                                         | API                                    | Working example                                          |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------- |
| Translate, rotate, scale, skew, or reflect in place          | `geometry.transform(matrix)`           | [Editable geometry](#/examples/drawing/path-geometry)    |
| Apply an affine mapping without changing the original        | `affineTransform` with `transformPath` | [Transform examples](path-transforms.md)                 |
| Fit into four corners, using bilinear or perspective mapping | `quadTransform`                        | [Interactive quad warp](#/examples/drawing/path-warp)    |
| Stretch between two or more guide paths                      | `envelopeTransform`                    | [Multi-guide envelope](#/examples/drawing/text-envelope) |
| Warp through a grid of curved boundaries                     | `meshTransform`                        | [Mesh reference](path-transforms.md#meshes)              |
| Bend around a circular arc                                   | `arcBendTransform`                     | [Arc and path bending](#/examples/drawing/path-bending)  |
| Bend along a smooth guide path                               | `pathBendTransform`                    | [Arc and path bending](#/examples/drawing/path-bending)  |
| Combine mappings and apply them once                         | `composeTransforms`, `transformPath`   | [Transform examples](path-transforms.md)                 |

See [composable path transforms](path-transforms.md) for source rectangles,
guide correspondence, mesh boundaries, tolerance, and domain limits. See
[path bending](path-bending.md) for baseline, alignment, fitting, and overflow.
Affine mappings preserve curves; nonlinear mappings produce line segments.

### Change detail and export

| Goal                                                    | API                  | Result                                                                     |
| ------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| Adaptively approximate curves with lines                | `flattenPath`        | Independent line-only geometry                                             |
| Flatten with uniform parameter steps using Wang's bound | `flattenPathWang`    | Independent line-only geometry; predictable segment allocation             |
| Reduce polyline vertices                                | `simplifyPath`       | Independent simplified geometry; curves must be flattened first            |
| Simplify with a radial-distance prepass                 | `simplifyPathRadial` | Independent simplified geometry; the two stages share the tolerance budget |
| Split segments into more editable pieces                | `subdividePath`      | Independent geometry; preserves curves, not equal physical spacing         |
| Draw with native Canvas APIs                            | `toPath2D`           | Fresh native `Path2D` snapshot                                             |
| Export SVG path data                                    | `toSvgPathData`      | SVG path-data string                                                       |

See [geometry utilities](#geometry-utilities) and the
[utility comparison example](#/examples/drawing/path-geometry).

### Boundaries and larger examples

Geometry edits do not schedule rendering: notify a consumed signal after editing.
Changing `Path` or `Group` presentation transforms does not rewrite the source
geometry. Pixel filters likewise do not edit its segments.

Native `Path2D` is opaque: Pibbl cannot turn it back into editable geometry. The
`create*Path` factories return native paths, not `PathGeometry`. Start with the
builder when later editing or warping is needed. Text outlines from `@pibbl/text`
can also provide editable geometry; see [text geometry](text-geometry.md).
Boolean union/intersection/subtraction, equal-distance resampling, and curve
fitting are not provided by this surface.

Explore the [multi-guide text envelope example](#/examples/drawing/text-envelope)
for a larger composition using the same mapping APIs.

## Smallest construction example

```ts
import { PathGeometry, toPath2D, toSvgPathData } from "@pibbl/core";

const geometry = new PathGeometry();
geometry.moveTo(10, 10);
geometry.bezierCurveTo(10, 40, 40, 40, 40, 10);
geometry.closePath();
const native = toPath2D(geometry);
const svgData = toSvgPathData(geometry);
```

## Construction and editing

The mutable builder methods are `moveTo`, `lineTo`, `quadraticCurveTo`,
`bezierCurveTo`, `closePath`, `arc`, `arcTo`, `ellipse`, `geometry.rect()`, and `roundRect`.
They use the corresponding Canvas argument order and return void. Nonfinite
builder inputs are ignored; invalid radii follow Canvas exception categories.

`new PathGeometry(source?)` and `clone()` copy independently. `addPath(other,
matrix?)` copies another geometry, optionally transformed, including self-addition.
Native Path2D and SVG-string import are not supported because native paths do
not expose their segments for reading.

`revision` advances on mutation. Save it separately when checking whether an
instance changed: reading two references to the same object cannot recover a
previous revision. Mutation does not schedule a frame or invalidate a retained
Layer; update a separate signal consumed by your component after editing.

`segmentCount` counts canonical segments. `getSegment(index)` returns an
independent `PathSegment`. `setSegment(index, segment)` replaces a segment;
`spliceSegments(start, deleteCount, segments?)` inserts/removes/replaces segments.
Indices are zero-based, and splice requires an in-range nonnegative deletion
count. A nonempty path must start with Move. Failed edits leave it unchanged.

Segment types use these fields:

| Type           | Fields                                                    |
| -------------- | --------------------------------------------------------- |
| `move`, `line` | `x`, `y`                                                  |
| `quadratic`    | `cpx`, `cpy`, `x`, `y`                                    |
| `cubic`        | `cp1x`, `cp1y`, `cp2x`, `cp2y`, `x`, `y`                  |
| `arc`          | `cx`, `cy`, `ux`, `uy`, `vx`, `vy`, `startAngle`, `sweep` |
| `close`        | none                                                      |

An arc is `center + u*cos(t) + v*sin(t)`; its start and signed sweep are in
radians within one revolution. This preserves ellipses through skew and
reflection. Rectangle/rounded-rectangle and arcTo calls resolve to canonical
segments, not a retained history of builder calls. Editing their points does
not rerun those original calls. Iteration yields independent segment values;
mutation during iteration throws. `clear()` removes geometry but retains buffer
capacity for reuse. Segment lookup scans the packed buffer; sequential iteration
is linear overall.

## Transforms and conversion

`transform(matrix)` mutates coordinates using a finite 2D DOMMatrix-compatible
matrix. Matrix dictionaries accept platform aliases/defaults. 3D/perspective
matrices and overflowing coordinates are rejected before modifying geometry.

`toPath2D(geometry)` always returns a fresh caller-owned snapshot.
`toSvgPathData(geometry)` returns absolute SVG data without decimal rounding.
Neither function caches publicly. Ellipses remain analytic; singular transforms
export traversal-preserving lines. Turning-point stroke joins can differ from a
browser's degenerate native ellipse representation.

Path, Clip, explicit event-target and cursor/event-hook inputs accept geometry
alongside native Path2D. Pibbl privately caches by identity and saved revision;
paint, clipping and interaction use the same native snapshot. Already-rendered
hit regions stay unchanged until their consumer renders again. Browser canvas
methods still require `toPath2D` output. Particle path assets snapshot geometry
when defining an effect, consistent with immutable effect ownership.

## Geometry utilities

```ts
import { flattenPath, simplifyPath, subdividePath } from "@pibbl/core";

const lines = flattenPath(geometry, { tolerance: 0.25 });
const reduced = simplifyPath(lines, { tolerance: 0.5 });
const moreHandles = subdividePath(geometry, { divisions: 3 });
```

All three return independent geometry and preserve separate contours/closure.
Their option types are `FlattenPathOptions`, `SimplifyPathOptions`, and
`SubdividePathOptions`. Each accepts optional `maxSegments` (default 1,000,000,
including Move/Close). Exceeding it throws without changing the input.

- Flatten adaptively replaces curves with lines. Required positive `tolerance`
  measures geometric error in input coordinate units. Transform a clone first
  if you need output/tolerance in screen coordinates. Unachievable numerical
  precision or output limits cause an explicit error, not a partial result.
- Simplify removes polyline vertices using required positive `tolerance`. Curved
  inputs require explicit flattening. Open endpoints and closure are preserved;
  nondegenerate closed rings retain at least three distinct vertices. Topology,
  hole preservation, and freedom from new intersections are not promised.
  Its error is relative to the polyline input, so earlier flattening error adds.
- Subdivide splits each segment into a positive integer `divisions`, preserving
  curves up to floating-point precision. Equal parameter intervals do not mean
  equal physical lengths. Closing edges are subdivided and remain closed.

Equal-distance resampling and curve fitting are separate future operations.
Try the [editable path example](#/examples/drawing/path-geometry).

## Spatial transformations

Use [composable path transforms](path-transforms.md) to apply affine, quad,
envelope, mesh, and bend mappings through `transformPath`. `PathGeometry.transform`
remains the low-level in-place affine operation.
