---
id: api-hook-use-event-listener
title: useEventListener
summary: Registers propagation listeners for the current logical component.
kind: api
slug: use-event-listener
apiCategory: hook
symbols: [useEventListener]
relatedTypes: [CRCEventHandlers, CRCNode]
---

# useEventListener

```ts
import { useEventListener, Group, type CRCNode } from "@crc/core";
```

`useEventListener(handlers)` accepts [`CRCEventHandlers`](#/api/types/events#crceventhandlers), is render-only, and updates propagation listeners
for the current component identity. It does not define hit geometry; combine it
with a primitive target or `useEventTarget`. CRC owns the listener registration
and releases it on replacement or component teardown.

```tsx
function Panel({ children }: { children: CRCNode }) {
  useEventListener({ onClickCapture: (event) => console.log(event.type) });
  return <Group>{children}</Group>;
}
```

See the [Propagation and cancellation live example](#/examples/events-and-interaction/propagation-and-cancellation).

Container children use [`CRCNode`](#/api/types/elements-components#crcnode).
