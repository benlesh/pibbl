import { describe, expect, it } from 'vitest';
import { renderCanvas } from '../test-utils/component-test';
import { createLinePath } from './create-line-path';

describe('createLinePath', () => {
  function createTestCanvas() {
    const canvas = renderCanvas({ backgroundColor: 'black' });
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    return { canvas, ctx };
  }

  function isPixelFilled(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const [r, g, b] = pixel;
    const isBlack = r === 0 && g === 0 && b === 0;
    return !isBlack;
  }

  it('should create a path with moveTo for first point and lineTo for subsequent points', () => {
    const { ctx } = createTestCanvas();
    const coords: [number, number][] = [[20, 20], [40, 40], [60, 20]];
    const path = createLinePath(coords);

    ctx.stroke(path);

    for (const [x, y] of coords) {
      expect(isPixelFilled(ctx, x, y)).toBe(true);
    }

    const midX = (coords[0][0] + coords[1][0]) / 2;
    const midY = (coords[0][1] + coords[1][1]) / 2;

    expect(isPixelFilled(ctx, midX, midY)).toBe(true);

    // Check a point that shouldn't be on the path
    expect(isPixelFilled(ctx, 10, 10)).toBe(false);
  });

  it('should close path when closePath option is true', () => {
    const { ctx } = createTestCanvas();
    const coords: [number, number][] = [[10, 10], [20, 20], [30, 10]];
    const path = createLinePath(coords, { closePath: true });

    ctx.stroke(path);

    // Check if there's a line connecting the last point to the first
    // Sample a point that should be on the closing line
    expect(isPixelFilled(ctx, 20, 10)).toBe(true);
  });

  // TODO: Is this a valid usecase? What should we expect to have happen when a user does this?
  it.skip('should handle single point', () => {
    const { ctx } = createTestCanvas();
    const coords: [number, number][] = [[10, 10]];
    const path = createLinePath(coords);

    ctx.stroke(path);

    // Check if the point exists
    expect(isPixelFilled(ctx, 10, 10)).toBe(true);
    // Check surrounding area is empty
    expect(isPixelFilled(ctx, 15, 15)).toBe(false);
  });

  it('should handle empty coords array', () => {
    const { ctx } = createTestCanvas();
    const coords: [number, number][] = [];
    const path = createLinePath(coords);

    const initialImageData = ctx.getImageData(0, 0, 100, 100);
    ctx.stroke(path);
    const finalImageData = ctx.getImageData(0, 0, 100, 100);

    // Canvas should remain unchanged
    expect(initialImageData.data).toEqual(finalImageData.data);
  });
});
