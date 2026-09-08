import { finiteNumber, nonnegativeNumber } from './validation.js';

export interface EllipsePathOptions {
  cx?: number;
  cy?: number;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

export function createEllipsePath(options: Readonly<EllipsePathOptions>): Path2D {
  const cx = finiteNumber(options.cx ?? 0, 'cx');
  const cy = finiteNumber(options.cy ?? 0, 'cy');
  const radiusX = nonnegativeNumber(options.radiusX, 'radiusX');
  const radiusY = nonnegativeNumber(options.radiusY, 'radiusY');
  const rotation = finiteNumber(options.rotation ?? 0, 'rotation');
  const path = new Path2D();
  if (radiusX > 0 && radiusY > 0) {
    path.ellipse(cx, cy, radiusX, radiusY, rotation, 0, Math.PI * 2);
  }
  return path;
}
