---
id: api-hook-crc-event
title: crcEvent
summary: Registers one logical-region or root mouse-event callback.
kind: api
slug: crc-event
apiCategory: hook
symbols: [crcEvent]
relatedTypes: [CRCLogicalMouseEvent, CRCMouseEventListener]
---

# crcEvent

```ts
import { crcEvent } from "@crc/core";
```

`crcEvent(type, handler, path?, fill?, lineInteractionWidth?)` is render-only.
Passing a path registers a logical target; omitting it observes the root mouse
event. Re-render replaces the registration and unmount cleans it up. The path,
fill, and stroke width must match the intended painted geometry.

A geometric callback receives a [`CRCLogicalMouseEvent`](#/api/types/events#crclogicalmouseevent); the pathless root-observer form uses [`CRCMouseEventListener`](#/api/types/events#crcmouseeventlistener).

```tsx
function HitArea() {
  crcEvent(
    "click",
    (event) => console.log(event.x, event.y),
    new Path2D("M0 0h80v40H0z"),
    true,
  );
}
```

See the [Click live example](#/examples/events-and-interaction/click).
