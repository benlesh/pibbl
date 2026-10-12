# Sprites and Brick Climb

> **Historical status: Design record for the sprites and Brick Climb implementation.**

Status: approved direction from the 2026-10-05 conversation; implementation in progress.

## Purpose

Add sprite authoring that composes with Pibbl's existing animation and physics
APIs. Prove it with a minimal learning example and a small desktop vertical
platform game. This document describes intended behavior, not shipped behavior.

## Public model

`@pibbl/core/sprites` exports `Sprite`, `loadSpriteSheet`, and
`defineSpriteAnimation`, with named public types. Format factories live in
separate modules, beginning with `@pibbl/core/sprites/formats/aseprite` and
`@pibbl/core/sprites/formats/texture-packer`. The loader calls the supplied adapter;
there is no central format registry or string dispatch. Importing sprites must
not import unused adapters or physics.

```tsx
import { drive, repeat, usePlayback, useSignal } from "@pibbl/core";
import { Sprite, loadSpriteSheet } from "@pibbl/core/sprites";
import { aseprite } from "@pibbl/core/sprites/formats/aseprite";

const hero = await loadSpriteSheet("/assets/hero.json", { format: aseprite() });

function Walker() {
  const frame = useSignal(hero.frames.standing);
  usePlayback(
    repeat(drive(frame, hero.animations.walk), {
      iterations: Infinity,
    }),
    { autoplay: true },
  );
  return <Sprite frame={frame} sampling="nearest" />;
}
```

Frames are immutable opaque values with stable identity. They retain a shared
image source, packed rectangle, original dimensions, trim offsets, and packing
rotation. Atlas coordinates never become collision geometry. A static frame and
a signal of frames use the same `Sprite` input. Drawing preserves logical bounds
across trimming, rotation, and flipping. Anchor coordinates are normalized in
the original frame, not the trimmed rectangle. Explicit style dimensions scale
the logical box. Sampling is explicit (`nearest` or `linear`).

Regular grids use `loadSpriteSheet(imageURL, { grid: { frameWidth,
frameHeight, margin?, spacing? } })`. Named packed frames use string keys;
grid frames use numeric keys. Invalid bounds, timing, and unsupported metadata
fail descriptively instead of silently producing corrupt frames.

`defineSpriteAnimation({ frames, fps })` and
`defineSpriteAnimation({ frames: [{ frame, duration }, ...] })` produce ordinary
`PibblAnimationDefinition<SpriteFrame>` values. Durations are milliseconds and
strictly positive. Sampling selects a frame discretely; exact interior boundaries
select the next frame and the terminal time selects the final frame. Imported
clips normalize timing and direction. Looping belongs to `repeat`; all controls,
writer leases, seeking, replacement, and cleanup belong to `usePlayback`. There
is no new sprite clock, animation manager, or convenience playback hook in this
first design.

The sheet owns decoded images. Its idempotent `dispose()` is called by the asset
owner after consumers unmount. Removing one sprite never destroys a shared
sheet. Loading failure releases partially loaded resources. A disposed frame
must not silently draw an invalid image. External cancellation and multi-page
loading need explicit ownership tests before completion.

## Brick Climb game

Use an original small character and brick/coin artwork, with platformer mechanics
inspired by the requested Mario-like example. Desktop keyboard only: A/D move,
W or Space jumps, S accelerates descent. Ignore repeated jump keydown events,
clear held controls on blur, and prevent browser scrolling only while the game
owns keyboard input. Show controls on the start screen.

The player starts on ground and climbs successive reachable tiers of platforms
and breakable brick ceilings. Camera progress follows upward; falling below the
visible play area costs a life. Start with three lives and restart at a safe
checkpoint while lives remain. Zero lives shows a game-over splash; restart
resets score, coins, lives, camera, level state, and physics resources. Use a
finite authored set of tiers with an explicit completion state or a documented
repeatable tier generator, never an unreachable final screen.

Use public `@pibbl/core/physics/2d` for the player, ground, platforms, bricks, and
debris. Physics owns dynamic poses. Ground detection uses contacts/queries;
jumping is not allowed in midair. An upward hit on a brick's underside removes
that brick exactly once and creates a bounded set of small physical fragments
with gravity, impulses, and angular motion. Side/top contacts do not break it.
Fragments expire and do not block the player's route.

Coins spin using sprite definitions. Collection credits the game exactly once
and creates a short cosmetic flight to the fixed HUD using ordinary animation
programs. Every crossed 100-coin threshold grants one extra life, including
multiple thresholds in one award. Cosmetic completion is not the accounting
trigger. Score and total coins remain observable independently.

## Sprite asset review

Create transparent sprite sheets for character states, bricks/fragments, and
coin rotation. Record the generation prompt and exact frame rectangles. Inspect
each extracted frame, animation contact sheets, baseline alignment, transparency,
neighbor bleed, and left/right flipping. Never assume AI-generated cells align
to a requested grid without measuring. Keep artwork reviewable separately from
game physics and expose a frame/animation preview. User visual review is a
milestone before broader hardening.

## Delivery and evidence

1. Focused failing public test for loading a grid, drawing a frame signal, and
   changing it through existing playback. Implement the minimal sprite slice.
2. Runnable small game slice: sprite character, keyboard movement, ground,
   jumping, and one breakable brick producing physical debris. Provide its exact
   URL and sprite preview for experiential feedback.
3. Add tiers, upward camera, coins and HUD flight, life thresholds, start,
   game-over/restart, and a minimal independent learning example.
4. After feedback, harden adapter validation, trim/rotation/anchor behavior,
   resource ownership, lost focus, restart, collisions, and frame timing.
5. Verify exports, declarations, packed Bundler/NodeNext consumers, source/built
   browsers, editor declarations, tree shaking, catalogs, and documentation.

Tests drive the same public scenes as manual play. Assert semantic frame,
geometry, contacts, score, life, and cleanup state before screenshots. Preserve
all pre-existing working-tree edits. The older active-plan index still points
to HtmlBox; this explicitly requested work is recorded independently rather
than rewriting that unrelated plan.

### Frame-count refinement (user feedback, 2026-10-05)

Use twice the original Super Mario Bros. pose counts as the baseline for relevant
character actions: six run poses (original three), two airborne poses (original
one jump pose), two standing poses, and two skid poses. Keep eight rotation
frames for coins. Swimming, climbing, fireballs, and power-up transformations
are outside this game's scope. Count unique poses, not display refresh frames;
added frames must advance a coherent cycle. Source:
<https://6502disassembly.com/nes-smb/SuperMarioBros.html>, PlayerGraphicsTable.

### Contiguous repeat boundary decision

The pitched `repeat(drive(frame, clip))` surface exposed an existing validator
restriction: touching iteration endpoints were rejected as overlapping writers.
Positive-duration repeat iterations are sequential, like sequence children;
allow equality at their boundary while preserving parallel writer rejection
and the zero-duration ambiguity guard. Verify exact-boundary frame selection
and reverse/alternate behavior before treating this change as hardened.
