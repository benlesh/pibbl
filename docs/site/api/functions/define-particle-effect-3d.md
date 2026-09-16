---
id: api-function-define-particle-effect-3d
title: defineParticleEffect3D
summary: Validates and compiles an immutable three-dimensional particle definition.
kind: api
slug: define-particle-effect-3d
apiCategory: function
symbols: [defineParticleEffect3D]
relatedTypes:
  [CRCParticleEffect3D, CRCParticleEffect3DInput, CRCParticleEmitter3D]
keywords: [particles, definition, webgl, emitter]
---

# defineParticleEffect3D

```ts
import { defineParticleEffect3D } from "@crc/particles/webgl";
```

Creates an immutable validated 3D effect. Point and billboard renderers declare
unlit or emissive material intent, alpha/additive/cutout blending, depth flags,
and a closed sorting policy. They do not expose shader source, raw GL context,
or draw callbacks.

The compiled definition records execution capabilities. `Particles3D` accepts
the stateless-WebGL subset and reports the exact modules that require a future
stateful executor.

Types: [`CRCParticleEffect3D`](#/api/types/particles#crcparticleeffect3d),
[`CRCParticleEffect3DInput`](#/api/types/particles#crcparticleeffect3dinput),
and [`CRCParticleEmitter3D`](#/api/types/particles#crcparticleemitter3d).
