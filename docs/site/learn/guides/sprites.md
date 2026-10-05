---
id: guide-sprites
title: Draw and animate sprites
summary: Load grids or packed atlases, share image resources, and animate frame signals through normal playback.
kind: guide
slug: sprites
order: 65
keywords: [sprites, sprite sheets, atlas, aseprite, texturepacker, frames]
exampleSlug: sprites
---

# Sprites and sprite sheets

[Try the minimal sprite example](#/examples/composition/sprites). It displays four
source frames and an animated sprite with pause/resume controls, independently of
physics or state machines.

A sprite sheet owns decoded images and immutable frame handles. `Sprite` draws a
frame; an ordinary animation program can change a frame signal.

```tsx
import { drive, repeat, usePlayback, useSignal } from "@pibbl/core";
import { Sprite, loadSpriteSheet } from "@pibbl/core/sprites";
import { aseprite } from "@pibbl/core/sprites/formats/aseprite";

const sheet = await loadSpriteSheet("/hero.json", { format: aseprite() });

function Walker() {
  const frame = useSignal(sheet.frames.standing);
  usePlayback(
    repeat(drive(frame, sheet.animations.walk), {
      iterations: Infinity,
    }),
    { autoplay: true },
  );
  return <Sprite frame={frame} sampling="nearest" />;
}
```

Load assets before mounting this component, or conditionally mount it after a
loading task succeeds. The owner must dispose the sheet after its consumers
unmount. Sharing a sheet does not transfer its ownership to each sprite.

## Grids and custom clips

```ts
import { loadSpriteSheet, defineSpriteAnimation } from "@pibbl/core/sprites";

const sheet = await loadSpriteSheet("/coin.png", {
  grid: { frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 },
});
const spin = defineSpriteAnimation({
  frames: Object.values(sheet.frames),
  fps: 12,
});
```

Grid frames have numeric-string names in row order. Use explicit timed entries
`{ frames: [{ frame, duration }, ...] }` for unequal frame durations, measured in
milliseconds. Clips are finite; looping belongs to `repeat`, seeking and pausing
to playback. Interior frame boundaries select the next frame; the final sample
selects the last frame.

## Packed formats and geometry

Import `aseprite()` or `texturePacker()` from their own format modules. The loader
calls the supplied parser; there is no format registry or string dispatch that
pulls every parser into the bundle. Aseprite tags supply named clips. Unsupported
TexturePacker scale/multipack metadata fails explicitly.

Frames preserve source dimensions, trim offsets, and packing rotation. Sprite
size and normalized anchor use original logical dimensions rather than the packed
rectangle, avoiding jitter from trimming. `flipX`/`flipY` mirror the frame, while
`sampling="nearest"` preserves hard pixel edges; linear sampling is the default.
Use explicit physical colliders: atlas transparency is not collision geometry.

## Artwork review

Measure generated atlas rectangles rather than assuming cells are aligned. Check
unique poses, baseline alignment, transparency, neighboring pixels, and the loop
at its intended display size and speed. More frames help only when their poses
form a coherent cycle. Brick Climb includes a separate sprite inspector for that
review.

See [animation](#/learn/guides/signals-and-animation) for playback composition and
[machine animation](#/learn/guides/machine-animation) for event-driven coordination.
