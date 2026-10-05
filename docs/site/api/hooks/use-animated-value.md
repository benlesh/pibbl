---
id: api-hook-use-animated-value
title: useAnimatedValue
summary: Presents a target through a component-owned tween or spring signal.
kind: api
slug: use-animated-value
apiCategory: hook
symbols: [useAnimatedValue]
relatedTypes:
  [Signal, PibblTweenAnimatedValueOptions, PibblSpringAnimatedValueOptions]
---

# useAnimatedValue

`useAnimatedValue(target, options)` returns a readonly signal. The tween overload
supports typed interpolation; the spring overload is number-only. Omitting
`initial` presents the mount target immediately. A distinct initial value starts
after a successful mounting render, and later unequal targets retarget from the
last committed presented value.

Related types: [`Signal`](#/api/types/canvas-runtime#signal),
[`PibblTweenAnimatedValueOptions`](#/api/types/canvas-runtime#pibbltweenanimatedvalueoptions),
and [`PibblSpringAnimatedValueOptions`](#/api/types/canvas-runtime#pibblspringanimatedvalueoptions).
