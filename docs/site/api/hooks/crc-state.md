---
id: api-hook-crc-state
title: crcState
summary: Stores component state and schedules a coalesced CRC update.
kind: api
slug: crc-state
apiCategory: hook
symbols: [crcState]
---

# crcState

```ts
import { crcState, Rectangle } from "@crc/core";
```

`crcState(init?)` is render-only and returns `[value, setValue]`. The setter
accepts a value or updater function and schedules the owning Canvas through
CRC's animation-frame update path. Multiple updates before the next frame
coalesce; stale setters from a disposed or unmounted component safely do nothing.

```tsx
function Toggle() {
  const [on, setOn] = crcState(false);
  return (
    <Rectangle
      onClick={() => setOn((value) => !value)}
      style={{ width: 80, height: 40, fill: on ? "#22c55e" : "#64748b" }}
    />
  );
}
```

Try the [State and lifecycle guide](#/learn/guides/state-and-lifecycle).
