---
id: api-function-tween
title: tween
summary: Defines duration-based interpolation between typed values.
kind: api
slug: tween
apiCategory: function
symbols: [tween]
relatedTypes: [PibblAnimationDefinition, PibblTweenOptions, PibblInterpolator]
---

# tween

`tween(options)` returns an immutable
[`PibblAnimationDefinition`](#/api/types/canvas-runtime#pibblanimationdefinition).
Numbers interpolate linearly by default; other value types require an explicit
interpolator. `from` may be omitted so playback captures the output's activation
value.

Use [`drive`](#/api/functions/drive) to bind the definition to a writable signal.

Related types: [`PibblTweenOptions`](#/api/types/canvas-runtime#pibbltweenoptions)
and [`PibblInterpolator`](#/api/types/canvas-runtime#pibblinterpolator).
