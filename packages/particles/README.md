# @crc/particles

Optional particle-effect package for CRC. The root entry provides the
`Particles2D` component, `crcParticleSystem`, effect definitions, and direct
tree-shakable descriptor factories such as `particleRange`, `particleChoice`,
and `particleCurve`. These factories create deterministic particle-definition
descriptors; they do not return random values or general CRC utilities.

`@crc/particles/webgl` currently provides 3D effect definitions and types. The
renderable `Particles3D` component remains gated on the WebGL scene/material
composition work.
