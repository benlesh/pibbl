---
id: api-hook-crc-particle-system
title: crcParticleSystem
summary: Owns particle playback, commands, status, parameters, and renderer binding for one component slot.
kind: api
slug: crc-particle-system
apiCategory: hook
symbols: [crcParticleSystem]
relatedTypes:
  [
    CRCParticleSystem,
    CRCParticleSystemOptions,
    CRCParticleSystemStatus,
    CRCParticleExecution,
  ]
keywords: [particles, hook, pause, restart, emit, drain]
---

# crcParticleSystem

```ts
import { crcParticleSystem } from "@crc/particles";
```

Creates a stable component-owned system for an immutable 2D or 3D definition.
Its controls are `play`, `pause`, `resume`, `restart`, `emit`, and `stop`.
`status` and `execution` are readonly CRC signals.

Commands enter the shared scheduler's Begin phase. Population advances in
Advance, metadata publishes in Commit, renderer work plans and paints, and
events/errors deliver in Complete. Removal cancels queued commands, unregisters
the scheduler participant, releases the renderer binding and parameter epochs,
and makes retained controls inert.

Use explicit system mode when event handlers need manual bursts or lifecycle
controls. Canvas supports manual births. Stateless WebGL currently accepts
automatic definitions only.

Types: [`CRCParticleSystem`](#/api/types/particles#crcparticlesystem),
[`CRCParticleSystemOptions`](#/api/types/particles#crcparticlesystemoptions),
[`CRCParticleSystemStatus`](#/api/types/particles#crcparticlesystemstatus), and
[`CRCParticleExecution`](#/api/types/particles#crcparticleexecution).
