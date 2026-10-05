import { collider2D, capsuleShape2D } from '@pibbl/core/physics/2d';

// Same 24 × 40 bounds as the artwork's logical body. Rounded feet cannot
// catch the tiny vertical contact faces between independently breakable bricks.
const playerShape = capsuleShape2D({ start: [12, 12], end: [12, 28], radius: 12 });

/** Character collision geometry, shared by the playable scene and seam regression. */
export function playerCollider2D() {
  return collider2D({ shape: playerShape, friction: 0, restitution: 0, tag: 'player' });
}
