---
id: api-function-path-bending
title: Path bending
summary: Bend editable geometry along an arc or smooth path with explicit alignment and accuracy.
kind: api
slug: path-bending
apiCategory: function
symbols:
  [
    bendPathAlongArc,
    bendPathAlongPath,
    PathBendFrame,
    PathBendArc,
    PathBendAlign,
    PathBendBaseline,
    PathBendFit,
    PathBendOverflow,
    PathBendOptions,
    BendPathAlongArcOptions,
  ]
---

# Path bending

`bendPathAlongArc(source, options)` returns independent line-only PathGeometry
following a circular guide. It bends entire curves and closing edges. Source
geometry is unchanged, and the operation does not schedule rendering.

```ts
import { bendPathAlongArc, PathGeometry } from "@crc/core";

const outline = new PathGeometry();
outline.rect(0, -20, 180, 40);
const bent = bendPathAlongArc(outline, {
  source: { x: 0, y: -20, width: 180, height: 40 },
  arc: { cx: 250, cy: 250, radius: 160, startAngle: -Math.PI, sweep: Math.PI },
  align: "center",
  baseline: 0,
  tolerance: 0.25,
});
```

The explicit source frame defines alignment; it does not clip geometry.
`align` is `start` (default), `center`, or `end`. `baseline` selects source
`top`, `center` (default), `bottom`, or an absolute numeric source Y coordinate.
For a rightward guide, bottom baseline puts the source above the guide, and top
baseline puts it below. `offset` moves along the guide and `normalOffset` moves
toward its traversal's right-hand side. Both default to zero.

`fit: 'none'` preserves baseline distances; `'stretch'` stretches source width
to guide length while preserving thickness. Arc angles are radians; positive
sweeps are clockwise in Canvas coordinates. The radius must be positive and the
nonzero signed sweep must be at most one revolution.

`overflow: 'error'` rejects geometry beyond guide endpoints. `'extend'` continues
along endpoint tangent rays; `'wrap'` requires a full-circle guide. Required
positive `tolerance` measures output centerline error in local coordinates.
`maxSegments` defaults to 1,000,000 including Move and Close. Invalid inputs,
unachievable accuracy, and exceeded work/output budgets throw without mutation.
Stroke width is applied after bending; supply outline geometry to bend a stroke's
actual outline. Folds and self-intersections are possible.

`bendPathAlongPath(source, guide, options)` applies the same controls to one
smooth `PathGeometry` guide contour. It follows distance along the actual guide,
not the guide's curve parameter. Guides may use lines, quadratics, cubics, and
ellipse arcs. Sharp joins, reversals, cusps, empty guides, and multiple guide
contours are rejected. Zero-length segments are ignored; stationary endpoints
with a defined limiting tangent are supported. Self-intersections are allowed.

Wrapping requires an explicit smooth Close seam. Both utilities return independent
line geometry with the same paint, clip, targeting, and export behavior. Native
Path2D cannot be used as a guide because its segments cannot be inspected.

Try [Along Arc](#/examples/drawing/path-bending) with draggable center, radius,
and sweep, or [Along Path](#/examples/drawing/along-path) with a draggable cubic guide.
Keep the original geometry and recompute from it when controls change; repeatedly
bending a previous approximation accumulates error. Publish the new geometry
through existing CRC state or signals.
