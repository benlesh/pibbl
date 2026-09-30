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

```ts
import { PathGeometry, toPath2D, toSvgPathData } from "@crc/core";

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
alongside native Path2D. CRC privately caches by identity and saved revision;
paint, clipping and interaction use the same native snapshot. Already-rendered
hit regions stay unchanged until their consumer renders again. Browser canvas
methods still require `toPath2D` output. Particle path assets snapshot geometry
when defining an effect, consistent with immutable effect ownership.

## Geometry utilities

```ts
import { flattenPath, simplifyPath, subdividePath } from "@crc/core";

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
