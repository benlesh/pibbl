import { PixelGridAlignment } from '../types.js';

export function adjustRectangleToPixelGrid(
  lineWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alignment: PixelGridAlignment,
) {
  if (alignment === 'none') {
    return { x, y, width, height };
  }

  const right = x + width;
  const bottom = y + height;
  x = adjustForPixelGrid(x, lineWidth, alignment);
  y = adjustForPixelGrid(y, lineWidth, alignment);
  const adjustedRight = adjustForPixelGrid(right, lineWidth, alignment);
  width = adjustedRight - x;
  const adjustedBottom = adjustForPixelGrid(bottom, lineWidth, alignment);
  height = adjustedBottom - y;
  return { x, y, width, height };
}

function calculatePixelGridOffset(lineWidth: number) {
  return ((lineWidth ?? 0) / 2) % 1;
}

export function adjustForPixelGrid(
  value: number,
  lineWidth: number | undefined,
  alignment: undefined | PixelGridAlignment,
) {
  if (!alignment || alignment === 'none') {
    return value;
  }

  return Math[alignment](value) - calculatePixelGridOffset(lineWidth ?? 0);
}
