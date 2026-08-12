import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { text } from './text';

const defaultOptions = {
  x: 50,
  y: 50,
  text: 'Hello World',
  fillStyle: 'black',
  strokeStyle: 'red',
  lineWidth: 2,
  font: '24px Arial',
};

describe('text', () => {
  it('applies alpha zero while drawing', async () => {
    const observedAlpha: number[] = [];
    const fillText = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'fillText')
      .mockImplementation(function (this: CanvasRenderingContext2D) {
        observedAlpha.push(this.globalAlpha);
      });

    await componentTest(text({
      ...defaultOptions,
      strokeStyle: undefined,
      alpha: 0,
    }));

    expect(observedAlpha).toEqual([0]);
    fillText.mockRestore();
  });

  it('renders text in browser', async () => {
    await componentTest(text(defaultOptions));
    await takeScreenshot(page);
  });

  describe('mouse events', () => {
    const { x, y } = defaultOptions;
    // We need to measure text to get accurate dimensions for hit testing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = defaultOptions.font;
    const metrics = ctx.measureText(defaultOptions.text);

    const width = metrics.width;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const lineWidth = defaultOptions.lineWidth;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    // Stay inside the stroke instead of depending on exact corner inclusion,
    // which differs across Chromium's Canvas implementations.
    const onBorderX = centerX;
    const onBorderY = y - (lineWidth / 4);
    const offTextX = x - 10;
    const offTextY = y - 10;

    describe.each([
      { event: 'click', handler: 'onClick' },
      { event: 'dblClick', handler: 'onDblClick' },
      { event: 'contextMenu', handler: 'onContextMenu' },
      { event: 'mouseDown', handler: 'onMouseDown' },
      { event: 'mouseUp', handler: 'onMouseUp' },
    ] as const)('should handle %s events', ({ event, handler }) => {
      it(`should handle ${event} events`, async () => {
        const handlerFn = vi.fn();

        const canvas = await componentTest(text({
          ...defaultOptions,
          [handler]: handlerFn,
        }));

        const centerPosition = { x: centerX, y: centerY };
        const onBorderPosition = { x: onBorderX, y: onBorderY };
        const offTextPosition = { x: offTextX, y: offTextY };
        const triggerEvent = (position: { x: number; y: number }) =>
          event === 'mouseDown' || event === 'mouseUp' ?
              canvas.click({ position }) :
            canvas[event]({ position });

        await triggerEvent(offTextPosition);
        expect(handlerFn).not.toHaveBeenCalled();

        await triggerEvent(centerPosition);
        expect(handlerFn).toHaveBeenCalledTimes(1);

        await triggerEvent(onBorderPosition);
        expect(handlerFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('mouse movement', () => {
      it('uses text bounds for a cursor-only interaction', async () => {
        const canvas = await componentTest(text({
          ...defaultOptions,
          cursor: 'pointer',
        }));

        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(getComputedStyle(canvas.element).cursor).not.toBe('pointer');
        await canvas.mouseMove({ position: { x: centerX, y: centerY } });
        expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
      });

      it('should handle mouse over and out events for text with a stroke', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const canvas = await componentTest(text({
          ...defaultOptions,
          onMouseOver,
          onMouseOut,
        }));

        // start outside
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).not.toHaveBeenCalled();
        expect(onMouseOut).not.toHaveBeenCalled();

        // move to the text area
        await canvas.mouseMove({ position: { x: centerX, y: centerY } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).not.toHaveBeenCalled();

        // move back outside
        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(onMouseOver).toHaveBeenCalledTimes(1);
        expect(onMouseOut).toHaveBeenCalledTimes(1);
      });

      it('should handle mouse over and mouse out for text without a stroke', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const canvas = await componentTest(text({
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

  describe('text specific features', () => {
    it('should handle text overflow with ellipsis', async () => {
      await componentTest(text({
        ...defaultOptions,
        text: 'This is a very long text that should be truncated',
        maxWidth: 100,
        overflow: 'ellipsis',
      }));
      await takeScreenshot(page);
    });

    it('should handle word wrap', async () => {
      await componentTest(text({
        ...defaultOptions,
        text: 'This text should wrap to multiple lines',
        maxWidth: 100,
        wordWrap: true,
        lineHeight: 24,
      }));
      await takeScreenshot(page);
    });
  });
});
