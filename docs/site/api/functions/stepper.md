---
id: api-function-stepper
title: stepper
summary: Defines playback-owned fixed-step stateful animation.
kind: api
slug: stepper
apiCategory: function
symbols: [stepper]
relatedTypes: [PibblAnimationDefinition, PibblStepperOptions]
---

# stepper

`stepper(options)` defines fixed-step state such as acceleration, velocity, or
constraints. Each playback owns its integration state. Elapsed input is clamped
and consumed in fixed increments; seeking recreates the same step sequence.

Related types: [`PibblAnimationDefinition`](#/api/types/canvas-runtime#pibblanimationdefinition)
and [`PibblStepperOptions`](#/api/types/canvas-runtime#pibblstepperoptions).
