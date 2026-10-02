---
id: api-hook-use-flow-field
title: useFlowField2D and useFlowSource2D
summary: Share a component-owned velocity field and localized force or heat sources.
kind: api
slug: use-flow-field
apiCategory: hook
symbols: [useFlowField2D, useFlowSource2D]
keywords: [particles, flow, smoke, buoyancy]
---

# useFlowField2D and useFlowSource2D

```ts
import { useFlowField2D, useFlowSource2D } from "@crc/particles";
```

`useFlowField2D({ bounds, resolution, obstacles?, buoyancy? })` owns one
staggered velocity grid. Bounds contain logical `width` and `height`;
resolution is `[columns, rows]`. Dimensions are mount-only. The field uses the
CRC scheduler, fixed 60 Hz steps, and at most four catch-up steps per frame.
Negative buoyancy accelerates hot flow upward in Canvas coordinates.

`useFlowSource2D(field, { position, radius, acceleration?, heat?, enabled? })`
adds a hook-owned localized source. Source fields accept signals. Acceleration
uses logical units/second squared; heat is normalized heat injected per second.
Heat is transported by the velocity field and decays over time. Removing or
disabling a source stops its injection. The source does not emit particles.

A field handle exposes a readonly `revision` signal and
`sampleBatch(positions, velocities, count)`. Both buffers are caller-owned
`Float32Array` values with interleaved x/y entries. Sampling reads committed
velocity state without stepping or allocating result objects. Positions use the
field's local coordinates, with origin `[0, 0]`. Sampling outside the grid
extends its edge velocity. A retained handle rejects sampling after disposal.

Obstacle sources return committed batches; they do not share engine memory.
Boxes rasterize to solid cells. Boundary normal velocity follows solid motion,
while tangential velocity is free-slip. Grid resolution limits obstacle detail.

Pass the field as `useParticleSystem(effect, { flow })` to advect particle
positions. The field binding is mount-only. Flow-bound emitters use the field
for translation; initial velocity and translational motion modules are rejected.
Angular velocity and lifetime appearance remain available.

Particles sample the last committed field using bounded midpoint integration
and swept solid-cell collision checks. When changed geometry covers a particle
center, that particle retires from rendering and integration until its slot is
reborn. It cannot reappear when the obstacle moves away. Its ledger slot remains
reserved until normal lifetime expiry or recycling. Sprite pixels can still
extend across a solid boundary; this is center-based transport, not sprite
clipping or volumetric occlusion.
