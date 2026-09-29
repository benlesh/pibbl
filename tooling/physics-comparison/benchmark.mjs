// Run: node --import tsx tooling/physics-comparison/benchmark.mjs /path/to/engine-install
// Install planck@1.5.0 and @dimforge/rapier2d-compat@0.21.0 in that separate folder.
import { RapierSimulation2D } from "../../packages/physics/src/lib/2d/world/rapier.ts";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { cpus, platform, arch } from "node:os";
import { PhysicsWorld2DKernel } from "../../packages/physics/src/lib/2d/world/world.ts";
import { boxShape2D } from "../../packages/physics/src/2d-geometry.ts";
import { requireShapeRecord2D } from "../../packages/physics/src/lib/2d/shape-records.ts";
const requireEngine = createRequire(
  resolve(process.argv[2] ?? ".", "package.json"),
);
const P = requireEngine("planck");
const R = requireEngine("@dimforge/rapier2d-compat");
await R.init();
const result = {
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0].model,
  },
  versions: { planck: "1.5.0", rapier: "0.21.0" },
  ticks: 600,
  warmup: 60,
  results: [],
};
for (const scenario of [
  { name: "settling-pile", n: 10 },
  { name: "settling-pile", n: 100 },
  { name: "settling-pile", n: 1000 },
  { name: "active-static-field", n: 100 },
])
  for (const engine of ["crc", "crc-rapier", "planck", "rapier"]) {
    const n = scenario.n;
    const active = scenario.name === "active-static-field";
    const bodies = [];
    const topology = [];
    let serial = 0;
    const w = engine.startsWith("crc")
      ? new PhysicsWorld2DKernel(
          {
            gravity: [0, 600],
            ...(engine === "crc"
              ? { solver: { velocityIterations: 8, positionIterations: 3 } }
              : {}),
          },
          engine === "crc-rapier" ? new RapierSimulation2D() : undefined,
        )
      : engine === "planck"
        ? new P.World({ gravity: P.Vec2(0, 6) })
        : new R.World({ x: 0, y: 6 });
    const add = (x, y, hx, hy, dynamic) => {
      if (engine.startsWith("crc")) {
        const id = ++serial;
        if (dynamic) bodies.push(id);
        topology.push({
          kind: "body",
          id,
          definition: {
            positionX: x * 100,
            positionY: y * 100,
            rotationRadians: 0,
            localCenterX: 0,
            localCenterY: 0,
            linearVelocityX: 0,
            linearVelocityY: 0,
            angularVelocity: 0,
            forceX: 0,
            forceY: 0,
            torque: 0,
            inverseMass: dynamic ? 1 : 0,
            inverseInertia: dynamic
              ? 3 / (hx * hx * 10000 + hy * hy * 10000)
              : 0,
            linearDamping: 0,
            angularDamping: 0,
            gravityScale: 1,
            sleepTime: 0,
            flags: dynamic ? (active ? 9 : 1) : 0,
            owner: null,
          },
        });
        topology.push({
          kind: "collider",
          id: ++serial,
          bodyId: id,
          definition: {
            shape: requireShapeRecord2D(
              boxShape2D({ width: 2 * hx * 100, height: 2 * hy * 100 }),
            ),
            material: { friction: 0.6, restitution: 0 },
            filter: null,
            tag: null,
            handlers: null,
            owner: null,
            flags: 0,
          },
        });
      } else if (engine === "planck") {
        const b = w.createBody({
          type: dynamic ? "dynamic" : "static",
          allowSleep: !active,
          position: P.Vec2(x, y),
        });
        b.createFixture(P.Box(hx, hy), {
          density: 1 / (4 * hx * hy),
          friction: 0.6,
        });
        if (dynamic) bodies.push(b);
      } else {
        const b = w.createRigidBody(
          (dynamic ? R.RigidBodyDesc.dynamic() : R.RigidBodyDesc.fixed())
            .setTranslation(x, y)
            .setCanSleep(!active),
        );
        w.createCollider(
          R.ColliderDesc.cuboid(hx, hy).setMass(1).setFriction(0.6),
          b,
        );
        if (dynamic) bodies.push(b);
      }
    };
    add(0, 10, 100, 0.5, false);
    for (let i = 0; i < n; i++)
      add(
        (i % 20) * 0.42 - 4,
        9 - (Math.floor(i / 20) + 0.5) * 0.42,
        0.2,
        0.2,
        true,
      );
    if (active)
      for (let i = 0; i < 1000; i++)
        add(
          20 + (i % 50) * 0.5,
          -20 + Math.floor(i / 50) * 0.5,
          0.2,
          0.2,
          false,
        );
    if (engine.startsWith("crc")) {
      w.proposeTopology(topology);
      w.adopt(
        w.advance({
          frameId: 0,
          logicalTime: 0,
          stagedKinematicTargets: new Map(),
        }),
      );
    }
    const times = [];
    const targets = new Map();
    for (let i = 1; i <= result.ticks; i++) {
      const start = performance.now();
      if (engine.startsWith("crc"))
        w.adopt(
          w.advance({
            frameId: i,
            logicalTime: (i * 1000) / 60,
            stagedKinematicTargets: targets,
          }),
        );
      else if (engine === "planck") w.step(1 / 60);
      else w.step();
      if (i > result.warmup) times.push(performance.now() - start);
    }
    const states = engine.startsWith("crc")
      ? w.snapshot().bodies.filter((b) => (b.flags & 1) !== 0)
      : bodies;
    const ys = states.map((b) =>
      engine.startsWith("crc")
        ? b.positionY / 100
        : engine === "planck"
          ? b.getPosition().y
          : b.translation().y,
    );
    const maximumY = Math.max(...ys);
    times.sort((a, b) => a - b);
    const row = {
      scenario: scenario.name,
      engine,
      bodies: n,
      staticBodies: active ? 1001 : 1,
      p50Milliseconds: times[Math.floor(times.length * 0.5)],
      p95Milliseconds: times[Math.floor(times.length * 0.95)],
      escaped: ys.filter((y) => y > 10).length,
      maximumCenterY: maximumY,
      sleeping: states.filter((b) =>
        engine.startsWith("crc")
          ? (b.flags & 16) !== 0
          : engine === "planck"
            ? !b.isAwake()
            : b.isSleeping(),
      ).length,
    };
    result.results.push(row);
    process.stderr.write(JSON.stringify(row) + "\n");
    if (engine === "rapier") w.free();
    if (engine.startsWith("crc")) w.dispose();
  }
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
