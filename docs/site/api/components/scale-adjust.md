---
id: api-component-scale-adjust
title: ScaleAdjust
summary: Positions ordinary Pibbl children using named scale coordinates.
kind: api
slug: scale-adjust
apiCategory: component
symbols: [ScaleAdjust, ScaleAdjustProps]
---

# ScaleAdjust

Import `ScaleAdjust` from `@pibbl/core/viz`. Supply `x` with `xScale`, `y` with `yScale`,
or both pairs. Continuous coordinates are numbers; point-scale coordinates are string or numeric categories. Both accept core signals. Unknown point categories throw `RangeError`; band scales are unsupported. Omitted
axes translate by zero; a coordinate without its matching ID is invalid.

The component maps the supplied coordinates and returns an ordinary translated
core `Group`. It does not allocate space, paint a mark, add hit geometry, or change
signal semantics. Children can be normal core shapes, text, or custom components.
This is the low-level extension point for scaled markers and other composition.
