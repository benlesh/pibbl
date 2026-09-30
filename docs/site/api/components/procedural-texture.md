---
id: api-component-procedural-texture
title: ProceduralTexture
summary: Seeded marble, paper, and cellular surfaces with independently configurable color and presentation.
kind: api
slug: procedural-texture
apiCategory: component
symbols: [ProceduralTexture]
relatedTypes: [ProceduralTextureProps, TextureKind, TextureRenderer]
---

# ProceduralTexture

Import from `@crc/textures`. Required `kind` is `marble`, `paper`, or `cellular`.
Defaults: seed 42, 256 × 160 resolution, scale 6, detail 0.65, porcelain palette.
Scale is in `1–32`; detail is in `0–1`. Shape inputs regenerate; palettes recolor.
Display dimensions do not change the generated field.

It uses the render-layer style/event surface and stops scheduling after generation.
Use `pointerEvents="none"` for decorative content. The optional `render` callback
supports images, repeating fills, and masks. All three materials have matching opposite edges for seamless repetition.
Feature counts round to whole periods where needed. See [Material Lab](#/examples/composition/material-lab).

Options: [ProceduralTextureProps](#/api/types/textures#proceduraltextureprops), [TextureKind](#/api/types/textures#texturekind), [TextureRenderer](#/api/types/textures#texturerenderer).
