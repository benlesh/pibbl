import {
  arcShape2D,
  boundsOfShape2D,
  capsuleShape2D,
  chainShape2D,
  polygonShape2D,
  segmentShape2D,
  transformShape2D,
  wedgeShape2D,
  type PibblPhysicsShape2D,
  type PibblPhysicsTransform2D,
  type PibblPhysicsVector2,
} from '@pibbl/core/physics/2d/geometry';

const start: PibblPhysicsVector2 = [0, 0];
const end: PibblPhysicsVector2 = [20, 0];
const triangle: readonly PibblPhysicsVector2[] = [[0, 0], [20, 0], [10, 18]];
const shapes: Record<string, PibblPhysicsShape2D> = {
  capsule: capsuleShape2D({ start, end, radius: 4 }),
  segment: segmentShape2D({ start, end }),
  chain: chainShape2D({ points: [[0, 0], [20, 0], [20, 20]] }),
  polygon: polygonShape2D({ points: triangle }),
  arc: arcShape2D({ radius: 16, startAngleRadians: 0, endAngleRadians: Math.PI, thickness: 3 }),
  wedge: wedgeShape2D({ radius: 16, startAngleRadians: 0, endAngleRadians: Math.PI / 2 }),
};
const transform: PibblPhysicsTransform2D = { position: [40, 30], rotationDegrees: 30 };
const rows = Object.entries(shapes).map(([name, shape]) => {
  const moved = transformShape2D(shape, transform);
  const bounds = boundsOfShape2D(moved);
  return `${name}: ${bounds.min.map(n => n.toFixed(1)).join(',')} to ${bounds.max.map(n => n.toFixed(1)).join(',')}`;
});

const output = document.createElement('pre');
output.textContent = rows.join('\n');
document.body.append(output);
