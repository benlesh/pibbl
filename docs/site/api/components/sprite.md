---
id: api-component-sprite
title: Sprite
summary: Draw an atlas frame or frame signal with stable logical bounds, trim, rotation, and sampling.
kind: api
slug: sprite
apiCategory: component
symbols: [Sprite]
relatedTypes: [SpriteProps, SpriteStyle, SpriteFrame]
---

# Sprite

`Sprite` from `@pibbl/core/sprites` draws an immutable frame returned by
`loadSpriteSheet`. `frame` accepts a literal or signal. Its source sheet must remain
alive until all consumers unmount.

```tsx
<Sprite
  frame={frame}
  sampling="nearest"
  flipX={facingLeft}
  anchor={{ x: 0.5, y: 1 }}
  style={{ width: 48, height: 64 }}
/>
```

`sampling` defaults to linear. `anchor` defaults to top-left and uses normalized
original frame dimensions. `flipX` and `flipY` default to false. Width/height default
to the original untrimmed frame dimensions. Packing rotation and trim offsets are
handled by drawing; hit bounds stay logical. Use explicit physics colliders.

See the [sprite guide](#/learn/guides/sprites) and [sprite types](#/api/types/sprites).

Related types: [SpriteProps](#/api/types/sprites#spriteprops), [SpriteStyle](#/api/types/sprites#spritestyle), [SpriteFrame](#/api/types/sprites#spriteframe).
