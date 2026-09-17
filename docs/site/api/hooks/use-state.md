---
id: api-hook-use-state
title: useState
summary: Stores component state and schedules a coalesced CRC update.
kind: api
slug: use-state
apiCategory: hook
symbols: [useState]
relatedTypes: [Canvas, StateUpdater]
---

# useState

```ts
import { useState, Rectangle } from "@crc/core";
```

`useState(init?)` is render-only and returns `[value, setValue]`. The setter
accepts a value or updater function and schedules the owning [`Canvas`](#/api/types/canvas-runtime#canvas) through
CRC's animation-frame update path. Multiple updates before the next frame
coalesce; stale setters from a disposed or unmounted component safely do nothing.

The returned setter is a generic [`StateUpdater`](#/api/types/canvas-runtime#stateupdater).

```tsx
function Toggle() {
  const [on, setOn] = useState(false);
  return (
    <Rectangle
      onClick={() => setOn((value) => !value)}
      style={{ width: 80, height: 40, fill: on ? "#22c55e" : "#64748b" }}
    />
  );
}
```

Try the [State and lifecycle guide](#/learn/guides/state-and-lifecycle).
