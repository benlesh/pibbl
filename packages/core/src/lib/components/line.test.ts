import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { Group } from './g';
import { Line, type LineStyle } from './line';
import { createElement } from '../element/create-element';
import { LayoutDiagnostic } from '../style/diagnostics';

// Default test configuration for a diagonal line
const defaultStyle = {
  coords: [[50, 50], [150, 150]], // diagonal line from (50,50) to (150,150)
  stroke: 'black',
  strokeWidth: 1,
} satisfies LineStyle;

describe('line', () => {
  describe('basic rendering', () => {
    it('leaves empty and move-only paths unpainted', async () => {
      const canvas = await componentTest(createElement(Group, { children: [
        createElement(Line, { style: { coords: [], stroke: 'red', strokeWidth: 10 } }),
        createElement(Line, { style: { coords: [[20, 20]], stroke: 'blue', strokeWidth: 10 } }),
      ] }));
      const pixels = canvas.element
        .getContext('2d')!
        .getImageData(0, 0, 40, 40)
        .data;

      expect(pixels.some((value, index) => index % 4 === 3 && value > 0))
        .toBe(false);
    });

    it('renders a simple line', async () => {
      await componentTest(createElement(Line, { style: defaultStyle }));
      await takeScreenshot(page);
    });

    // Tests different line styles and configurations
    it('renders lines with different styles', async () => {
      await componentTest(createElement(Group, { children: [
        // Red line with increased width
        createElement(Line, {
          style: {
            ...defaultStyle,
            stroke: 'red',
            strokeWidth: 2,
          },
        }),
        // Blue line offset to the right
        createElement(Line, {
          style: {
            ...defaultStyle,
            coords: [[200, 50], [300, 150]],
            stroke: 'blue',
            strokeWidth: 4,
          },
        }),
        // Green line with large interaction area
        createElement(Line, {
          style: {
            ...defaultStyle,
            coords: [[50, 150], [150, 250]],
            stroke: 'green',
            strokeWidth: 6,
            lineInteractionWidth: 20, // Creates a wider area for mouse interactions
          },
        }),
      ] }));
      await takeScreenshot(page);
    });

    // Demonstrates complex line rendering capabilities
    it('renders a multi-point line, like a sine wave', async () => {
      await componentTest(createElement(Line, {
        style: {
          ...defaultStyle,
          stroke: 'lime',
          strokeWidth: 3,
          // Generate 100 points following a sine wave pattern
          coords: Array.from(
            { length: 100 },
            (_, i): [number, number] => [i * 4, Math.sin(i * 0.1) * 100 + 150],
          ),
        },
      }));
      await takeScreenshot(page);
    });
  });

  // Tests mouse interactions without expanded hit area
  it('properly handles mouse click-type events without lineInteractionWidth', async () => {
    const onClick = vi.fn();
    const onDblClick = vi.fn();
    const onContextMenu = vi.fn();

    const canvas = await componentTest(createElement(Line, {
      style: defaultStyle,
      onClick,
      onDblClick,
      onContextMenu,
    }));

    await canvas.click({ position: { x: 100, y: 100 } });
    expect(onClick).toHaveBeenCalledTimes(1);

    await canvas.dblClick({ position: { x: 100, y: 100 } });
    expect(onDblClick).toHaveBeenCalledTimes(1);

    await canvas.click({ position: { x: 100, y: 100 }, button: 'right' });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  // Tests mouse interactions with expanded hit area
  it('properly handles mouse click-type events with lineInteractionWidth', async () => {
    const onClick = vi.fn();
    const onDblClick = vi.fn();
    const onContextMenu = vi.fn();

    const canvas = await componentTest(createElement(Line, {
      style: {
        ...defaultStyle,
        lineInteractionWidth: 20,
      },
      onClick,
      onDblClick,
      onContextMenu,
    }));

    await canvas.click({ position: { x: 100, y: 110 } });
    expect(onClick).toHaveBeenCalledTimes(1);

    await canvas.dblClick({ position: { x: 100, y: 110 } });
    expect(onDblClick).toHaveBeenCalledTimes(1);

    await canvas.click({ position: { x: 100, y: 110 }, button: 'right' });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  // Tests hover behavior with precise hit detection
  it('properly handles mouse movement interactions without lineInteractionWidth', async () => {
    const onMouseOver = vi.fn();
    const onMouseOut = vi.fn();
    const onMouseMove = vi.fn();

    const canvas = await componentTest(createElement(Line, {
      style: defaultStyle,
      onMouseOver,
      onMouseOut,
      onMouseMove,
    }));

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).not.toHaveBeenCalled();
    expect(onMouseOver).not.toHaveBeenCalled();
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 100, y: 100 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).toHaveBeenCalledTimes(1);
  });

  // Tests hover behavior with expanded hit area
  it('properly handles mouse movement interactions with lineInteractionWidth', async () => {
    const onMouseOver = vi.fn();
    const onMouseOut = vi.fn();
    const onMouseMove = vi.fn();

    const canvas = await componentTest(createElement(Line, {
      style: {
        ...defaultStyle,
        lineInteractionWidth: 20,
      },
      onMouseOver,
      onMouseOut,
      onMouseMove,
    }));

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).not.toHaveBeenCalled();
    expect(onMouseOver).not.toHaveBeenCalled();
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 105, y: 95 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).toHaveBeenCalledTimes(1);
  });

  it('keeps an opacity-zero stroke interactive without painting it', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Line, {
      style: {
        coords: [[50, 50], [150, 150]],
        stroke: 'red',
        strokeWidth: 10,
        opacity: 0,
        lineInteractionWidth: 10,
        cursor: 'pointer',
      },
      onClick,
    }));

    const pixels = canvas.element
      .getContext('2d')!
      .getImageData(0, 0, 200, 200)
      .data;
    expect(pixels.some((value, index) => index % 4 === 3 && value > 0))
      .toBe(false);

    await canvas.click({ position: { x: 100, y: 100 } });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(canvas.element.style.cursor).toBe('pointer');
  });

  it('does not paint an injected fill for a closed line', async () => {
    const canvas = await componentTest(createElement(Line, {
      style: {
        coords: [[40, 40], [160, 40], [100, 160], [40, 40]],
        fill: 'red',
      },
    } as any));

    const interior = canvas.element
      .getContext('2d')!
      .getImageData(100, 80, 1, 1)
      .data;
    expect([...interior]).toEqual([0, 0, 0, 0]);
  });

  it('does not create fill interaction from an injected line style key', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Line, {
      style: {
        coords: [[40, 40], [160, 40], [100, 160], [40, 40]],
        fill: 'red',
      },
      onClick,
    } as any));

    await canvas.click({ position: { x: 100, y: 80 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reports indexed non-finite coordinates as contextual diagnostics and accepts a later valid render', () => {
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
      controller = crc(canvas, createElement(Line, {
        style: { coords: [[0, 0], [Number.NaN, 1]] },
      }));
      let failure: unknown;
      try {
        pending?.(0);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(LayoutDiagnostic);
      expect(failure).toMatchObject({
        message: expect.stringMatching(/Line: property coords\[1\]\[0\]/),
      });

      controller = crc(canvas, createElement(Line, {
        style: { coords: [[0, 0], [20, 0]], stroke: 'black', strokeWidth: 4 },
      }));
      expect(() => pending?.(0)).not.toThrow();
      expect(pixel(canvas, 10, 1)[3]).toBeGreaterThan(0);
    } finally {
      controller?.dispose();
      canvas.remove();
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});

function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}
