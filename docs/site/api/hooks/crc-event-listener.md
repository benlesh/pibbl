---
id: api-hook-crc-event-listener
title: crcEventListener
summary: Registers propagation listeners for the current logical component.
kind: api
slug: crc-event-listener
apiCategory: hook
symbols: [crcEventListener]
---

# crcEventListener

```ts
import { crcEventListener } from "@crc/core";
```

`crcEventListener(handlers)` is render-only and updates propagation listeners
for the current component identity. It does not define hit geometry; combine it
with a primitive target or `crcEventTarget`. CRC owns the listener registration
and releases it on replacement or component teardown.

```tsx
function Panel({ children }) {
  crcEventListener({ onClickCapture: (event) => console.log(event.type) });
  return <Group>{children}</Group>;
}
```

See [Event propagation].
