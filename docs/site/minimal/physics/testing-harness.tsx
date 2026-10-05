import { Rectangle } from "@crc/core";
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
  inspectPhysics2D,
  staticBody2D,
  type CRCPhysicsWorldHandle2D,
} from "@crc/core/physics/2d";
import {
  createPhysicsTestHarness2D,
  type CRCPhysicsTestHarness2D,
  type CRCPhysicsTestHarness2DOptions,
} from "@crc/core/physics/2d/testing";

interface Observation {
  readonly floorPresent: boolean;
  readonly tick: number;
}

const canvas = document.createElement("canvas");
canvas.width = 240;
canvas.height = 120;
let world: CRCPhysicsWorldHandle2D | undefined;
function Scene() {
  world = crcPhysicsWorld2D();
  return (
    <Rectangle
      physics={staticBody2D()}
      style={{ left: 10, top: 90, width: 220, height: 10, fill: "#334155" }}
    />
  );
}
const options: CRCPhysicsTestHarness2DOptions<Observation> = {
  canvas,
  root: () => (
    <PhysicsWorld2D gravity={[0, 300]}>
      <Scene />
    </PhysicsWorld2D>
  ),
  observe: () => {
    if (!world) return { floorPresent: false, tick: 0 };
    const snapshot = inspectPhysics2D(world);
    return {
      floorPresent: snapshot.colliders.length === 1,
      tick: snapshot.tick,
    };
  },
};

const harness: CRCPhysicsTestHarness2D<Observation> =
  createPhysicsTestHarness2D(options);
try {
  harness.flush();
  const frames = harness.advanceFrames(4, 1000 / 60);
  const observed = harness.observe();
  if (frames < 1 || !observed.floorPresent || observed.tick < 1) {
    throw new Error("The physics scene did not advance as expected.");
  }
  harness.reset();
  harness.flush();
  if (!harness.observe().floorPresent)
    throw new Error("Reset did not remount the floor.");
} finally {
  harness.dispose();
}
const result = document.createElement("p");
result.textContent = "Physics advanced, reset, and disposed successfully.";
document.body.append(result);
