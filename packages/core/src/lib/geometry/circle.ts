import { finiteNumber, nonnegativeNumber } from './validation.js';

export interface CirclePathOptions {
  cx?: number;
  cy?: number;
  radius: number;
}

export function createCirclePath(options: Readonly<CirclePathOptions>): Path2D {
  const cx = finiteNumber(options.cx ?? 0, 'cx');
  const cy = finiteNumber(options.cy ?? 0, 'cy');
  const radius = nonnegativeNumber(options.radius, 'radius');
  const path = new Path2D();
  if (radius > 0) path.arc(cx, cy, radius, 0, Math.PI * 2);
  return path;
}
