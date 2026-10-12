---
id: api-types-pattern-textures
title: Parameterized patterns, fabrics, and Gray–Scott presets
summary: Seamless parameterized patterns, periodic motion, and expanded living ink chemistry.
kind: api
slug: pattern-textures
apiCategory: types
symbols:
  [
    plainWeave,
    twill,
    herringbone,
    FabricOptions,
    softNoise,
    ridgedNoise,
    NoiseOptions,
    schnakenberg,
    barkley,
    brusselator,
    schnakenbergPresets,
    barkleyPresets,
    brusselatorPresets,
    SchnakenbergOptions,
    BarkleyOptions,
    BrusselatorOptions,
    stripes,
    checkers,
    woodGrain,
    StripesOptions,
    CheckersOptions,
    WoodGrainOptions,
    PatternMotionOptions,
    grayScottPresets,
    ReactionDiffusionPreset,
  ]
---

# Parameterized pattern textures

Import recipes and types from `@pibbl/core/textures`. Mount a recipe with
`useTexture` from `@pibbl/core`, supplying resolution and palette there. Recipes
return `TextureRecipe<never>`: these patterns have no message commands.

## stripes

Creates a recipe with `StripesOptions`.

## StripesOptions

`stripes({ bands, dutyCycle, wave, waveCycles, phase, speed })` uses the first
palette color for the background and the last for the bands. `bands` is an integer
1–64 (default 8), `dutyCycle` is 0–1 (default 0.5), `wave` is horizontal amplitude
in tile fractions 0–1 (default 0), and `waveCycles` is an integer 1–16 (default 1).
Rotate the complete repeating paint through `texture.paint({ rotation: 45 })`.

## checkers

Creates a recipe with `CheckersOptions`.

## CheckersOptions

`checkers({ columns, rows, phase, speed })` alternates the palette endpoints.
Rows/columns are even integers 2–64 (default 8), preserving seamless alternation.
Change tile width/height independently to make rectangular checks.

## woodGrain

Creates a recipe with `WoodGrainOptions`.

## WoodGrainOptions

`woodGrain({ seed, grain, distortion, roughness, knots, knotSize, phase, speed })`
produces a seeded wood surface. Seed is unsigned 32-bit (default 42). Grain periods
are integer 4–128 (default 32). Distortion and roughness are 0–1 (defaults 0.5 and
0.4). Distortion bends growth lines with several scales of periodic seeded noise;
zero leaves straight grain except where knots deflect it. Roughness adds fine
fibers and pore variation. Knots are integer 0–12 (default 0); zero gives clear
wood. Knot size is a tile-radius fraction 0.02–0.18 (default 0.09). Elliptical knots
have seeded round-to-elliptical outlines with their long axis along the grain.
They push nearby growth lines outward so the grain flows around the core, and
contain darker concentric rings. Their seeded positions
wrap at tile boundaries. Palette colors form a tonal ramp.

The initial unreleased `hair` / `HairOptions` study was replaced by `woodGrain` /
`WoodGrainOptions` after visual feedback. No compatibility alias is retained;
actual hair/fur remains a separate future family.

## PatternMotionOptions

All three accept finite `phase` in cycles (wrapped) and `speed` in cycles per
second, finite 0–20 (default 0). Zero speed stops continuing frame requests.
Changing speed preserves the current phase; changing authored phase sets it.
Geometry is periodic on both axes throughout motion. At fixed parameters one
phase cycle repeats the field. These recipes use reusable Canvas raster buffers;
the existing chemical solver remains WASM.

## grayScottPresets

Frozen feed/kill pairs for `spots`, `stripes`, `coral`, `worms`, `labyrinths`, and
`mitosis`. The first two preserve their existing coefficients. Appearance depends
on resolution, seed, and step count; names describe characteristic regimes rather
than guaranteeing a particular shape at every seed and time.

## ReactionDiffusionPreset

The six keys of `grayScottPresets`, selecting chemistry within one solver.

`reactionDiffusion` and `ReactionDiffusion` additionally accept optional `feed`
and `kill` overrides, finite 0–0.1, and `warmupSteps`, integer 0–4096 (default 0).
Warmup runs once during initialization, synchronously, before the first texture
publication. Large grids and warmups can delay mounting; use a modest simulation
resolution for previews. Changing chemistry or warmup resets the field. Recoloring
preserves it. Existing paint/stir/pause/reset commands remain available.

The simulation uses periodic neighboring cells. Existing paint clipping and
clamped stirring are unchanged; interactions do not wrap around the tile. Living
ink is animated, without an exact animation-loop or arbitrary-time seek promise.

## plainWeave

`plainWeave(options)` alternates warp over weft at each crossing.

## twill

`twill(options)` creates two-over, two-under crossings stepping diagonally.

## herringbone

`herringbone(options)` uses a 2/2 broken twill, offsetting the interlacing order
at each four-column reversal rather than forming a continuous chevron point.
Its eight-column harness sequence is 1,2,3,4,2,1,4,3, matching the example in
[CottonWorks Weaving 101, page 23](https://cottonworks.com/wp-content/uploads/2023/03/Weaving-101.pdf).

## FabricOptions

All three factories return `TextureRecipe<never>` and share optional controls:
`threads` is the thread count on each axis, a multiple of 8 in 8–128 (default 16).
`threadWidth` is the fraction of spacing occupied by a thread, 0.2–1 (default 0.8).
`relief` controls rounded thread shading, 0–1 (default 0.65), and `fuzz` controls
seeded directional fiber variation and softened, uneven yarn edges, 0–1 (default
0.2). `seed` is unsigned 32-bit (default
42). Phase and speed follow `PatternMotionOptions`; speed defaults to zero and
idles. Palette colors form a tonal ramp with lighter warp and darker weft. Gap
pixels use the dark end. This is a stylized fabric surface, without physical cloth
simulation or individually simulated fibers. Rotate the complete repeat lattice
through paint placement. Use enough raster resolution for the chosen thread count;
small raster or display sizes can alias fine fibers.

## softNoise

`softNoise(options)` sums periodic smooth value-noise layers. Each successive
layer doubles the integer lattice frequency. Layer amplitudes are normalized.

## ridgedNoise

`ridgedNoise(options)` folds each layer with `1 - abs(noise)` before summing it,
producing connected bright crests and softer valleys. Both are material fields,
without a terrain or physical cloud simulation contract.

## NoiseOptions

Seed is unsigned 32-bit (default 42). Frequency is integer 1–16 (default 4);
octaves is integer 1–6 (default 4); persistence is 0–1 (default 0.5). Contrast is
0–4 (default 1), centered around 0.5 with final color values clamped to the ramp.
Zero contrast is a uniform midpoint field. Phase/speed follow PatternMotionOptions.
Motion scrolls the field periodically, preserving its seams; zero speed idles.
Mount with useTexture for colors and resolution. Use enough resolution for the
highest selected frequency to avoid aliasing. Layer composition belongs to the
application; these factories add no new blending or filter API.

## schnakenberg

`schnakenberg(options?)` creates a periodic activator/inhibitor simulation recipe
accepting `InkMessage` paint, stir, pause and reset. Mount with `useTexture` for
palette and resolution, and use paint placement for tile size.

## barkley

`barkley(options?)` creates an excitable two-field simulation initialized with a
broken excitation front. Paint excites activator; stir advects both fields.

## brusselator

`brusselator(options?)` creates a periodic two-field feed/conversion simulation.
Color represents activator relative to twice its equilibrium concentration.

## SchnakenbergOptions

`a` and `b` are 0.01–2 (defaults 0.1, 0.9); diffusion defaults to 1, 20.

## BarkleyOptions

`a` is 0.3–1.2 (default 0.75), `b` is 0–0.2 (default 0.02), and `epsilon` is
0.005–0.1 (default 0.02). Diffusion defaults to 1, 0. Color represents excitation.

## BrusselatorOptions

`a` is 0.1–3 (default 1), `b` is 0.1–5 (default 1.8). Diffusion defaults to 0.2, 2.

All three types accept `seed` (uint32, default 42), `diffusionU`/`diffusionV`
(0–32), `initialNoise` (0–1, default 0.1), `warmupSteps` (integer 0–12000,
default 4096), `speed` (0–4, default 1) and `paused` (default false).
Speed multiplies 480 numerical steps per second; an internal stability-limited
step size depends on chemistry and diffusion. Zero speed or pause idles.
Chemistry, seed, noise and warmup changes reset the field; speed and pause changes
preserve it. Reset reproduces initialization and preserves pause state. Palette
changes preserve the field. Resolution changes initialize a new field.
Minimum resolution is 3×3. Raster borders duplicate periodic samples. All stepping,
brushes and stirring wrap. Brush radius is in simulation cells.

## schnakenbergPresets

Immutable `spots` and `labyrinths` option objects, spread into `schnakenberg`.

## barkleyPresets

Immutable `spirals` and `waves` option objects, spread into `barkley`.

## brusselatorPresets

Immutable `spots` and `oscillations` option objects, spread into `brusselator`.
