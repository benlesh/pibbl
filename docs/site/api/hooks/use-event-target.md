---
id: api-hook-use-event-target
title: useEventTarget
summary: Defines a geometric logical event and focus target.
kind: api
slug: use-event-target
apiCategory: hook
symbols: [useEventTarget]
relatedTypes: [CRCEventHandlers, CRCEventTargetOptions, CRCEventTargetSnapshot]
---

# useEventTarget

```ts
import { useEventTarget } from "@crc/core";
```

`useEventTarget(handlers, options)` accepts [`CRCEventHandlers`](#/api/types/events#crceventhandlers) and [`CRCEventTargetOptions`](#/api/types/events#crceventtargetoptions), is render-only, and returns the current
focus snapshot while registering/updating a geometric target, its event
handlers, and focus options. CRC owns the registration and releases it when the
hook slot is replaced or the component unmounts.

The returned focus state is a [`CRCEventTargetSnapshot`](#/api/types/events#crceventtargetsnapshot).

```tsx
function Target() {
  const path = new Path2D("M0 0h80v40H0z");
  const focus = useEventTarget(
    { onClick: () => undefined },
    { path, fill: true },
  );
  return focus.isFocused ? null : null;
}
```

Use `FocusManagement` for logical focus policy. See the [Custom event targets live example](#/examples/events-and-interaction/custom-event-targets).
