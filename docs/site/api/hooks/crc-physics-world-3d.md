---
id: api-hook-crc-physics-world-3d
title: crcPhysicsWorld3D
summary: Reads the nearest mounted 3D physics world handle.
kind: api
slug: crc-physics-world-3d
apiCategory: hook
symbols: [crcPhysicsWorld3D]
relatedTypes: [CRCPhysicsWorldHandle3D]
---

# crcPhysicsWorld3D

```ts
import { Text } from "@crc/core";
import { crcPhysicsWorld3D, raycast3D } from "@crc/physics/3d";
```

`crcPhysicsWorld3D()` returns the nearest enclosing
[`CRCPhysicsWorldHandle3D`](#/api/types/physics-3d#crcphysicsworldhandle3d).
Call it during component evaluation, then use it with authoritative world-query
functions.

```tsx
function QueryProbe() {
  const world = crcPhysicsWorld3D();
  const hit = raycast3D(world, {
    origin: [0, 5, 5],
    direction: [0, -0.7, -0.7],
    maxDistance: 20,
  });
  return hit ? <Text>{String(hit.tag)}</Text> : undefined;
}
```

The handle's `revision` signal changes when a committed simulation generation
can affect a query. Queries are synchronous committed-state reads and never
advance time or schedule a render. Calling the hook outside a 3D world produces
an actionable diagnostic.
