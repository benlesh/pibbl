---
id: api-hook-crc-event-listener
title: crcEventListener
summary: Registers propagation listeners for the current logical component.
kind: api
slug: crc-event-listener
apiCategory: hook
symbols: [crcEventListener]
relatedTypes: [CRCEventHandlers, CRCNode]
---

# crcEventListener

```ts
import { crcEventListener, Group, type CRCNode } from "@crc/core";
```

`crcEventListener(handlers)` accepts [`CRCEventHandlers`](#/api/types/events#crceventhandlers), is render-only, and updates propagation listeners
for the current component identity. It does not define hit geometry; combine it
with a primitive target or `crcEventTarget`. CRC owns the listener registration
and releases it on replacement or component teardown.

```tsx
function Panel({ children }: { children: CRCNode }) {
  crcEventListener({ onClickCapture: (event) => console.log(event.type) });
  return <Group>{children}</Group>;
}
```

See the [Propagation and cancellation live example](#/examples/events-and-interaction/propagation-and-cancellation).

Container children use [`CRCNode`](#/api/types/elements-components#crcnode).
