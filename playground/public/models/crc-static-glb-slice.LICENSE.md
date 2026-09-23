# CRC Static GLB Calibration Totem — provenance and license

## Provenance

- **Title:** CRC Static GLB Calibration Totem
- **Author:** CRC contributors
- **Authoritative source:** [the vendored CRC repository asset](https://github.com/benlesh/crc/blob/main/playground/public/models/crc-static-glb-slice.glb)
- **Source revision:** SHA-256 `ba852d0135ef287aa93ff7fbbb52d8647f5a34b382b80088db180ad783ed48e8`
- **Creation date:** 2026-09-17
- **Download date:** Not applicable. This is an original CRC-authored asset and was not downloaded or adapted from an upstream model.
- **License:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode)

The author has dedicated this asset to the public domain under CC0 1.0. To the extent possible under law, the author has waived all copyright and related or neighboring rights in the asset. The asset may be copied, modified, distributed, and performed, including for commercial purposes, without asking permission.

## Deterministic generation record

No third-party geometry, texture, font, or binary payload is included. The GLB was generated directly as a glTF 2.0 binary container with no post-export preprocessing:

1. Create two independently indexed cuboids with explicit flat normals and UV set zero. The tall cuboid is `1 × 1.5 × 1`; the compact cuboid is `1 × 1 × 0.75`.
2. Place both mesh nodes under a parent translated by `(0, 0.25, 0)`. Child translations produce final model origins at `(-1, 1, 0)` and `(1, 0.75, 0)`.
3. Assign two metallic-roughness materials. Their `(metallic, roughness)` factors are `(0.15, 0.72)` and `(0.82, 0.28)`.
4. Generate one embedded 8 × 8 RGBA PNG with four solid orientation quadrants: amber upper-left, sky blue upper-right, green lower-left, and violet lower-right. Both materials reference this one texture with UV set zero.
5. Pack all vertex streams, indices, PNG bytes, JSON, and required four-byte padding into one self-contained GLB 2 file.

The resulting asset contains one selected scene, a three-node hierarchy, two meshes, two triangle primitives, two materials, one texture, one sampler, and one embedded PNG. It intentionally contains no external URI, animation, skin, camera, punctual-light extension, normal map, occlusion map, emissive map, HDR environment, or deferred glTF feature.
