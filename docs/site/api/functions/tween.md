---
id: api-function-tween
title: tween
summary: Defines duration-based interpolation between typed values.
kind: api
slug: tween
apiCategory: function
symbols: [tween]
relatedTypes: [CRCAnimationDefinition, CRCTweenOptions, CRCInterpolator]
---

# tween

`tween(options)` returns an immutable
[`CRCAnimationDefinition`](#/api/types/canvas-runtime#crcanimationdefinition).
Numbers interpolate linearly by default; other value types require an explicit
interpolator. `from` may be omitted so playback captures the output's activation
value.

Use [`drive`](#/api/functions/drive) to bind the definition to a writable signal.

Related types: [`CRCTweenOptions`](#/api/types/canvas-runtime#crctweenoptions)
and [`CRCInterpolator`](#/api/types/canvas-runtime#crcinterpolator).
