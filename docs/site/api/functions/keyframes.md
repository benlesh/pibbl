---
id: api-function-keyframes
title: keyframes
summary: Defines two or more typed values across one duration.
kind: api
slug: keyframes
apiCategory: function
symbols: [keyframes]
relatedTypes: [CRCAnimationDefinition, CRCKeyframesOptions, CRCInterpolator]
---

# keyframes

`keyframes(options)` creates an immutable seekable definition from at least two
values. Optional offsets must be nondecreasing and cover the values; easing may
be one function or one per segment. Numbers interpolate by default, while other
types require a [`CRCInterpolator`](#/api/types/canvas-runtime#crcinterpolator).

Related types: [`CRCAnimationDefinition`](#/api/types/canvas-runtime#crcanimationdefinition)
and [`CRCKeyframesOptions`](#/api/types/canvas-runtime#crckeyframesoptions).
