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
The simulation resolution stays small even when the display grows. A second
mounted texture has its own simulation; this API does not share a live source
between independent elements.

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
