---
id: guide-procedural-textures
title: Procedural textures
summary: Create living ink, seeded materials, backgrounds, repeating fills, and artwork reveals.
kind: guide
slug: procedural-textures
order: 68
keywords:
  [textures, backgrounds, procedural, reaction-diffusion, masks, seamless]
exampleSlug: living-ink
---

# Procedural textures

Install the optional `@crc/textures` package alongside `@crc/core`. It provides
`ReactionDiffusion` for living, paintable surfaces and `ProceduralTexture` for
seeded marble, paper, and cellular materials. Both participate in CRC scheduling,
layout, clipping, filters, and resource disposal.

## Shared fills and animated parameters

`useTexture` mounts one resource that can supply several fills or strokes in its
owning root. The four field generators use WASM internally; configuration stays
ordinary TypeScript. There is no engine switch or separate animation loop.

```tsx
import { Rectangle, useTexture } from "@crc/core";
import { marble } from "@crc/textures";

function Material({ detail }: { detail: number }) {
  const surface = useTexture(marble({ detail }), {
    resolution: { width: 256, height: 160 },
  });
  return <Rectangle style={{ width: 640, height: 400, fill: surface }} />;
}
```

Pass a signal's `.get()` value from a component to animate detail. Field parameters
reuse existing memory; changing resolution replaces it. Use `surface.paint(...)`
for repeat/stretch placement. Palette updates recolor without regenerating shape.

## Stir existing ink

A `reactionDiffusion` resource accepts movement as well as paint:

```ts
ink.send({ type: "stir", u: 0.5, v: 0.5, du: 0.02, dv: -0.01, radius: 20 });
```

The center and displacement are normalized to the texture dimensions. Radius is
in texture cells. Stir moves existing ink with smooth falloff, while paint plants
new nuclei. Both work with the reaction paused. Spots can settle toward an
unchanging pattern; the stripes preset and moving disturbances create a more
active surface.

Read a physics body's committed position in `useReaction`, compute the displacement
from its previous position, and send it to the texture. Reset that previous
position on initial placement or teleport. The body and texture keep separate
WASM memories; only small movement messages connect them. This is a texture
response to motion, not a fluid simulation or a new physics solver.

Try [Stirred Ink](#/examples/composition/stirred-ink): pause the reaction to isolate
movement, or stop stirring to watch the reaction alone. Animation also changes
the three static materials above the ink.

## A living background

```tsx
import { Group, Text } from "@crc/core";
import { ReactionDiffusion, texturePalettes } from "@crc/textures";

function Card() {
  return (
    <Group>
      <ReactionDiffusion
        seed={42}
        preset="stripes"
        resolution={{ width: 256, height: 160 }}
        palette={texturePalettes.porcelain}
        brush={false}
        pointerEvents="none"
        style={{ width: 640, height: 400 }}
      />
      <Text style={{ x: 24, y: 24, font: "32px Georgia", fill: "#172955" }}>
        A living background
      </Text>
    </Group>
  );
}
```

Put decorative textures before content in paint order and opt them out of pointer
participation. Wrap the background in `Clip` when it needs a shaped boundary.
The simulation resolution stays small even when the display grows. A second mounted component has its own simulation. To share a live source across
elements, use a `useTexture` resource as shown above.

## Painting and controls

`ReactionDiffusion` paints by default. Its `brush` radius is measured in simulation
cells and strength is between zero and one. Pause with `paused`; painting continues
to work while paused. Increment `resetRevision` to repeat the current seed without
remounting. Changing `seed`, `preset`, or `resolution` also resets. Display resizing
and palette changes preserve the pattern. Use `.get()` when passing signal-driven
configuration from your component.

No separate animation loop is needed. Fixed numerical steps follow CRC frames,
with bounded catch-up after long gaps. Seeded repeatability depends on the same
step count and ordered painting history, not just elapsed wall time. There is no
free arbitrary-time seeking.

Try [Living Ink](#/examples/composition/living-ink).

## Reproducible materials

```tsx
import { ProceduralTexture } from "@crc/textures";

const paper = (
  <ProceduralTexture
    kind="paper"
    seed={24}
    scale={6}
    detail={0.65}
    palette={["#e7dcc6", "#fff8e9"]}
    pointerEvents="none"
    style={{ width: 640, height: 400 }}
  />
);
```

Select `marble`, `paper`, or `cellular`. Change `scale` and `detail` to regenerate
shape; change `palette` to recolor the stored field. A “new variation” control
changes the seed. Static textures request no continuing animation frames.
Palettes contain 2–16 opaque `#RRGGBB` colors. All three materials tile seamlessly in both axes. Noise lattices, grain, and
cellular neighbors wrap, and opposite raster edges match. Feature counts round to
whole periods where necessary.

Try [Material Lab](#/examples/composition/material-lab).

## Use the output as a fill or mask

Both components accept a `render` callback. It receives a saved Canvas 2D context
in logical display units, plus the generated `source`, a lazy alpha `mask`, and
both display and texture dimensions. Reuse the same source within this callback
without rerunning its generator.

```tsx
import { ProceduralTexture } from "@crc/textures";

const repeated = (
  <ProceduralTexture
    kind="cellular"
    seed={12}
    pointerEvents="none"
    style={{ width: 640, height: 400 }}
    render={(context, texture) => {
      context.fillStyle = context.createPattern(texture.source, "repeat")!;
      context.fillRect(0, 0, texture.width, texture.height);
    }}
  />
);
```

For an artwork reveal, draw your artwork, set
`context.globalCompositeOperation = 'destination-in'`, and draw `texture.mask` to
the display rectangle. The alpha mask reflects current field intensity and can
recede as well as grow. It does not accumulate reveal history.

Sources are read-only borrows for the synchronous callback. Do not retain,
resize, transfer, or dispose them. Copy into an application-owned Canvas if you
need a still image. Callbacks cannot return promises, invoke hooks, or write signals.
CRC restores Canvas state and composes the result normally. The hit region remains
the allocated rectangle; remapping the image in a custom presenter does not remap
pointer painting. Core `Image` still takes a URL and `Clip` still takes a path.

Try [Growing Reveal](#/examples/composition/growing-reveal).
