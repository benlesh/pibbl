import { Circle, Group, Rectangle } from "@pibbl/core";
import {
  PhysicsWorld2D,
  collider2D,
  pibblPhysicsWorld2D,
  dynamicBody2D,
  inspectPhysics2D,
  staticBody2D,
  type PibblPhysicsWorldHandle2D,
} from "@pibbl/core/physics/2d";
import {
  createPhysicsTestHarness2D,
  type PibblPhysicsTestHarness2D,
  type PibblPhysicsTestHarness2DOptions,
} from "@pibbl/core/physics/2d/testing";

interface Observation {
  readonly floorPresent: boolean;
  readonly ballY: number | null;
  readonly tick: number;
}

const canvas = document.createElement("canvas");
canvas.width = 240;
canvas.height = 120;
document.body.append(canvas);
let world: PibblPhysicsWorldHandle2D | undefined;
function Scene() {
  world = pibblPhysicsWorld2D();
  return (
    <>
      <Rectangle
        physics={staticBody2D({ collider: { tag: "floor" } })}
        style={{ left: 10, top: 90, width: 220, height: 10, fill: "#334155" }}
      />
      <Group
        physics={dynamicBody2D({ collider: false })}
        style={{ translateX: 120, translateY: 25 }}
      >
        <Circle
          physics={collider2D({ tag: "ball" })}
          style={{ radius: 10, fill: "#0f766e" }}
        />
      </Group>
    </>
  );
}
const options: PibblPhysicsTestHarness2DOptions<Observation> = {
  canvas,
  root: () => (
    <PhysicsWorld2D gravity={[0, 300]}>
      <Scene />
    </PhysicsWorld2D>
  ),
  observe: () => {
    if (!world) return { floorPresent: false, ballY: null, tick: 0 };
    const snapshot = inspectPhysics2D(world);
    return {
      floorPresent: snapshot.colliders.some(
        (collider) => collider.label === "floor",
      ),
      ballY:
        snapshot.bodies.find((body) => body.type === "dynamic")?.pose
          .position[1] ?? null,
      tick: snapshot.tick,
    };
  },
};

const harness: PibblPhysicsTestHarness2D<Observation> =
  createPhysicsTestHarness2D(options);
try {
  harness.flush();
  harness.flush();
  const initial = harness.observe();
  const frames = harness.advanceFrames(4, 1000 / 60);
  const observed = harness.observe();
  if (
    frames < 1 ||
    !observed.floorPresent ||
    observed.tick < 1 ||
    initial.ballY === null ||
    observed.ballY === null ||
    observed.ballY <= initial.ballY
  ) {
    throw new Error("The physics scene did not advance as expected.");
  }
  harness.reset();
  harness.flush();
  harness.flush();
  if (!harness.observe().floorPresent)
    throw new Error("Reset did not remount the floor.");
} finally {
  harness.dispose();
  canvas.remove();
}
const result = document.createElement("p");
result.textContent = "Physics advanced, reset, and disposed successfully.";
document.body.append(result);
