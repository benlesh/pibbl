import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { g } from './g';
import { rect } from './rect';
import { text } from './text';

describe('g', () => {
  const defaultRect = {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    fillStyle: 'blue',
  };

  it('supports zero and negative scales without leaking transforms', async () => {
    const scales: number[] = [];
    const TransformProbe = defineComp((_props: {}, ctx) => {
      scales.push(ctx.getTransform().a);
    });

    await componentTest(g({ children: [
      g({ scaleX: 0, children: [TransformProbe({})] }),
      g({ scaleX: -1, children: [TransformProbe({})] }),
      TransformProbe({}),
    ] }));

    expect(scales).toEqual([0, -1, 1]);
  });

  it('renders children without transformation', async () => {
    await componentTest(g({
      children: [
        rect(defaultRect),
      ],
    }));
    await takeScreenshot(page);
  });

  it('translates children', async () => {
    await componentTest(g({
      x: 100,
      y: 50,
      children: [
        rect(defaultRect),
      ],
    }));
    await takeScreenshot(page);
  });

  describe('scaling', () => {
    it('scales uniformly', async () => {
      await componentTest(g({
        scaleX: 2,
        scaleY: 2,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });

    it('scales non-uniformly', async () => {
      await componentTest(g({
        scaleX: 2,
        scaleY: 0.5,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });
  });

  describe('rotation', () => {
    it('rotates around origin', async () => {
      await componentTest(g({
        rotate: 45,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });

    it('rotates around specified point', async () => {
      await componentTest(g({
        rotate: 90,
        rotateOrigin: [25, 25], // center of rect
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });
  });

  describe('skewing', () => {
    it('skews on X axis', async () => {
      await componentTest(g({
        skewX: 30,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });

    it('skews on Y axis', async () => {
      await componentTest(g({
        skewY: 30,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });

    it('skews on both axes', async () => {
      await componentTest(g({
        skewX: 30,
        skewY: 30,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });
  });

  describe('compound transformations', () => {
    it('combines multiple transformations in correct order', async () => {
      await componentTest(g({
        x: 100,
        y: 100,
        rotate: 45,
        scaleX: 2,
        scaleY: 1.5,
        children: [
          rect(defaultRect),
        ],
      }));
      await takeScreenshot(page);
    });

    it('handles nested groups with transformations', async () => {
      await componentTest(g({
        x: 100,
        y: 100,
        rotate: 45,
        children: [
          g({
            scaleX: 2,
            scaleY: 2,
            children: [
              rect(defaultRect),
            ],
          }),
        ],
      }));
      await takeScreenshot(page);
    });
  });

  describe('interaction with transformed elements', () => {
    it('handles mouse events on scaled elements', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(g({
        scaleX: 2,
        scaleY: 2,
        children: [
          rect({
            ...defaultRect,
            onClick,
          }),
        ],
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
        rotate: 45,
        rotateOrigin: [25, 25],
        children: [
          rect({
            ...defaultRect,
            onMouseOver,
          }),
        ],
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
        x: offset.x,
        y: offset.y,
        rotate: rotation,
        scaleX: scale,
        scaleY: scale,
        skewX,
        skewY,
        children: [
          rect({
            ...defaultRect,
            onClick,
            cursor: 'crosshair',
          }),
        ],
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
        x: 100,
        y: 50,
        rotate: 30,
        scaleX: 1.5,
        scaleY: 1.5,
        children: [
          rect({
            ...defaultRect,
            fillStyle: 'purple',
          }),
          text({
            x: 10,
            y: 30,
            text: 'Transformed!',
            fillStyle: 'white',
          }),
        ],
      }));
      await takeScreenshot(page);
    });
  });
});
