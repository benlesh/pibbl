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
      horizontalLine({ style: { y: 22, stroke: 'red', strokeWidth: 1 } }),
      verticalLine({ style: { x: 33, stroke: 'blue', strokeWidth: 1 } }),
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
        style: {
          y: 10.2,
          left: 2,
          right: 20,
          stroke: 'red',
          strokeWidth: 1,
          alignToPixelGrid,
        },
      }),
      verticalLine({
        style: {
          x: 10.2,
          top: 3,
          bottom: 30,
          stroke: 'blue',
          strokeWidth: 1,
          alignToPixelGrid,
        },
      }),
    ] }));

    expect(moveTo.mock.calls).toEqual([[2, expected], [expected, 3]]);
    expect(lineTo.mock.calls).toEqual([[20, expected], [expected, 30]]);
    moveTo.mockRestore();
    lineTo.mockRestore();
  });

  it('forwards paint, cursor, and interaction style while keeping handlers in props', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(horizontalLine({
      style: {
        y: 40,
        left: 20,
        right: 120,
        stroke: 'red',
        strokeWidth: 2,
        opacity: 0,
        lineInteractionWidth: 20,
        cursor: 'crosshair',
      },
      onClick,
    }));

    const pixels = canvas.element
      .getContext('2d')!
      .getImageData(0, 0, 140, 60)
      .data;
    expect(pixels.some((value, index) => index % 4 === 3 && value > 0))
      .toBe(false);

    await canvas.click({ position: { x: 70, y: 48 } });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(canvas.element.style.cursor).toBe('crosshair');
  });
});
