---
id: api-component-particles-2d
title: Particles2D
summary: Draws a fixed-capacity Canvas particle effect as one CRC component.
kind: api
slug: particles-2d
apiCategory: component
symbols: [Particles2D]
relatedTypes:
  [Particles2DProps, Particles2DStyle, CRCParticleEffect2D, CRCParticleSystem]
keywords: [particles, canvas, effects, emission]
---

# Particles2D

```ts
import { Particles2D } from "@crc/particles";
```

`Particles2D` binds a 2D effect or an explicitly owned particle system to the
Canvas renderer. Exactly one of `effect` or `system` is required. Effect mode
can use `autoplay` and `seed`; system mode takes its lifecycle from
[`useParticleSystem`](#/api/hooks/use-particle-system).

```tsx
declare const sparks: import("@crc/particles").CRCParticleEffect2D;

<Particles2D
  effect={sparks}
  autoplay
  seed={42}
  pointerEvents="none"
  style={{ width: 640, height: 360, opacity: 0.9 }}
/>;
```

The component owns one fixed-capacity birth ledger and draws through one
private primitive. It does not create one CRC component or event target per
particle. `pointerEvents="auto"` targets the declared component box; individual
particles are never retained interaction objects.

Canvas execution runs particle math on the CPU and paints with Canvas 2D. CRC
does not claim portable GPU acceleration for this path. Use a tight `Layer`
only after measuring a scene; an offscreen bitmap is not automatically faster.

See [Create particle effects](#/learn/guides/particle-effects). Types:
[`Particles2DProps`](#/api/types/particles#particles2dprops),
[`Particles2DStyle`](#/api/types/particles#particles2dstyle),
[`CRCParticleEffect2D`](#/api/types/particles#crcparticleeffect2d), and
[`CRCParticleSystem`](#/api/types/particles#crcparticlesystem).
