---
id: api-hook-use-animation-frame
title: useAnimationFrame
summary: Returns the shared CRC frame timestamp and requests another frame while mounted.
kind: api
slug: use-animation-frame
apiCategory: hook
symbols: [useAnimationFrame]
relatedTypes: []
---

# useAnimationFrame

```ts
import { useAnimationFrame, Cube } from "@crc/webgl";
```

`useAnimationFrame()` is a render-only hook. It returns the current CRC frame
timestamp and keeps its mounted component rendering on the coalesced core
scheduler.

```tsx
function Spin() {
  const timestamp = useAnimationFrame();
  return <Cube style={{ rotationYDegrees: timestamp / 20 }} />;
}
```

All callers in one CRC transaction observe the same timestamp. Multiple
requests coalesce; removing the component or disposing the root releases the
continuing request, and a stale callback cannot schedule a replacement mount.
Static WebGL content does not request continuing frames.
