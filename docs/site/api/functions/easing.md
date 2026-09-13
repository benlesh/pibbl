---
id: api-function-easing
title: easing
summary: Provides CRC's frozen collection of easing functions and factories.
kind: api
slug: easing
apiCategory: function
symbols: [easing]
relatedTypes: [CRCEasing]
---

# easing

`easing` is a frozen object containing `linear`, `easeIn`, `easeOut`,
`easeInOut`, `cubicBezier(...)`, and `steps(...)`. Pass one of its
[`CRCEasing`](#/api/types/canvas-runtime#crceasing) values to a tween, keyframe
segment, or tween transition. The object itself is not an easing function.
