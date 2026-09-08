import { validateCoordinates } from './validation.js';

export interface LinePathOptions {
  coords: readonly (readonly [number, number])[];
  closePath?: boolean;
}

export function createLinePath(options: Readonly<LinePathOptions>): Path2D {
  const coords = validateCoordinates(options.coords);
  const path = new Path2D();
  coords.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  if (options.closePath) path.closePath();
  return path;
}
