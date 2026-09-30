---
id: api-types-textures
title: Texture types and palettes
summary: Procedural texture options, color palettes, and borrowed image/mask presentation.
kind: api
slug: textures
apiCategory: types
symbols:
  [
    ReactionDiffusionProps,
    ProceduralTextureProps,
    TextureBrush,
    TexturePalette,
    TextureResolution,
    TextureKind,
    TextureRenderer,
    TextureRenderFrame,
    texturePalettes,
  ]
---

# Texture types and palettes

Import these types and `texturePalettes` from `@crc/textures`.

## `ReactionDiffusionProps`

Optional `seed`, `preset`, `resolution`, `palette`, `paused`, `resetRevision`,
`brush`, and `render` inputs. Reset revision must be a safe integer.

## `ProceduralTextureProps`

Required `kind`, optional `seed`, `resolution`, `scale`, `detail`, `palette`,
and `render`. Materials idle until inputs change.

## `TextureBrush`

`{ radius, strength }`: finite radius in (0,128] simulation cells and strength
in [0,1]. `false` disables the reaction–diffusion brush.

## `TexturePalette`

A readonly array of 2–16 opaque `#RRGGBB` strings, evenly interpolated in sRGB.

## `texturePalettes`

Frozen `lagoon`, `porcelain`, and `ember` palettes. Pass an ordinary palette array
for custom colors.

## `TextureResolution`

Readonly integer `width`/`height`, each from 8 to 1024, and at most 262,144 cells.
Independent of the display box. Seed values are unsigned 32-bit integers.

## `TextureKind`

`'marble' | 'paper' | 'cellular'`.

## `TextureRenderer`

Synchronous `(context, texture) => void` callback. Its context uses logical display
units; state is saved/restored. No promises, hooks, or signal writes.

## `TextureRenderFrame`

`source` is the low-resolution color canvas; `mask` is a lazily allocated white
canvas with normalized field intensity as alpha. `width`/`height` describe the
display allocation; `textureWidth`/`textureHeight` describe generation resolution.
Sources are read-only, callback-scoped borrows. Do not retain, transfer, resize,
or dispose them. Copy to an application-owned surface for a still image.
