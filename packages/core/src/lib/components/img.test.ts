import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import bartImageSmall from '../test-utils/fixtures/bart-500kb.png';
import { takeScreenshot } from '../util/test-utils';
import { img } from './img';

const defaultOptions = {
  x: 50,
  y: 50,
  src: bartImageSmall,
  width: 564 / 2,
  height: 424 / 2,
  strokeStyle: 'red',
  lineWidth: 2,
};

describe('img', () => {
  it('renders an image in browser', async () => {
    await componentTest(img(defaultOptions));
    await takeScreenshot(page);
  });

  it('renders an image with natural dimensions when width/height not specified', async () => {
    const { width, height, ...options } = defaultOptions;
    await componentTest(img(options));
    await takeScreenshot(page);
  });

  describe('mouse events', () => {
    const { x, y, width, height, lineWidth } = defaultOptions;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const onBorderX = x + width + (lineWidth / 2);
    const onBorderY = y + height + (lineWidth / 2);
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
          ...defaultOptions,
          [handler]: handlerFn,
        }));

        const centerPosition = { x: centerX, y: centerY };
        const onBorderPosition = { x: onBorderX, y: onBorderY };
        const offImagePosition = { x: offImageX, y: offImageY };

        await canvas[event]({ position: offImagePosition });
        expect(handlerFn).not.toHaveBeenCalled();

        await canvas[event]({ position: centerPosition });
        expect(handlerFn).toHaveBeenCalledTimes(1);

        await canvas[event]({ position: onBorderPosition });
        expect(handlerFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('mouse movement', () => {
      it('should handle mouse over and out events for image with a border', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const canvas = await componentTest(img({
          ...defaultOptions,
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

  describe('image specific features', () => {
    it('should handle alpha transparency', async () => {
      await componentTest(img({
        ...defaultOptions,
        alpha: 0.5,
      }));
      await takeScreenshot(page);
    });

    it('should align to pixel grid when specified', async () => {
      await componentTest(img({
        ...defaultOptions,
        lineWidth: 1,
        alignToPixelGrid: 'none', // This will make the image blurry if not aligned to the pixel grid
      }));

      await takeScreenshot(page, 'pixel-grid-none.png');

      await componentTest(img({
        ...defaultOptions,
        lineWidth: 1,
        alignToPixelGrid: 'round', // This will make the image crisp if aligned to the pixel grid
      }));

      await takeScreenshot(page, 'pixel-grid-round.png');
    });

    it('should handle cursor styles', async () => {
      await componentTest(img({
        ...defaultOptions,
        cursor: 'pointer',
      }));
      await takeScreenshot(page);
    });
  });
});
