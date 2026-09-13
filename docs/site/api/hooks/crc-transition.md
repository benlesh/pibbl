---
id: api-hook-crc-transition
title: crcTransition
summary: Presents a target through a component-owned tween or spring signal.
kind: api
slug: crc-transition
apiCategory: hook
symbols: [crcTransition]
relatedTypes: [Signal, CRCTweenTransitionOptions, CRCSpringTransitionOptions]
---

# crcTransition

`crcTransition(target, options)` returns a readonly signal. The tween overload
supports typed interpolation; the spring overload is number-only. Omitting
`initial` presents the mount target immediately. A distinct initial value starts
after a successful mounting render, and later unequal targets retarget from the
last committed presented value.

Related types: [`Signal`](#/api/types/canvas-runtime#signal),
[`CRCTweenTransitionOptions`](#/api/types/canvas-runtime#crctweentransitionoptions),
and [`CRCSpringTransitionOptions`](#/api/types/canvas-runtime#crcspringtransitionoptions).
