import { describe, expect, it } from 'vitest';
import type { StyleResolutionContext } from '../types';
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
  shapeGeometryErrorFactory,
} from './shape-style';
import { LayoutDiagnostic } from '../style/diagnostics';

describe('shape style helpers', () => {
  const context: StyleResolutionContext = {
    allocation: { x: 0, y: 0, width: 300, height: 180 },
    percentageBasis: { x: 0, y: 0, width: 300, height: 180 },
    constraints: { minWidth: 0, maxWidth: 300, minHeight: 0, maxHeight: 180 },
    component: 'Circle',
    algorithm: 'render-dispatch',
  };

  it('resolves the circular percentage basis from the smaller side', () => {
    expect(circularPercentageBasis(context)).toBe(180);
  });

  it('resolves nonnegative shape lengths from percentages and numbers', () => {
    expect(resolveNonnegativeShapeLength('50%', 180, 'radius', context)).toBe(
      90,
    );
    expect(resolveNonnegativeShapeLength(0, 180, 'radius', context)).toBe(0);
  });

  it('rejects negative shape lengths', () => {
    expect(() => resolveNonnegativeShapeLength(-1, 180, 'radius', context)).toThrow(
      /Circle.*radius.*-1.*nonnegative/,
    );
  });

  it('rejects non-finite shape numbers', () => {
    expect(() =>
      resolveFiniteShapeNumber(Number.NaN, 'rotation', context),
    ).toThrow(/Circle.*rotation.*NaN.*finite/);
  });

  it('adapts shared geometry failures to contextual layout diagnostics', () => {
    const error = shapeGeometryErrorFactory({
      ...context,
      component: 'RegularPolygon',
    })('sides', 2, 'must be at least 3');

    expect(error).toBeInstanceOf(LayoutDiagnostic);
    expect(error).toMatchObject({
      component: 'RegularPolygon',
      property: 'sides',
      suppliedValue: 2,
      algorithm: 'render-dispatch',
      constraints: context.constraints,
    });
    expect(error.message).toMatch(/must be at least 3/);
  });
});
