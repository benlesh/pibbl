# @crc/textures

Optional procedural Canvas surfaces for CRC: interactive Gray–Scott
reaction–diffusion, seeded marble, paper, and cellular materials.

```tsx
/** @jsxImportSource @crc/core */
import { Group, Text } from "@crc/core";
import { ReactionDiffusion, texturePalettes } from "@crc/textures";

const background = (
  <Group>
    <ReactionDiffusion
      seed={42}
      preset="stripes"
      palette={texturePalettes.porcelain}
      brush={false}
      pointerEvents="none"
      resolution={{ width: 256, height: 160 }}
      style={{ width: 640, height: 400 }}
    />
    <Text style={{ x: 24, y: 24, font: "32px Georgia", fill: "#172955" }}>
      A living background
    </Text>
  </Group>
);
```

Both components use public `defineRenderLayer()`. CRC owns scheduling,
composition, routed input, and bitmap lifetime. The package creates no animation
loop and has no dependency on React, Three, WASM, or workers. Importing it creates
no Canvas resources. It peers on the application's `@crc/core`.

`ReactionDiffusion` supports `seed`, `preset` (`spots` or `stripes`), `resolution`,
`palette`, `paused`, `resetRevision`, and `brush` (`false` or `{ radius, strength }`).
The brush radius is in simulation cells. Pause still allows painting. Changing
seed, preset, resolution, or reset revision resets the field; palette and display
changes preserve it. Defaults are seed 42, spots, 256 × 160, lagoon palette,
unpaused, and a brush of radius 6/strength 0.8.

`ProceduralTexture` accepts `kind` (`marble`, `paper`, `cellular`), `seed`,
`resolution`, `scale` (1–32, default 6), `detail` (0–1, default 0.65), and `palette`
(default porcelain). It stops scheduling after generation. Shape inputs regenerate;
palette changes recolor the existing scalar field. All three materials are periodic in both axes: opposite raster edges match,
including cellular neighbors and paper grain. Feature counts round to complete
periods so a repeated fill joins without a cut.

Palettes are 2–16 opaque `#RRGGBB` colors, interpolated evenly in sRGB. Seed is an
unsigned 32-bit integer. Dimensions must be integers from 8 to 1024, with at most
262,144 cells. Both components accept existing render-layer style and event props.

## Reuse as images, repeating fills, and masks

Place a texture before ordinary CRC content to make it a background. Use `Clip`
for a shaped background. For more control, both components accept a synchronous
`render(context, texture)` callback. It receives logical display dimensions and
borrowed low-resolution `source` and `mask` canvases. The mask is white with the
field's normalized intensity as alpha; it is allocated only when accessed.

```tsx
import { ProceduralTexture } from "@crc/textures";

const repeated = (
  <ProceduralTexture
    kind="paper"
    seed={12}
    pointerEvents="none"
    style={{ width: 640, height: 400 }}
    render={(context, texture) => {
      const pattern = context.createPattern(texture.source, "repeat")!;
      context.fillStyle = pattern;
      context.fillRect(0, 0, texture.width, texture.height);
    }}
  />
);
```

For a reveal, paint artwork, set `globalCompositeOperation = 'destination-in'`,
and draw `texture.mask`. Callback state is saved/restored; CRC applies outer
transforms, clips, and filters afterward. The interaction region stays the whole
rectangle, regardless of alpha or custom drawing. Disable pointer participation
for decorative uses. A custom display mapping also needs a matching input mapping;
the first API only paints using the default stretched rectangle.

Treat sources as read-only, callback-scoped borrows: do not resize, transfer,
retain, or dispose them. To export a still, copy into an application-owned Canvas
inside the callback. There is no public live-resource handle shared among separate
CRC elements, and core `Image` continues to accept URL sources only.

## Timing and ownership

The simulation uses fixed numerical steps at 480 iterations per second, with
50 ms elapsed admission and at most 24 iterations per frame. Long gaps discard
excess time. Pause/resume and reset establish a new time baseline. Periodic
simulation boundaries do not make pointer brushes wrap around the edges.

Identical seeds, dimensions, presets, algorithm version, step counts, and ordered
brush commands reproduce a run on the same numerical implementation. Wall-clock
history, pointer delivery, and future backend floating-point differences can
change results. There is no arbitrary-time seek API.

CRC releases its surfaces, bitmaps, event registrations, and scheduler entries.
The package releases its simulation arrays and raster/mask backing stores on
unmount. A failed custom render follows CRC's existing last-good-generation error
behavior; private simulation state is not rolled back. A later explicit update can
retry. Dispose ends the resource lifetime exactly once.

See [the public guide](../../docs/site/learn/guides/procedural-textures.md),
[the contract](../../docs/design/textures-contract.md), and the Studio's Living Ink,
Material Lab, and Growing Reveal examples.

## Performance evidence

A 2026-09-30 Chromium 151.0.7922.34 run on macOS arm64 with Node 26.9.0 and
pnpm 11.21.0 measured 60 frames after 20 warm-up frames: 256×144 simulation,
832×400 presentation at density 1, eight numerical iterations per 60 Hz frame.
Mean solver cost was 1.70 ms, mean recoloring/upload cost 0.12 ms, and complete
synchronous CRC frame cost was 2.60 ms median / 2.80 ms p95. These measurements
include CPU presentation and bitmap submission, but exclude asynchronous browser
compositor/GPU completion and vsync. They are not portable performance guarantees.

Reproduce with `VITE_CRC_REPORT_PERF=1 corepack pnpm@11.21.0 exec vitest run packages/textures/test/performance.test.tsx --browser.headless --browser.ui=false`.

A future WASM comparison should batch all numerical steps in one call, keep fields
in linear memory, and report copies and pixel upload separately from solver time.
The JavaScript baseline already uploads just once per changed frame and performs
no pixel readback. WASM must improve the complete frame cost enough to justify its
loading and maintenance cost; no speedup is claimed without measurement. Workers
and GPU implementations are independent decisions and the public API does not
require any particular implementation language.
