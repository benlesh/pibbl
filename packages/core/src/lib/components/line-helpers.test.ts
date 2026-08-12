import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { g } from './g';
import { horizontalLine } from './horizontal-line';
import { verticalLine } from './vertical-line';

describe('horizontalLine and verticalLine', () => {
  it('default to the full Canvas dimensions', async () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');

    await componentTest(g({ children: [
      horizontalLine({ y: 22, strokeStyle: 'red', lineWidth: 1 }),
      verticalLine({ x: 33, strokeStyle: 'blue', lineWidth: 1 }),
    ] }));

    expect(moveTo.mock.calls).toEqual([[0, 22], [33, 0]]);
    expect(lineTo.mock.calls).toEqual([[400, 22], [33, 300]]);
    moveTo.mockRestore();
    lineTo.mockRestore();
  });

  it.each([
    ['none', 10.2],
    ['round', 9.5],
    ['ceil', 10.5],
    ['floor', 9.5],
  ] as const)('applies %s pixel-grid alignment symmetrically', async (
    alignToPixelGrid,
    expected,
  ) => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');

    await componentTest(g({ children: [
      horizontalLine({
        y: 10.2,
        left: 2,
        right: 20,
        strokeStyle: 'red',
        lineWidth: 1,
        alignToPixelGrid,
      }),
      verticalLine({
        x: 10.2,
        top: 3,
        bottom: 30,
        strokeStyle: 'blue',
        lineWidth: 1,
        alignToPixelGrid,
      }),
    ] }));

    expect(moveTo.mock.calls).toEqual([[2, expected], [expected, 3]]);
    expect(lineTo.mock.calls).toEqual([[20, expected], [expected, 30]]);
    moveTo.mockRestore();
    lineTo.mockRestore();
  });
});
