---
id: api-function-linear-interpolation
title: linearInterpolation
summary: Returns an ordinary linear interpolation function.
kind: api
slug: linear-interpolation
apiCategory: function
symbols: [linearInterpolation, HoverInterpolation]
---

# linearInterpolation

Import from `@pibbl/core/viz`. Returns an ordinary linear interpolation function.

`linearInterpolation()` returns `(beforeY, afterY, fraction) => number`. Pass it as interpolateX's interpolation function or supply your own synchronous function. It estimates in data space before scales map the result. Inputs and output must be finite.
