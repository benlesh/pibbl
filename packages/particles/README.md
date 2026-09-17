# @crc/particles

Optional particle-effect package for CRC. The root entry provides the
`Particles2D` component, `useParticleSystem`, effect definitions, and direct
tree-shakable descriptor factories such as `particleRange`, `particleChoice`,
and `particleCurve`. These factories create deterministic particle-definition
descriptors; they do not return random values or general CRC utilities.

`@crc/particles/webgl` provides 3D effect definitions, types, and the
instanced `Particles3D` component for use inside `WebGLLayer`.

Canvas execution supports manual, rate, and scheduled births with fixed
capacity storage. Stateless WebGL reconstructs automatic populations from
seed, ordinal, and logical time in one instanced submission per emitter. It
does not perform per-particle CPU updates or expose shaders and raw GL.

Read the [particle effects
guide](../../docs/site/learn/guides/particle-effects.md), the [API
overview](../../docs/site/api/index.md), and the complete public [particle type
reference](../../docs/site/api/types/particles.md).
