---
id: api-component-physics-world-3d
title: PhysicsWorld3D
summary: Owns one deterministic 3D physics world inside a WebGL island.
kind: api
slug: physics-world-3d
apiCategory: component
symbols: [PhysicsWorld3D]
relatedTypes: [CRCPhysicsWorld3DProps]
---

# PhysicsWorld3D

```ts
import { PhysicsWorld3D, dynamicBody3D, staticBody3D } from "@crc/physics/3d";
import { Cube, WebGLLayer } from "@crc/webgl";
```

`PhysicsWorld3D` establishes the nearest 3D physics world for its descendants.
It must be rendered inside a [`WebGLLayer`](#/api/components/webgl-layer).
Its timing, gravity, solver, event, and child fields are defined by
[`CRCPhysicsWorld3DProps`](#/api/types/physics-3d#crcphysicsworld3dprops).

```tsx
<WebGLLayer style={{ width: 640, height: 360 }}>
  <PhysicsWorld3D gravity={[0, -9.81, 0]}>
    <Cube physics={dynamicBody3D()} />
    <Cube
      physics={staticBody3D()}
      style={{ translateY: -2, scaleX: 8, scaleZ: 8 }}
    />
  </PhysicsWorld3D>
</WebGLLayer>
```

One mounted awake world participates in CRC's existing realm scheduler. Animation
advances first, physics runs bounded fixed ticks, values commit together, and the
WebGL island settles once afterward. Bodies and colliders do not register their
own scheduler work, and there is no public `world.step()` or second frame loop.

The defaults are zero gravity, a `1000 / 60` millisecond fixed step, four catch-up
steps, linear presentation interpolation, sleeping enabled, eight velocity
iterations, and three position iterations. Rendering may occur between fixed
ticks; handles, queries, contacts, and events read authoritative committed state,
while rendering uses the world's presentation pose.

Same-dimension nested worlds are rejected. A 3D world does not collide with a 2D
world, and CRC provides no 2.5D bridge. Removing the component releases its
single scheduler registration, world state, body/collider stores, contacts, and
pending owner-scoped work.
