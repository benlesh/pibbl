---
id: api-hook-use-ref
title: useRef
summary: Creates a stable mutable reference object for one component lifetime.
kind: api
slug: use-ref
apiCategory: hook
symbols: [useRef]
relatedTypes: [CRCRef]
---

# useRef

```ts
import { useRef, Text } from "@crc/core";
```

`useRef(init?)` is render-only and returns one stable [`CRCRef`](#/api/types/canvas-runtime#crcref) with a generic mutable
`current` field for the component identity. Updating `current` does not schedule
a render. Its normal hook slot lifetime ends when the component unmounts; do
not use it to preserve state across a changed component identity.

```tsx
function Counter() {
  const renders = useRef(0);
  renders.current = (renders.current ?? 0) + 1;
  return <Text>{renders.current}</Text>;
}
```

Use [`useState`](#/api/hooks/use-state) for values that should schedule updates.
