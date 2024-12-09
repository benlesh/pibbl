import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { rect } from './rect';

const defaultOptions = {
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  fillStyle: 'red',
  strokeStyle: 'black',
  lineWidth: 2,
};

describe('rect', () => {
  it('renders a rectangle in browser', async () => {
    await componentTest(rect(defaultOptions));
    await takeScreenshot(page);
  });

  describe('other styles', () => {
    it.only('should change the mouse cursor to a pointer when hovering over the rect', async () => {
      const canvas = await componentTest(rect({
        ...defaultOptions,
        cursor: 'pointer',
      }));

      const { x, y, width, height } = defaultOptions;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      await canvas.mouseMove({ position: { x: centerX, y: centerY } });
      expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
    });
  });

  describe('mouse events', () => {
    const { x, y, width, height, lineWidth } = defaultOptions;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const onBorderX = x + width + (lineWidth / 2);
    const onBorderY = y + height + (lineWidth / 2);
    const offRectX = x - 10;
    const offRectY = defaultOptions.y - 10;

    describe.each([
      { event: 'click', handler: 'onClick' },
      { event: 'dblClick', handler: 'onDblClick' },
      { event: 'contextMenu', handler: 'onContextMenu' },
      { event: 'mouseDown', handler: 'onMouseDown' },
      { event: 'mouseUp', handler: 'onMouseUp' },
    ] as const)('should handle %s events', ({ event, handler }) => {
      it(`should handle ${event} events`, async () => {
        const handlerFn = vi.fn();

        const canvas = await componentTest(rect({
          ...defaultOptions,
          [handler]: handlerFn,
        }));

        const centerPosition = { x: centerX, y: centerY };
        const onBorderPosition = { x: onBorderX, y: onBorderY };
        const offRectPosition = { x: offRectX, y: offRectY };

        await canvas[event]({ position: offRectPosition });
        expect(handlerFn).not.toHaveBeenCalled();

        await canvas[event]({ position: centerPosition });
        expect(handlerFn).toHaveBeenCalledTimes(1);

        await canvas[event]({ position: onBorderPosition });
        expect(handlerFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('mouse movement', () => {
      it('should handle mouse over and out events for a rect with a border', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const { x, y, width, height } = defaultOptions;

        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const lineWidth = 3;
        const onBorderX = x - 1;
        const onBorderY = y - 1;

        const canvas = await componentTest(rect({
          ...defaultOptions,
          lineWidth,
          onMouseOver,
          onMouseOut,
        }));

        // start in the corner
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).not.toHaveBeenCalled();
        expect(onMouseOut).not.toHaveBeenCalled();

        // move to the border
        await canvas.mouseMove({ position: { x: onBorderX, y: onBorderY } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).not.toHaveBeenCalled();

        // move back to the corner
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).toHaveBeenCalledTimes(1);

        // move to the center
        await canvas.mouseMove({ position: { x: centerX, y: centerY } });
        expect(onMouseOver).toHaveBeenCalledTimes(2);
        expect(onMouseOut).toHaveBeenCalledTimes(1);

        // move back to the corner
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).toHaveBeenCalledTimes(2);
        expect(onMouseOut).toHaveBeenCalledTimes(2);
      });

      it('should handle mouse over and mouse out for a rect without a border', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const { x, y, width, height } = defaultOptions;

        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const canvas = await componentTest(rect({
          ...defaultOptions,
          lineWidth: 0,
          onMouseOver,
          onMouseOut,
        }));

        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).not.toHaveBeenCalled();
        expect(onMouseOut).not.toHaveBeenCalled();

        await canvas.mouseMove({ position: { x: centerX, y: centerY } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).not.toHaveBeenCalled();

        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).toHaveBeenCalledTimes(1);
      });
    });
  });
});
