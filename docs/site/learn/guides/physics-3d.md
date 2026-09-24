---
id: guide-physics-3d
title: Add first-class 3D physics
summary: Build deterministic CRC-owned rigid-body scenes inside a WebGL island.
kind: guide
slug: physics-3d
order: 68
keywords: [physics, 3d, rigid body, collision, query, webgl]
---

# Add first-class 3D physics

Install the optional physics package beside matching CRC core and WebGL
versions, then import runtime values from the dimension-specific entry.

```tsx
import { crc } from "@crc/core";
import { Cube, DirectionalLight, Sphere, WebGLLayer } from "@crc/webgl";
import { PhysicsWorld3D, dynamicBody3D, staticBody3D } from "@crc/physics/3d";

function Scene() {
  return (
    <WebGLLayer style={{ width: 640, height: 360 }}>
      <DirectionalLight style={{ rotationXDegrees: -45 }} />
      <PhysicsWorld3D gravity={[0, -9.81, 0]}>
        <Sphere
          physics={dynamicBody3D({ collider: { restitution: 0.7 } })}
          style={{ translateY: 4, color: "#38bdf8" }}
        />
        <Cube
          physics={staticBody3D()}
          style={{ translateY: -1, scaleX: 8, scaleZ: 8 }}
        />
      </PhysicsWorld3D>
    </WebGLLayer>
  );
}

crc(document.querySelector("canvas")!, <Scene />);
```

CRC owns this solver; it does not wrap a third-party engine, WASM runtime, or
service. One awake world joins the existing scheduler after animation and before
the shared Commit/Render. Do not create another `requestAnimationFrame`, and do
not look for a manual `world.step()` API.

World and shape component inputs use CRC's shared declared signal-input
contract. Pass a signal directly for reactive replacement of an opted-in
gravity, body, collider, or presentation input; the receiving component owns
the dependency. A physics handle prop that explicitly asks for a signal object
retains that object instead. CRC does not inspect nested user metadata or shape
payloads for signals.

## Bodies, colliders, and inference

Body descriptors establish motion authority. Dynamic bodies are solver-owned
while enabled; kinematic targets belong to application signals or CRC animation;
static and disabled bodies use authored placement. Disable a dynamic body before
animating its root pose, then re-enable it at the authored pose with an explicit
zero/preserve velocity policy.

`Cube` infers a box. Uniformly scaled `Sphere` infers a sphere and nonuniform
scale infers an ellipsoid. Static `Mesh` infers its triangle mesh; dynamic and
kinematic `Mesh` infer a deterministic convex hull. `Group3D` is a compound body
host and infers no self collider. Attach descendant colliders explicitly:

```tsx
<Group3D physics={dynamicBody3D({ collider: false })}>
  <Cube
    physics={collider3D({ density: 2, tag: "left" })}
    style={{ translateX: -1 }}
  />
  <Sphere
    physics={collider3D({ sensor: true, tag: "sensor" })}
    style={{ translateX: 1 }}
  />
</Group3D>
```

CRC preserves exact authored transform lineage for compound geometry. Scale and
mirroring are baked into collider geometry and automatic mass, never into body
pose. Triangle meshes and heightfields are static-only; moving concave use is a
runtime diagnostic because the same descriptor can be valid on a static body.

## Commands and queries

Create a body handle with [`crcPhysicsBody3D`](#/api/hooks/crc-physics-body-3d)
and pass it into a descriptor. Forces, impulses, torque, teleports, velocities,
sleep/wake, and enable/disable commands enter the next Begin phase. Handle
signals publish committed state together.

Use [`crcPhysicsWorld3D`](#/api/hooks/crc-physics-world-3d) for ray, shape,
overlap, AABB, or point queries. These are synchronous reads of authoritative
collider state. They are distinct from WebGL renderer picking, which resolves
pointer targets against the committed camera and depth-aware scene. Build a
world-space physics ray explicitly when an interaction needs both systems.

## Standalone geometry

Server tools and tests can use the pure entry without browser globals:

```ts
import {
  boxShape3D,
  contactBetweenShapes3D,
  transformShape3D,
} from "@crc/physics/3d/geometry";
```

Immutable shape/BVH and shape-to-render-geometry caches use weak descriptor
keys. They have stable identity while a descriptor is live, but CRC makes no
public cache-count or garbage-collection promise.

There is no root `@crc/physics` barrel. The 2D and 3D worlds are separate and do
not collide. Joints, vehicles, character controllers, debug rendering, public
replay/history, 2.5D bridging, workers, and an independent simulation clock are
outside this release.

Explore the complete public surface in [`PhysicsWorld3D`](#/api/components/physics-world-3d),
the [shape components](#/api/components/physics-shape-3d), and the grouped
[functions](#/api/functions/physics-3d) and [types](#/api/types/physics-3d).
