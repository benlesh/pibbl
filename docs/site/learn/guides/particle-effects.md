---
id: guide-particle-effects
title: Create particle effects
summary: Build deterministic Canvas celebrations with fixed-capacity particle components.
kind: guide
slug: particle-effects
order: 66
keywords: [particles, canvas, confetti, sparks, trails]
---

# Create particle effects

`@crc/core/particles` provides deterministic 2D effects for UI-scale sparks,
confetti, click feedback, trails, and other Canvas composition. An immutable
effect describes a population; `Particles2D` binds it into ordinary CRC
layout, events, filters, lifecycle, and scheduling.

## Define, then mount

```tsx
import {
  Particles2D,
  useParticleSystem,
  defineParticleEffect2D,
  particleChoice,
  particleCurve,
  particleRange,
} from "@crc/core/particles";

const celebration = defineParticleEffect2D({
  emitters: [
    {
      name: "confetti",
      capacity: 240,
      overflow: "recycle-oldest",
      emission: [{ type: "manual", count: 48 }],
      shape: { type: "circle", radius: 5, sample: "interior" },
      initial: {
        lifetimeMilliseconds: particleRange(700, 1_100),
        velocity: [particleRange(-160, 160), particleRange(-220, -90)],
        size: particleRange(5, 10),
        color: particleChoice([
          { value: "#fb7185", weight: 1 },
          { value: "#34d399", weight: 1 },
          { value: "#f7c948", weight: 1 },
        ]),
      },
      motion: [{ type: "acceleration", value: [0, 280] }],
      appearance: {
        opacity: particleCurve([
          [0, 1],
          [0.8, 1],
          [1, 0],
        ]),
      },
      renderer: { type: "rectangle", blend: "source-over" },
      bounds: { min: [-180, -240], max: [180, 180] },
    },
  ],
});

function Celebration() {
  const system = useParticleSystem(celebration, { autoplay: false, seed: 42 });
  return (
    <Particles2D
      system={system}
      pointerEvents="auto"
      style={{ width: 640, height: 360, cursor: "crosshair" }}
      onPointerDown={(event) =>
        system.emit("confetti", { position: [event.x, event.y] })
      }
    />
  );
}
```

The direct descriptor functions do not sample immediately. They build frozen,
particle-specific values that compile into deterministic random channels,
parameter registers, and curve or gradient tables.

## Motion, capacity, and bounds

`acceleration`, `gravity`, `drag`, and the other motion modules calculate
particle motion analytically at its logical age. They do not replace CRC animation: continue to drive
component transforms and ordinary application values with signals plus
`tween`, `keyframes`, `spring`, `defineAnimation`, or `stepper`.

Capacity is allocated up front in fixed typed arrays. Choose a realistic ceiling
rather than an unbounded safety number. Bounds should conservatively contain
shape, velocity, acceleration, and size for the full lifetime so Canvas can
perform coarse paint culling.

Start with [Particle effects](#/examples/composition/particle-effects).

## Fire, smoke, and shared flow

A convincing flame needs coherent internal detail as well as moving particles.
The [Fire and Flow example](#/examples/composition/fire-and-flow) combines a small
animated procedural flame texture, sparse embers, and soft smoke sprites. Its
artwork is generated locally. Shape selection and manipulation use ordinary CRC
controls; decorative effects opt out of pointer targeting.

For interacting smoke, create one field with `useFlowField2D`, add force/heat
sources with `useFlowSource2D`, and pass it to `useParticleSystem(effect, { flow })`.
Many particles can sample that shared field without owning rigid bodies. With
optional `@crc/core/physics/2d`, `physicsObstacles2D(crcPhysicsWorld2D())` provides
committed box, ellipse, and polygon geometry and motion. Both systems must use
the same coordinates. The adapter copies numerical data and does not depend on
shared WASM memory or apply smoke forces back to the physics world.

Flow-bound particles use the field for translation. Put wind and upward force
on the flow source, rather than adding particle initial velocity or translational
motion modules. Angular motion, deterministic random appearance, and lifetime
curves remain available. Ordinary particles keep analytical motion; flow adds
stateful transport with [explicit timing and replay limits](#/api/hooks/use-flow-field).

Effect recipes belong to the application. A helper such as `useFireAndSmoke`
can compose these hooks and return the systems and controls its scene needs;
CRC does not export a growing catalog of named fire/smoke presets. Canvas paint
order determines which whole elements appear in front. Soft particle pixels can
cross an obstacle boundary even when their centers cannot; this is not volumetric
lighting or depth-aware sprite clipping.
