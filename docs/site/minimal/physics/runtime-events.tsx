import { Circle, Group, Rectangle, pibbl } from '@pibbl/core';
import {
  PhysicsWorld2D,
  collider2D,
  pibblPhysicsBody2D,
  pibblPhysicsWorld2D,
  dynamicBody2D,
  inspectPhysics2D,
  staticBody2D,
  type PibblPhysicsBodyStateEvent2D,
  type PibblPhysicsBodyStateHandler2D,
  type PibblPhysicsColliderConfiguration2D,
  type PibblPhysicsColliderInspection2D,
  type PibblPhysicsCollisionEvent2D,
  type PibblPhysicsCollisionFilter,
  type PibblPhysicsCollisionHandler2D,
  type PibblPhysicsContactInspection2D,
  type PibblPhysicsDynamicBody2DOptions,
  type PibblPhysicsHitHandler2D,
  type PibblPhysicsOverlapEvent2D,
  type PibblPhysicsOverlapHandler2D,
  type PibblPhysicsStaticBody2DOptions,
  type PibblPhysicsWorld2DProps,
  type PibblPhysicsWorldHandle2D,
} from '@pibbl/core/physics/2d';

const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 220;
const output = document.createElement('pre');
document.body.append(canvas, output);
const messages: string[] = [];
const record = (message: string) => {
  messages.push(message);
  output.textContent = messages.slice(-6).join('\n');
};

const filter: PibblPhysicsCollisionFilter = { category: 1, mask: 0xffff };
const onCollision: PibblPhysicsCollisionHandler2D = (event: PibblPhysicsCollisionEvent2D) => {
  record(`Collision tick ${event.tick}, impulse ${event.totalNormalImpulse.toFixed(1)}`);
};
const onHit: PibblPhysicsHitHandler2D = event => {
  record(`Hit ${event.otherTag ?? 'untagged'} at ${event.points[0]?.pointOnFirst.join(', ') ?? 'unknown'}`);
};
const onOverlap: PibblPhysicsOverlapHandler2D = (event: PibblPhysicsOverlapEvent2D) => {
  record(`Sensor met ${event.otherTag ?? 'untagged'} on tick ${event.tick}`);
};
const onBodyState: PibblPhysicsBodyStateHandler2D = (event: PibblPhysicsBodyStateEvent2D) => {
  record(`Body ${event.sleeping ? 'slept' : 'woke'} on tick ${event.tick}`);
};
const ballCollider: PibblPhysicsColliderConfiguration2D = {
  tag: 'ball', restitution: 0.25, collisionFilter: filter,
  onCollisionStart: onCollision, onHit,
};
const sensorCollider: PibblPhysicsColliderConfiguration2D = {
  tag: 'sensor', sensor: true, onOverlapStart: onOverlap,
};
const ballOptions: PibblPhysicsDynamicBody2DOptions = {
  collider: false, mass: 1, allowSleep: true,
};
const floorOptions: PibblPhysicsStaticBody2DOptions = {
  collider: { tag: 'floor', friction: 0.8 },
};
const worldProps: PibblPhysicsWorld2DProps = {
  gravity: [0, 500], onSleep: onBodyState, onWake: onBodyState,
};

let world: PibblPhysicsWorldHandle2D | undefined;
function Scene() {
  world = pibblPhysicsWorld2D();
  const body = pibblPhysicsBody2D();
  return <>
    <Group physics={dynamicBody2D({ ...ballOptions, handle: body })} style={{ translateX: 130, translateY: 30 }}>
      <Circle physics={collider2D(ballCollider)} style={{ radius: 14, fill: '#0f766e' }} />
    </Group>
    <Rectangle physics={staticBody2D(floorOptions)} style={{ left: 20, top: 195, width: 280, height: 12, fill: '#334155' }} />
    <Circle physics={staticBody2D({ collider: sensorCollider })} style={{ cx: 130, cy: 120, radius: 20, fill: '#fbbf24' }} />
  </>;
}

const controller = pibbl(canvas, <PhysicsWorld2D {...worldProps}><Scene /></PhysicsWorld2D>);
const button = document.createElement('button');
button.textContent = 'Inspect contacts';
button.addEventListener('click', () => {
  if (!world) return;
  const snapshot = inspectPhysics2D(world);
  const collider: PibblPhysicsColliderInspection2D | undefined = snapshot.colliders[0];
  const contact: PibblPhysicsContactInspection2D | undefined = snapshot.contacts[0];
  record(`Colliders ${snapshot.colliders.length}; first ${collider?.label ?? 'none'}; contact impulse ${contact?.normalImpulse.toFixed(1) ?? 'none'}`);
});
document.body.append(button);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
