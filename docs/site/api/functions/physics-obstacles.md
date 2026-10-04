---
id: api-function-physics-obstacles
title: physicsObstacles2D
summary: Borrow committed solid geometry and motion for one-way flow coupling.
kind: api
slug: physics-obstacles
apiCategory: function
symbols: [physicsObstacles2D]
---

# physicsObstacles2D

Import from `@crc/core/physics/2d`. Call `physicsObstacles2D(world)` during
component evaluation to obtain a stable source accepted by
`useFlowField2D({ ..., obstacles: source })` or
`embers({ ..., physics: { obstacles: source } })`. The world retains the source and
its reusable numerical buffers until disposal. Worlds that never request it
perform no obstacle packing.

`source.read()` returns `{ revision, boxes, ellipses, polygons }` from the last successful physics
commit. The borrowed `Float64Array` uses ten entries per box: center x/y,
half-width/height, rotation in radians, center-of-mass linear velocity x/y,
angular velocity in radians per second, and world center-of-mass x/y.
Coordinates use the physics world's simulation space. The field must use the
same origin and scale.

The obstacle revision changes only when packed geometry or motion changes;
unchanged physics commits retain the revision so a flow field can reuse its grid.
Do not mutate or retain borrowed values across commits; copy them if needed.
The buffer contains copies, never Rapier or another WASM module's memory.
Ellipses (including circles) use the same ten-entry layout with radii instead
of half extents. Each polygon record contains vertex count, linear velocity x/y,
angular velocity, center of mass x/y, then world-space vertex x/y pairs.

Rounded boxes with equal corner radii are exported as an exact union of
central boxes and corner circles. Their immutable local geometry is cached.

Disabled bodies and sensors are excluded. Unsupported solid collider kinds
(such as capsules or rounded boxes with unequal corner radii) produce an explicit error on read. Reading after world disposal throws.

Geometry and motion publish together after physics adoption, so flow advancement
reads the previous committed physics state regardless of registration order.
The flow applies no forces back to the world, and smoke particles need no bodies.
