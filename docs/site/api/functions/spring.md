---
id: api-function-spring
title: spring
summary: Defines an analytic number spring with deterministic logical time.
kind: api
slug: spring
apiCategory: function
symbols: [spring]
relatedTypes: [CRCAnimationDefinition, CRCSpringOptions]
---

# spring

`spring(options)` returns a number-only analytic damped-oscillator definition.
Mass, stiffness, damping, velocity, rest thresholds, and a maximum duration are
explicit options. Sampling derives from logical time rather than accumulating
display-frame deltas.

Related types: [`CRCAnimationDefinition`](#/api/types/canvas-runtime#crcanimationdefinition)
and [`CRCSpringOptions`](#/api/types/canvas-runtime#crcspringoptions).
