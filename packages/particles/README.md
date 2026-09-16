# @crc/particles

Optional particle-effect package for CRC. The root entry provides the
`Particles2D` component, `crcParticleSystem`, effect definitions, and direct
tree-shakable descriptor factories such as `particleRange`, `particleChoice`,
and `particleCurve`. These factories create deterministic particle-definition
descriptors; they do not return random values or general CRC utilities.

`@crc/particles/webgl` provides 3D effect definitions, types, and the
instanced `Particles3D` component for use inside `WebGLLayer`.
