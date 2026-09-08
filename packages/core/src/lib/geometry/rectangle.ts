import {
  resolveNumericCornerRadii,
  type RoundedCornerPathOptions,
} from './rounded-corners.js';
import { finiteNumber } from './validation.js';

export interface RectanglePathOptions extends RoundedCornerPathOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export function createRectanglePath(
  options: Readonly<RectanglePathOptions>,
): Path2D {
  const x = finiteNumber(options.x ?? 0, 'x');
  const y = finiteNumber(options.y ?? 0, 'y');
  const width = finiteNumber(options.width, 'width');
  const height = finiteNumber(options.height, 'height');
  const radii = resolveNumericCornerRadii(4, options);
  const path = new Path2D();

  if (radii.every(radius => radius === 0)) {
    path.rect(x, y, width, height);
  } else {
    path.roundRect(x, y, width, height, [...radii]);
  }

  return path;
}
