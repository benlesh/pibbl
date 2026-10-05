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
    rainDrops,
    RainDropsOptions,
    RainDropsMessage,
    waterWaves,
    WaterWavesOptions,
    WaterWavesMessage,
    waterSurface,
    WaterSurfaceObstacle,
    WaterSurfaceOptions,
    WaterSurfaceMessage,
  ]
---

# Texture types and palettes

Import these types and `texturePalettes` from `@pibbl/core/textures`.

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
through 32, finite nonnegative `rippleStrength` (default 1), and initial `paused`
state. Ripple strength changes existing ripples independently of ambient waves.
This numeric displacement map rejects palettes.

## WaterWavesMessage

Typed `pause`, `reset`, and `{ type: "ripple", x, y }` messages with normalized
coordinates in `[0, 1]`. Reset returns phase to its seeded initial state and clears
ripples while preserving the current pause state.

## WaterSurfaceObstacle

A normalized axis-aligned `{ x, y, width, height }` rectangle within `[0, 1]`.
It is a visual water boundary only and has no hit-testing or physics effect.

## WaterSurfaceOptions

The same seed, speed, scale, ripple-strength, and paused inputs as
`waterWaves`, plus optional `obstacles` and `viscosity`. Viscosity defaults to 0
and accepts 0–1: increasing it slows wave propagation and ambient motion and
increases damping. It is an artistic thickness control, not physical density
or a mass-conserving fluid solver. Changes preserve existing waves and pause state.
For colored or textured liquid, paint a decorative Rectangle with a color or
Pibbl texture and `style.opacity` inside the displaced group; keep
`pointerEvents="none"` so it does not intercept scene input.

`waterSurface` is a WASM-backed,
bounded reflective height field: it uses a maximum 128-cell short edge and
256-cell long edge, while preserving the source aspect ratio.

## WaterSurfaceMessage

The same typed `pause`, `reset`, and normalized `ripple` messages as
`waterWaves`. A ripple can keep a speed-zero field active until its damped
energy settles; a paused field discards elapsed time.

## Recipe factories

`marble`, `paper`, `cellular`, `reactionDiffusion`, `waterWaves`, and `waterSurface` create inert recipes consumed
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
It advances through Pibbl's scheduler and remains static when paused. Speed zero
stops ambient motion while active ripples continue to spread.

## waterSurface

Creates a numeric RG displacement map with bounded, reflecting outer and
rectangle-obstacle boundaries. Solid obstacle pixels are transparent. It is
appearance-only and does not couple to Pibbl physics.

## rainDrops

`rainDrops(options?)` creates a seeded rain-on-glass displacement map. Mount it
with `useTexture` and pass its stretched paint to `displacement({ map, strength,
region, blurRadius })`. Blue encodes local condensation blur. Small beads cling, overlapping beads merge conserving volume, and
larger beads slide downward. This is a droplet simulation, not Gray–Scott ink.

## RainDropsOptions

`seed` is an unsigned 32-bit integer (default 7). `rainRate` is new beads per
second, 0–120 (default 24); `gravity` is a multiplier, 0–10 (default 1).
`initialDrops` is an integer, 0–256 (default 100). `paused` defaults to false.
At most 256 free beads and one held finger bead are live. Radius and motion scale with the shorter texture
side. Palettes are rejected because red/green encode displacement data.

`condensation` is film coverage, 0–1 (default 0). `trailPersistence` is the
exponential recovery/drying time in seconds, 0–60 (default 8); zero clears old
trails at the next advancing frame. `trailStrength` controls newly deposited
residual water, 0–1 (default 0.65). `irregularity` controls outline and path
variation, 0–1 (default 0.8). These controls update without resetting the field.
Moving beads gather film along their swept footprints, leaving clearer paths
and uneven residual water. Film recovery and trail drying pause with the drops.
The bounded, stylized height field models visual behavior, not fluid pressure.

Use a positive displacement `blurRadius` to soften only misted regions. At zero
condensation the dry map is transparent; with condensation it is opaque and
neutral in cleared regions, preserving blue-channel coverage independently
from the displacement normals.

## RainDropsMessage

`pause` carries `paused`; `reset` repeats the configured seed. `nudge` carries
normalized `x`/`y` in [0, 1], normalized width/height movement `dx`/`dy` in
[-1, 1], and optional `radius` in (0, 2], measured against the shorter side
(default 0.12). Nudges work while paused. Seed or initial-count changes reset
simulation state; display resizing alone does not. Long frame gaps are capped
at 50 ms. Refraction affects only filtered Pibbl content, not arbitrary HTML.

`finger` begins or moves one contact with normalized `x`/`y` in [0, 1] and
optional positive `radius` up to 2 (default 0.045, relative to the shorter side).
It wipes a continuous swept path through condensation and residual trails,
collecting that water and intersected beads into one droplet pinned to the
contact. It works while paused. `release` leaves the gathered bead at the last
contact position with zero initial velocity; gravity resumes on advancement.
Repeated release is harmless. Reset cancels the contact. Applications own
pointer capture and should send release on up, cancel, or lost capture.
At free-bead capacity, release coalesces the nearest free pair to make room,
preserving their combined volume.
