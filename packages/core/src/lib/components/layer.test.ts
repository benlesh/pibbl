import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import { crcState } from '../hooks/crc-state';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { g } from './g';
import { layer } from './layer';
import { rect, type RectProps } from './rect';
import { text } from './text';

describe('layer', () => {
  interface MyComponentProps {
    onRender: () => void;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fillStyle?: string;
  }

  const MyComponent = ({ onRender, x = 0, y = 0, width = 100, height = 100, fillStyle = 'blue' }: MyComponentProps) => {
    const [counter, setCounter] = crcState(0);
    onRender();
    return rect({
      x,
      y,
      width,
      height,
      fillStyle,
      onClick: () => setCounter(counter + 1),
    });
  };

  const myComponent = defineComp(MyComponent);

  it('renders basic content to offscreen canvas', async () => {
    await componentTest(layer({
      render: myComponent({
        onRender: () => {},
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      }),
    }));
    await takeScreenshot(page);
  });

  it('respects custom dimensions', async () => {
    await componentTest(layer({
      width: 200,
      height: 150,
      render: rect({
        x: 0,
        y: 0,
        width: 200,
        height: 150,
        fillStyle: 'green',
      }),
    }));
    await takeScreenshot(page);
  });

  describe('render optimization', () => {
    it('optimizes renders compared to non-layered components', async () => {
      let normalRenderCount = 0;
      let layeredRenderCount = 0;

      const NORMAL_RECT_CENTER = { x: 50, y: 50 };
      const LAYERED_RECT_CENTER = { x: 150, y: 50 };

      const _canvas = await componentTest(g({
        children: [
          // Non-layered component
          myComponent({
            onRender: () => normalRenderCount++,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fillStyle: 'blue',
          }),
          // Same component inside a layer
          layer({
            render: myComponent({
              onRender: () => layeredRenderCount++,
              x: 100,
              y: 0,
              width: 100,
              height: 100,
              fillStyle: 'red',
            }),
          }),
        ],
      }));

      // Initial render count should be 1 for each
      expect(normalRenderCount).toBe(1);
      expect(layeredRenderCount).toBe(1);

      await _canvas.click({ position: NORMAL_RECT_CENTER });
      // Non-layered component should re-render, layered should not
      expect(normalRenderCount).toBe(2);
      expect(layeredRenderCount).toBe(1);

      await _canvas.click({ position: LAYERED_RECT_CENTER });
      // Non-layered component should re-render again, layered still should not
      expect(normalRenderCount).toBe(3);
      expect(layeredRenderCount).toBe(2);
    });

    it.skip('only re-renders when props change', async () => {
      let renderCount = 0;
      const countedRect = defineComp((props: RectProps) => {
        renderCount++;
        return rect(props);
      });

      const wrapperComponent = defineComp(() => {
        const [fillStyle, setFillStyle] = crcState('blue');
        const [layerWidth, setLayerWidth] = crcState(200);

        return g({
          children: [
            rect({
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fillStyle: 'green',
              onClick: () => {
                setFillStyle('red');
                setLayerWidth(300);
              },
            }),
            layer({
              width: layerWidth,
              render: countedRect({
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                fillStyle,
              }),
            }),
          ],
        });
      });

      const canvas = await componentTest(wrapperComponent({}));
      // Click to trigger state changes
      await canvas.click({ position: { x: 100, y: 100 } });

      // Should re-render due to prop changes from state updates
      expect(renderCount).toBe(2);
    });

    it.skip('re-renders when dimensions change', async () => {
      let renderCount = 0;

      const _canvas = await componentTest(layer({
        width: 200,
        height: 200,
        render: myComponent({
          onRender: () => renderCount++,
          width: 200,
          height: 200,
        }),
      }));
      expect(renderCount).toBe(1);

      // Click to trigger potential re-render
      await _canvas.click({ position: { x: 100, y: 100 } });
      expect(renderCount).toBe(1);

      // Change dimensions
      await componentTest(layer({
        width: 300,
        height: 300,
        render: myComponent({
          onRender: () => renderCount++,
          width: 300,
          height: 300,
        }),
      }));

      expect(renderCount).toBe(2);
    });
  });

  describe('complex rendering', () => {
    it('handles nested components', async () => {
      await componentTest(layer({
        render: g({
          x: 100,
          y: 100,
          children: [
            rect({
              x: 0,
              y: 0,
              width: 50,
              height: 50,
              fillStyle: 'purple',
            }),
            text({
              x: 10,
              y: 30,
              text: 'Layered!',
              fillStyle: 'white',
            }),
          ],
        }),
      }));
      await takeScreenshot(page);
    });

    it('handles multiple layers', async () => {
      await componentTest(g({
        children: [
          // Background layer
          layer({
            render: rect({
              x: 0,
              y: 0,
              width: 300,
              height: 200,
              fillStyle: 'lightblue',
            }),
          }),
          // Content layer
          layer({
            render: g({
              x: 50,
              y: 50,
              children: [
                rect({
                  x: 0,
                  y: 0,
                  width: 100,
                  height: 100,
                  fillStyle: 'rgba(255, 0, 0, 0.5)',
                }),
                text({
                  x: 20,
                  y: 50,
                  text: 'Multiple Layers',
                  fillStyle: 'white',
                }),
              ],
            }),
          }),
          // Overlay layer
          layer({
            render: rect({
              x: 100,
              y: 100,
              width: 50,
              height: 50,
              fillStyle: 'rgba(0, 255, 0, 0.5)',
            }),
          }),
        ],
      }));
      await takeScreenshot(page);
    });
  });

  describe('interaction behavior', () => {
    it('handles mouse events through layers', async () => {
      const onClick = vi.fn();
      const BLUE_RECT_CENTER = { x: 75, y: 75 };
      const EMPTY_SPACE_POSITION = { x: 25, y: 25 };

      const canvas = await componentTest(layer({
        render: rect({
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          fillStyle: 'blue',
          onClick,
        }),
      }));

      await canvas.click({ position: BLUE_RECT_CENTER });
      expect(onClick).toHaveBeenCalledTimes(1);

      await canvas.click({ position: EMPTY_SPACE_POSITION });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.skip('handles events with multiple layers', async () => {
      const onClickTop = vi.fn();
      const onClickBottom = vi.fn();
      const RED_RECT_CENTER = { x: 75, y: 75 };
      const BLUE_RECT_EXCLUSIVE_AREA = { x: 25, y: 25 };

      const canvas = await componentTest(g({
        children: [
          // Bottom layer
          layer({
            render: rect({
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fillStyle: 'blue',
              onClick: onClickBottom,
            }),
          }),
          // Top layer
          layer({
            render: rect({
              x: 50,
              y: 50,
              width: 100,
              height: 100,
              fillStyle: 'red',
              onClick: onClickTop,
            }),
          }),
        ],
      }));

      await canvas.click({ position: RED_RECT_CENTER });
      expect(onClickTop).toHaveBeenCalledTimes(1);
      expect(onClickBottom).not.toHaveBeenCalled();

      await canvas.click({ position: BLUE_RECT_EXCLUSIVE_AREA });
      expect(onClickTop).toHaveBeenCalledTimes(1);
      expect(onClickBottom).toHaveBeenCalledTimes(1);
    });
  });
});
