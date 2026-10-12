---
id: api-function-keyframes
title: keyframes
summary: Defines two or more typed values across one duration.
kind: api
slug: keyframes
apiCategory: function
symbols: [keyframes]
relatedTypes:
  [PibblAnimationDefinition, PibblKeyframesOptions, PibblInterpolator]
---

# keyframes

`keyframes(options)` creates an immutable seekable definition from at least two
values. Optional offsets must be nondecreasing and cover the values; easing may
be one function or one per segment. Numbers interpolate by default, while other
types require a [`PibblInterpolator`](#/api/types/canvas-runtime#pibblinterpolator).

Related types: [`PibblAnimationDefinition`](#/api/types/canvas-runtime#pibblanimationdefinition)
and [`PibblKeyframesOptions`](#/api/types/canvas-runtime#pibblkeyframesoptions).
