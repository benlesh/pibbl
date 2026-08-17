import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { text } from './text';

const defaultStyle = {
  x: 50,
  y: 50,
  text: 'Hello World',
  fill: 'black',
  stroke: 'red',
  strokeWidth: 2,
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
      style: {
        ...defaultStyle,
        stroke: undefined,
        opacity: 0,
      },
    }));

    expect(observedAlpha).toEqual([0]);
    fillText.mockRestore();
  });

  it('renders text in browser', async () => {
    await componentTest(text({ style: defaultStyle }));
    await takeScreenshot(page);
  });

  describe('mouse events', () => {
    const { x, y } = defaultStyle;
    // We need to measure text to get accurate dimensions for hit testing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = defaultStyle.font;
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(defaultStyle.text);

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
          style: defaultStyle,
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
          style: {
            ...defaultStyle,
            cursor: 'pointer',
          },
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
          style: defaultStyle,
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

  describe('text specific features', () => {
    it('renders the exact single-line ellipsis selected by measured width', async () => {
      const measureText = useFixedWidthTextMetrics();
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({
        style: {
          x: 10,
          y: 20,
          text: 'abcdefghij',
          fill: 'black',
          width: 55,
          fit: 'ellipsis',
        },
      }));

      expect(fillText).toHaveBeenCalledExactlyOnceWith('ab...', 10, 20, undefined);
      measureText.mockRestore();
      fillText.mockRestore();
    });

    it('ellipsizes the exact final visible wrapped line at maxHeight', async () => {
      const measureText = useFixedWidthTextMetrics();
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({
        style: {
          x: 10,
          y: 30,
          text: 'one two three four',
          fill: 'black',
          width: 75,
          height: 40,
          wrap: true,
          lineHeight: 20,
          fit: 'ellipsis',
        },
      }));

      expect(fillText.mock.calls).toEqual([
        ['one two', 10, 30, undefined],
        ['thre...', 10, 50, undefined],
      ]);
      measureText.mockRestore();
      fillText.mockRestore();
    });

    it('passes maxWidth as the Canvas squish argument', async () => {
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({
        style: {
          x: 7,
          y: 9,
          text: 'wide',
          fill: 'black',
          width: 42,
          fit: 'squish',
        },
      }));

      expect(fillText).toHaveBeenCalledExactlyOnceWith('wide', 7, 9, 42);
      fillText.mockRestore();
    });

    it('uses the exact aligned clip rectangle without moving the text anchor', async () => {
      const rect = vi.spyOn(Path2D.prototype, 'rect');
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({
        style: {
          x: 100,
          y: 80,
          text: 'clip me',
          fill: 'black',
          width: 60,
          height: 40,
          fit: 'clip',
          textAlign: 'center',
          textBaseline: 'middle',
        },
      }));

      expect(rect).toHaveBeenCalledExactlyOnceWith(70, 60, 60, 40);
      expect(fillText).toHaveBeenCalledExactlyOnceWith(
        'clip me',
        100,
        80,
        undefined,
      );
      rect.mockRestore();
      fillText.mockRestore();
    });

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
        style: {
          x: 10,
          y: 20,
          text: 'one two three',
          fill: 'black',
          font: '20px Arial',
          width: 82,
          wrap: true,
          lineHeight: 24,
        },
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
        style: {
          x: 10,
          y: 20,
          text: 'clipped text',
          fill: 'black',
          width: 60,
          fit: 'clip',
        },
      }));

      expect(clip).toHaveBeenCalledOnce();
      expect(fillText).toHaveBeenCalledOnce();
      clip.mockRestore();
      fillText.mockRestore();
    });

    it('hits centered middle-baseline text at its painted bounds', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(text({
        style: {
          x: 200,
          y: 100,
          text: 'Centered',
          fill: 'black',
          font: '24px Arial',
          textAlign: 'center',
          textBaseline: 'middle',
        },
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
        style: {
          x: 20,
          y: 40,
          text: 'A very wide label',
          fill: 'black',
          font: '24px Arial',
          width: 60,
          fit: 'squish',
        },
        onClick,
      }));

      await canvas.click({ position: { x: 50, y: 50 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 100, y: 50 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('clips handlers and cursor to the visible text portion', async () => {
      const measureText = useFixedWidthTextMetrics();
      const onClick = vi.fn();
      const canvas = await componentTest(text({
        style: {
          text: 'abcdefghij',
          x: 20,
          y: 20,
          width: 40,
          height: 20,
          fit: 'clip',
          fill: 'black',
          cursor: 'pointer',
        },
        onClick,
      }));

      await canvas.mouseMove({ position: { x: 80, y: 21 } });
      expect(getComputedStyle(canvas.element).cursor).not.toBe('pointer');
      await canvas.click({ position: { x: 80, y: 21 } });
      expect(onClick).not.toHaveBeenCalled();

      await canvas.mouseMove({ position: { x: 30, y: 21 } });
      expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
      await canvas.click({ position: { x: 30, y: 21 } });
      expect(onClick).toHaveBeenCalledOnce();
      measureText.mockRestore();
    });

    it('should handle text overflow with ellipsis', async () => {
      await componentTest(text({
        style: {
          ...defaultStyle,
          text: 'This is a very long text that should be truncated',
          width: 100,
          fit: 'ellipsis',
        },
      }));
      await takeScreenshot(page);
    });

    it('should handle word wrap', async () => {
      await componentTest(text({
        style: {
          ...defaultStyle,
          text: 'This text should wrap to multiple lines',
          width: 100,
          wrap: true,
          lineHeight: 24,
        },
      }));
      await takeScreenshot(page);
    });

    it('defaults omitted x and y to the zero origin', async () => {
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({ style: { text: 'origin', fill: 'black' } }));

      expect(fillText).toHaveBeenCalledExactlyOnceWith(
        'origin',
        0,
        0,
        undefined,
      );
      fillText.mockRestore();
    });

    it('ignores legacy visual props when types are bypassed', async () => {
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(text({
        style: { text: 'style only', fill: 'black' },
        text: 'legacy',
        x: 80,
        y: 90,
        fillStyle: 'red',
      } as never));

      expect(fillText).toHaveBeenCalledExactlyOnceWith(
        'style only',
        0,
        0,
        undefined,
      );
      fillText.mockRestore();
    });
  });
});

function useFixedWidthTextMetrics() {
  return vi
    .spyOn(CanvasRenderingContext2D.prototype, 'measureText')
    .mockImplementation(value => ({
      width: value.length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: value.length * 10,
    }) as TextMetrics);
}
