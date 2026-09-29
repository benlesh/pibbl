import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { crc } from '../crc.js';
import { createElement } from '../element/create-element.js';
import { Flow } from '../layout/flow.js';
import { measureElement } from '../layout/measure.js';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { Group } from './g.js';
import { Rectangle } from './rect.js';
import { Text } from './text';
import { signal } from '../signals/graph.js';

const defaultText = 'Hello World';
const defaultStyle = {
  left: 50,
  top: 50,
  fill: 'black',
  stroke: 'red',
  strokeWidth: 2,
  font: '24px Arial',
};

describe('text', () => {
  it('renders and updates a direct signal child', async () => {
    const label = signal('Current');
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = crc(canvas, createElement(Text, {
      children: label as never,
      style: { fill: 'black' },
    }));

    try {
      await nextFrame();
      label.set('Updated');
      await nextFrame();

      expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        'Current',
        'Updated',
      ]);
    } finally {
      controller.dispose();
      fillText.mockRestore();
    }
  });

  it('rematerializes a mutated recursive container on a later render', async () => {
    const children: Array<string> = ['first'];
    const element = createElement(Text, {
      children,
      style: { fill: 'black' },
    });
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = crc(canvas, element);

    try {
      await nextFrame();
      children[0] = 'second';
      crc(canvas, element);
      await nextFrame();

      expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        'first',
        'second',
      ]);
    } finally {
      controller.dispose();
      fillText.mockRestore();
    }
  });

  it('materializes a shared mutable container separately for each receiver', () => {
    const children: Array<string> = ['first'];
    const first = createElement(Text, { children });
    const second = createElement(Text, { children });
    const measuredValues: string[] = [];
    const service = measurementService(measuredValues);

    measureElement(first, measurementConstraints, service);
    children[0] = 'second';
    measureElement(second, measurementConstraints, service);

    expect(measuredValues).toEqual(['first', 'second']);
  });

  it('revalidates mutated content after a prior successful measurement', () => {
    const children: Array<unknown> = ['valid'];
    const element = createElement(Text, { children: children as never });
    measureElement(element, measurementConstraints, measurementService([]));

    children.push(createElement(Rectangle, {
      style: { width: 10, height: 10 },
    }));

    expect(() => measureElement(
      element,
      measurementConstraints,
      measurementService([]),
    )).toThrowError(
      'Text received a CRC element inside textual content as a CRC child.',
    );
  });

  it('materializes one-shot children once for layout measurement and paint', async () => {
    let iterableReads = 0;
    function* oneShotContent() {
      iterableReads++;
      yield ' iterable ';
      yield -2;
    }
    const children = [
      '  leading ',
      0,
      [false, true, null, undefined, 'nested'],
      oneShotContent(),
      ' trailing  ',
    ] as const;
    const element = createElement(Text, {
      children,
      style: { fill: 'black' },
    });
    const measuredValues: string[] = [];
    const expected = '  leading 0nested iterable -2 trailing  ';
    const measureText = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'measureText')
      .mockImplementation(value => {
        measuredValues.push(value);
        return fixedMetrics(value);
      });
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

    try {
      const canvas = await componentTest(createElement(Flow, {
        style: { width: 500, height: 100 },
        children: [element],
      }), { width: 500, height: 100 });

      expect(iterableReads).toBe(1);
      expect(measuredValues).toEqual([expected, expected]);
      expect(fillText).toHaveBeenCalledExactlyOnceWith(
        expected,
        0,
        0,
        undefined,
      );
      canvas.dispose();
    } finally {
      measureText.mockRestore();
      fillText.mockRestore();
    }
  });

  it('materializes a reused descriptor once per layout sibling occurrence', async () => {
    let iterableReads = 0;
    const children = {
      *[Symbol.iterator]() {
        iterableReads++;
        yield `value-${iterableReads}`;
      },
    };
    const element = createElement(Text, {
      children,
      style: { fill: 'black' },
    });
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

    try {
      const canvas = await componentTest(createElement(Flow, {
        style: { width: 500, height: 100 },
        children: [element, element],
      }), { width: 500, height: 100 });

      expect(iterableReads).toBe(2);
      expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        'value-1',
        'value-2',
      ]);
      canvas.dispose();
    } finally {
      fillText.mockRestore();
    }
  });

  it('validates a reused descriptor separately at each layout occurrence', () => {
    let iterableReads = 0;
    const children = {
      *[Symbol.iterator]() {
        iterableReads++;
        yield iterableReads === 1 ? 'valid' : createElement(Rectangle, {
          style: { width: 10, height: 10 },
        });
      },
    };
    const element = createElement(Text, {
      children: children as never,
      style: { fill: 'black' },
    });
    const scene = createElement(Flow, {
      style: { width: 500, height: 100 },
      children: [element, element],
    });
    let pendingFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        pendingFrame = callback;
        return 1;
      });
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = crc(canvas, scene);

    try {
      expect(() => pendingFrame?.(0)).toThrowError(
        'Text received a CRC element inside textual content as a CRC child.',
      );
      expect(iterableReads).toBe(2);
    } finally {
      controller.dispose();
      requestAnimationFrame.mockRestore();
    }
  });

  it('materializes a reused descriptor separately for direct sibling paints', async () => {
    let iterableReads = 0;
    const children = {
      *[Symbol.iterator]() {
        iterableReads++;
        yield `value-${iterableReads}`;
      },
    };
    const element = createElement(Text, {
      children,
      style: { fill: 'black' },
    });
    const scene = createElement(Group, null, [element, element]);
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = crc(canvas, scene);

    try {
      await nextFrame();
      expect(iterableReads).toBe(2);
      expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        'value-1',
        'value-2',
      ]);
    } finally {
      controller.dispose();
      fillText.mockRestore();
    }
  });

  it('applies alpha zero while drawing', async () => {
    const observedAlpha: number[] = [];
    const fillText = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'fillText')
      .mockImplementation(function (this: CanvasRenderingContext2D) {
        observedAlpha.push(this.globalAlpha);
      });

    await componentTest(createElement(Text, {
      style: {
        ...defaultStyle,
        stroke: undefined,
        opacity: 0,
      },
    }, defaultText));

    expect(observedAlpha).toEqual([0]);
    fillText.mockRestore();
  });

  it('renders text in browser', async () => {
    await componentTest(createElement(Text, { style: defaultStyle }, defaultText));
    await takeScreenshot(page);
  });

  describe('mouse events', () => {
    const { left: x, top: y } = defaultStyle;
    // We need to measure text to get accurate dimensions for hit testing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = defaultStyle.font;
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(defaultText);

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

        const canvas = await componentTest(createElement(Text, {
          style: defaultStyle,
          [handler]: handlerFn,
        }, defaultText));

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
        const canvas = await componentTest(createElement(Text, {
          style: {
            ...defaultStyle,
            cursor: 'pointer',
          },
        }, defaultText));

        await canvas.mouseMove({ position: { x: 0, y: 0 } });
        expect(getComputedStyle(canvas.element).cursor).not.toBe('pointer');
        await canvas.mouseMove({ position: { x: centerX, y: centerY } });
        expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
      });

      it('should handle mouse over and out events for text with a stroke', async () => {
        const onMouseOver = vi.fn();
        const onMouseOut = vi.fn();

        const canvas = await componentTest(createElement(Text, {
          style: defaultStyle,
          onMouseOver,
          onMouseOut,
        }, defaultText));

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

        const canvas = await componentTest(createElement(Text, {
          style: {
            ...defaultStyle,
            strokeWidth: 0,
          },
          onMouseOver,
          onMouseOut,
        }, defaultText));

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

      await componentTest(createElement(Text, {
        style: {
          left: 10,
          top: 20,
          fill: 'black',
          width: 55,
          fit: 'ellipsis',
        },
      }, 'abcdefghij'));

      expect(fillText).toHaveBeenCalledExactlyOnceWith('ab...', 0, 0, undefined);
      measureText.mockRestore();
      fillText.mockRestore();
    });

    it('ellipsizes the exact final visible wrapped line at maxHeight', async () => {
      const measureText = useFixedWidthTextMetrics();
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(createElement(Text, {
        style: {
          left: 10,
          top: 30,
          fill: 'black',
          width: 75,
          height: 40,
          wrap: true,
          lineHeight: 20,
          fit: 'ellipsis',
        },
      }, 'one two three four'));

      expect(fillText.mock.calls).toEqual([
        ['one two', 0, 0, undefined],
        ['thre...', 0, 20, undefined],
      ]);
      measureText.mockRestore();
      fillText.mockRestore();
    });

    it('passes maxWidth as the Canvas squish argument', async () => {
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(createElement(Text, {
        style: {
          left: 7,
          top: 9,
          fill: 'black',
          width: 42,
          fit: 'squish',
        },
      }, 'wide'));

      expect(fillText).toHaveBeenCalledExactlyOnceWith('wide', 0, 0, 42);
      fillText.mockRestore();
    });

    it('uses the exact aligned clip rectangle without moving the text anchor', async () => {
      const rect = vi.spyOn(Path2D.prototype, 'rect');
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(createElement(Text, {
        style: {
          left: 100,
          top: 80,
          fill: 'black',
          width: 60,
          height: 40,
          fit: 'clip',
          textAlign: 'center',
          textBaseline: 'middle',
        },
      }, 'clip me'));

      expect(rect).toHaveBeenCalledExactlyOnceWith(-30, -20, 60, 40);
      expect(fillText).toHaveBeenCalledExactlyOnceWith(
        'clip me',
        0,
        0,
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

      await componentTest(createElement(Text, {
        style: {
          left: 10,
          top: 20,
          fill: 'black',
          font: '20px Arial',
          width: 82,
          wrap: true,
          lineHeight: 24,
        },
      }, 'one two three'));

      expect(calls).toEqual([
        ['one two', 0, 0],
        ['three', 0, 24],
      ]);
      fillText.mockRestore();
    });

    it('clips with a finite canvas height when maxHeight is omitted', async () => {
      const clip = vi.spyOn(CanvasRenderingContext2D.prototype, 'clip');
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(createElement(Text, {
        style: {
          left: 10,
          top: 20,
          fill: 'black',
          width: 60,
          fit: 'clip',
        },
      }, 'clipped text'));

      expect(clip).toHaveBeenCalledOnce();
      expect(fillText).toHaveBeenCalledOnce();
      clip.mockRestore();
      fillText.mockRestore();
    });

    it('hits centered middle-baseline text at its painted bounds', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Text, {
        style: {
          left: 200,
          top: 100,
          fill: 'black',
          font: '24px Arial',
          textAlign: 'center',
          textBaseline: 'middle',
        },
        onClick,
      }, 'Centered'));

      await canvas.click({ position: { x: 200, y: 100 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 270, y: 100 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('shrinks squished text interaction bounds with the painted glyphs', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Text, {
        style: {
          left: 20,
          top: 40,
          fill: 'black',
          font: '24px Arial',
          width: 60,
          fit: 'squish',
        },
        onClick,
      }, 'A very wide label'));

      await canvas.click({ position: { x: 50, y: 50 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 100, y: 50 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('clips handlers and cursor to the visible text portion', async () => {
      const measureText = useFixedWidthTextMetrics();
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Text, {
        style: {
          left: 20,
          top: 20,
          width: 40,
          height: 20,
          fit: 'clip',
          fill: 'black',
          cursor: 'pointer',
        },
        onClick,
      }, 'abcdefghij'));

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
      await componentTest(createElement(Text, {
        style: {
          ...defaultStyle,
          width: 100,
          fit: 'ellipsis',
        },
      }, 'This is a very long text that should be truncated'));
      await takeScreenshot(page);
    });

    it('should handle word wrap', async () => {
      await componentTest(createElement(Text, {
        style: {
          ...defaultStyle,
          width: 100,
          wrap: true,
          lineHeight: 24,
        },
      }, 'This text should wrap to multiple lines'));
      await takeScreenshot(page);
    });

    it('defaults omitted x and y to the zero origin', async () => {
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

      await componentTest(createElement(Text, { style: { fill: 'black' } }, 'origin'));

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

      await componentTest(createElement(Text, {
        style: { text: 'style only', fill: 'black' },
        text: 'legacy',
        x: 80,
        y: 90,
        fillStyle: 'red',
      } as never, 'children only'));

      expect(fillText).toHaveBeenCalledExactlyOnceWith(
        'children only',
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

function fixedMetrics(value: string): TextMetrics {
  return {
    width: value.length * 10,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: value.length * 10,
  } as TextMetrics;
}

const measurementConstraints = {
  minWidth: 0,
  maxWidth: 500,
  minHeight: 0,
  maxHeight: 100,
};

function measurementService(values: string[]) {
  return {
    measureText(value: string) {
      values.push(value);
      return fixedMetrics(value);
    },
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
