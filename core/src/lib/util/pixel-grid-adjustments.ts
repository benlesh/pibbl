import { PixelGridAlignment } from '../types';

export function adjustRectangleToPixelGrid(
  lineWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alignment: PixelGridAlignment
) {
  x = adjustForPixelGrid(x, lineWidth, alignment);
  y = adjustForPixelGrid(y, lineWidth, alignment);
  const right = x + width;
  const adjustedRight = adjustForPixelGrid(right, lineWidth, alignment) + 1;
  width = adjustedRight - x;
  const bottom = y + height;
  const adjustedBottom = adjustForPixelGrid(bottom, lineWidth, alignment) + 1;
  height = adjustedBottom - y;
  return { x, y, width, height };
}

function calculatePixelGridOffset(lineWidth: number) {
  return ((lineWidth ?? 0) / 2) % 1;
}

export function adjustForPixelGrid(
  value: number,
  lineWidth: number | undefined,
  alignment: undefined | PixelGridAlignment
) {
  if (!alignment || alignment === 'none') {
    return value;
  }

  return Math[alignment](value) - calculatePixelGridOffset(lineWidth ?? 0);
}
