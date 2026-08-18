import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { g } from './g';
import { rect } from './rect';
import { text } from './text';

describe('g', () => {
  const defaultRectStyle = {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    fill: 'blue',
  };

  it('uses style as the sole transform authority in the documented order', async () => {
    const transforms: DOMMatrix[] = [];
    const TransformProbe = defineComp((_props: {}, _style, ctx) => {
      transforms.push(ctx.getTransform());
    });
    const style = {
      scaleX: 2,
      scaleY: 3,
      rotationDegrees: 30,
      rotationOrigin: [4, 5] as [number, number],
      translateX: 7,
      translateY: 11,
      skewX: 13,
      skewY: 17,
    };
    const legacyInput = {
      style,
      x: 1000,
      y: 2000,
      rotate: 180,
      rotateOrigin: [50, 60],
      children: [TransformProbe({})],
    } as any;

    await componentTest(g(legacyInput));

    const expected = new DOMMatrix()
      .scale(style.scaleX, style.scaleY)
      .translate(...style.rotationOrigin)
      .rotate(style.rotationDegrees)
      .translate(-style.rotationOrigin[0], -style.rotationOrigin[1])
      .translate(style.translateX, style.translateY)
      .skewX(style.skewX)
      .skewY(style.skewY);
    expect(Array.from(transforms[0].toFloat32Array()))
      .toEqual(Array.from(expected.toFloat32Array()));
  });

  it('supports zero and negative scales without leaking transforms', async () => {
    const scales: number[] = [];
    const TransformProbe = defineComp((_props: {}, _style, ctx) => {
      scales.push(ctx.getTransform().a);
    });

    await componentTest(g({ children: [
      g({
        style: {
          scaleX: 0
        },
        children: [TransformProbe({})]
      }),
      g({
        style: {
          scaleX: -1
        },
        children: [TransformProbe({})]
      }),
      TransformProbe({}),
    ] }));

    expect(scales).toEqual([0, -1, 1]);
  });

  it('renders children without transformation', async () => {
    await componentTest(g({
      children: [
        rect({ style: defaultRectStyle }),
      ],
    }));
    await takeScreenshot(page);
  });

  it('translates children', async () => {
    await componentTest(g({
      style: {
        translateX: 100,
        translateY: 50
      },
      children: [rect({
        style: defaultRectStyle
      })]
    }));
    await takeScreenshot(page);
  });

  describe('scaling', () => {
    it('scales uniformly', async () => {
      await componentTest(g({
        style: {
          scaleX: 2,
          scaleY: 2
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });

    it('scales non-uniformly', async () => {
      await componentTest(g({
        style: {
          scaleX: 2,
          scaleY: 0.5
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });
  });

  describe('rotation', () => {
    it('rotates around origin', async () => {
      await componentTest(g({
        style: {
          rotationDegrees: 45
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });

    it('rotates around specified point', async () => {
      await componentTest(g({
        style: {
          rotationDegrees: 90,
          rotationOrigin: [25, 25]
        },
        // center of rect
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });
  });

  describe('skewing', () => {
    it('skews on X axis', async () => {
      await componentTest(g({
        style: {
          skewX: 30
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });

    it('skews on Y axis', async () => {
      await componentTest(g({
        style: {
          skewY: 30
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });

    it('skews on both axes', async () => {
      await componentTest(g({
        style: {
          skewX: 30,
          skewY: 30
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });
  });

  describe('compound transformations', () => {
    it('combines multiple transformations in correct order', async () => {
      await componentTest(g({
        style: {
          translateX: 100,
          translateY: 100,
          rotationDegrees: 45,
          scaleX: 2,
          scaleY: 1.5
        },
        children: [rect({
          style: defaultRectStyle
        })]
      }));
      await takeScreenshot(page);
    });

    it('handles nested groups with transformations', async () => {
      await componentTest(g({
        style: {
          translateX: 100,
          translateY: 100,
          rotationDegrees: 45
        },
        children: [g({
          style: {
            scaleX: 2,
            scaleY: 2
          },
          children: [rect({
            style: defaultRectStyle
          })]
        })]
      }));
      await takeScreenshot(page);
    });
  });

  describe('interaction with transformed elements', () => {
    it('handles mouse events on scaled elements', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(g({
        style: {
          scaleX: 2,
          scaleY: 2
        },
        children: [rect({
          style: defaultRectStyle,
          onClick
        })]
      }));

      // Click in the center of the scaled rect
      await canvas.click({ position: { x: 50, y: 50 } });
      expect(onClick).toHaveBeenCalledTimes(1);

      // Click outside the scaled rect
      await canvas.click({ position: { x: 150, y: 150 } });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('handles mouse events on rotated elements', async () => {
      const onMouseOver = vi.fn();
      const canvas = await componentTest(g({
        style: {
          rotationDegrees: 45,
          rotationOrigin: [25, 25]
        },
        children: [rect({
          style: defaultRectStyle,
          onMouseOver
        })]
      }));

      // Move to center of rotated rect
      await canvas.mouseMove({ position: { x: 25, y: 25 } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);

      // Move outside rotated rect
      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);
    });

    it('handles mouse events with compound transformations', async () => {
      const onClick = vi.fn();
      const rectCenter = { x: 50, y: 50 };
      const rotation = 45;
      const scale = 1.5;
      const offset = { x: 100, y: 10 };
      const skewX = 10;
      const skewY = 10;

      const matrix = new DOMMatrix();
      matrix.scaleSelf(scale, scale);
      matrix.rotateSelf(rotation);
      matrix.translateSelf(offset.x, offset.y);
      matrix.skewXSelf(skewX);
      matrix.skewYSelf(skewY);
      const transformedPoint = matrix.transformPoint(new DOMPoint(rectCenter.x, rectCenter.y));

      const canvas = await componentTest(g({
        style: {
          translateX: offset.x,
          translateY: offset.y,
          rotationDegrees: rotation,
          scaleX: scale,
          scaleY: scale,
          skewX,
          skewY
        },
        children: [rect({
          onClick,
          style: {
            ...defaultRectStyle,
            cursor: 'crosshair'
          }
        })]
      }));

      // Click off of the transformed position (should miss)
      await canvas.click({ position: { x: 0, y: 0 } });
      expect(onClick).toHaveBeenCalledTimes(0);

      // Click in the transformed position (should hit)
      await canvas.click({ position: transformedPoint });
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('mixed content', () => {
    it('transforms both shapes and text', async () => {
      await componentTest(g({
        style: {
          translateX: 100,
          translateY: 50,
          rotationDegrees: 30,
          scaleX: 1.5,
          scaleY: 1.5
        },
        children: [rect({
          style: {
            ...defaultRectStyle,
            fill: 'purple'
          }
        }), text({
          style: {
            x: 10,
            y: 30,
            text: 'Transformed!',
            fill: 'white'
          }
        })]
      }));
      await takeScreenshot(page);
    });
  });
});
