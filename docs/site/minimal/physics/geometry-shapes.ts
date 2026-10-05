import {
  boundsOfShape2D,
  boxShape2D,
  circleShape2D,
  ellipseShape2D,
  massProperties2D,
  roundedBoxShape2D,
  type PibblPhysicsAabb2D,
  type PibblPhysicsMassProperties2D,
  type PibblPhysicsPose2D,
  type PibblPhysicsShape2D,
  type PibblPhysicsVector2,
} from '@pibbl/core/physics/2d/geometry';

const center: PibblPhysicsVector2 = [70, 50];
const pose: PibblPhysicsPose2D = { position: center, rotationDegrees: 15 };
const shapes: Record<string, PibblPhysicsShape2D> = {
  circle: circleShape2D({ radius: 12 }),
  ellipse: ellipseShape2D({ radiusX: 18, radiusY: 9 }),
  box: boxShape2D({ width: 30, height: 20 }),
  roundedBox: roundedBoxShape2D({ width: 30, height: 20, radius: 4 }),
};

const rows = Object.entries(shapes).map(([name, shape]) => {
  const bounds: PibblPhysicsAabb2D = boundsOfShape2D(shape, pose);
  const mass: PibblPhysicsMassProperties2D = massProperties2D(shape, { density: 2 });
  return `${name}: area ${mass.area.toFixed(1)}, mass ${mass.mass.toFixed(1)}, bounds ${bounds.min.join(',')} to ${bounds.max.join(',')}`;
});

const output = document.createElement('pre');
output.textContent = rows.join('\n');
document.body.append(output);
