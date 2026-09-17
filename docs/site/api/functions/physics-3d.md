---
id: api-function-physics-3d
title: 3D physics functions
summary: Creates shapes and attachments, issues commands, and queries committed 3D worlds.
kind: api
slug: physics-3d
apiCategory: function
symbols:
  [
    applyForce3D,
    applyImpulse3D,
    applyTorque3D,
    boundsOfShape3D,
    boxShape3D,
    capsuleShape3D,
    collider3D,
    coneShape3D,
    contactBetweenShapes3D,
    containsPoint3D,
    convexHullShape3D,
    cylinderShape3D,
    disableBody3D,
    distanceBetweenShapes3D,
    dynamicBody3D,
    ellipsoidShape3D,
    enableBody3D,
    heightfieldShape3D,
    kinematicBody3D,
    massProperties3D,
    overlapShape3D,
    overlapShapes3D,
    queryAabb3D,
    queryPoint3D,
    raycast3D,
    raycastShape3D,
    setAngularVelocity3D,
    setLinearVelocity3D,
    shapeCast3D,
    shapeCastAgainstShape3D,
    sleepBody3D,
    sphereShape3D,
    staticBody3D,
    teleportBody3D,
    transformShape3D,
    triangleMeshShape3D,
    wakeBody3D,
  ]
relatedTypes: [CRCPhysicsShape3D]
---

# 3D physics functions

Pure shape construction and geometry operations over immutable
[`CRCPhysicsShape3D`](#/api/types/physics-3d#crcphysicsshape3d) values are available from the
renderer-independent entry:

```ts
import {
  boxShape3D,
  massProperties3D,
  raycastShape3D,
} from "@crc/physics/3d/geometry";

const box = boxShape3D({ width: 2, height: 1, depth: 3 });
const mass = massProperties3D(box, { density: 2 });
const hit = raycastShape3D(
  box,
  { position: [0, 0, 0], orientation: [0, 0, 0, 1] },
  {
    origin: [0, 0, 5],
    direction: [0, 0, -1],
    maxDistance: 10,
  },
);
```

That entry loads no CRC runtime, WebGL renderer, DOM, Canvas, scheduler, or
browser global. It exports the shape factories; bounds, mass, containment,
distance, overlap, contact, ray-cast, shape-cast, and rigid-transform operations;
and their geometry-only types.

Runtime functions come from `@crc/physics/3d`:

```ts
import {
  applyImpulse3D,
  collider3D,
  dynamicBody3D,
  queryPoint3D,
} from "@crc/physics/3d";
```

`dynamicBody3D`, `staticBody3D`, and `kinematicBody3D` create immutable body
attachments. `collider3D` attaches compound or sensor geometry to the nearest
body. Body commands queue forces, impulses, torque, teleports, velocities,
sleep/wake, and enable/disable changes for Begin; they never run a private loop.

`raycast3D`, `shapeCast3D`, `overlapShape3D`, `queryAabb3D`, and `queryPoint3D`
read the latest committed physics generation. Options select `"closest"`,
`"any"`, or `"all"`, include/exclude sensors, filter collision categories, and
exclude a body or collider. Results use stable ordering and generation-bound
handles.

Physics queries are not renderer picking. WebGL pointer targeting uses the
committed rendered camera, model, and depth-aware pick ledger; physics queries
use authoritative world coordinates and collider state. CRC does not
automatically turn pointer coordinates into a physics ray.

There is deliberately no root `@crc/physics` barrel or namespace object. Import
from exactly `/2d`, `/2d/geometry`, `/3d`, or `/3d/geometry`.
