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

`@crc/particles` provides deterministic 2D effects for UI-scale sparks,
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
} from "@crc/particles";

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

`acceleration`, `gravity`, `drag`, and the other motion modules update the
members of a population. They do not replace CRC animation: continue to drive
component transforms and ordinary application values with signals plus
`tween`, `keyframes`, `spring`, `defineAnimation`, or `stepper`.

Capacity is allocated up front in fixed typed arrays. Choose a realistic ceiling
rather than an unbounded safety number. Bounds should conservatively contain
shape, velocity, acceleration, and size for the full lifetime so Canvas can
perform coarse paint culling.

Start with [Particle effects](#/examples/composition/particle-effects).
