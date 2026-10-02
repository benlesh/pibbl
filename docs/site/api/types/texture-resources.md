---
id: api-types-texture-resources
title: Texture resources
summary: Mount-owned procedural paint with typed messages and shared source pixels.
kind: api
slug: texture-resources
apiCategory: types
symbols:
  [
    Texture,
    TextureContext,
    TextureDefinition,
    TextureFrame,
    TextureOptions,
    TexturePaint,
    TexturePlacement,
    TextureRecipe,
    defineTexture,
    useTexture,
  ]
---

# Texture resources

`defineTexture` from `@crc/core` creates a recipe factory. Recipes contain data;
`useTexture(recipe, options)` creates one persistent, mount-owned source that can
be passed directly to `style.fill` or `style.stroke`. Its `send(message)` method
queues typed, structured-cloneable data for the next CRC update. It may not run
during rendering. A static texture without a receiver accepts no messages.

`TextureDefinition<Config, State, Message>` supplies synchronous `create`,
`rasterize`, and optional `update`, `receive`, `advance`, and `dispose` callbacks.
`TextureContext` supplies the resource-owned `canvas`, optional `palette`,
`invalidate()` for changed output, and `requestFrame()` for continuing work.
`TextureFrame` supplies `delta` and `time` in milliseconds. No additional loop is
needed. Configurations and messages must be structured-cloneable data.

`TextureOptions` controls `resolution` and optional `palette`. Resolution defaults
to 256 by 160; dimensions are integers from 8 through 1024 with at most 262144
cells. Resizing resets implementation state. Palette changes preserve state.

`Texture<Message>` is a `TexturePaint` with `send` and `paint(placement)`.
`TexturePlacement` chooses `repeat` or `stretch`, logical `tileWidth`/`tileHeight`,
`offsetX`/`offsetY`, and `rotation` in degrees. Paint views share their owner's
pixels and lifetime. Sharing is supported within the owner's CRC tree. Disposal
releases the canvas and queued work; later sends are inert, and rendering a
disposed resource is an error. Owners must outlive consumers.

`TextureRecipe<Message>` is the opaque result of the recipe factory. Recreating
recipes with the same definition preserves the mounted resource. Changing the
definition requires a new keyed owner. Custom implementations receive changed
configuration through `update` and decide whether output needs regeneration.

## Texture

The typed resource handle accepted by fills and strokes.

## TexturePaint

An opaque resource-backed paint, optionally with per-use placement.

## TextureRecipe

A pure definition/configuration value consumed by the hook.

## TextureDefinition

The custom implementation lifecycle described above.

## TextureContext

The owned raster and invalidation capabilities.

## TextureFrame

CRC-supplied time and delta in milliseconds.

## TextureOptions

Resource resolution and presentation palette.

## TexturePlacement

Per-consumer repeat/stretch, tile size, offset, and rotation.

## defineTexture

Creates the immutable recipe factory for a custom implementation.

## useTexture

Owns one recipe instance at the current mounted hook slot.
