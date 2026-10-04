---
id: api-function-path-transforms
title: Composable path transforms
summary: Compose envelope, four-corner, and affine mappings before approximating editable geometry.
kind: api
slug: path-transforms
apiCategory: function
symbols:
  [transformPath, composeTransforms, affineTransform, quadTransform, envelopeTransform, PathTransform, PathPoint, PathRect, TransformPathOptions, QuadTransformOptions, EnvelopeTransformOptions, EnvelopeGuide, PathGuide, PathGuideOptions, PathGuideStation]
---

# Composable path transforms

Create a reusable mapping, then apply it to independent geometry:

```ts
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
