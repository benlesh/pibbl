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

## CRC worlds and components

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

The first 2D package does not include 3D physics, joints, debug drawing,
record/replay, workers, or a second scheduler.
