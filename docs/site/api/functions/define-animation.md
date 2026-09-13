---
id: api-function-define-animation
title: defineAnimation
summary: Defines a synchronous custom seekable animation sampler.
kind: api
slug: define-animation
apiCategory: function
symbols: [defineAnimation]
relatedTypes:
  [CRCAnimationDefinition, CRCAnimationOptions, CRCAnimationSampleInput]
---

# defineAnimation

`defineAnimation(options)` creates an immutable seekable definition whose
synchronous sampler receives the activation value, local time, and normalized
progress. Use it when the built-in tween, keyframe, and spring definitions do
not describe the required value curve.

Related types: [`CRCAnimationDefinition`](#/api/types/canvas-runtime#crcanimationdefinition),
[`CRCAnimationOptions`](#/api/types/canvas-runtime#crcanimationoptions), and
[`CRCAnimationSampleInput`](#/api/types/canvas-runtime#crcanimationsampleinput).
