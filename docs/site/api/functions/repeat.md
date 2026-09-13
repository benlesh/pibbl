---
id: api-function-repeat
title: repeat
summary: Repeats an animation program with an explicit direction.
kind: api
slug: repeat
apiCategory: function
symbols: [repeat]
relatedTypes:
  [CRCAnimationProgram, CRCAnimationRepeatOptions, CRCAnimationRepeatDirection]
---

# repeat

`repeat(program, options)` repeats a child for a positive iteration count or
infinity. Direction is `normal`, `reverse`, `alternate`, or
`alternate-reverse`. Infinite repeats are valid only where the surrounding
composition can schedule them unambiguously.

Related types: [`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram),
[`CRCAnimationRepeatOptions`](#/api/types/canvas-runtime#crcanimationrepeatoptions),
and [`CRCAnimationRepeatDirection`](#/api/types/canvas-runtime#crcanimationrepeatdirection).
