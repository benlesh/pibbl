import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { Rectangle } from './rect';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { crc } from '../crc';
import { useState } from '../hooks/use-state';
import { Group } from './g';

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
  it('resolves rounded lengths against the smaller percentage basis', () => {
    const resolve = getPrimitiveDefinition(Rectangle)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => Record<string, unknown>;

    expect(resolve({
      width: 40,
      height: 30,
      cornerRadius: '25%',
      cornerRadii: [0, null, '50%', undefined],
    }, {
      allocation: { x: 0, y: 0, width: 200, height: 120 },
      percentageBasis: { x: 0, y: 0, width: 200, height: 120 },
      constraints: { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 200 },
      component: 'Rectangle',
      algorithm: 'render-dispatch',
    })).toMatchObject({
      cornerRadius: 30,
      cornerRadii: [0, null, 60, undefined],
    });
  });

  it('uses rounded geometry for painting and coordinate targeting', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Rectangle, {
      style: {
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        cornerRadius: 10,
        fill: 'red',
      },
      onClick,
    }));

    expect(canvas.element.getContext('2d')!.getImageData(1, 1, 1, 1).data[3]).toBe(0);
    expect(canvas.element.getContext('2d')!.getImageData(20, 20, 1, 1).data[3]).toBeGreaterThan(0);
    await canvas.click({ position: { x: 1, y: 1 } });
    await canvas.click({ position: { x: 20, y: 20 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses browser signed rounded-rectangle geometry for painting', async () => {
    const canvas = await componentTest(createElement(Rectangle, {
      style: {
        x: 60,
        y: 20,
        width: -40,
        height: 30,
        cornerRadius: 10,
        fill: 'red',
      },
    }));

    expect(alphaAt(canvas.element, 59, 21)).toBe(0);
    expect(alphaAt(canvas.element, 50, 30)).toBeGreaterThan(0);
  });

  it('updates rounded rectangle geometry', async () => {
    let setRadius!: (radius: number) => void;
    function Probe() {
      const [radius, set] = useState(10);
      setRadius = set;
      return createElement(Rectangle, {
        style: { x: 0, y: 0, width: 40, height: 40, cornerRadius: radius, fill: 'red' },
      });
    }

    const canvas = await componentTest(createElement(Probe, {}));
    expect(alphaAt(canvas.element, 1, 1)).toBe(0);

    setRadius(0);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(alphaAt(canvas.element, 1, 1)).toBeGreaterThan(0);
  });

  it('recovers from an invalid rounded radius with a later valid rectangle', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    let controller: ReturnType<typeof crc> | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    try {
      controller = crc(canvas, createElement(Rectangle, {
        style: { x: 0, y: 0, width: 20, height: 20, cornerRadius: -1, fill: 'red' },
      }));
      let failure: unknown;
      try {
        pending?.(0);
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        message: expect.stringMatching(/Rectangle: property cornerRadius.*nonnegative/),
      });

      controller = crc(canvas, createElement(Rectangle, {
        style: { x: 0, y: 0, width: 20, height: 20, cornerRadius: 4, fill: 'red' },
      }));
      expect(() => pending?.(0)).not.toThrow();
      expect(alphaAt(canvas, 10, 10)).toBeGreaterThan(0);
    } finally {
      controller?.dispose();
      canvas.remove();
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('adjusts the box before passing unchanged radii to roundRect', async () => {
    const roundRect = vi.spyOn(Path2D.prototype, 'roundRect');
    try {
      await componentTest(createElement(Rectangle, {
        style: {
          x: 1.2,
          y: 2.3,
          width: 3.4,
          height: 4.5,
          alignToPixelGrid: 'round',
          strokeWidth: 1,
          cornerRadius: 9,
          fill: 'red',
        },
      }));

      expect(roundRect).toHaveBeenCalledWith(0.5, 1.5, 4, 5, [9, 9, 9, 9]);
    } finally {
      roundRect.mockRestore();
    }
  });

  it('keeps the resolved rectangle box for keyboard navigation and honors an override', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Rectangle, {
          style: { x: 20, y: 30, width: 40, height: 50, cornerRadius: 8 },
          onClick: vi.fn(),
        }),
        createElement(Rectangle, {
          style: { x: 80, y: 30, width: 40, height: 50, cornerRadius: 8 },
          onClick: vi.fn(),
          keyboardNavigationBounds: override,
        }),
      ],
    }));

    expect(Array.from(getCRCInstance(canvas.element).eventRoot.targets)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyboardNavigationBounds: { x: 20, y: 30, width: 40, height: 50 },
        }),
        expect.objectContaining({ keyboardNavigationBounds: override }),
      ]),
    );
  });

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

function alphaAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
}
