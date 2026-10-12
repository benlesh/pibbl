import { Circle, Group, Rectangle, pibbl, useReaction } from "@pibbl/core";
import {
  PhysicsDebug2D,
  PhysicsWorld2D,
  applyForce2D,
  applyImpulse2D,
  applyTorque2D,
  collider2D,
  pibblPhysicsBody2D,
  pibblPhysicsWorld2D,
  disableBody2D,
  enableBody2D,
  inspectPhysics2D,
  setAngularVelocity2D,
  setLinearVelocity2D,
  sleepBody2D,
  staticBody2D,
  dynamicBody2D,
  teleportBody2D,
  wakeBody2D,
  type PibblPhysicsBodyHandle2D,
  type PibblPhysicsBodyInspection2D,
  type PibblPhysicsDebug2DProps,
  type PibblPhysicsInspection2D,
  type PibblPhysicsSolverOptions,
  type PibblPhysicsWorldHandle2D,
} from "@pibbl/core/physics/2d";

const canvas = document.createElement("canvas");
canvas.width = 400;
canvas.height = 240;
const status = document.createElement("pre");
document.body.append(canvas, status);

let body: PibblPhysicsBodyHandle2D | undefined;
let world: PibblPhysicsWorldHandle2D | undefined;

function Ball() {
  body = pibblPhysicsBody2D();
  return (
    <Group
      physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
      style={{ translateX: 100, translateY: 40 }}
    >
      <Circle
        physics={collider2D({ restitution: 0.55, friction: 0.4, tag: "ball" })}
        style={{ radius: 16, fill: "#0f766e" }}
      />
    </Group>
  );
}

function DebugOverlay() {
  world = pibblPhysicsWorld2D();
  useReaction(refresh, []);
  const debug: PibblPhysicsDebug2DProps = { world, color: "#be123c" };
  return <PhysicsDebug2D {...debug} />;
}

const solver: PibblPhysicsSolverOptions = {
  velocityIterations: 4,
  positionIterations: 2,
};
const controller = pibbl(
  canvas,
  <PhysicsWorld2D gravity={[0, 420]} solver={solver}>
    <Rectangle
      physics={staticBody2D()}
      style={{ left: 30, top: 205, width: 340, height: 14, fill: "#334155" }}
    />
    <Ball />
    <DebugOverlay />
  </PhysicsWorld2D>,
);

function refresh() {
  if (!world || !body) return;
  const snapshot: PibblPhysicsInspection2D = inspectPhysics2D(world);
  const ball: PibblPhysicsBodyInspection2D | undefined = inspectPhysics2D(body);
  status.textContent = `Tick ${snapshot.tick}; bodies ${snapshot.bodies.length}; ball ${ball?.pose.position.join(", ") ?? "pending"}; velocity ${body.linearVelocity.get().join(", ")}`;
}

const actions: readonly [string, (handle: PibblPhysicsBodyHandle2D) => void][] = [
  ["Impulse", (handle) => applyImpulse2D(handle, [80, -180])],
  ["Force", (handle) => applyForce2D(handle, [20, -50])],
  ["Torque", (handle) => applyTorque2D(handle, 5)],
  ["Set speed", (handle) => setLinearVelocity2D(handle, [60, -100])],
  ["Spin", (handle) => setAngularVelocity2D(handle, 45)],
  [
    "Teleport",
    (handle) =>
      teleportBody2D(handle, { position: [100, 40], rotationDegrees: 0 }),
  ],
  ["Sleep", sleepBody2D],
  ["Wake", wakeBody2D],
  ["Disable", disableBody2D],
  ["Enable", (handle) => enableBody2D(handle, { velocity: "zero" })],
];
for (const [label, action] of actions) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", () => {
    if (!body) return;
    action(body);
  });
  document.body.append(button);
}
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
