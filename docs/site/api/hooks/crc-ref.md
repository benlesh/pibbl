---
id: api-hook-crc-ref
title: crcRef
summary: Creates a stable mutable reference object for one component lifetime.
kind: api
slug: crc-ref
apiCategory: hook
symbols: [crcRef]
relatedTypes: [CRCRef]
---

# crcRef

```ts
import { crcRef, Text } from "@crc/core";
```

`crcRef(init?)` is render-only and returns one stable [`CRCRef`](#/api/types/canvas-runtime#crcref) with a generic mutable
`current` field for the component identity. Updating `current` does not schedule
a render. Its normal hook slot lifetime ends when the component unmounts; do
not use it to preserve state across a changed component identity.

```tsx
function Counter() {
  const renders = crcRef(0);
  renders.current = (renders.current ?? 0) + 1;
  return <Text>{renders.current}</Text>;
}
```

Use [`crcState`](#/api/hooks/crc-state) for values that should schedule updates.
