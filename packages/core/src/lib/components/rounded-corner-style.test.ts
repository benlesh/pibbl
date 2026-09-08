import { describe, expect, it } from 'vitest';
import type { StyleResolutionContext } from '../types';
import { LayoutDiagnostic } from '../style/diagnostics';
import { resolveRoundedCornerStyle } from './rounded-corner-style';

const context: StyleResolutionContext = {
  allocation: { x: 0, y: 0, width: 200, height: 120 },
  percentageBasis: { x: 0, y: 0, width: 200, height: 120 },
  constraints: { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 120 },
  component: 'Polygon',
  algorithm: 'render-dispatch',
};

describe('resolveRoundedCornerStyle', () => {
  it('resolves a uniform percentage against the smaller percentage basis', () => {
    expect(resolveRoundedCornerStyle(4, {
      cornerRadius: '25%',
    }, context)).toEqual({
      cornerRadius: 30,
      cornerRadii: undefined,
    });
  });

  it('resolves every present override and preserves sparse nullish fallback entries', () => {
    const cornerRadii: (number | `${number}%` | null | undefined)[] = [
      0,
      null,
      '50%',
      undefined,
    ];
    delete cornerRadii[3];

    const resolved = resolveRoundedCornerStyle(5, {
      cornerRadius: '10%',
      cornerRadii,
    }, context);

    expect(resolved).toEqual({
      cornerRadius: 12,
      cornerRadii: [0, null, 60, undefined],
    });
    expect(3 in resolved.cornerRadii!).toBe(false);
  });

  it('rejects overlong arrays before resolving their entries', () => {
    let failure: unknown;
    try {
      resolveRoundedCornerStyle(3, {
        cornerRadii: [1, 2, 3, Number.NaN],
      }, context);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(LayoutDiagnostic);
    expect(failure).toMatchObject({
      component: 'Polygon',
      property: 'cornerRadii',
      suppliedValue: 4,
      algorithm: 'render-dispatch',
    });
    expect((failure as Error).message).toMatch(/length.*3/);
  });

  it('reports the exact uniform or indexed path for every invalid radius', () => {
    expect(() => resolveRoundedCornerStyle(4, {
      cornerRadius: -1,
      cornerRadii: [1, 2, 3, 4],
    }, context)).toThrow(/Polygon.*cornerRadius.*-1.*nonnegative/);
    expect(() => resolveRoundedCornerStyle(4, {
      cornerRadii: [1, Number.NaN],
    }, context)).toThrow(/Polygon.*cornerRadii\[1\].*NaN.*finite/);
    expect(() => resolveRoundedCornerStyle(4, {
      cornerRadii: [1, Number.NEGATIVE_INFINITY],
    }, context)).toThrow(/Polygon.*cornerRadii\[1\].*-Infinity.*finite/);
    expect(() => resolveRoundedCornerStyle(4, {
      cornerRadii: [1, -2],
    }, context)).toThrow(/Polygon.*cornerRadii\[1\].*-2.*nonnegative/);
  });
});
