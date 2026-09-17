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

The 3D geometry entry does not load CRC, WebGL, browser APIs, a world, or a
scheduler. Install the matching optional `@crc/core` and `@crc/webgl` peers
when using the world-facing `@crc/physics/3d` entry.

## CRC 3D worlds and components

The world-facing entry integrates with one `WebGLLayer` and CRC's shared realm
scheduler:

```tsx
import { crc } from "@crc/core";
import { Cube, WebGLLayer } from "@crc/webgl";
import { PhysicsWorld3D, dynamicBody3D } from "@crc/physics/3d";

crc(
  canvas,
  <WebGLLayer style={{ width: 640, height: 360 }}>
    <PhysicsWorld3D gravity={[0, -9.81, 0]}>
      <Cube physics={dynamicBody3D({ mass: 1 })} style={{ lit: false }} />
    </PhysicsWorld3D>
  </WebGLLayer>,
);
```

`Cube`, `Sphere`, and `Mesh` infer colliders. `Group3D` hosts compound bodies,
and `Box3D`, `Ellipsoid3D`, `Capsule3D`, `Cylinder3D`, `Cone3D`,
`ConvexHull3D`, `Heightfield3D`, and `PhysicsShape3D` render the remaining
public shapes. Moving triangle meshes and heightfields are rejected with a
runtime diagnostic; use a convex hull or another convex shape for moving
bodies.

Runtime queries read authoritative committed collider state. They are distinct
from WebGL renderer picking, which uses the committed camera, presented model,
and depth-aware pick ledger. CRC does not automatically convert pointer
coordinates into a physics ray.

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

Read [Add first-class 3D physics](../../docs/site/learn/guides/physics-3d.md),
the [`PhysicsWorld3D` API](../../docs/site/api/components/physics-world-3d.md),
and the grouped [3D physics functions](../../docs/site/api/functions/physics-3d.md)
and [types](../../docs/site/api/types/physics-3d.md).
