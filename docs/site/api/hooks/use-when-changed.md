---
id: api-hook-use-when-changed
title: useWhenChanged
summary: Runs synchronous change work and deterministic cleanup for dependencies.
kind: api
slug: use-when-changed
apiCategory: hook
symbols: [useWhenChanged]
---

# useWhenChanged

```ts
import { useWhenChanged } from "@crc/core";
```

`useWhenChanged(callback, deps?)` is render-only. It invokes the callback
synchronously on mount and after shallow dependency changes, runs the previous
returned cleanup first, and runs the final cleanup at component teardown. It is
not deferred post-render work; use `useMemo` for purely derived state.

```tsx
function Subscription({ id }: { id: string }) {
  useWhenChanged(() => {
    console.log(`subscribed to ${id}`);
    return () => console.log(`unsubscribed from ${id}`);
  }, [id]);
}
```

Try the [State and lifecycle guide](#/learn/guides/state-and-lifecycle).
