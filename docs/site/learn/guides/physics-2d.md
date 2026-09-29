---
id: guide-physics-2d
title: Compose and test 2D physics
summary: Build reusable local physics worlds, keep one pose owner, and verify them through public observations and a manual test clock.
kind: guide
slug: physics-2d
order: 64
keywords:
  [physics, collisions, simulation, Rapier, testing, agents, composition]
---

# Compose and test 2D physics

Use `PhysicsWorld2D` around normal CRC components with `physics` attachments.
CRC supplies the clock and component lifecycle; the bundled Rapier engine solves
solid contacts. Do not start another animation loop or call the engine directly.

```tsx
import { Circle, Group, Rectangle } from "@crc/core";
import {
  PhysicsWorld2D,
  applyImpulse2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  staticBody2D,
} from "@crc/physics/2d";

function Ball() {
  const body = crcPhysicsBody2D();
  return (
    <Group
      physics={dynamicBody2D({ handle: body, mass: 1, collider: false })}
      style={{ translateX: 80, translateY: 30 }}
    >
      <Circle
        physics={collider2D({ restitution: 0.2, friction: 0.5 })}
        style={{ radius: 12, fill: "#2563eb" }}
        onPointerDown={() => applyImpulse2D(body, [30, -180])}
      />
    </Group>
  );
}

function PhysicsPanel() {
  return (
    <PhysicsWorld2D space="local" gravity={[0, 600]}>
      <Rectangle
        physics={staticBody2D()}
        style={{ x: 0, y: 180, width: 240, height: 16, fill: "#334155" }}
      />
      <Ball />
    </PhysicsWorld2D>
  );
}
```

Render two keyed `PhysicsPanel` instances to get independent worlds. Move or
scale their parents without resetting either simulation. Try the
[resizable panels example](#/examples/composition/physics-panels) and the
[drag-and-throw example](#/examples/composition/physics-2d).

## Coordinates and one pose owner

`space="local"` makes geometry, gravity, body poses, and queries relative to the
world component. `space="root"` is the compatibility default. `space` is creation
only; change the component key to choose a different space. A local viewport
must have a finite invertible transform. Body transforms inside that viewport
still need to be rigid; put decorative scaling outside the world boundary or
inside the body's visual children with explicit collision geometry.

Pointer events always report root-logical coordinates. Convert them with
`toPhysicsPoint2D(world, [event.x, event.y])` before using local queries or targets;
`fromPhysicsPoint2D` converts back.

Dynamic bodies own their pose after mounting. Initial `linearVelocity` and
`angularVelocityDegreesPerSecond` seed motion; later commands set velocity,
apply an impulse, apply one fixed-tick force/torque, or teleport. Changing the
initial drawing transform is not a dynamic-body motion command. Static bodies
follow authored geometry. Kinematic bodies follow target signals and transfer
motion through contacts. Use one of these owners at a time when implementing
dragging or animation handoff. Keep the handle stable and use its `enabled` and
`generation` signals when checking lifecycle state.

A compound body is a `Group` with `collider: false` and child `collider2D`
attachments. Children may be solids or sensors; custom geometry comes from the
pure `@crc/physics/2d/geometry` factories. `mass: "auto"` derives mass and center
of mass from contributing colliders; explicit `mass` gives a predictable impulse
response. Public body position is the authored origin, not necessarily its COM.

## Timing, sleeping, and collision limits

Distances use logical Canvas units, velocities use units/second, angles use
degrees, and the world fixed step uses milliseconds. Gravity defaults to zero;
`[0, 600]` is a practical screen-space starting point. The default is 60 fixed
ticks/second with at most four catch-up ticks per frame. Sleeping bodies and
stationary kinematic worlds stop requesting frames. Commands and target changes
wake them through the same CRC scheduler.

The engine internally uses 100 logical units per meter and single-precision
numbers. Use tolerances in assertions. `velocityIterations` (default 4) selects
Rapier solver iterations; `positionIterations` (default 1) selects internal PGS
iterations. These retained option names describe budgets, not exact trajectories.

Set `ccd: true` for fast dynamic solids. CRC adds bounded substeps for opposing
fast bodies; a step needing more than 64 rejects and rolls back with an error.
Reduce speed or fixed-step length, or enlarge the collision geometry. Sensors
observe discrete overlaps, so fast triggers should use explicit ray/shape casts.
Ellipses and rounded corners use convex approximations with at most 0.01-unit
chord error and a 4096-vertex safety limit. Pure queries retain the mathematical
shape. This is not a claim of exact arbitrary-speed collision detection.

World settings are reactive except `space`. Attachment material, density,
filtering, enabled state and damping changes reconcile on a successful render.
Hooks and keyed component identity determine ownership; unmounting invalidates
handles and removes the body. Commands on stale handles cannot affect a later
body generation. Complete-phase callbacks can queue commands for the next frame.

## Observe before judging pixels

Capture a world handle with `crcPhysicsWorld2D()` inside the world, then call
`inspectPhysics2D(world)` outside render to get frozen JSON-safe observations.
It includes body identity, pose, presentation pose, velocity, sleep state,
collider bounds, contacts and failed-frame diagnostics. String collider tags
become labels; arbitrary tag objects are not serialized. Inspection does not
advance the simulation and is not an engine save/restore format.

`<PhysicsDebug2D world={world} />` draws authoritative bounds, centers of mass and
contact normals without intercepting pointer events. Between fixed ticks, the
interpolated drawing may lag the authoritative overlay slightly; that difference
is expected and separately exposed by inspection.

## Reproduce a failure with the supported clock

Run this in an isolated browser test. This complete fixture owns and attaches
its Canvas and uses the same public components as a manual scene.

```tsx
import { expect } from "vitest";
import { Circle, Rectangle } from "@crc/core";
import { createPhysicsTestHarness2D } from "@crc/physics/2d/testing";
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  staticBody2D,
  inspectPhysics2D,
  type CRCPhysicsWorldHandle2D,
} from "@crc/physics/2d";

const canvas = document.createElement("canvas");
canvas.width = 240;
canvas.height = 220;
document.body.append(canvas);
let world!: CRCPhysicsWorldHandle2D;
function Contents() {
  world = crcPhysicsWorld2D();
  return (
    <>
      <Circle
        physics={dynamicBody2D({ mass: 1 })}
        style={{ cx: 80, cy: 30, radius: 12 }}
      />
      <Rectangle
        physics={staticBody2D()}
        style={{ x: 0, y: 180, width: 240, height: 16 }}
      />
    </>
  );
}
function Scene() {
  return (
    <PhysicsWorld2D gravity={[0, 600]}>
      <Contents />
    </PhysicsWorld2D>
  );
}

const harness = createPhysicsTestHarness2D({
  canvas,
  root: () => <Scene />,
  observe: () => inspectPhysics2D(world),
});
try {
  harness.flush(); // render the scene
  harness.flush(); // accept topology and anchor physics time
  harness.advanceFrames(300, 1000 / 60);
  const state = harness.observe();
  expect(
    state.bodies.every((body) => Number.isFinite(body.pose.position[1])),
  ).toBe(true);
  expect(state.bodies.find((body) => body.type === "dynamic")?.sleeping).toBe(
    true,
  );
} finally {
  harness.dispose();
  canvas.remove();
}
```

`advanceFrames` advances pending host frames, not guaranteed fixed ticks. It
stops when the realm becomes idle. `act(callback)` runs an action and flushes one
frame at the current time; subsequent physics may require another frame.
`reset()` remounts the root factory while keeping host time monotonic. It does
not reset caller-owned signals. A harness rejects an already-mounted CRC realm
so it cannot take over a production clock. Dispose it before mounting another.

For an agent-written regression, save the scene/seed, engine version, world
settings, exact frame times, actions, and the failed observation. Assert bounds,
contact events, sleep, identity and cleanup before using screenshots. Test the
same public scene used for manual review; do not force sleep or teleport bodies
to make a settling or collision claim pass.

## Loading and cost

The runtime entry initializes embedded WebAssembly using top-level await. Use an
ES-module-capable bundler; no separate WASM URL or setup hook is necessary. The
pure geometry entries avoid engine initialization. Startup and bundle size are
real costs; dynamically import the runtime when physics is optional.

One world is generally cheaper than many tiny worlds when objects must collide.
Keep diagnostics opt-in, reuse immutable shape descriptions, and let sleeping
stop work. CRC performs transaction checkpoints so failed frames can roll back;
raw engine benchmarks do not include that cost or Canvas repainting.
