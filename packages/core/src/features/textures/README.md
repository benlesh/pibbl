# @pibbl/core/textures

Optional procedural textures for Pibbl. The marble, paper, cellular, and
reaction-diffusion generators compute in WASM, with ordinary JavaScript/TypeScript
configuration and Pibbl-owned scheduling. There is no JavaScript fallback or backend
selector for those four generators. Water and electric recipes are documented
separately in the public API reference.

## Shared texture fills

```tsx
/** @jsxImportSource @pibbl/core */
import { Rectangle, useTexture } from "@pibbl/core";
import { marble } from "@pibbl/core/textures";

function Card() {
  const surface = useTexture(marble({ seed: 42, scale: 6, detail: 0.65 }), {
    resolution: { width: 256, height: 160 },
    palette: ["#f2e8d7", "#625e68", "#252c3f"],
  });
  return <Rectangle style={{ width: 640, height: 400, fill: surface }} />;
}
```

`useTexture` owns one resource per mounted hook slot. Reuse its handle as a fill
or stroke across shapes, text, or nested Layers in the same root. Use
`surface.paint({ mode: "repeat", tileWidth: 128, tileHeight: 80 })` to choose
placement. The core texture contract owns publication, validation, and teardown.
The package does not create another animation loop, worker, or renderer.

`marble`, `paper`, and `cellular` accept unsigned 32-bit `seed`, `scale` from 1
through 32, and `detail` from 0 through 1. Defaults are 42, 6, and 0.65. Opposite
raster edges match, including grain and cellular neighbors. Field-defining
parameter updates reuse the same fixed WASM memory; resolution or generator
changes replace it. Palette changes recolor without regenerating the field.
Static textures stop scheduling when unchanged.

Texture dimensions are integers from 8 through 1024, with at most 262,144 cells.
Palettes contain 2–16 opaque `#RRGGBB` colors, interpolated evenly in sRGB.
`texturePalettes` provides lagoon, porcelain, and ember. Display dimensions are
independent of texture resolution.

## Living ink and movement

`reactionDiffusion({ seed, preset })` accepts `spots` or `stripes` (default spots).
Use `useTexture` to mount it, then send typed `InkMessage` commands:

- `paint`: normalized `u`/`v`, optional radius in cells (default 6, greater than
  zero through 128), and strength from 0 through 1 (default 0.8). It plants small
  nuclei; large brushes plant separated groups rather than a solid patch.
- `stir`: normalized `u`/`v`, normalized displacements `du`/`dv` in [-1, 1], and
  optional radius in cells (default 16, greater than zero through 128). It moves
  existing A/B fields with smooth local falloff and bilinear sampling. It does
  not deposit ink or solve fluid pressure. Sampling clamps at the field edge.
- `pause`: `{ type: "pause", paused: boolean }` stops or resumes reaction stepping.
  Explicit paint and stir messages still work while paused.
- `reset`: restores the current seeded field and fresh timing, preserving pause.

All numeric inputs must be finite. Finite centers outside [0, 1] are ignored;
invalid radius, strength, or displacement rejects without publishing bad pixels.
Commands retain their send order. Disposal makes sends inert.

Pibbl advances ink at 480 fixed numerical steps per second, admitting at most 50 ms
and 24 steps per frame. Pause, reset, and resume discard elapsed-time debt. The
first continuing frame establishes a fresh baseline. Equal seed, preset,
dimensions, step count, and ordered messages reproduce a run on the same
implementation. There is no arbitrary-time seeking or simulation rollback.
Spots can settle; stripes and ongoing stirring provide more visible movement.

Animation can drive recipe parameters through signals. Read a physics body's
committed position in `useReaction`, then send a small stir vector; the accepted
Stirred Ink example demonstrates this. Physics and texture WASM modules have
separate memories. This implementation neither reads Rapier's private memory nor
moves Pibbl animation into WASM. Messages run on the next eligible texture frame;
there is no same-tick physics/texture coupling guarantee.

## Existing components and borrowed rasters

`ReactionDiffusion` and `ProceduralTexture` remain available for independent
render-layer surfaces. They use the same WASM kernels as the recipes.
`ReactionDiffusion` also accepts `paused`, `resetRevision`, and a Pibbl-routed
pointer `brush` (`false` or `{ radius, strength }`). Seed, preset, resolution, and
reset revision changes clear its field, strokes, capture, and elapsed time.
`ProceduralTexture` requires `kind: "marble" | "paper" | "cellular"`. Both accept
palette, resolution, normal render-layer styles/events, and a synchronous
`render(context, texture)` callback.

Callbacks borrow a color `source` and lazily created white alpha `mask`, together
with display and texture dimensions. They may repeat or composite those sources
but must not retain, resize, transfer, or dispose them. Copy into an
application-owned Canvas to export a still. Canvas state is restored on callback
failure. Display remapping does not change the logical hit region or brush
mapping. Use `pointerEvents="none"` for decorative content.

## WASM ownership and build

Importing the package or constructing a recipe performs no WASM compilation,
Canvas allocation, or scheduling. Each selected kernel compiles lazily on first
mount. Modules are cached; each resource owns fixed memory that never grows while
views are borrowed. Fields, scratch storage, RGBA, alpha, palette, and stamp
storage reside in that memory. `ImageData` directly views RGBA bytes: there is no
full-field or RGBA marshalling copy through JavaScript. Canvas upload and Pibbl's
committed publication surfaces still have browser-managed copy costs.

Unmount drops resource ownership and borrowed views. WASM compilation/allocation
failures propagate through normal Pibbl error handling; there is no silent JS
fallback. Existing last-good publication behavior remains intact, without a
promise to roll back private simulation state.

AssemblyScript is pinned as a development dependency. Sources live in `assembly/`;
small generated byte modules are embedded in the package, with no asset fetch or
runtime compiler dependency. Only a selected recipe's kernel survives bundling.

```sh
corepack pnpm@11.21.0 test:texture-kernels
corepack pnpm@11.21.0 test:texture-kernels
```

The aggregate trust gate checks kernel reproducibility and original-JS numerical
parity. Original JS generators remain benchmark controls in
`tooling/texture-wasm-spike/`, not production backends. Timings are machine-specific;
see that directory's recorded experiments and reproduction commands. Richer visual
candidates remain experiments rather than changes to shipped material defaults.

See [the public guide](../../../../../docs/site/learn/guides/procedural-textures.md),
[the contract](../../../../../docs/design/textures-contract.md), and Studio's Living Ink,
Material Lab, Stirred Ink, and Growing Reveal examples.
