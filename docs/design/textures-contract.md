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
or shader failures. It does not currently promise context-loss recovery,
per-revision upload caching, cross-context sharing, or a generic public texture
consumer protocol.

`waterWaves()` in `@crc/textures` is an optional numeric RG displacement-map
recipe. It produces periodic integer-wave fields, accepts finite nonnegative
speed and integer scale 1 through 32, rejects palettes, and supports `pause`
and `reset` messages. Pausing, reset, and speed changes discard elapsed-time
debt; zero speed requests no continuing work. Importing or painting water does
not import the displacement processor.

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

There is no interactive ripple API, worker/WASM execution contract, raw-source
accessor, global producer registry, cross-root texture sharing, or automatic
semantic/input remapping. Texture pixels affect appearance only; a displacement
filter does not alter layout, measurement, events, focus, physics, animation
semantics, or hit areas.

Focused browser tests cover one-raster-per-revision sharing, committed
pixel/revision observation, Commit failure and retry, initial and later render
failure behavior, bounded publication-surface reuse, root validation, water
timing/messages/seams, and texture/displacement ownership. Packed consumer
checks cover public exports and source/packed feature selection. They do not
constitute a context-loss or GPU-cache recovery guarantee.
