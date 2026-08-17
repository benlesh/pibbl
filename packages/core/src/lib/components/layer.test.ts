import type { RectProps } from './rect';
import type { RectStyle } from '../style/types';
import type { SystemStyle } from '../types';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import { crcCursor } from '../hooks/crc-cursor';
import { crcEvent } from '../hooks/crc-event';
import { crcState } from '../hooks/crc-state';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { clip } from './clip';
import { g } from './g';
import { layer } from './layer';
import { rect } from './rect';
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
      style: {
        x,
        y,
        width,
        height,
        fill: fillStyle,
      },
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
        style: {
          x: 0,
          y: 0,
          width: 200,
          height: 150,
          fill: 'green',
        },
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

    it('only re-renders when props change', async () => {
      let renderCount = 0;
      const countedRect = defineComp<RectProps, RectStyle>((props, style) => {
        renderCount++;
        return rect({
          ...props,
          style,
        });
      });

      const wrapperComponent = defineComp(() => {
        const [fillStyle, setFillStyle] = crcState('blue');
        const [layerWidth, setLayerWidth] = crcState(200);

        return g({
          children: [
            rect({
              style: {
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                fill: 'green',
              },
              onClick: () => {
                setFillStyle('red');
                setLayerWidth(300);
              },
            }),
            layer({
              width: layerWidth,
              render: countedRect({
                style: {
                  x: 0,
                  y: 0,
                  width: 200,
                  height: 200,
                  fill: fillStyle,
                },
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

    it('re-renders when only the root element style changes', async () => {
      let renderCount = 0;
      const renderProps = { onRender: () => renderCount++ };
      interface CountedRectStyle extends SystemStyle {
        version: number;
      }
      const countedRect = defineComp<
        typeof renderProps,
        CountedRectStyle
      >(({ onRender }) => {
        onRender();
        return rect({
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'blue',
          },
        });
      });
      const wrapperComponent = defineComp(() => {
        const [styleVersion, setStyleVersion] = crcState(1);
        return g({
          children: [
            rect({
              style: {
                x: 100,
                y: 0,
                width: 100,
                height: 100,
                fill: 'green',
              },
              onClick: () => setStyleVersion(2),
            }),
            layer({
              render: countedRect({
                ...renderProps,
                style: { version: styleVersion },
              }),
            }),
          ],
        });
      });

      const canvas = await componentTest(wrapperComponent({}));
      expect(renderCount).toBe(1);

      await canvas.click({ position: { x: 150, y: 50 } });

      expect(renderCount).toBe(2);
    });

    it('re-renders when dimensions change on the same mount', async () => {
      let renderCount = 0;
      const onRender = () => renderCount++;
      const wrapperComponent = defineComp(() => {
        const [size, setSize] = crcState(100);
        return g({ children: [
          rect({
            style: {
              x: 0,
              y: 0,
              width: 300,
              height: 300,
              fill: 'green',
            },
            onClick: () => setSize(200),
          }),
          layer({
            width: size,
            height: size,
            render: myComponent({
              onRender,
              width: size,
              height: size,
            }),
          }),
        ] });
      });

      const canvas = await componentTest(wrapperComponent({}));
      expect(renderCount).toBe(1);

      await canvas.click({ position: { x: 250, y: 250 } });

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
              style: {
                x: 0,
                y: 0,
                width: 50,
                height: 50,
                fill: 'purple',
              },
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
              style: {
                x: 0,
                y: 0,
                width: 300,
                height: 200,
                fill: 'lightblue',
              },
            }),
          }),
          // Content layer
          layer({
            render: g({
              x: 50,
              y: 50,
              children: [
                rect({
                  style: {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    fill: 'rgba(255, 0, 0, 0.5)',
                  },
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
              style: {
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                fill: 'rgba(0, 255, 0, 0.5)',
              },
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
          style: {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            fill: 'blue',
          },
          onClick,
        }),
      }));

      await canvas.click({ position: BLUE_RECT_CENTER });
      expect(onClick).toHaveBeenCalledTimes(1);

      await canvas.click({ position: EMPTY_SPACE_POSITION });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('handles events with multiple layers', async () => {
      const onClickTop = vi.fn();
      const onClickBottom = vi.fn();
      const RED_RECT_CENTER = { x: 75, y: 75 };
      const BLUE_RECT_EXCLUSIVE_AREA = { x: 25, y: 25 };

      const canvas = await componentTest(g({
        children: [
          // Bottom layer
          layer({
            render: rect({
              style: {
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                fill: 'blue',
              },
              onClick: onClickBottom,
            }),
          }),
          // Top layer
          layer({
            render: rect({
              style: {
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                fill: 'red',
              },
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

    it('lets root content painted after a layer win the global target', async () => {
      const onClickLayer = vi.fn();
      const onClickRoot = vi.fn();
      const canvas = await componentTest(g({
        children: [
          layer({
            render: rect({
              style: {
                x: 40,
                y: 40,
                width: 120,
                height: 120,
                fill: 'orange',
              },
              onClick: onClickLayer,
            }),
          }),
          rect({
            style: {
              x: 70,
              y: 70,
              width: 60,
              height: 60,
              fill: 'purple',
            },
            onClick: onClickRoot,
          }),
        ],
      }));

      await canvas.click({ position: { x: 100, y: 100 } });
      expect(onClickRoot).toHaveBeenCalledOnce();
      expect(onClickLayer).not.toHaveBeenCalled();
    });

    it('composes the parent transform into layer hit testing', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(g({
        x: 120,
        y: 50,
        scaleX: 1.5,
        children: [
          layer({
            width: 80,
            height: 80,
            render: rect({
              style: {
                x: 0,
                y: 0,
                width: 60,
                height: 60,
                fill: 'teal',
              },
              onClick,
            }),
          }),
        ],
      }));

      await canvas.click({ position: { x: 225, y: 80 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 30, y: 30 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('clips interaction to the offscreen layer dimensions', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(layer({
        width: 50,
        height: 50,
        render: rect({
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'blue',
          },
          onClick,
        }),
      }));

      await canvas.click({ position: { x: 25, y: 25 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 75, y: 25 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('recursively resolves transformed nested layers', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(layer({
        width: 200,
        height: 150,
        render: g({
          x: 60,
          y: 30,
          children: [
            layer({
              width: 80,
              height: 80,
              render: rect({
                style: {
                  x: 0,
                  y: 0,
                  width: 60,
                  height: 60,
                  fill: 'green',
                },
                onClick,
              }),
            }),
          ],
        }),
      }));

      await canvas.click({ position: { x: 90, y: 60 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 30, y: 30 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('applies parent clips to layered interaction geometry', async () => {
      const clipPath = new Path2D();
      clipPath.rect(50, 50, 80, 80);
      const onClick = vi.fn();
      const canvas = await componentTest(clip({
        path: clipPath,
        children: [
          layer({
            render: rect({
              style: {
                x: 0,
                y: 0,
                width: 180,
                height: 180,
                fill: 'red',
              },
              onClick,
            }),
          }),
        ],
      }));

      await canvas.click({ position: { x: 80, y: 80 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 25, y: 25 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('shares transitions, cursor targeting, and observer order with the root', async () => {
      const calls: string[] = [];
      const LayerTarget = defineComp(() => {
        crcEvent('mousemove', () => calls.push('observer'));
        return rect({
          style: {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            fill: 'orange',
            cursor: 'pointer',
          },
          onMouseOver: () => calls.push('layer-over'),
          onMouseOut: () => calls.push('layer-out'),
          onMouseMove: () => calls.push('layer-move'),
        });
      });
      const canvas = await componentTest(g({
        children: [
          rect({
            style: {
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fill: 'blue',
              cursor: 'crosshair',
            },
            onMouseOver: () => calls.push('root-over'),
            onMouseMove: () => calls.push('root-move'),
          }),
          layer({ render: LayerTarget({}) }),
        ],
      }));

      await canvas.mouseMove({ position: { x: 100, y: 100 } });
      expect(calls).toEqual(['layer-over', 'layer-move', 'observer']);
      expect(canvas.element.style.cursor).toBe('pointer');

      await canvas.mouseMove({ position: { x: 20, y: 20 } });
      expect(calls).toEqual([
        'layer-over',
        'layer-move',
        'observer',
        'layer-out',
        'root-over',
        'root-move',
        'observer',
      ]);
      expect(canvas.element.style.cursor).toBe('crosshair');
    });

    it('roots a pathless layer cursor as the Canvas fallback', async () => {
      const LayerDefaultCursor = defineComp(() => {
        crcCursor({ style: 'wait' });
        return rect({
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'gray',
          },
        });
      });
      const canvas = await componentTest(layer({
        render: LayerDefaultCursor({}),
      }));

      await canvas.mouseMove({ position: { x: 50, y: 50 } });
      expect(canvas.element.style.cursor).toBe('wait');
    });
  });
});
