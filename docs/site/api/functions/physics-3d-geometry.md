---
id: api-function-physics-3d-geometry
title: 3D physics geometry functions
summary: Creates and queries renderer-independent immutable 3D physics shapes.
kind: api
slug: physics-3d-geometry
apiCategory: function
symbols:
  [
    boundsOfShape3D,
    boxShape3D,
    capsuleShape3D,
    coneShape3D,
    contactBetweenShapes3D,
    containsPoint3D,
    convexHullShape3D,
    cylinderShape3D,
    distanceBetweenShapes3D,
    ellipsoidShape3D,
    heightfieldShape3D,
    massProperties3D,
    overlapShapes3D,
    raycastShape3D,
    shapeCastAgainstShape3D,
    sphereShape3D,
    transformShape3D,
    triangleMeshShape3D,
  ]
relatedTypes: [CRCPhysicsShape3D, CRCPhysicsTransform3D, CRCPhysicsShapeHit3D]
---

# 3D physics geometry functions

```ts
import {
  boxShape3D,
  overlapShapes3D,
  raycastShape3D,
} from "@crc/physics/3d/geometry";
```

The 3D geometry entry is pure and renderer independent. The named shape
factories create immutable box, sphere, ellipsoid, capsule, cylinder, cone,
convex-hull, triangle-mesh, and heightfield
[`CRCPhysicsShape3D`](#/api/types/physics-3d-geometry#crcphysicsshape3d)
descriptors. Queries accept explicit
[`CRCPhysicsTransform3D`](#/api/types/physics-3d-geometry#crcphysicstransform3d)
values and casts return
[`CRCPhysicsShapeHit3D`](#/api/types/physics-3d-geometry#crcphysicsshapehit3d)
when they hit.

`boundsOfShape3D`, `massProperties3D`, `containsPoint3D`,
`distanceBetweenShapes3D`, `overlapShapes3D`, `contactBetweenShapes3D`,
`raycastShape3D`, `shapeCastAgainstShape3D`, and `transformShape3D` perform
deterministic geometry operations without loading CRC core, Three.js, Canvas,
WebGL, a component runtime, or a scheduler.

CRC does not currently publish a Three object binding or 3D physics world
component. Applications may use these pure operations with their own Three
objects and coordinate conventions.
