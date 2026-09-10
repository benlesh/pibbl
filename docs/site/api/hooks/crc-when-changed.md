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
crcWhenChanged(() => {
  const subscription = subscribe(id);
  return () => subscription.unsubscribe();
}, [id]);
```

Try [Lifecycle changes].
