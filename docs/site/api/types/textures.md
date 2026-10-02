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
    marble,
    paper,
    cellular,
    reactionDiffusion,
    MaterialOptions,
    ReactionDiffusionOptions,
    InkMessage,
    waterWaves,
    WaterWavesOptions,
    WaterWavesMessage,
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

`{ radius, strength }`: finite radius from greater than zero through 128
simulation cells and strength from 0 through 1. `false` disables the
reaction–diffusion brush.

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

## MaterialOptions

Seed, scale, and detail for `marble`, `paper`, and `cellular` recipe factories.

## ReactionDiffusionOptions

Seed and spots/stripes preset for the `reactionDiffusion` recipe factory.

## InkMessage

Typed `paint`, `stir`, `pause`, and `reset` messages delivered through the texture's
`send` method. Paint uses normalized `u`/`v`, a radius in cells (default 6), and
strength in [0, 1] (default 0.8). Stir uses normalized `u`/`v`, normalized `du`/`dv`
displacements in [-1, 1], and a radius in cells (default 16). Radii must be finite,
greater than zero, and at most 128. All coordinates/vectors must be finite;
centers outside [0, 1] are ignored.

Stir displaces existing ink with smooth local falloff; it adds no ink. Pause stops
reaction stepping while explicit paint/stir commands still apply. Reset repeats
the seed and preserves pause. Messages run in send order on the next eligible
texture frame, and sends after disposal are inert.

## WaterWavesOptions

Optional unsigned `seed`, finite nonnegative `speed`, integer `scale` from 1
through 32, and initial `paused` state. This numeric displacement map rejects
palettes.

## WaterWavesMessage

Typed `pause` and `reset` messages. Reset returns phase to its seeded initial
state while preserving the current pause state.

## Recipe factories

`marble`, `paper`, `cellular`, `reactionDiffusion`, and `waterWaves` create inert recipes consumed
by `useTexture` from core (also re-exported by this package). Use the returned
resource directly as `style.fill` or `style.stroke`; no renderer callback is needed.

## marble

Creates a seamless warped-band material recipe.

## paper

Creates a seamless fiber and grain recipe.

## cellular

Creates a seamless toroidal cell-field recipe.

## reactionDiffusion

Creates a living Gray–Scott recipe that accepts `InkMessage` values.

## waterWaves

Creates a periodic numeric RG displacement map for the `displacement` filter.
It advances through CRC's scheduler and remains static when paused or at speed
zero.
