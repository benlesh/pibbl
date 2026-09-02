import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { Clip } from './clip';
import { Rectangle } from './rect';
import { Text } from './text';
import { createElement } from '../element/create-element';

describe('clip', () => {
  it('uses style as the sole clipping-path authority', async () => {
    const styledPath = new Path2D();
    styledPath.rect(0, 0, 20, 20);
    const legacyPath = new Path2D();
    legacyPath.rect(30, 0, 20, 20);
    const legacyInput = {
      style: { d: styledPath },
      path: legacyPath,
      children: [
        createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 60,
            height: 20,
            fill: 'red',
          },
        }),
      ],
    } as any;

    const canvas = await componentTest(createElement(Clip, legacyInput));
    const context = canvas.element.getContext('2d')!;

    expect(context.getImageData(10, 10, 1, 1).data[3]).toBe(255);
    expect(context.getImageData(40, 10, 1, 1).data[3]).toBe(0);
  });

  it('treats an empty clip as empty rendering geometry', async () => {
    const canvas = await componentTest(createElement(Clip, {
      style: {
        d: new Path2D()
      },
      children: [createElement(Rectangle, {
        style: {
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          fill: 'red'
        }
      })]
    }));

    expect(canvas.element.getContext('2d')!.getImageData(20, 20, 1, 1).data[3])
      .toBe(0);
  });

  it('clips a rectangle with default fillRule', async () => {
    const clipPath = new Path2D();
    clipPath.rect(50, 50, 100, 100);

    await componentTest(createElement(Clip, {
      style: {
        d: clipPath
      },
      children: [createElement(Rectangle, {
        style: {
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          fill: 'blue'
        }
      })]
    }));
    await takeScreenshot(page);
  });

  it('clips with evenodd fillRule', async () => {
    const clipPath = new Path2D();
    // Outer rectangle
    clipPath.rect(50, 50, 100, 100);
    // Inner rectangle (creates a hole with evenodd rule)
    clipPath.rect(75, 75, 50, 50);

    await componentTest(createElement(Clip, {
      style: {
        d: clipPath,
        fillRule: 'evenodd'
      },
      children: [createElement(Rectangle, {
        style: {
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          fill: 'red'
        }
      })]
    }));
    await takeScreenshot(page);
  });

  it('clips multiple children', async () => {
    const clipPath = new Path2D();
    clipPath.arc(100, 100, 50, 0, Math.PI * 2);

    await componentTest(createElement(Clip, {
      style: {
        d: clipPath
      },
      children: [createElement(Rectangle, {
        style: {
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          fill: 'green'
        }
      }), createElement(Text, {
        style: {
          x: 75,
          y: 100,
          fill: 'white'
        }
      }, 'Clipped Text')]
    }));
    await takeScreenshot(page);
  });

  it('handles nested clipping', async () => {
    const outerClipPath = new Path2D();
    outerClipPath.rect(50, 50, 150, 150);

    const innerClipPath = new Path2D();
    innerClipPath.arc(125, 125, 50, 0, Math.PI * 2);

    await componentTest(createElement(Clip, {
      style: {
        d: outerClipPath
      },
      children: [createElement(Rectangle, {
        style: {
          x: 0,
          y: 0,
          width: 250,
          height: 250,
          fill: 'purple'
        }
      }), createElement(Clip, {
        style: {
          d: innerClipPath
        },
        children: [createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 250,
            height: 250,
            fill: 'orange'
          }
        })]
      })]
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

    await componentTest(createElement(Clip, {
      style: {
        d: clipPath
      },
      children: [createElement(Rectangle, {
        style: {
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          fill: 'yellow'
        }
      }), createElement(Text, {
        style: {
          x: 60,
          y: 100,
          fill: 'black'
        }
      }, 'Star Clip')]
    }));
    await takeScreenshot(page);
  });

  describe('mouse interaction with clipped regions', () => {
    it('prevents interaction outside clipped rectangle region', async () => {
      const clipPath = new Path2D();
      clipPath.rect(50, 50, 100, 100);

      const onClick = vi.fn();

      const canvas = await componentTest(createElement(Clip, {
        style: {
          d: clipPath
        },
        children: [createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            fill: 'goldenrod'
          },
          onClick
        })]
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

      const canvas = await componentTest(createElement(Clip, {
        style: {
          d: clipPath,
          fillRule: 'evenodd'
        },
        children: [createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            fill: 'red',
            cursor: 'pointer'
          },
          onMouseOver
        })]
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

      const canvas = await componentTest(createElement(Clip, {
        style: {
          d: outerClipPath
        },
        children: [createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            fill: 'blue',
            cursor: 'pointer'
          },
          onClick: onOuterClick
        }), createElement(Clip, {
          style: {
            d: innerClipPath
          },
          children: [createElement(Rectangle, {
            style: {
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fill: 'green',
              cursor: 'crosshair'
            },
            onClick: onInnerClick
          })]
        })]
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
