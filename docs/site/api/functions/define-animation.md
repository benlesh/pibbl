---
id: api-function-define-animation
title: defineAnimation
summary: Defines a synchronous custom seekable animation sampler.
kind: api
slug: define-animation
apiCategory: function
symbols: [defineAnimation]
relatedTypes:
  [PibblAnimationDefinition, PibblAnimationOptions, PibblAnimationSampleInput]
---

# defineAnimation

`defineAnimation(options)` creates an immutable seekable definition whose
synchronous sampler receives the activation value, local time, and normalized
progress. Use it when the built-in tween, keyframe, and spring definitions do
not describe the required value curve.

Related types: [`PibblAnimationDefinition`](#/api/types/canvas-runtime#pibblanimationdefinition),
[`PibblAnimationOptions`](#/api/types/canvas-runtime#pibblanimationoptions), and
[`PibblAnimationSampleInput`](#/api/types/canvas-runtime#pibblanimationsampleinput).
