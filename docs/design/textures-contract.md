# Procedural textures contract

Status: implemented, 2026-09-30.

`@crc/textures` is an optional peer of `@crc/core`, implemented exclusively through
public `defineRenderLayer`. It owns no second scheduler and imports no core friend
entry. Its public values are `ReactionDiffusion`, `ProceduralTexture`, and
`texturePalettes`; its types describe props, palettes, resolutions, brushes,
material kinds, and the synchronous presentation callback.

## Persistence and timing

One mounted identity owns one simulation/scalar field and low-resolution raster.
Resource creation is inert at module import. Render-layer lifecycle creation,
updates, resizing, rendering, and disposal determine all ownership. Reevaluation
and display-density changes preserve the field. Every source raster is independent
of display dimensions; core still owns a display-resolution presentation surface.

Gray–Scott uses double-buffered float fields, the nine-point stencil with center
−1, cardinal 0.2, diagonal 0.05, diffusion coefficients 1 and 0.5, and numerical
time step 1. Spots use feed 0.0367/kill 0.0649; stripes use 0.029/0.057. Boundaries
are periodic. Seeded distributed patches initialize concentrations. Each eligible
CRC render admits at most 50 ms, retains fractional step time, and executes up to
24 steps at 480 steps/second. Excess host time is discarded. Initial/reset/resume
frames establish a fresh baseline. Paused fields accept brushes and recoloring
without numerical advancement or continuing frame requests.

The implementation advances private fields during the external render callback,
not in the scheduler's Advance phase. It never writes public signals in that
callback. Continuing work uses the supplied frame invalidator. No arbitrary-time
seeking, checkpoints, rollback of chemical fields, GPU, workers, or WASM are promised.

## Input and update semantics

CRC resolves one topmost target and supplies layer-local pointer coordinates.
The default brush mapping scales the displayed rectangle into the simulation.
A single primary pointer is captured through CRC; release/cancel ends the stroke.
Stamps interpolate movement and clip to the field, without clamping out-of-bounds
points to its edge. Brush settings are snapshotted into each queued stamp. Work is
bounded to 4096 stamps per event and 8192 queued stamps; pathological overload can
lose excess stamps. Queued painting applies before numerical steps.

Changing preset, seed, reset revision, or simulation resolution resets the field
and clears pending strokes/capture/time. Value-equal option objects do not reset.
Palette changes rebuild color lookup data without regeneration. Display resizing,
placement, outer clipping, and density preserve concentrations. Pause clears
elapsed debt. Disabling brushes releases active capture.

Static materials regenerate only for kind, seed, resolution, scale, or detail
changes. Their scalar fields remain available for recoloring. They request no
continuing frames. Marble uses periodic warped noise bands, paper uses periodic directional noise
and wrapped integer-hashed grain, and cellular wraps jittered sites across a torus.
Raster endpoints match in both axes. Scale selects whole feature periods (rounded
where necessary); octave periods double together. No post-generation edge blur or
mirroring hides a discontinuity.

## Composition and borrowing

The default presenter stretches the low-resolution color image to its allocation.
A `TextureRenderer` may instead draw it repeatedly, use Canvas patterns, or compose
artwork with the alpha mask. Coordinates are logical display units. Mask storage
is lazy; color/mask sources are never transferred. The callback is synchronous
and its Canvas state is restored even on failure. Outer CRC composition is unchanged.

Sources are borrowed only for the callback; callers must not mutate, transfer,
retain, or dispose them. A caller may copy a still to its own Canvas. One callback
may reuse the same image arbitrarily without advancing the simulation again.
There is no shared live-source resource across independently mounted components.
There is no new core Image input, raster Clip, child-subtree masking, or retained
display list. The current interaction geometry remains the allocated rectangle;
custom display remapping does not remap painting automatically.

## Resource release and errors

The package releases array references, callback/brush queues, pointer capture,
and raster/mask backing stores. CRC owns the display surface, committed/candidate
bitmaps, event registrations, and scheduler work. Duplicate disposal is inert.
Render failures preserve CRC's last committed generation and are reported through
its completion mechanism; package state is not a transactional checkpoint. Final
removal disposes the resources exactly once. Invalid inputs throw actionable errors.

## Evidence

Package browser tests cover routed paused painting, reset, display resizing,
fixed-step and long-gap behavior, pause/resume, color-only changes, multiple roots,
static seeded reproducibility, repeated fills, alpha masks, overlap, and teardown.
The three public Studio lessons use the same package entry. Package-consumer and
Studio export/declaration checks cover the built public boundary. Performance
measurements are evidence for the tested machine, not portable time guarantees.
