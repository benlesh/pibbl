---
id: api-component-particles-3d
title: Particles3D
summary: Contributes a fixed-capacity instanced particle system to a settled WebGL scene.
kind: api
slug: particles-3d
apiCategory: component
symbols: [Particles3D]
relatedTypes:
  [Particles3DProps, Particles3DStyle, CRCParticleEffect3D, CRCParticleBounds3D]
keywords: [particles, webgl, instancing, emissive, additive]
---

# Particles3D

```ts
import { Particles3D } from "@crc/particles/webgl";
```

`Particles3D` is valid only inside [`WebGLLayer`](#/api/components/webgl-layer).
It contributes immutable instanced recipes during scene composition; the
WebGL renderer later settles pass, depth, opacity, picking, and transactional
bitmap work with the rest of the island.

```tsx
declare const embers: import("@crc/particles/webgl").CRCParticleEffect3D;

<Particles3D effect={embers} autoplay seed={42} pointerEvents="none" />;
```

Project 1 executes automatic rate and scheduled births analytically from
`gl_InstanceID`, seed, and logical time. Spawn and simulation parameters are
fixed for a running binding. Render parameters may change live. Manual births,
stateful overflow, and CPU/GPU stateful simulation return capability errors
until a later execution project implements them.

When `pointerEvents` is not `"none"`, provide finite `interactionBounds`.
Picking and focus use that one projected volume; CRC never ray-tests individual
particles. Additive or unsorted rendering is the fast path. Capacity is a GPU
resource commitment even when few particles are visible.

See [Create particle effects](#/learn/guides/particle-effects) and the live
[GPU embers](#/examples/webgl/embers) and
[GPU fireflies](#/examples/webgl/fireflies) examples.

Types: [`Particles3DProps`](#/api/types/particles#particles3dprops),
[`Particles3DStyle`](#/api/types/particles#particles3dstyle),
[`CRCParticleEffect3D`](#/api/types/particles#crcparticleeffect3d), and
[`CRCParticleBounds3D`](#/api/types/particles#crcparticlebounds3d).
