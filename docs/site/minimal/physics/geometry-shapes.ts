import {
  boundsOfShape2D,
  boxShape2D,
  circleShape2D,
  ellipseShape2D,
  massProperties2D,
  roundedBoxShape2D,
  type CRCPhysicsAabb2D,
  type CRCPhysicsMassProperties2D,
  type CRCPhysicsPose2D,
  type CRCPhysicsShape2D,
  type CRCPhysicsVector2,
} from '@crc/core/physics/2d/geometry';

const center: CRCPhysicsVector2 = [70, 50];
const pose: CRCPhysicsPose2D = { position: center, rotationDegrees: 15 };
const shapes: Record<string, CRCPhysicsShape2D> = {
  circle: circleShape2D({ radius: 12 }),
  ellipse: ellipseShape2D({ radiusX: 18, radiusY: 9 }),
  box: boxShape2D({ width: 30, height: 20 }),
  roundedBox: roundedBoxShape2D({ width: 30, height: 20, radius: 4 }),
};

const rows = Object.entries(shapes).map(([name, shape]) => {
  const bounds: CRCPhysicsAabb2D = boundsOfShape2D(shape, pose);
  const mass: CRCPhysicsMassProperties2D = massProperties2D(shape, { density: 2 });
  return `${name}: area ${mass.area.toFixed(1)}, mass ${mass.mass.toFixed(1)}, bounds ${bounds.min.join(',')} to ${bounds.max.join(',')}`;
});

const output = document.createElement('pre');
output.textContent = rows.join('\n');
document.body.append(output);
