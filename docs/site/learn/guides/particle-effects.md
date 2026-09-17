---
id: guide-particle-effects
title: Create particle effects
summary: Build deterministic Canvas celebrations and high-count WebGL ambience with fixed-capacity particle components.
kind: guide
slug: particle-effects
order: 66
keywords: [particles, canvas, webgl, confetti, embers, fireflies]
---

# Create particle effects

Particle effects are components, not style decorations. An immutable effect
describes a population; `Particles2D` or `Particles3D` binds it into ordinary
CRC composition, layout, events, lifecycle, and scheduling.

## Choose a renderer

Use Canvas for UI-scale sparks, confetti, click feedback, trails, and effects
that need manual bursts. It has the broadest execution feature set and composes
naturally with Canvas filters, clips, and Layers, but its particle sampling and
paint loop run on the CPU.

Use WebGL for ambient embers, fireflies, dust, snow, rain, smoke sprites, and
other high-count automatic effects. Project 1 reconstructs every instance from
seed, ordinal, and logical time in the vertex shader. One emitter is one
instanced submission, with no per-particle CPU update or dynamic upload.

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
        system.emit("confetti", {
          position: [event.x, event.y],
        })
      }
    />
  );
}
```

The direct descriptor functions do not sample immediately. They build frozen,
particle-specific values that compile into deterministic random channels,
parameter registers, and 257-sample curve or gradient tables.

## Understand particle motion

`acceleration`, `gravity`, `drag`, and the other motion modules update the
members of a particle population. They are not standardized WebGL primitives
and do not replace CRC animation. Animate component transforms, cameras,
materials, lights, and ordinary values with signals plus `tween`, `keyframes`,
`spring`, `defineAnimation`, or `stepper`.

## Plan capacity and bounds

Capacity is allocated up front. Canvas commits fixed typed arrays; WebGL draws
exactly that many analytic instances and discards unborn or expired slots in
the shader. Choose a realistic ceiling rather than an unbounded safety number.

Bounds should conservatively contain shape, velocity, acceleration, and size
for the full lifetime. Canvas uses them for coarse paint culling. WebGL uses
them for scene culling and, when enabled, one component-level pick/focus volume.

## Use the current WebGL subset

Stateless WebGL supports automatic rate and scheduled burst emission with
fixed spawn/simulation parameters. Render parameters may change live. Manual
births, stateful recycling, distance sorting, and world-space state need a
future stateful executor and produce actionable capability diagnostics today.

Start with [Particle effects](#/examples/composition/particle-effects), then
compare [GPU embers](#/examples/webgl/embers) and
[GPU fireflies](#/examples/webgl/fireflies).
