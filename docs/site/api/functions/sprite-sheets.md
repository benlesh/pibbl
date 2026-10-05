---
id: api-functions-sprite-sheets
title: Sprite sheets and clips
summary: Load explicit atlas formats or regular grids and define discrete frame animations.
kind: api
slug: sprite-sheets
apiCategory: function
symbols: [loadSpriteSheet, defineSpriteAnimation, aseprite, texturePacker]
relatedTypes: [SpriteSheet, SpriteGrid, SpriteSheetFormat, SpriteFrame]
---

# Sprite sheets and clips

## loadSpriteSheet

Import from `@pibbl/core/sprites`. `loadSpriteSheet(url, { grid })` loads a regular
image grid; `loadSpriteSheet(url, { format })` loads metadata through a supplied
adapter. It returns a promise for a sheet with readonly `frames` and `animations`
maps, and idempotent `dispose()`. Failures release partially loaded image resources.
Unmount consumers before disposal. Loading uses browser image decoding.

## defineSpriteAnimation

`defineSpriteAnimation({ frames, fps })` or
`defineSpriteAnimation({ frames: [{ frame, duration }, ...] })` creates an ordinary
seekable animation definition. FPS and millisecond durations must be finite and
positive. The frame list must be nonempty. Loop with `repeat`; control playback
with the existing animation API.

## aseprite

Import `aseprite` from `@pibbl/core/sprites/formats/aseprite` and pass
`{ format: aseprite() }`. Supports JSON hash/array frames and frame tags, including
forward, reverse, and ping-pong ordering. Images resolve relative to metadata.

## texturePacker

Import `texturePacker` from `@pibbl/core/sprites/formats/texture-packer` and pass
`{ format: texturePacker() }`. Supports JSON hash/array rectangles, trim offsets,
and clockwise packed rotation. Linked multipacks and scales other than 1 are
explicitly rejected. Author clips with `defineSpriteAnimation`.

Adapters are separate imports; importing a grid loader does not import either
parser. See the [sprite guide](#/learn/guides/sprites) and
[sprite types](#/api/types/sprites).

Related types: [SpriteSheet](#/api/types/sprites#spritesheet), [SpriteGrid](#/api/types/sprites#spritegrid), [SpriteSheetFormat](#/api/types/sprites#spritesheetformat), [SpriteFrame](#/api/types/sprites#spriteframe).
