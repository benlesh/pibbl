---
id: api-function-interpolate-x
title: interpolateX
summary: Creates a query for an exact observation or a data-space estimate at x.
kind: api
slug: interpolate-x
apiCategory: function
symbols: [interpolateX, InterpolateXOptions, HoverSample]
---

# interpolateX

Import from `@pibbl/core/viz`. Creates a query for an exact observation or a data-space estimate at x.

`interpolateX({series,x,xScale,yScale,interpolation,maxGap?,duplicateX?})` returns a function for HoverData. Source x must be nondecreasing; missing/undefined rows break segments. Duplicates error unless explicitly resolved with first/last. There is no extrapolation or gap bridging; maxGap limits bracketing intervals in domain units. Results distinguish exact original observations from interpolated values with before/after source records, indices, fraction, and mapped anchor.
