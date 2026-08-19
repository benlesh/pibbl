import { describe, expect, it } from 'vitest';
import { resolveSurface } from './resolve-surface.js';
import { toLogicalTransform } from './transform.js';

describe('toLogicalTransform', () => {
  it('removes the root backing projection while retaining local transforms', () => {
    const surface = resolveSurface(
      {
        mode: 'fixed',
        width: 200,
        height: 100,
        fit: 'contain',
        pixelRatio: 2,
      },
      { width: 300, height: 300 },
      2,
    )!;
    const current = surface.renderTransform
      .translate(20, 10)
      .scale(1.5, 0.5);

    const logical = toLogicalTransform(surface, current);

    expect(logical.a).toBeCloseTo(1.5);
    expect(logical.d).toBeCloseTo(0.5);
    expect(logical.e).toBeCloseTo(20);
    expect(logical.f).toBeCloseTo(10);
  });
});
