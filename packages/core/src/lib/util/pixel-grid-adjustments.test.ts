import { describe, expect, it } from 'vitest';
import { adjustForPixelGrid, adjustRectangleToPixelGrid } from './pixel-grid-adjustments';

describe('pixel-grid-adjustments', () => {
  describe('adjustForPixelGrid', () => {
    it.each([
      // [value, lineWidth, alignment, expected]
      [10.5, 1, 'none', 10.5],
      [10.5, 2, 'none', 10.5],
      [10.5, 5, 'none', 10.5],
      [10.5, undefined, undefined, 10.5],
      [10.5, 1, 'ceil', 10.5],
      [10.5, 2, 'ceil', 11],
      [10.5, 5, 'ceil', 10.5],
      [10.5, 1, 'floor', 9.5],
      [10.5, 2, 'floor', 10],
      [10.5, 5, 'floor', 9.5],
      [10.4, 1, 'round', 9.5],
      [10.6, 1, 'round', 10.5],
      [10.4, 2, 'round', 10],
      [10.6, 2, 'round', 11],
      [10.4, 5, 'round', 9.5],
      [10.6, 5, 'round', 10.5],
    ] as const)('should adjust %f with lineWidth %d and %s alignment to %f', (value, lineWidth, alignment, expected) => {
      expect(adjustForPixelGrid(value, lineWidth, alignment)).toBe(expected);
    });
  });

  describe('adjustRectangleToPixelGrid', () => {
    const startingRectangle = { x: 10.5, y: 20.5, width: 100.5, height: 200.5 };
    it.each([
      // [lineWidth, alignment, x, y, width, height, expected]

      // 0.5 lineWidth cases produce quarter-pixel offsets:
      // calculatePixelGridOffset(0.5) = (0.5/2) % 1 = 0.25
      // This means positions end up at .75 or .25 instead of .5
      // [0.5, 'round', { x: 10.5, y: 20.5, width: 100.5, height: 200.5 }, { x: 10.75, y: 20.75, width: 101, height: 201 }],
      // [0.5, 'ceil', { x: 10.5, y: 20.5, width: 100.5, height: 200.5 }, { x: 10.75, y: 20.75, width: 102, height: 202 }],
      // [0.5, 'floor', { x: 10.5, y: 20.5, width: 100.5, height: 200.5 }, { x: 9.75, y: 19.75, width: 101, height: 201 }],

      // Zero lineWidth still rounds positions but keeps even-number behavior for dimensions
      [0, 'none', startingRectangle, { x: 10.5, y: 20.5, width: 101.5, height: 201.5 }], // Shouldn't this be the right answer for all of them?
      [0, 'round', startingRectangle, { x: 11, y: 21, width: 102, height: 202 }], // Sus
      [0, 'ceil', startingRectangle, { x: 11, y: 21, width: 102, height: 202 }], // Sus
      [0, 'floor', startingRectangle, { x: 10, y: 20, width: 101, height: 201 }], // Sus

      // Round cases
      [1, 'round', startingRectangle, { x: 10.5, y: 20.5, width: 101, height: 201 }],
      [2, 'round', startingRectangle, { x: 11, y: 21, width: 102, height: 202 }],
      [5, 'round', startingRectangle, { x: 10.5, y: 20.5, width: 101, height: 201 }],
      [10, 'round', startingRectangle, { x: 11, y: 21, width: 102, height: 202 }],

      // None cases
      [1, 'none', startingRectangle, { x: 10.5, y: 20.5, width: 101.5, height: 201.5 }],
      [2, 'none', startingRectangle, { x: 10.5, y: 20.5, width: 101.5, height: 201.5 }],
      [5, 'none', startingRectangle, { x: 10.5, y: 20.5, width: 101.5, height: 201.5 }],
      [10, 'none', startingRectangle, { x: 10.5, y: 20.5, width: 101.5, height: 201.5 }],

      // Ceil cases
      [1, 'ceil', startingRectangle, { x: 10.5, y: 20.5, width: 101, height: 201 }],
      [2, 'ceil', startingRectangle, { x: 11, y: 21, width: 102, height: 202 }],
      [5, 'ceil', startingRectangle, { x: 10.5, y: 20.5, width: 101, height: 201 }],
      [10, 'ceil', startingRectangle, { x: 11, y: 21, width: 102, height: 202 }],

      // Floor cases
      [1, 'floor', startingRectangle, { x: 9.5, y: 19.5, width: 101, height: 201 }],
      [2, 'floor', startingRectangle, { x: 10, y: 20, width: 101, height: 201 }],
      [5, 'floor', startingRectangle, { x: 9.5, y: 19.5, width: 101, height: 201 }],
      [10, 'floor', startingRectangle, { x: 10, y: 20, width: 101, height: 201 }],
    ] as const)('should adjust rectangle with lineWidth %d and "%s" alignment', (lineWidth, alignment, { x, y, width, height }, expected) => {
      const result = adjustRectangleToPixelGrid(lineWidth, x, y, width, height, alignment);
      expect(result).toEqual(expected);
    });
  });
});
