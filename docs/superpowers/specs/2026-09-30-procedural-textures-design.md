# Optional procedural textures decision record

> **Historical status: Design or implementation record; current behavior is defined by runtime contracts.**

Recorded 2026-09-30. This records the proposal approved in this conversation and
the subsequent request for seamless repeated materials. Numerical tuning and
resource bounds below document implementation choices within that authorization;
they were not separately reviewed by the user.

## Package boundary

Ship optional `@crc/textures` through public `defineRenderLayer`, with
`ReactionDiffusion`, `ProceduralTexture`, and `texturePalettes`. Keep CRC's single
scheduler, mounted identity, routed input, composition, and exact resource ownership.
The package owns generation, simulation, palettes, low-resolution rasterization,
and presentation. Do not require core changes, internal imports, workers, or GPU.

## Persistence and timing

Each mounted component retains its private simulation or scalar field and raster
through component reevaluation and display resizing. Simulation resolution is
independent of display dimensions and density. Allocation and release follow the
render-layer lifecycle; module import allocates no live resources.

Start with a JavaScript Gray–Scott implementation using double-buffered float
fields, periodic boundaries, and seeded patches. The implemented nine-point
stencil uses center −1, cardinal 0.2, diagonal 0.05, diffusion 1/0.5, timestep 1,
and spots feed/kill 0.0367/0.0649 or stripes 0.029/0.057. Advance fixed steps from
CRC frames at 480 steps/second, clamp elapsed time to 50 ms and 24 steps, retain
fractional time, and discard excess host time. Initial/reset/resume frames start a
fresh time baseline. Pause keeps painting and recoloring available without a loop.

Private simulation work runs in the supported external Render callback, uses the
frame invalidator, and writes no public signals there. Reproducibility depends on
seed, parameters, step count, and ordered brushes; wall time is not an arbitrary-time
seek API. Checkpoints, chemical rollback, WASM, workers, and GPU are deferred.

## Input and updates

CRC supplies one topmost pointer target and local coordinates. Scale the default
rectangular display into simulation coordinates. Capture one primary pointer,
interpolate brush stamps, and end on release/cancel. Ignore outside samples rather
than clamping them onto an edge. Snapshot brush settings per stamp and apply painting
before numerical steps. Bound pathological work to 4096 stamps/event and 8192 queued
stamps, allowing overload to drop excess input. Subsequent hands-on feedback
reported that broad brush doses erased spots. Painting now plants separated
nuclei, leaves occupied neighborhoods intact, and uses clusters for larger
brushes; small or weak marks may still dissipate. Seeded initialization is unchanged.

Seed, preset, reset revision, and simulation resolution reset the field, strokes,
capture, and elapsed time. Value-equal options preserve state. Palette changes
recolor only; display placement, density, clipping, and resizing preserve the field.
Pause clears time debt, and disabling the brush releases capture.

Material Lab provides seeded marble, paper, and cellular materials. Kind, seed,
resolution, scale, and detail regenerate; palette only recolors; static output
requests no continuing frames. Following hands-on feedback, materials must wrap
across both axes: periodic warped marble bands, directional paper noise with
wrapped grain, and toroidal jittered cellular sites. Raster endpoints match;
scale selects whole feature periods and octave periods double. Do not disguise
seams with edge blur or mirroring.

## Composition and reuse

Separate generation from presentation internally. Expose a synchronous
`TextureRenderer` callback that borrows the same low-resolution color source and
lazy alpha mask for the duration of that callback. Default output stretches to the
allocation; custom presentation can repeat a Canvas pattern, draw a background,
or apply `destination-in` to artwork in logical display coordinates. Restore
Canvas state on failure and preserve CRC's outer composition.

Borrowed sources must not be retained, mutated, transferred, or disposed. Callers
can copy a still to their own canvas, or draw the same source multiple times in one
callback without another simulation. Defer shared live sources across mounted
components, new Image inputs, raster Clip, subtree masks, and retained display
lists. Custom presentation geometry does not automatically remap painting.

## Ownership and evidence

Release package arrays, pointer capture, queues, raster and mask backing stores
exactly once. CRC owns presentation surfaces, bitmaps, event registrations, and
scheduler work. Render failures use CRC's last committed generation and completion
error delivery; private fields are not transactional checkpoints. Invalid inputs
throw actionable errors. Removal and repeated disposal must leave no work alive.

Deliver Living Ink first through public JSX with focused failing evidence and a
runnable Studio lesson. Extend with Material Lab and Growing Reveal. Then verify
fixed-step timing, reset/recolor/resize, routed painting, seeded reproducibility,
seamless repeat, alpha masks, overlap, teardown, packed consumers, and Studio
source/built/editor parity. Measure solver, raster/upload, and complete synchronous
CRC frame costs separately; machine-specific timings are evidence, not guarantees.
A future batched WASM solver must preserve the public API and be assessed including
memory copies, pixel upload, presentation, and composition, not solver speed alone.
