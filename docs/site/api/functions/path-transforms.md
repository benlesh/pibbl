---
id: api-function-path-transforms
title: Composable path transforms
summary: Compose envelope, four-corner, and affine mappings before approximating editable geometry.
kind: api
slug: path-transforms
apiCategory: function
symbols:
  [
    PathQuadCorners,
    PathQuadMode,
    BendTransformOptions,
    meshTransform,
    arcBendTransform,
    pathBendTransform,
    MeshTransformOptions,
    ArcBendTransformOptions,
    PathBendTransformOptions,
    transformPath,
    composeTransforms,
    affineTransform,
    quadTransform,
    envelopeTransform,
    PathTransform,
    PathPoint,
    PathRect,
    TransformPathOptions,
    QuadTransformOptions,
    EnvelopeTransformOptions,
    EnvelopeGuide,
    PathGuide,
    PathGuideOptions,
    PathGuideStation,
  ]
---

# Composable path transforms

Create a reusable mapping, then apply it to independent geometry:

```ts
import {
  PathGeometry,
  composeTransforms,
  envelopeTransform,
  affineTransform,
  arcBendTransform,
  transformPath,
} from "@crc/core";

const original = new PathGeometry();
original.rect(0, 0, 200, 50);
const textBounds = { x: 0, y: 0, width: 200, height: 50 };
const top = new PathGeometry();
top.moveTo(0, 0);
top.lineTo(200, 20);
const bottom = new PathGeometry();
bottom.moveTo(0, 50);
bottom.lineTo(200, 70);
const mapping = composeTransforms(
  envelopeTransform({ source: textBounds, top, bottom }),
  affineTransform({ a: 1.2, d: 1.2, e: 100, f: 60 }),
);
const result = transformPath(original, mapping, { tolerance: 0.25 });
```

Composition runs left to right in ordinary coordinates. `source` belongs to a
mapping; each later source rectangle describes the preceding mapping's output.
`transformPath` approximates the final composed outline, including closing
edges, in destination units. It preserves source geometry and contour order.
All-affine compositions preserve curve segments. Nonlinear output uses lines.
`tolerance` is required and positive; `maxSegments` defaults to one million.
Work, output, precision, and domain failures throw without returning partial output.

Envelope inputs can instead use `guides: [{ at: 0, path: top }, { at: 0.4,
path: middle }, { at: 1, path: bottom }]`. Positions strictly increase from zero
to one. Interpolation is linear between guides and may crease at interior guides.
Guides are independent snapshots of one nonempty open contour. They match by
normalized arc length. `{ path, reverse: true, stations: [{ at: 0, distance: 0 },
{ at: 1, distance: 1 }] }` supplies direction and correspondence landmarks.
Stations increase strictly on both axes; distance is measured after reversal.
Crossed guides and intentional folds are allowed. Envelope source bounds are
required; geometry outside them is rejected rather than clamped.

`quadTransform({ source, destination, mode })` accepts the existing four named
corners. Mode is `bilinear` (default) or `perspective`. Perspective requires a
strictly convex destination. Quad mappings allow finite extrapolation.

`mapPoint({ x, y }, { tolerance: 0.0001 })` evaluates a mapping for editor guides
and annotations. The tolerance option is optional and defaults to 0.0001.
Values are opaque; arbitrary objects or callbacks are not PathTransforms.

Sequential `transformPath` calls remain supported when intermediate geometry
is useful. Each call has an independent tolerance; later maps can amplify earlier
approximation error. Prefer composition for a single final accuracy target.

## Meshes

`meshTransform({ source, columns, rows, horizontal, vertical })` creates a grid
of Coons patches. Columns and rows are strictly increasing normalized coordinates
from 0 to 1. Horizontal contains one row of edges per row boundary, each with
`columns.length - 1` left-to-right guides. Vertical contains one column of edges
per column boundary, each with `rows.length - 1` top-to-bottom guides.

Edges share exact endpoint coordinates. Mismatches throw; no points are moved
implicitly. Shared edges are supplied once. Each cell interpolates its four
boundaries. Adjacent cells meet continuously, but matching slopes are not promised.
Folds are permitted. The constructor accepts at most 4,096 cells. Source geometry
must remain inside the source rectangle.

## Bends

Continuing with the imports and original geometry above:

```ts
const bend = arcBendTransform({
  source: { x: 0, y: 0, width: 200, height: 50 },
  arc: { cx: 300, cy: 300, radius: 180, startAngle: -Math.PI, sweep: Math.PI },
  baseline: "bottom",
  fit: "stretch",
});
const bentResult = transformPath(
  original,
  composeTransforms(bend, affineTransform({ e: 20 })),
  {
    tolerance: 0.25,
  },
);
```

`pathBendTransform({ source, guide, ...placement })` takes an explicit
`PathGeometry` guide. Both constructors accept `BendTransformOptions`; arc and
path variants add `arc` and `guide`, respectively. See [path bending](path-bending.md)
for alignment, baseline, fitting, offsets, and overflow rules. Bends retain their
existing smooth-guide requirements; envelopes and meshes also support corners.

## Migration

`warpPath`, `bendPathAlongArc`, and `bendPathAlongPath` are replaced by
`transformPath(path, quadTransform(mapping), quality)`,
`transformPath(path, arcBendTransform(mapping), quality)`, and
`transformPath(path, pathBendTransform({ ...mapping, guide }), quality)`.
There are no root compatibility exports. Separate `tolerance` and `maxSegments`
from mapping options. The root exports `PathPoint`, `PathRect`, `PathQuadCorners`,
and `PathQuadMode` instead of the former warp-specific point/rectangle types.

The in-place `PathGeometry.transform(matrix)` builder remains available. Use
`affineTransform` with `transformPath` when independent results or composition
are needed. Flattening, subdivision, and simplification remain separate geometry
operations rather than spatial mappings.
