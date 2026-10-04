import { expect, it } from "vitest";
import { boxShape2D } from "../../../2d-geometry.js";
import { requireShapeRecord2D } from "../shape-records.js";
import { PhysicsWorld2DKernel } from "../world/world.js";
import { CommittedObstacles2D } from "./obstacles.js";

it("copies box geometry and COM motion without exposing live candidate state", () => {
  const world = new PhysicsWorld2DKernel({ gravity: [0, 0] });
  world.proposeTopology([
    {
      kind: "body",
      id: 1,
      definition: {
        positionX: 100,
        positionY: 110,
        rotationRadians: Math.PI / 2,
        localCenterX: 10,
        localCenterY: 0,
        linearVelocityX: 12,
        linearVelocityY: -4,
        angularVelocity: 2,
        forceX: 0,
        forceY: 0,
        torque: 0,
        inverseMass: 1,
        inverseInertia: 1,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 0,
        sleepTime: 0,
        flags: 1,
        owner: null,
      },
    },
    {
      kind: "collider",
      id: 2,
      bodyId: 1,
      definition: {
        shape: requireShapeRecord2D(boxShape2D({ width: 40, height: 20 })),
        material: null,
        filter: null,
        tag: null,
        handlers: null,
        owner: null,
        flags: 0,
      },
    },
  ]);
  const initial = world.advance({
    frameId: 0,
    logicalTime: 0,
    stagedKinematicTargets: new Map(),
  })!;
  world.adopt(initial);
  const snapshot = new CommittedObstacles2D();
  const colliders = [{ id: 2, bodyId: 1 }];
  snapshot.publish(world, colliders, 1);
  const batch = snapshot.read();
  expect(Array.from(batch.boxes)).toEqual([
    100,
    100,
    20,
    10,
    Math.PI / 2,
    12,
    -4,
    2,
    100,
    110,
  ]);
  const saved = batch.boxes.slice();
  snapshot.publish(world, colliders, 2);
  expect(snapshot.read().revision).toBe(1);
  expect(snapshot.read().boxes).toBe(batch.boxes);
  const candidate = world.advance({
    frameId: 1,
    logicalTime: 1000 / 60,
    stagedKinematicTargets: new Map(),
  })!;
  expect(snapshot.read().boxes).toEqual(saved);
  world.adopt(candidate);
  snapshot.publish(world, colliders, 2);
  expect(snapshot.read().boxes).toBe(batch.boxes);
  expect(snapshot.read().revision).toBe(2);
  expect(snapshot.read().boxes[8]).toBeGreaterThan(100);
  snapshot.publish(world, [], 3);
  expect(snapshot.read().revision).toBe(3);
  expect(snapshot.read().boxes).toHaveLength(0);
  snapshot.publish(world, [], 4);
  expect(snapshot.read().revision).toBe(3);
  world.dispose();
});
