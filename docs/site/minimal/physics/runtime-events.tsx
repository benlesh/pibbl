import { Circle, Group, Rectangle, crc } from '@crc/core';
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  inspectPhysics2D,
  staticBody2D,
  type CRCPhysicsBodyStateEvent2D,
  type CRCPhysicsBodyStateHandler2D,
  type CRCPhysicsColliderConfiguration2D,
  type CRCPhysicsColliderInspection2D,
  type CRCPhysicsCollisionEvent2D,
  type CRCPhysicsCollisionFilter,
  type CRCPhysicsCollisionHandler2D,
  type CRCPhysicsContactInspection2D,
  type CRCPhysicsDynamicBody2DOptions,
  type CRCPhysicsHitHandler2D,
  type CRCPhysicsOverlapEvent2D,
  type CRCPhysicsOverlapHandler2D,
  type CRCPhysicsStaticBody2DOptions,
  type CRCPhysicsWorld2DProps,
  type CRCPhysicsWorldHandle2D,
} from '@crc/core/physics/2d';

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

const filter: CRCPhysicsCollisionFilter = { category: 1, mask: 0xffff };
const onCollision: CRCPhysicsCollisionHandler2D = (event: CRCPhysicsCollisionEvent2D) => {
  record(`Collision tick ${event.tick}, impulse ${event.totalNormalImpulse.toFixed(1)}`);
};
const onHit: CRCPhysicsHitHandler2D = event => {
  record(`Hit ${event.otherTag ?? 'untagged'} at ${event.points[0]?.pointOnFirst.join(', ') ?? 'unknown'}`);
};
const onOverlap: CRCPhysicsOverlapHandler2D = (event: CRCPhysicsOverlapEvent2D) => {
  record(`Sensor met ${event.otherTag ?? 'untagged'} on tick ${event.tick}`);
};
const onBodyState: CRCPhysicsBodyStateHandler2D = (event: CRCPhysicsBodyStateEvent2D) => {
  record(`Body ${event.sleeping ? 'slept' : 'woke'} on tick ${event.tick}`);
};
const ballCollider: CRCPhysicsColliderConfiguration2D = {
  tag: 'ball', restitution: 0.25, collisionFilter: filter,
  onCollisionStart: onCollision, onHit,
};
const sensorCollider: CRCPhysicsColliderConfiguration2D = {
  tag: 'sensor', sensor: true, onOverlapStart: onOverlap,
};
const ballOptions: CRCPhysicsDynamicBody2DOptions = {
  collider: false, mass: 1, allowSleep: true,
};
const floorOptions: CRCPhysicsStaticBody2DOptions = {
  collider: { tag: 'floor', friction: 0.8 },
};
const worldProps: CRCPhysicsWorld2DProps = {
  gravity: [0, 500], onSleep: onBodyState, onWake: onBodyState,
};

let world: CRCPhysicsWorldHandle2D | undefined;
function Scene() {
  world = crcPhysicsWorld2D();
  const body = crcPhysicsBody2D();
  return <>
    <Group physics={dynamicBody2D({ ...ballOptions, handle: body })} style={{ translateX: 130, translateY: 30 }}>
      <Circle physics={collider2D(ballCollider)} style={{ radius: 14, fill: '#0f766e' }} />
    </Group>
    <Rectangle physics={staticBody2D(floorOptions)} style={{ left: 20, top: 195, width: 280, height: 12, fill: '#334155' }} />
    <Circle physics={staticBody2D({ collider: sensorCollider })} style={{ cx: 130, cy: 120, radius: 20, fill: '#fbbf24' }} />
  </>;
}

const controller = crc(canvas, <PhysicsWorld2D {...worldProps}><Scene /></PhysicsWorld2D>);
const button = document.createElement('button');
button.textContent = 'Inspect contacts';
button.addEventListener('click', () => {
  if (!world) return;
  const snapshot = inspectPhysics2D(world);
  const collider: CRCPhysicsColliderInspection2D | undefined = snapshot.colliders[0];
  const contact: CRCPhysicsContactInspection2D | undefined = snapshot.contacts[0];
  record(`Colliders ${snapshot.colliders.length}; first ${collider?.label ?? 'none'}; contact impulse ${contact?.normalImpulse.toFixed(1) ?? 'none'}`);
});
document.body.append(button);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
