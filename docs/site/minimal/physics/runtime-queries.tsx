import { Rectangle, crc } from '@crc/core';
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
  fromPhysicsPoint2D,
  overlapShape2D,
  physicsObstacles2D,
  queryAabb2D,
  queryPoint2D,
  raycast2D,
  shapeCast2D,
  staticBody2D,
  toPhysicsPoint2D,
  circleShape2D,
  type CRCPhysicsAabb2D,
  type CRCPhysicsColliderHandle2D,
  type CRCPhysicsQueryHit2D,
  type CRCPhysicsQueryMatch2D,
  type CRCPhysicsQueryMode,
  type CRCPhysicsQueryOptions2D,
  type CRCPhysicsQueryResult2D,
  type CRCPhysicsWorldHandle2D,
} from '@crc/core/physics/2d';

const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 180;
const output = document.createElement('pre');
document.body.append(canvas, output);

let world: CRCPhysicsWorldHandle2D | undefined;
function Scene() {
  world = crcPhysicsWorld2D();
  return <Rectangle
    physics={staticBody2D()}
    style={{ left: 125, top: 55, width: 70, height: 70, fill: '#0f766e' }}
  />;
}
const controller = crc(canvas,
  <PhysicsWorld2D gravity={[0, 0]}>
    <Scene />
  </PhysicsWorld2D>,
);

function inspect() {
  if (!world) return;
  const mode: CRCPhysicsQueryMode = 'all';
  const options: CRCPhysicsQueryOptions2D<'all'> = { mode, sensors: 'exclude' };
  const bounds: CRCPhysicsAabb2D = { min: [100, 40], max: [210, 140] };
  const region: CRCPhysicsQueryResult2D<'all', CRCPhysicsQueryMatch2D> = queryAabb2D(world, bounds, options);
  const pointMatches: readonly CRCPhysicsQueryMatch2D[] = queryPoint2D(world, [150, 90], options);
  const firstCollider: CRCPhysicsColliderHandle2D | undefined = pointMatches[0]?.collider;
  const ray: CRCPhysicsQueryHit2D | null = raycast2D(world, {
    origin: [0, 90], direction: [1, 0], maxDistance: 300,
  });
  const circle = circleShape2D({ radius: 8 });
  const cast = shapeCast2D(world, circle, { position: [10, 90], rotationDegrees: 0 }, [200, 0]);
  const overlaps = overlapShape2D(world, circle, { position: [150, 90], rotationDegrees: 0 }, options);
  const local = toPhysicsPoint2D(world, [150, 90]);
  const back = fromPhysicsPoint2D(world, local);
  const obstacles = physicsObstacles2D(world).read();
  output.textContent = [
    `AABB matches: ${region.length}; point matches: ${pointMatches.length}`,
    `First collider generation: ${firstCollider ? pointMatches[0]!.colliderGeneration : 'none'}`,
    `Ray: ${ray?.distance.toFixed(1) ?? 'miss'}; cast: ${cast?.timeOfImpact.toFixed(2) ?? 'miss'}`,
    `Shape overlaps: ${overlaps.length}; coordinates: ${back.join(', ')}`,
    `Obstacle revision: ${obstacles.revision}; boxes: ${obstacles.boxes.length / 4}`,
  ].join('\n');
}

const button = document.createElement('button');
button.textContent = 'Run queries';
button.addEventListener('click', inspect);
document.body.append(button);
requestAnimationFrame(inspect);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
