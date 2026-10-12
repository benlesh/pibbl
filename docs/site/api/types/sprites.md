---
id: api-types-sprites
title: Sprite types
summary: Atlas geometry, shared ownership, formats, and drawing inputs.
kind: api
slug: sprites
apiCategory: types
typeDomain: sprites
symbols:
  [
    SpriteFrame,
    SpriteRectangle,
    SpriteFrameData,
    SpriteAnimationFrameData,
    SpriteSheetData,
    SpriteSheetFormat,
    SpriteSheet,
    SpriteGrid,
    SpriteProps,
    SpriteStyle,
  ]
---

# Sprite types

## SpriteFrame

Opaque immutable handle with a stable name and original logical width/height. Its sheet owns image data.

## SpriteRectangle

Source pixel rectangle with x, y, width, and height.

## SpriteFrameData

Normalized adapter record: name, optional page, packed rectangle, original size, trim offset, and rotation flag.

## SpriteAnimationFrameData

Normalized frame name and positive duration in milliseconds.

## SpriteSheetData

Adapter result containing relative image URLs, frame records, and optional named timed clips.

## SpriteSheetFormat

Explicit parser object with `parse(unknown)` returning normalized sheet data.

## SpriteSheet

Shared decoded images exposed through readonly frame and animation maps, with idempotent disposal.

## SpriteGrid

Positive integer frameWidth/frameHeight and optional nonnegative integer margin/spacing, measured in pixels.

## SpriteProps

Frame, sampling, normalized anchor, flipX/flipY, and ordinary drawing event props. Declared primitive inputs accept signals.

## SpriteStyle

Logical width, height, opacity, and ordinary Pibbl system style. Default size is the frame’s original untrimmed size.
