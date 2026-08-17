import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import bartImageSmall from '../test-utils/fixtures/bart-500kb.png';
import { takeScreenshot } from '../util/test-utils';
import { img } from './img';

const defaultStyle = {
  x: 50,
  y: 50,
  src: bartImageSmall,
  width: 564 / 2,
  height: 424 / 2,
  stroke: 'red',
  strokeWidth: 2,
};

describe('img', () => {
  it('renders an image in browser', async () => {
    await componentTest(img({ style: defaultStyle }));
    await takeScreenshot(page);
  });

  it('renders an image with natural dimensions when width/height not specified', async () => {
    const { width, height, ...style } = defaultStyle;
    await componentTest(img({ style }));
    await takeScreenshot(page);
  });

  describe('mouse events', () => {
    const { x, y, width, height, strokeWidth } = defaultStyle;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const onBorderX = x + width + (strokeWidth / 2);
    const onBorderY = y + height + (strokeWidth / 2);
    const offImageX = x - 10;
    const offImageY = y - 10;

    describe.each([
      { event: 'click', handler: 'onClick' },
      { event: 'dblClick', handler: 'onDblClick' },
      { event: 'contextMenu', handler: 'onContextMenu' },
      { event: 'mouseDown', handler: 'onMouseDown' },
      { event: 'mouseUp', handler: 'onMouseUp' },
    ] as const)('should handle %s events', ({ event, handler }) => {
      it(`should handle ${event} events`, async () => {
        const handlerFn = vi.fn();

        const canvas = await componentTest(img({
          style: defaultStyle,
          [handler]: handlerFn,
        }));

        const centerPosition = { x: centerX, y: centerY };
        const onBorderPosition = { x: onBorderX, y: onBorderY };
        const offImagePosition = { x: offImageX, y: offImageY };
        const triggerEvent = (position: { x: number; y: number }) =>
          event === 'mouseDown' || event === 'mouseUp' ?
              canvas.click({ position }) :
            canvas[event]({ position });

        await triggerEvent(offImagePosition);
        expect(handlerFn).not.toHaveBeenCalled();

        await triggerEvent(centerPosition);
        expect(handlerFn).toHaveBeenCalledTimes(1);

        await triggerEvent(onBorderPosition);
        expect(handlerFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('mouse movement', () => {
      it('should handle mouse over and out events for image with a border', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const canvas = await componentTest(img({
          style: defaultStyle,
          onMouseOver,
          onMouseOut,
        }));

        // start outside
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).not.toHaveBeenCalled();
        expect(onMouseOut).not.toHaveBeenCalled();

        // move to the image area
        await canvas.mouseMove({ position: { x: centerX, y: centerY } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).not.toHaveBeenCalled();

        // move back outside
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).toHaveBeenCalledTimes(1);
      });

      it('should handle mouse over and mouse out for image without a border', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const canvas = await componentTest(img({
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

  describe('image specific features', () => {
    it('keeps opacity-zero image geometry interactive', async () => {
      const onClick = vi.fn();
      const centerX = defaultStyle.x + defaultStyle.width / 2;
      const centerY = defaultStyle.y + defaultStyle.height / 2;
      const canvas = await componentTest(img({
        style: {
          ...defaultStyle,
          opacity: 0,
        },
        onClick,
      }));

      await canvas.click({ position: { x: centerX, y: centerY } });
      expect(onClick).toHaveBeenCalledOnce();
      expect(Array.from(
        canvas.element.getContext('2d')!.getImageData(centerX, centerY, 1, 1).data,
      )).toEqual([0, 0, 0, 0]);
    });

    it('ignores a legacy top-level cursor from untyped callers', async () => {
      const centerX = defaultStyle.x + defaultStyle.width / 2;
      const centerY = defaultStyle.y + defaultStyle.height / 2;
      const legacyInput = {
        style: defaultStyle,
        cursor: 'pointer',
      } as unknown as Parameters<typeof img>[0];
      const canvas = await componentTest(img(legacyInput));

      await canvas.mouseMove({ position: { x: centerX, y: centerY } });
      expect(getComputedStyle(canvas.element).cursor).not.toBe('pointer');
    });

    it('should handle opacity', async () => {
      await componentTest(img({
        style: {
          ...defaultStyle,
          opacity: 0.5,
        },
      }));
      await takeScreenshot(page);
    });

    it('should align to pixel grid when specified', async () => {
      await componentTest(img({
        style: {
          ...defaultStyle,
          strokeWidth: 1,
          alignToPixelGrid: 'none', // This will make the image blurry if not aligned to the pixel grid
        },
      }));

      await takeScreenshot(page, 'pixel-grid-none.png');

      await componentTest(img({
        style: {
          ...defaultStyle,
          strokeWidth: 1,
          alignToPixelGrid: 'round', // This will make the image crisp if aligned to the pixel grid
        },
      }));

      await takeScreenshot(page, 'pixel-grid-round.png');
    });

    it('should handle cursor styles', async () => {
      await componentTest(img({
        style: {
          ...defaultStyle,
          cursor: 'pointer',
        },
      }));
      await takeScreenshot(page);
    });
  });
});
