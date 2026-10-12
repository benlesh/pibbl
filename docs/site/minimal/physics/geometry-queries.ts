import {
  circleShape2D,
  contactBetweenShapes2D,
  containsPoint2D,
  distanceBetweenShapes2D,
  overlapShapes2D,
  raycastShape2D,
  shapeCastAgainstShape2D,
  type PibblPhysicsContactPoint2D,
  type PibblPhysicsDistance2D,
  type PibblPhysicsRay2D,
  type PibblPhysicsShapeContact2D,
  type PibblPhysicsShapeHit2D,
} from '@pibbl/core/physics/2d/geometry';

const circle = circleShape2D({ radius: 10 });
const first = { position: [20, 20], rotationDegrees: 0 } as const;
const second = { position: [45, 20], rotationDegrees: 0 } as const;
const distance: PibblPhysicsDistance2D = distanceBetweenShapes2D(circle, first, circle, second);
const contact: PibblPhysicsShapeContact2D | null = contactBetweenShapes2D(circle, first, circle, second);
const firstContactPoint: PibblPhysicsContactPoint2D | undefined = contact?.points[0];
const ray: PibblPhysicsRay2D = { origin: [0, 20], direction: [1, 0], maxDistance: 100 };
const rayHit: PibblPhysicsShapeHit2D | null = raycastShape2D(circle, first, ray);
const castHit: PibblPhysicsShapeHit2D | null = shapeCastAgainstShape2D(
  circle, first, [30, 0], circle, second,
);

const output = document.createElement('pre');
output.textContent = [
  `Point inside: ${containsPoint2D(circle, first, [20, 20])}`,
  `Overlapping: ${overlapShapes2D(circle, first, circle, second)}`,
  `Separation: ${distance.separation.toFixed(1)}`,
  `Contact points: ${contact?.points.length ?? 0}`,
  `First contact separation: ${firstContactPoint?.separation.toFixed(1) ?? 'none'}`,
  `Ray hit distance: ${rayHit?.distance.toFixed(1) ?? 'none'}`,
  `Cast impact time: ${castHit?.timeOfImpact.toFixed(2) ?? 'none'}`,
].join('\n');
document.body.append(output);
