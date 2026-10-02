# Texture resources contract

Status: implemented, 2026-10-01.

CRC texture production is authored through `defineTexture()` and mounted through
`useTexture()` from `@crc/core`. `@crc/textures` is an optional package of
recipes and existing texture components; it has no scheduler of its own and
does not import the core friend entry. Creating a recipe or importing either
package is inert. A mounted `useTexture` hook owns the live resource.

```ts
const recipe = defineTexture({
  create(context, options) { /* create producer state */ },
  rasterize(state, context) { /* draw context.canvas */ },
});

const texture = useTexture(recipe(options));
<Rectangle style={{ fill: texture.paint({ mode: "repeat" }) }} />
```

`TextureContext.canvas` is the stable producer canvas. Recipe callbacks may use
it synchronously during `create`, `update`, `receive`, `advance`, `rasterize`,
and `dispose`. They cannot call CRC hooks. `invalidate()` marks source pixels
dirty and `requestFrame()` asks the realm scheduler for another frame; stopping
is the recipe's choice not to request another frame. Recipe factories clone
their configuration and allocate no canvas or scheduler participant.

## Handles, placement, and ownership

`useTexture()` returns a stable `Texture<Message>` handle for its mounted hook
slot. `paint(placement)` returns an opaque paint value. Both the handle and
paint values may be used by Canvas drawing, and their placement supports
`repeat` or `stretch`, optional positive tile dimensions, offsets, and rotation.
The public surface never exposes the producer canvas or a committed source
raster.

`send(message)` queues a structured-cloned message for the next eligible frame.
It is forbidden during CRC evaluation, rejects a recipe without `receive`, and
is inert after disposal. Messages are bounded at 8192. A texture may be shared
between consumers in its owning CRC root tree, including nested Layers; a
foreign-root or disposed value rejects when rendered. A texture resource has
one producer regardless of how many paints or filters consume it.

Built-in drawing resolves a paint through the internal value-owned capability.
The capability validates ownership and resolves the current committed raster
synchronously. It is not a registry or public extension point.

## Publication and scheduling

Texture rasterization happens at most once for a dirty resource in an admitted
frame. It draws first to the stable producer canvas and copies that result into
a separately owned candidate publication canvas. On a successful Commit, the
candidate and its revision become the committed pair before observers are
notified. Paint consumers and filters therefore see matching pixels and
revision for that publication.

The resource reuses a bounded committed/spare publication pair at one
resolution. A resolution reset recreates producer state, clears queued
messages, discards elapsed-time debt, and releases incompatible publication
surfaces. Failed candidate rasterization or Commit leaves the previously
committed pair visible; a later eligible frame retries dirty work. An initial
render failure clears its provisional candidate. A later ordinary render
failure does not promise rollback of already committed texture pixels.

Recipe `advance` receives logical frame time and a nonnegative delta. Recipes
that pause or otherwise change timing policy establish their own fresh baseline
through their state; CRC does not preserve a generic simulation rollback or
checkpoint. The scheduler, rather than a recipe-owned `requestAnimationFrame`,
owns all continuing work.

## Filter borrowing and displacement

Official filter code may validate a `TexturePaint` without subscribing to or
rasterizing it. A non-identity consumer may synchronously borrow the committed
raster for one callback. The private borrowed record includes source,
dimensions, revision, resource identity, and placement. Consumers must not
retain, transfer, mutate, or expose that source; a GPU consumer may retain only
its own derived upload keyed to the resource/revision.

`displacement()` from `@crc/core/filters` accepts a texture `map`, a finite
nonnegative logical `strength`, and a finite positive logical `region`. Red and
green encode signed horizontal and vertical offsets, alpha weights the offset,
and blue is ignored. Map placement is evaluated in the documented logical
region, including repeat/stretch, offsets, and rotation. A strength of zero
still validates map ownership, liveness, and placement, but does not borrow a
raster or create GPU resources.

The implemented processor uses an `OffscreenCanvas` WebGL2 context and has no
CPU fallback. It rejects missing WebGL2, lost context, oversized targets, upload
or shader failures. Root-owned processors cache uploads by resource/revision,
release invalid GPU handles on context loss, and invalidate consumers on restore.
Cross-context sharing and a generic public texture consumer protocol remain outside
the public contract.

`waterWaves()` in `@crc/textures` is an optional numeric RG displacement-map
recipe. It produces periodic integer-wave fields, accepts finite nonnegative
speed and integer scale 1 through 32, rejects palettes, and supports `pause`
and `reset` messages, plus normalized `ripple` impulses. `rippleStrength` changes
existing ripples independently of ambient waves. Pausing, reset, and speed changes
discard elapsed-time debt; zero speed still advances active ripples. Importing or
painting water does not import the displacement processor.

`waterSurface()` adds a bounded WASM height field with reflective outer edges
and explicitly supplied normalized rectangular obstacles. Moving obstacles leave
bounded wakes; they are visual boundaries and never become scene physics colliders.
The simulation uses at most 128 cells on its short edge, 256 on its long edge,
and six 1/120-second steps per frame. `viscosity` ranges from 0 to 1 and combines
slower propagation with increased damping; it is an artistic control rather than
physical density or a mass-conserving fluid model. Changes preserve the existing
field and paused state. The dedicated WASM memory is fixed in size for that grid.

`reflectedLight()` accepts a color, decoded caller-owned image, or CRC texture
paint. It blends light selectively from the displacement-map slope, preserves
scene alpha, and never closes a caller-owned image. Its opacity is independent of
wave strength. An immediately preceding `displacement()` fuses into one GPU pass
and bitmap transfer. Solid color or texture surface overlays use ordinary CRC
paint and opacity inside the filtered composition, with `pointerEvents="none"`.

## Existing texture components

`ReactionDiffusion`, `ProceduralTexture`, `TextureRenderer`, and
`texturePalettes` remain public `@crc/textures` exports. Each mounted legacy
component owns an independent render-layer resource and source raster; it does
not become a shared live `Texture` resource. Importing it is inert, and its
render-layer lifecycle continues to own creation, resize, rendering, and
disposal. `ReactionDiffusion` keeps its documented double-buffered periodic
Gray--Scott field, bounded fixed-step timing, fresh-baseline pause/reset
behavior, and CRC-routed primary-pointer brush queue. It advances only through
the supplied frame invalidator, never by a second scheduler loop.

CRC resolves one topmost target and supplies layer-local pointer coordinates.
The default brush mapping scales the displayed rectangle into the simulation.
A single primary pointer is captured through CRC; release/cancel ends the stroke.
Stamps interpolate movement and clip to the field, without clamping out-of-bounds
points to its edge. Brush settings are snapshotted into each queued stamp. Work is
bounded to 4096 stamps per event and 8192 queued stamps; pathological overload can
lose excess stamps. Queued painting applies before numerical steps. Painting plants separated nuclei
within the brush area and skips occupied neighborhoods, avoiding the broad
uniform doses that extinguish spots. Large brushes plant clusters; small or weak
marks are not guaranteed to survive. Initialization retains its seeded patches.

Its preset, seed, reset revision, and simulation-resolution changes reset the
reaction field and clear queued strokes, capture, and elapsed time. Equal
options and display-only resizing preserve it; palette changes recolor without
regeneration. A paused field accepts brushes and recoloring without numerical
advancement or continuing frame requests. `ProceduralTexture` remains a seeded
static material: marble, paper, and cellular fields are periodic at both
endpoints, regenerate only for field-defining options, and request no
continuing frame. Its palette changes recolor the existing scalar field.

`TextureRenderer` callbacks receive a synchronous borrowed legacy raster whose
Canvas state is restored on failure; they may draw it repeatedly but must not
mutate, transfer, retain, or dispose it. Legacy display remapping does not
remap brush interaction. Component disposal releases fields, rasters, queues,
captures, and callbacks exactly once; duplicate disposal is inert. Legacy
render failures preserve CRC's last committed render-layer generation and do
not promise simulation-state rollback. Invalid legacy inputs remain actionable
errors.

## Release and errors

The texture hook owns producer state, producer canvas, committed/spare and
provisional publication canvases, queued messages, and its scheduler
participant. Disposal is idempotent, makes sends and callbacks inert, zeros
owned canvases, and invokes recipe disposal once. A filter borrower never owns
or disposes the texture resource. Filter removal releases its GPU borrow but
does not dispose an independently mounted texture.

Validation and raster errors are actionable render errors. CRC preserves the
last successful texture publication where one exists, but it does not provide
transactional rollback for arbitrary producer state or an all-Canvas-frame
atomicity guarantee.

## Boundaries and evidence

There is no public worker/WASM execution API, raw-source accessor, global producer
registry, cross-root texture sharing, or automatic
semantic/input remapping. Texture pixels affect appearance only; a displacement
filter does not alter layout, measurement, events, focus, physics, animation
semantics, or hit areas.

Focused browser tests cover one-raster-per-revision sharing, committed
pixel/revision observation, Commit failure and retry, initial and later render
failure behavior, bounded publication-surface reuse, root validation, water
timing/messages/seams, and texture/displacement ownership. Packed consumer
checks cover public exports and source/packed feature selection. They do not
constitute a guarantee of physical fluid accuracy or two-way scene physics.

## WASM field implementation

The marble, paper, cellular, reaction-diffusion, tendrils, lightning, waterWaves,
and waterSurface kernels execute in WASM.
Configuration, lifecycle callbacks, and scheduling remain ordinary CRC code.
There is no runtime backend selector or JavaScript fallback for these kernels.
Water solver stepping, wave generation, obstacle masks and wakes, and RGBA
rasterization all execute in WASM. Canvas presentation and filter GPU passes
retain their existing roles.

Each selected embedded module compiles lazily on first resource creation, never
on import or inert recipe creation. Every live field owns fixed, bounded memory;
parameter changes reuse it, while resolution/generator changes replace it. Ink
keeps four fields for fixed stepping and scratch work. The RGBA ImageData and
alpha and legacy mask views borrow that memory without a JavaScript full-buffer copy. Canvas
upload and committed publication still incur browser work. Memory is never grown
while those views are live. Disposal detaches field-owner associations and drops
resource views; module caches remain reusable. No GC timing guarantee is made.

`reactionDiffusion` accepts ordered `paint`, `stir`, `pause`, and `reset` messages.
Stir uses a normalized center and displacement vector (each displacement in
[-1, 1]), with a finite radius greater than zero through 128 texture cells
(default 16). It backtraces a smooth local displacement into the existing A/B
fields with bilinear sampling and clamped edges, using the existing scratch
fields. It neither deposits ink nor implements incompressible-fluid pressure.
Zero displacement is an exact field no-op. Finite out-of-domain centers are
ignored; invalid numerical inputs reject without publishing a new raster.
Explicit paint/stir work while reaction stepping is paused.

Animation supplies parameters through existing signals. A `useReaction` can read
committed physics positions and send small stir messages. Rapier and textures
retain separate WASM memories. Neither raw pointers nor pixel/field buffers cross
the public boundary, and the connection does not alter scheduler phases or
promise same-frame bidirectional coupling. Animation itself is not ported to
WASM by this change.

Pinned AssemblyScript generates checked-in per-kernel byte modules. The trust gate
checks reproducibility, JS-reference parity, lazy import behavior, public recipe
ownership/messages, and selected-kernel tree shaking in source and packed builds.

Electric resources use separate tendrils/lightning modules and fixed 192 KiB
heaps. WASM owns weighted source selection, boundary convection, numerical
advancement, and generated filament coordinates. Control identifiers and
validated messages remain in JavaScript; numeric state views and path output
borrow the heap directly. Canvas consumes that output for glow strokes and
cores. Reference parity covers moving/released sources, boundary drift, rebirth,
pause, edge changes, and reused connection slots. No JS generator fallback is
retained in production.

Water resources keep one borrowed RGBA ImageData per fixed-resolution WASM heap.
Wave mode and ripple calculations stay in WASM, with at most sixteen wave
impulses. Surface stepping is batched across the existing six-step admission
bound; control updates upload obstacle rectangles, not pixel arrays. Resizing
replaces the heap, while ordinary option updates reuse it. Public-API parity
tests compare the prior water implementation across ripple, pause/reset, seed,
scale, viscosity, and moving-obstacle updates.
