---
id: api-function-particle-descriptors
title: Particle descriptors
summary: Builds deterministic ranges, choices, parameters, curves, and gradients for particle definitions.
kind: api
slug: particle-descriptors
apiCategory: function
symbols:
  [
    particleRange,
    particleInteger,
    particleChoice,
    particleParameter,
    particleCurve,
    particleGradient,
  ]
relatedTypes:
  [
    PibblParticleRange,
    PibblParticleIntegerRange,
    PibblParticleChoice,
    PibblParticleParameterReference,
    PibblParticleCurve,
    PibblParticleGradient,
  ]
keywords: [particles, random, curve, gradient, parameter]
---

# Particle descriptors

```ts
import {
  particleChoice,
  particleCurve,
  particleGradient,
  particleInteger,
  particleParameter,
  particleRange,
} from "@pibbl/core/particles";
```

These direct, tree-shakable functions create immutable definition descriptors.
They do not pick a value when called. The particle compiler assigns stable
random channels, and the executor samples them from the system seed, emitter,
particle ordinal, and property channel.

- `particleRange(min, max)` describes a continuous inclusive range.
- `particleInteger(min, max)` describes a safe-integer inclusive range.
- `particleChoice([{ value, weight }])` describes weighted selection.
- `particleParameter(name)` references a typed effect parameter.
- `particleCurve(keys, options?)` samples a scalar or two-dimensional value
  over normalized lifetime.
- `particleGradient(keys, options?)` samples color over normalized lifetime.

Curves and gradients require strictly increasing keys covering `0` through
`1`. These APIs are particle-specific because their descriptors participate in
deterministic channel compilation, parameter timing, and GPU lookup-table
generation; they are not general random-number or interpolation utilities.

Types: [`PibblParticleRange`](#/api/types/particles#pibblparticlerange),
[`PibblParticleIntegerRange`](#/api/types/particles#pibblparticleintegerrange),
[`PibblParticleChoice`](#/api/types/particles#pibblparticlechoice),
[`PibblParticleParameterReference`](#/api/types/particles#pibblparticleparameterreference),
[`PibblParticleCurve`](#/api/types/particles#pibblparticlecurve), and
[`PibblParticleGradient`](#/api/types/particles#pibblparticlegradient).
