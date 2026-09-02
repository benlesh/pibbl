import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { Rectangle } from './rect';
import { createElement } from '../element/create-element';

const defaultStyle = {
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  fill: 'red',
  stroke: 'black',
  strokeWidth: 1,
};

describe('rect', () => {
  it('renders a rectangle in browser', async () => {
    await componentTest(createElement(Rectangle, {
      style: defaultStyle,
    }));
    await takeScreenshot(page);
  });

  it('defaults omitted x and y to zero', async () => {
    const canvas = await componentTest(createElement(Rectangle, {
      style: {
        width: 20,
        height: 20,
        fill: 'red',
      },
    }));

    expect(Array.from(
      canvas.element.getContext('2d')!.getImageData(10, 10, 1, 1).data,
    )).toEqual([255, 0, 0, 255]);
  });

  describe('other styles', () => {
    it('should change the mouse cursor to a pointer when hovering over the rect', async () => {
      const canvas = await componentTest(createElement(Rectangle, {
        style: {
          ...defaultStyle,
          cursor: 'pointer',
        },
      }));

      const { x, y, width, height } = defaultStyle;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      await canvas.mouseMove({ position: { x: centerX, y: centerY } });
      expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
    });
  });

  describe('mouse events', () => {
    const { x, y, width, height } = defaultStyle;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const nearEdgeX = x + width - 1;
    const nearEdgeY = y + height / 2;
    const offRectX = x - 10;
    const offRectY = defaultStyle.y - 10;

    describe.each([
      { event: 'click', handler: 'onClick' },
      { event: 'dblClick', handler: 'onDblClick' },
      { event: 'contextMenu', handler: 'onContextMenu' },
      { event: 'mouseDown', handler: 'onMouseDown' },
      { event: 'mouseUp', handler: 'onMouseUp' },
    ] as const)('should handle %s events', ({ event, handler }) => {
      it(`should handle ${event} events`, async () => {
        const handlerFn = vi.fn();

        const canvas = await componentTest(createElement(Rectangle, {
          style: defaultStyle,
          [handler]: handlerFn,
        }));

        const centerPosition = { x: centerX, y: centerY };
        const nearEdgePosition = { x: nearEdgeX, y: nearEdgeY };
        const offRectPosition = { x: offRectX, y: offRectY };
        const triggerEvent = (position: { x: number; y: number }) =>
          event === 'mouseDown' || event === 'mouseUp' ?
              canvas.click({ position }) :
            canvas[event]({ position });

        await triggerEvent(offRectPosition);
        expect(handlerFn).not.toHaveBeenCalled();

        await triggerEvent(centerPosition);
        expect(handlerFn).toHaveBeenCalledTimes(1);

        await triggerEvent(nearEdgePosition);
        expect(handlerFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('mouse movement', () => {
      it('should handle mouse over and out events for a rect with a border', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const { x, y, width, height } = defaultStyle;

        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const lineWidth = 3;
        const onBorderX = x - 1;
        const onBorderY = y - 1;

        const canvas = await componentTest(createElement(Rectangle, {
          style: {
            ...defaultStyle,
            strokeWidth: lineWidth,
          },
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

        const { x, y, width, height } = defaultStyle;

        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const canvas = await componentTest(createElement(Rectangle, {
          style: {
            ...defaultStyle,
            strokeWidth: 0,
          },
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
