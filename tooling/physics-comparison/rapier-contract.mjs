// Integration feasibility checks. Engine install stays outside the repository.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const requireEngine = createRequire(
  resolve(process.argv[2] ?? ".", "package.json"),
);
const R = requireEngine("@dimforge/rapier2d-compat");
const started = performance.now();
await R.init();
const initializationMilliseconds = performance.now() - started;
const world = new R.World({ x: 0, y: 600 });
world.lengthUnit = 100;
world.timestep = 1 / 60;
const floor = world.createRigidBody(
  R.RigidBodyDesc.fixed().setTranslation(240, 226),
);
world.createCollider(R.ColliderDesc.cuboid(228, 10), floor);
const ball = world.createRigidBody(
  R.RigidBodyDesc.dynamic().setTranslation(64, 64),
);
world.createCollider(
  R.ColliderDesc.ball(12).setMass(1).setRestitution(0.1),
  ball,
);
for (let i = 0; i < 300; i++) world.step();
assert.ok(ball.translation().y <= 204.5);
assert.ok(ball.isSleeping());
const settledY = ball.translation().y;
const initial = world.takeSnapshot();
const handle = ball.handle;
const restored = R.World.restoreSnapshot(initial);
assert.equal(
  restored.getRigidBody(handle).translation().y,
  ball.translation().y,
);
ball.applyImpulse({ x: 60, y: -180 }, true);
restored.getRigidBody(handle).applyImpulse({ x: 60, y: -180 }, true);
for (let i = 0; i < 120; i++) {
  world.step();
  restored.step();
}
assert.deepEqual(
  restored.getRigidBody(handle).translation(),
  ball.translation(),
);
assert.deepEqual(restored.getRigidBody(handle).linvel(), ball.linvel());
process.stdout.write(
  JSON.stringify(
    {
      version: R.version(),
      initializationMilliseconds,
      snapshotBytes: initial.length,
      rollbackReplayExact: true,
      settledY,
    },
    null,
    2,
  ) + "\n",
);
restored.free();
world.free();
