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
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(defaultOptions.text);

    const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const boundsLeft = x - metrics.actualBoundingBoxLeft;
    const boundsTop = y - metrics.actualBoundingBoxAscent;

    const centerX = boundsLeft + width / 2;
    const centerY = boundsTop + height / 2;
    const onBorderX = boundsLeft + width - 1;
    const onBorderY = boundsTop + 1;
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
    it('renders every wrapped line, including a fitting final line', async () => {
      const calls: Array<[string, number, number]> = [];
      const fillText = vi
        .spyOn(CanvasRenderingContext2D.prototype, 'fillText')
        .mockImplementation(function (
          this: CanvasRenderingContext2D,
          value: string,
          x: number,
          y: number,
        ) {
          calls.push([value, x, y]);
        });

      await componentTest(text({
        x: 10,
        y: 20,
        text: 'one two three',
        fillStyle: 'black',
        font: '20px Arial',
        maxWidth: 82,
        wordWrap: true,
        lineHeight: 24,
      }));

      expect(calls).toEqual([
        ['one two', 10, 20],
        ['three', 10, 44],
      ]);
      fillText.mockRestore();
    });

    it('clips with a finite canvas height when maxHeight is omitted', async () => {
      const clip = vi.spyOn(CanvasRenderingContext2D.prototype, 'clip');
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({
        x: 10,
        y: 20,
        text: 'clipped text',
        fillStyle: 'black',
        maxWidth: 60,
        overflow: 'clip',
      }));

      expect(clip).toHaveBeenCalledOnce();
      expect(fillText).toHaveBeenCalledOnce();
      clip.mockRestore();
      fillText.mockRestore();
    });

    it('hits centered middle-baseline text at its painted bounds', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(text({
        x: 200,
        y: 100,
        text: 'Centered',
        fillStyle: 'black',
        font: '24px Arial',
        textAlign: 'center',
        textBaseline: 'middle',
        onClick,
      }));

      await canvas.click({ position: { x: 200, y: 100 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 270, y: 100 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('shrinks squished text interaction bounds with the painted glyphs', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(text({
        x: 20,
        y: 40,
        text: 'A very wide label',
        fillStyle: 'black',
        font: '24px Arial',
        maxWidth: 60,
        overflow: 'squish',
        onClick,
      }));

      await canvas.click({ position: { x: 50, y: 50 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 100, y: 50 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

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
