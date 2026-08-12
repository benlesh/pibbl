import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { path } from './path';

describe('path', () => {
  it('applies alpha zero while filling', async () => {
    const observedAlpha: number[] = [];
    const fill = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'fill')
      .mockImplementation(function (this: CanvasRenderingContext2D) {
        observedAlpha.push(this.globalAlpha);
      });
    const value = new Path2D();
    value.rect(10, 10, 20, 20);

    await componentTest(path({
      path: value,
      fillStyle: 'red',
      alpha: 0,
    }));

    expect(observedAlpha).toEqual([0]);
    fill.mockRestore();
  });
});
