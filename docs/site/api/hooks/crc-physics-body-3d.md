---
id: api-hook-crc-physics-body-3d
title: crcPhysicsBody3D
summary: Creates a stable component-owned handle for one mounted 3D body.
kind: api
slug: crc-physics-body-3d
apiCategory: hook
symbols: [crcPhysicsBody3D]
relatedTypes: [CRCPhysicsBodyHandle3D]
---

# crcPhysicsBody3D

```ts
import {
  applyImpulse3D,
  crcPhysicsBody3D,
  dynamicBody3D,
} from "@crc/physics/3d";
import { Sphere } from "@crc/webgl";
```

Call `crcPhysicsBody3D()` during component evaluation and pass the returned
[`CRCPhysicsBodyHandle3D`](#/api/types/physics-3d#crcphysicsbodyhandle3d)
handle to one body descriptor. The handle is stable for that hook slot and its
readonly signals expose committed position, orientation, velocities, sleeping,
enabled, and generation state.

```tsx
function Ball() {
  const body = crcPhysicsBody3D();
  return (
    <Sphere
      physics={dynamicBody3D({
        handle: body,
        collider: { restitution: 0.7 },
      })}
      onPointerDown={() => applyImpulse3D(body, [0, 4, 0])}
    />
  );
}
```

Commands are queued into the world's next Begin phase and are generation-bound;
a stale handle never controls a later body that reused storage. Reads do not
schedule simulation. A handle may bind to only one live body, and teardown makes
retained commands inert.
