# `@crc/physics`

First-class physics for CRC is exposed through dimensioned subpaths. This
package deliberately has no root runtime barrel and does not provide another
JSX runtime.

## 2D geometry

Use the renderer-independent entry for immutable shapes and standalone
geometry operations:

```ts
import { circleShape2D, overlapShapes2D } from "@crc/physics/2d/geometry";
```

The geometry entry has no dependency on `@crc/core`. Public numeric arrays are
copied into package-owned immutable values.

## 3D geometry

The matching renderer-independent 3D entry provides immutable sphere, box,
ellipsoid, capsule, cylinder, cone, convex-hull, triangle-mesh, and heightfield
shapes together with bounds, mass properties, containment, distance, overlap,
contact, ray-cast, shape-cast, and rigid-transform operations:

```ts
import {
  boxShape3D,
  massProperties3D,
  sphereShape3D,
} from "@crc/physics/3d/geometry";

const sphere = sphereShape3D({ radius: 1 });
const boxMass = massProperties3D(
  boxShape3D({ width: 2, height: 4, depth: 6 }),
  { density: 3 },
);
```

The 3D geometry entry does not load CRC, Three.js, WebGL, browser APIs, a world,
or a scheduler. CRC no longer publishes a renderer-coupled 3D world entry. A
future Three physics binding can be designed independently against ordinary
`THREE.Object3D` values; the geometry package remains useful for application
queries and custom integrations today.

## CRC 2D worlds and components

Install the matching `@crc/core` version and import the world-facing entry:

```tsx
import { Circle, crc } from "@crc/core";
import { PhysicsWorld2D, dynamicBody2D } from "@crc/physics/2d";

crc(
  canvas,
  <PhysicsWorld2D>
    <Circle physics={dynamicBody2D()} style={{ radius: 12 }} />
  </PhysicsWorld2D>,
);
```

CRC remains the JSX runtime. Positive X points right, positive Y points down,
rigid-body rotation is clockwise degrees, velocity is logical units per
second, acceleration is logical units per second squared, and fixed-step
duration is milliseconds. Arc and wedge contour angles are explicitly named
in radians.

One mounted awake world owns one physics participant in CRC's realm scheduler;
bodies and colliders do not start independent loops. Animation advances before
physics, and both publish through the existing frame transaction.

The package does not include joints, debug drawing, record/replay, workers, or
a second scheduler.

Read the [API overview](../../docs/site/api/index.md) and the pure [3D geometry
API](../../docs/site/api/functions/physics-3d-geometry.md).
