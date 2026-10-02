---
id: api-function-physics-box-obstacles
title: physicsBoxObstacles2D
summary: Borrow committed box geometry and motion for one-way flow coupling.
kind: api
slug: physics-box-obstacles
apiCategory: function
symbols: [physicsBoxObstacles2D]
---

# physicsBoxObstacles2D

Import from `@crc/physics/2d`. Call `physicsBoxObstacles2D(world)` during
component evaluation to obtain a stable source accepted by
`useFlowField2D({ ..., obstacles: source })`. The world retains the source and
its reusable numerical buffer until disposal. Worlds that never request it
perform no obstacle packing.

`source.read()` returns `{ revision, boxes }` from the last successful physics
commit. The borrowed `Float64Array` uses ten entries per box: center x/y,
half-width/height, rotation in radians, center-of-mass linear velocity x/y,
angular velocity in radians per second, and world center-of-mass x/y.
Coordinates use the physics world's simulation space. The field must use the
same origin and scale.

Do not mutate or retain borrowed values across commits; copy them if needed.
The buffer contains copies, never Rapier or another WASM module's memory.
Disabled bodies and sensors are excluded. Non-box solid colliders produce an
explicit error on read. Reading after world disposal throws.

Geometry and motion publish together after physics adoption, so flow advancement
reads the previous committed physics state regardless of registration order.
The flow applies no forces back to the world, and smoke particles need no bodies.
