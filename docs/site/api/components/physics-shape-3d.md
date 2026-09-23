---
id: api-component-physics-shape-3d
title: PhysicsShape3D and shape components
summary: Renders immutable CRC physics shapes through ordinary WebGL meshes.
kind: api
slug: physics-shape-3d
apiCategory: component
symbols:
  [
    PhysicsShape3D,
    Box3D,
    Ellipsoid3D,
    Capsule3D,
    Cylinder3D,
    Cone3D,
    ConvexHull3D,
    Heightfield3D,
  ]
relatedTypes: [CRCPhysicsShape3D]
---

# PhysicsShape3D and shape components

```ts
import {
  Box3D,
  Capsule3D,
  Heightfield3D,
  PhysicsShape3D,
  PhysicsWorld3D,
  dynamicBody3D,
  staticBody3D,
} from "@crc/physics/3d";
```

`PhysicsShape3D` converts one immutable [`CRCPhysicsShape3D`](#/api/types/physics-3d#crcphysicsshape3d)
descriptor into an ordinary WebGL `Mesh`. `Box3D`, `Ellipsoid3D`, `Capsule3D`,
`Cylinder3D`, `Cone3D`, `ConvexHull3D`, and `Heightfield3D` construct the matching
shape and delegate to that component.

```tsx
<PhysicsWorld3D gravity={[0, -9.81, 0]}>
  <Capsule3D
    start={[0, -0.75, 0]}
    end={[0, 0.75, 0]}
    radius={0.4}
    physics={dynamicBody3D()}
    style={{ color: "#38bdf8" }}
  />
  <Heightfield3D
    rows={2}
    columns={3}
    heights={[0, 0.2, 0, 0, 0, 0]}
    physics={staticBody3D()}
    style={{ color: "#475569" }}
  />
</PhysicsWorld3D>
```

Shape descriptors, their acceleration data, and render geometry are cached by
descriptor identity in `WeakMap`s. They are immutable descriptor-owned data, not
reference-counted runtime resources; CRC does not expose cache counts or
garbage-collection timing.

`Cube`, `Sphere`, `Mesh`, and `Group3D` also accept the augmented `physics` prop.
CRC infers a box for `Cube`, a sphere or ellipsoid from `Sphere` scale, a triangle
mesh for static `Mesh`, and a deterministic convex hull for moving `Mesh`.
`Group3D` hosts a compound body and infers no self collider. An explicit shape
overrides inference. Triangle meshes and heightfields are static-only collider
shapes; using either on a dynamic or kinematic body produces an actionable
runtime diagnostic.
