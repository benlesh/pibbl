import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { path } from './path';

describe('path', () => {
  it('applies opacity zero while filling', async () => {
    const observedAlpha: number[] = [];
    const fill = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'fill')
      .mockImplementation(function (this: CanvasRenderingContext2D) {
        observedAlpha.push(this.globalAlpha);
      });
    const value = new Path2D();
    value.rect(10, 10, 20, 20);

    await componentTest(path({
      style: {
        d: value,
        fill: 'red',
        opacity: 0,
      },
    }));

    expect(observedAlpha).toEqual([0]);
    fill.mockRestore();
  });

  it('uses transparent fill geometry for interaction without painting it', async () => {
    const onClick = vi.fn();
    const value = new Path2D();
    value.rect(10, 10, 20, 20);

    const canvas = await componentTest(path({
      style: {
        d: value,
        fill: 'transparent',
      },
      onClick,
    }));

    await canvas.click({ position: { x: 20, y: 20 } });
    expect(onClick).toHaveBeenCalledOnce();
    expect(Array.from(
      canvas.element.getContext('2d')!.getImageData(20, 20, 1, 1).data,
    )).toEqual([0, 0, 0, 0]);
  });

  it('ignores a legacy top-level cursor from untyped callers', async () => {
    const value = new Path2D();
    value.rect(10, 10, 20, 20);
    const legacyInput = {
      style: {
        d: value,
        fill: 'transparent',
      },
      cursor: 'pointer',
    } as unknown as Parameters<typeof path>[0];

    const canvas = await componentTest(path(legacyInput));
    await canvas.mouseMove({ position: { x: 20, y: 20 } });

    expect(getComputedStyle(canvas.element).cursor).not.toBe('pointer');
  });
});
