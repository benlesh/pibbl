---
id: api-hook-crc-when-changed
title: crcWhenChanged
summary: Runs synchronous change work and deterministic cleanup for dependencies.
kind: api
slug: crc-when-changed
apiCategory: hook
symbols: [crcWhenChanged]
---

# crcWhenChanged

```ts
import { crcWhenChanged } from "@crc/core";
```

`crcWhenChanged(callback, deps?)` is render-only. It invokes the callback
synchronously on mount and after shallow dependency changes, runs the previous
returned cleanup first, and runs the final cleanup at component teardown. It is
not deferred post-render work; use `crcMemo` for purely derived state.

```tsx
function Subscription({ id }: { id: string }) {
  crcWhenChanged(() => {
    console.log(`subscribed to ${id}`);
    return () => console.log(`unsubscribed from ${id}`);
  }, [id]);
}
```

Try the [State and lifecycle guide](#/learn/guides/state-and-lifecycle).
