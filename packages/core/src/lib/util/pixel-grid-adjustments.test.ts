import { describe, expect, it } from 'vitest';
import {
  adjustForPixelGrid,
  adjustRectangleToPixelGrid,
} from './pixel-grid-adjustments';

describe('pixel-grid adjustments', () => {
  it.each([
    ['none', 10.2],
    ['round', 9.5],
    ['ceil', 10.5],
    ['floor', 9.5],
  ] as const)('aligns a one-pixel stroke with %s', (alignment, expected) => {
    expect(adjustForPixelGrid(10.2, 1, alignment)).toBe(expected);
  });

  it('leaves every rectangle value unchanged in none mode', () => {
    expect(adjustRectangleToPixelGrid(1, 10.2, 20.7, 30.4, -8.6, 'none'))
      .toEqual({ x: 10.2, y: 20.7, width: 30.4, height: -8.6 });
  });

  it.each(['round', 'ceil', 'floor'] as const)(
    'preserves zero and negative integral dimensions in %s mode',
    alignment => {
      const adjusted = adjustRectangleToPixelGrid(
        1,
        10.2,
        20.2,
        0,
        -10,
        alignment,
      );

      expect(adjusted.width).toBe(0);
      expect(adjusted.height).toBe(-10);
    },
  );
});
