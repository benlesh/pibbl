---
id: api-hook-crc-animation-frame
title: crcAnimationFrame
summary: Returns the shared CRC frame timestamp and requests another frame while mounted.
kind: api
slug: crc-animation-frame
apiCategory: hook
symbols: [crcAnimationFrame]
relatedTypes: []
---

# crcAnimationFrame

```ts
import { crcAnimationFrame, Cube } from "@crc/webgl";
```

`crcAnimationFrame()` is a render-only hook. It returns the current CRC frame
timestamp and keeps its mounted component rendering on the coalesced core
scheduler.

```tsx
function Spin() {
  const timestamp = crcAnimationFrame();
  return <Cube style={{ rotationYDegrees: timestamp / 20 }} />;
}
```

All callers in one CRC transaction observe the same timestamp. Multiple
requests coalesce; removing the component or disposing the root releases the
continuing request, and a stale callback cannot schedule a replacement mount.
Static WebGL content does not request continuing frames.
