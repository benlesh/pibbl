# @crc/core/particles

Particle effects included in CRC. The `@crc/core/particles` entry provides the
`Particles2D` component, `useParticleSystem`, effect definitions, and direct
tree-shakable descriptor factories such as `particleRange`, `particleChoice`,
and `particleCurve`. These factories create deterministic particle-definition
descriptors; they do not return random values or general CRC utilities.

Canvas execution supports manual, rate, and scheduled births with fixed
capacity storage. CRC does not define a parallel 3D particle vocabulary; Three
applications use Three's particle and instancing facilities inside an
`@crc/three` layer.

Read the [particle effects
guide](../../../../../docs/site/learn/guides/particle-effects.md), the [API
overview](../../../../../docs/site/api/index.md), and the complete public [particle type
reference](../../../../../docs/site/api/types/particles.md).
