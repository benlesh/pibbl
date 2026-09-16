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

The matching renderer-independent 3D entry currently provides immutable sphere
and oriented-box shapes, rigid transforms, bounds, and analytic mass
properties:

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
when using the world-facing `@crc/physics/3d` entry. Runtime world values are
exported only as their implementations become available; this initial entry
re-exports geometry and the fixed runtime-facing types without placeholder
values.

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
