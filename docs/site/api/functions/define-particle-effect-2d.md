---
id: api-function-define-particle-effect-2d
title: defineParticleEffect2D
summary: Validates and compiles an immutable two-dimensional particle definition.
kind: api
slug: define-particle-effect-2d
apiCategory: function
symbols: [defineParticleEffect2D]
relatedTypes:
  [PibblParticleEffect2D, PibblParticleEffect2DInput, PibblParticleEmitter2D]
keywords: [particles, definition, canvas, emitter]
---

# defineParticleEffect2D

```ts
import { defineParticleEffect2D } from "@pibbl/core/particles";
```

Creates an immutable validated effect from one or more named emitters. The
returned value contains no clock or mutable population. A mounted component or
particle system owns execution.

Emitter capacity, emission sources, shape, initial values, motion modules,
over-life appearance, renderer, and optional bounds are compiled once. Invalid
or unsupported combinations fail at definition time with the effect, emitter,
and property in the diagnostic.

Types: [`PibblParticleEffect2D`](#/api/types/particles#pibblparticleeffect2d),
[`PibblParticleEffect2DInput`](#/api/types/particles#pibblparticleeffect2dinput),
and [`PibblParticleEmitter2D`](#/api/types/particles#pibblparticleemitter2d).
