---
id: api-component-absolute
title: Absolute
summary: Places direct children in one declared container box.
kind: api
slug: absolute
apiCategory: component
symbols: [Absolute]
relatedTypes: [AbsoluteProps, AbsoluteStyle, PibblNode]
---

# Absolute

```ts
import { Absolute, Rectangle } from "@pibbl/core";
```

`Absolute` places each direct child from its local `left`, `top`, and declared
box style. Its props are [`AbsoluteProps`](#/api/types/elements-components#absoluteprops); its local style is [`AbsoluteStyle`](#/api/types/layout#absolutestyle).
Children are recursive [`PibblNode`](#/api/types/elements-components#pibblnode) values. Allocation is finite and does not
measure or retain drawing commands.

```tsx
<Absolute style={{ width: 320, height: 180 }}>
  <Rectangle
    style={{ left: 24, top: 20, width: 120, height: 60, fill: "#2563eb" }}
  />
</Absolute>
```

Compare it with the [Absolute and Overlay live example](#/examples/layout/absolute-and-overlay).

Experimental mounted own-style resolution also accepts percentage `padding` from
the established containing-owner width, including top/bottom. A 200px owner keeps
10% at 20px when this container narrows to 160px. Upstream parent admission remains
authoritative; this does not add a pure measurement provider or infer an owner
from constraints. Try [allocated padding](#/examples/layout/wasm-flow-padding).

Actual experimental child allocation resolves raw percentage padding before box
conversion, using this parent’s content width. Pure measurement constraints alone do not supply that owner.
