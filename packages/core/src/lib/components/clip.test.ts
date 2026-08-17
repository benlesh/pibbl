import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { clip } from './clip';
import { rect } from './rect';
import { text } from './text';

describe('clip', () => {
  it('treats an empty clip as empty rendering geometry', async () => {
    const canvas = await componentTest(clip({
      path: new Path2D(),
      children: [
        rect({
          style: {
            x: 0,
            y: 0,
            width: 40,
            height: 40,
            fill: 'red',
          },
        }),
      ],
    }));

    expect(canvas.element.getContext('2d')!.getImageData(20, 20, 1, 1).data[3])
      .toBe(0);
  });

  it('clips a rectangle with default fillRule', async () => {
    const clipPath = new Path2D();
    clipPath.rect(50, 50, 100, 100);

    await componentTest(clip({
      path: clipPath,
      children: [
        rect({
          style: {
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            fill: 'blue',
          },
        }),
      ],
    }));
    await takeScreenshot(page);
  });

  it('clips with evenodd fillRule', async () => {
    const clipPath = new Path2D();
    // Outer rectangle
    clipPath.rect(50, 50, 100, 100);
    // Inner rectangle (creates a hole with evenodd rule)
    clipPath.rect(75, 75, 50, 50);

    await componentTest(clip({
      path: clipPath,
      fillRule: 'evenodd',
      children: [
        rect({
          style: {
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            fill: 'red',
          },
        }),
      ],
    }));
    await takeScreenshot(page);
  });

  it('clips multiple children', async () => {
    const clipPath = new Path2D();
    clipPath.arc(100, 100, 50, 0, Math.PI * 2);

    await componentTest(clip({
      path: clipPath,
      children: [
        rect({
          style: {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            fill: 'green',
          },
        }),
        text({
          style: {
            x: 75,
            y: 100,
            text: 'Clipped Text',
            fill: 'white',
          },
        }),
      ],
    }));
    await takeScreenshot(page);
  });

  it('handles nested clipping', async () => {
    const outerClipPath = new Path2D();
    outerClipPath.rect(50, 50, 150, 150);

    const innerClipPath = new Path2D();
    innerClipPath.arc(125, 125, 50, 0, Math.PI * 2);

    await componentTest(clip({
      path: outerClipPath,
      children: [
        rect({
          style: {
            x: 0,
            y: 0,
            width: 250,
            height: 250,
            fill: 'purple',
          },
        }),
        clip({
          path: innerClipPath,
          children: [
            rect({
              style: {
                x: 0,
                y: 0,
                width: 250,
                height: 250,
                fill: 'orange',
              },
            }),
          ],
        }),
      ],
    }));
    await takeScreenshot(page);
  });

  it('clips with complex path', async () => {
    const clipPath = new Path2D();
    // Create a star shape
    const cx = 100;
    const cy = 100;
    const spikes = 5;
    const outerRadius = 50;
    const innerRadius = 25;

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) {
        clipPath.moveTo(x, y);
      } else {
        clipPath.lineTo(x, y);
      }
    }
    clipPath.closePath();

    await componentTest(clip({
      path: clipPath,
      children: [
        rect({
          style: {
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            fill: 'yellow',
          },
        }),
        text({
          style: {
            x: 60,
            y: 100,
            text: 'Star Clip',
            fill: 'black',
          },
        }),
      ],
    }));
    await takeScreenshot(page);
  });

  describe('mouse interaction with clipped regions', () => {
    it('prevents interaction outside clipped rectangle region', async () => {
      const clipPath = new Path2D();
      clipPath.rect(50, 50, 100, 100);

      const onClick = vi.fn();

      const canvas = await componentTest(clip({
        path: clipPath,
        children: [
          rect({
            style: {
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fill: 'goldenrod',
            },
            onClick,
          }),
        ],
      }));

      // Click inside the clipped rectangle (should trigger)
      await canvas.click({ position: { x: 75, y: 75 } });
      expect(onClick).toHaveBeenCalledTimes(1);

      // Click outside the clipped rectangle (should not trigger)
      await canvas.click({ position: { x: 25, y: 25 } });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('prevents interaction in evenodd hole', async () => {
      const clipPath = new Path2D();
      clipPath.rect(50, 50, 100, 100);
      clipPath.rect(75, 75, 50, 50);

      const onMouseOver = vi.fn();

      const canvas = await componentTest(clip({
        path: clipPath,
        fillRule: 'evenodd',
        children: [
          rect({
            style: {
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fill: 'red',
              cursor: 'pointer',
            },
            onMouseOver,
          }),
        ],
      }));

      // Move to outer rectangle (should trigger)
      await canvas.mouseMove({ position: { x: 60, y: 60 } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);

      // Move to inner hole (should not trigger)
      await canvas.mouseMove({ position: { x: 100, y: 100 } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);

      // Move back to outer rectangle (should trigger again)
      await canvas.mouseMove({ position: { x: 140, y: 140 } });
      expect(onMouseOver).toHaveBeenCalledTimes(2);
    });

    it('requires every nested clip region for interaction', async () => {
      const outerClipPath = new Path2D();
      outerClipPath.rect(50, 50, 100, 100);

      const innerClipPath = new Path2D();
      innerClipPath.arc(100, 100, 25, 0, Math.PI * 2);

      const onOuterClick = vi.fn();
      const onInnerClick = vi.fn();

      const canvas = await componentTest(clip({
        path: outerClipPath,
        children: [
          rect({
            style: {
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fill: 'blue',
              cursor: 'pointer',
            },
            onClick: onOuterClick,
          }),
          clip({
            path: innerClipPath,
            children: [
              rect({
                style: {
                  x: 0,
                  y: 0,
                  width: 200,
                  height: 200,
                  fill: 'green',
                  cursor: 'crosshair',
                },
                onClick: onInnerClick,
              }),
            ],
          }),
        ],
      }));

      // Click in outer rect but outside circle (should trigger once)
      await canvas.click({ position: { x: 60, y: 60 } });
      expect(onOuterClick).toHaveBeenCalledTimes(1);
      expect(onInnerClick).not.toHaveBeenCalled();

      // Click outside both clips (should not trigger)
      await canvas.click({ position: { x: 40, y: 40 } });
      expect(onOuterClick).toHaveBeenCalledTimes(1);
      expect(onInnerClick).not.toHaveBeenCalled();

      // Only the topmost region inside both clips is the logical target.
      await canvas.click({ position: { x: 100, y: 100 } });
      expect(onOuterClick).toHaveBeenCalledTimes(1);
      expect(onInnerClick).toHaveBeenCalledTimes(1);
    });
  });
});
