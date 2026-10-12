---
id: api-hook-use-particle-system
title: useParticleSystem
summary: Owns particle playback, commands, status, parameters, and renderer binding for one component slot.
kind: api
slug: use-particle-system
apiCategory: hook
symbols: [useParticleSystem]
relatedTypes:
  [
    PibblParticleSystem,
    PibblParticleSystemOptions,
    PibblParticleSystemStatus,
    PibblParticleExecution,
  ]
keywords: [particles, hook, pause, restart, emit, drain]
---

# useParticleSystem

```ts
import { useParticleSystem } from "@pibbl/core/particles";
```

Creates a stable component-owned system for an immutable 2D definition.
Its controls are `play`, `pause`, `resume`, `restart`, `emit`, and `stop`.
`status` and `execution` are readonly Pibbl signals.

Commands enter the shared scheduler's Begin phase. Population advances in
Advance, metadata publishes in Commit, renderer work plans and paints, and
events/errors deliver in Complete. Removal cancels queued commands, unregisters
the scheduler participant, releases the renderer binding and parameter epochs,
and makes retained controls inert.

Use explicit system mode when event handlers need manual bursts or lifecycle
controls. Canvas supports both automatic emission and manual births.

Types: [`PibblParticleSystem`](#/api/types/particles#pibblparticlesystem),
[`PibblParticleSystemOptions`](#/api/types/particles#pibblparticlesystemoptions),
[`PibblParticleSystemStatus`](#/api/types/particles#pibblparticlesystemstatus), and
[`PibblParticleExecution`](#/api/types/particles#pibblparticleexecution).
