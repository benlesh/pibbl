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
import { useFlowField2D, useFlowSource2D } from "@crc/core/particles";
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
Boxes, ellipses, and polygons rasterize to solid cells. Boundary normal velocity follows solid motion,
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

## Timing, replay, and ownership

Physics obstacles, field velocities, and particle positions have separate
committed snapshots. A field step reads the last committed physics snapshot;
particle transport reads the last committed field. This deliberate pipeline
keeps sibling registration order from changing the result. It is not a promise
that particles see a rigid body's new position in the same simulation step.

The field uses fixed steps with bounded catch-up; transport uses midpoint
integration with swept solid-cell checks. Stateful trajectories depend on the
sequence of frame times, source changes, and committed obstacle snapshots, not
just a seed and final elapsed time. The public particle system has no seek
command. Restarting a particle system clears its population, but does not reset
a field shared with other systems. Replay requires recreating the field and
replaying the same input and frame sequence; cross-engine bitwise floating-point
identity is not promised.

Enabled sources and advancing particle systems retain the field's clock.
Disabling/removing the last source and pausing/stopping the last consumer freezes
the field until work resumes. Removing the field owner disposes it; keep that
owner mounted for as long as any source or particle system uses the handle.
Failed obstacle reads leave the committed field unchanged and can be retried on
a later frame. Failed initial mounts release their clocks and field storage.
