---
id: api-hook-crc-event-target
title: crcEventTarget
summary: Defines a geometric logical event and focus target.
kind: api
slug: crc-event-target
apiCategory: hook
symbols: [crcEventTarget]
---

# crcEventTarget

```ts
import { crcEventTarget } from "@crc/core";
```

`crcEventTarget(handlers, options)` is render-only. It returns the current
focus snapshot while registering/updating a geometric target, its event
handlers, and focus options. CRC owns the registration and releases it when the
hook slot is replaced or the component unmounts.

```tsx
const focus = crcEventTarget({ onClick: () => select() }, { path, fill: true });
```

Use `FocusManagement` for logical focus policy. See [Focus targets].
