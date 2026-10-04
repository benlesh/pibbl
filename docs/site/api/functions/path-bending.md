---
id: api-function-path-bending
title: Path bending
summary: Define reusable arc and path bends and compose them with other geometry mappings.
kind: api
slug: path-bending
apiCategory: function
symbols:
  [PathBendArc, PathBendAlign, PathBendBaseline, PathBendFit, PathBendOverflow]
---

# Path bending

Use `arcBendTransform` or `pathBendTransform` with `transformPath`. See the
[composable transforms reference](path-transforms.md) for signatures and examples.

`baseline` is `top`, `center` (default), `bottom`, or an absolute source Y value.
`align` is `start` (default), `center`, or `end`. `fit` is `none` (default) or
`stretch`. `offset` moves along the guide; `normalOffset` moves along its normal.
Both default to zero. Positive normal displacement is to the right of traversal.

`overflow` is `error` (default), `extend` (continue the endpoint tangent), or
`wrap` (closed guides only). Circular arc angles use radians and a nonzero signed
sweep of at most one revolution. Path guides must be one smooth directed contour;
corners and cusps are rejected. Unlike envelope guides, closed bend guides support
wrapping. Source-frame height may be zero for a baseline-only bend.
