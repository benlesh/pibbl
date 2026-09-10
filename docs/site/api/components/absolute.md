---
id: api-component-absolute
title: Absolute
summary: Places direct children in one declared container box.
kind: api
slug: absolute
apiCategory: component
symbols: [Absolute]
relatedTypes: [AbsoluteProps, AbsoluteStyle, CRCNode]
---

# Absolute

```ts
import { Absolute, Rectangle } from "@crc/core";
```

`Absolute` places each direct child from its local `left`, `top`, and declared
box style. Its props are [`AbsoluteProps`](#/api/types/elements-components#absoluteprops); its local style is [`AbsoluteStyle`](#/api/types/layout#absolutestyle).
Children are recursive [`CRCNode`](#/api/types/elements-components#crcnode) values. Allocation is finite and does not
measure or retain drawing commands.

```tsx
<Absolute style={{ width: 320, height: 180 }}>
  <Rectangle
    style={{ left: 24, top: 20, width: 120, height: 60, fill: "#2563eb" }}
  />
</Absolute>
```

Compare it with the [Absolute and Overlay live example](#/examples/layout/absolute-and-overlay).
