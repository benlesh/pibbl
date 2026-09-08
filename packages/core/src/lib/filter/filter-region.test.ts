import { afterEach, describe, expect, it } from 'vitest';
import { clearTempState, GLOBAL_STATE } from '../global-state';
import type { RenderTargetSnapshot } from '../render-target';
import { resolveFilterList } from '../style/filter';
import type { StyleResolutionContext } from '../types';
import {
  BLUR_EXTENT_FACTOR,
  largestAffineScale,
  resolveFilterWindows,
  reverseFilterInfluence,
} from './filter-region';

const context: StyleResolutionContext = {
  allocation: { x: 0, y: 0, width: 400, height: 200 },
  percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
  constraints: { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 200 },
  component: 'FilterProbe',
  algorithm: 'render-dispatch',
};

afterEach(() => {
  clearTempState();
});

describe('reverse filter influence', () => {
  it('walks an ordered blur and drop-shadow list backward in backing pixels', () => {
    const output = { x: 0, y: 0, width: 100, height: 50 };
    const density = 2;
    const shadowRadius = 2;
    const finalBlurRadius = 3;
    const shadowOffsetX = 10 * density;
    const shadowOffsetY = -4 * density;
    const filters = resolveFilterList([
      {
        type: 'dropShadow',
        offsetX: 10,
        offsetY: -4,
        blurRadius: shadowRadius,
        color: 'black',
      },
      { type: 'blur', radius: finalBlurRadius },
    ], context)!;

    const finalBlurExtent = Math.ceil(
      finalBlurRadius * density * BLUR_EXTENT_FACTOR,
    );
    const afterFinalBlur = {
      left: output.x - finalBlurExtent,
      top: output.y - finalBlurExtent,
      right: output.x + output.width + finalBlurExtent,
      bottom: output.y + output.height + finalBlurExtent,
    };
    const shadowBlurExtent = Math.ceil(
      shadowRadius * density * BLUR_EXTENT_FACTOR,
    );
    const expectedLeft = Math.min(
      afterFinalBlur.left,
      Math.floor(afterFinalBlur.left - shadowOffsetX - shadowBlurExtent),
    );
    const expectedTop = Math.min(
      afterFinalBlur.top,
      Math.floor(afterFinalBlur.top - shadowOffsetY - shadowBlurExtent),
    );
    const expectedRight = Math.max(
      afterFinalBlur.right,
      Math.ceil(afterFinalBlur.right - shadowOffsetX + shadowBlurExtent),
    );
    const expectedBottom = Math.max(
      afterFinalBlur.bottom,
      Math.ceil(afterFinalBlur.bottom - shadowOffsetY + shadowBlurExtent),
    );

    expect(BLUR_EXTENT_FACTOR).toBe((3 * Math.sqrt(2 * Math.PI)) / 4);
    expect(reverseFilterInfluence(output, filters, density)).toEqual({
      x: expectedLeft,
      y: expectedTop,
      width: expectedRight - expectedLeft,
      height: expectedBottom - expectedTop,
    });
  });

  it('rounds fractional reverse-shadow edges outward', () => {
    const filters = resolveFilterList({
      type: 'dropShadow',
      offsetX: 0.25,
      offsetY: -0.25,
      blurRadius: 0,
      color: 'black',
    }, context)!;

    expect(reverseFilterInfluence(
      { x: 10, y: 20, width: 30, height: 40 },
      filters,
      2,
    )).toEqual({ x: 9, y: 20, width: 31, height: 41 });
  });

  it('leaves bounds unchanged for color-only filters', () => {
    const output = { x: -12, y: 7, width: 81, height: 39 };
    const filters = resolveFilterList([
      { type: 'brightness', amount: 1.2 },
      { type: 'contrast', amount: 0.5 },
      { type: 'grayscale', amount: 1 },
      { type: 'hueRotate', degrees: 45 },
      { type: 'invert', amount: 0.2 },
      { type: 'opacity', amount: 0.8 },
      { type: 'saturate', amount: 2 },
      { type: 'sepia', amount: 0.3 },
    ], context)!;

    expect(reverseFilterInfluence(output, filters, 3)).toEqual(output);
  });
});

describe('affine raster density', () => {
  it.each([
    ['identity', new DOMMatrix(), 1],
    ['rotation', new DOMMatrix().rotate(37), 1],
    ['uniform scale', new DOMMatrix().scale(3), 3],
    ['nonuniform scale', new DOMMatrix().scale(2, 4), 4],
    ['skew', new DOMMatrix([1, 0, 1, 1, 0, 0]), (1 + Math.sqrt(5)) / 2],
    ['zero determinant', new DOMMatrix([2, 0, 0, 0, 0, 0]), 2],
  ])('finds the largest singular scale for %s', (_label, matrix, expected) => {
    expect(largestAffineScale(matrix)).toBeCloseTo(expected, 12);
  });
});

describe('filter windows', () => {
  it('uses the largest direct local-to-backing scale exactly once and preserves snapped origins', () => {
    const target = createTarget(
      { x: 0, y: 0, width: 120, height: 90 },
      new DOMMatrix().scale(2),
    );
    const parentPaintTransform = new DOMMatrix()
      .translate(10, 20)
      .scale(2, 3);
    const filters = resolveFilterList({ type: 'brightness', amount: 1 }, context)!;

    const windows = resolveFilterWindows(
      target,
      parentPaintTransform,
      filters,
    );

    expect(windows).not.toBe('discard');
    if (windows === 'discard') return;
    expect(windows.density).toBe(6);
    expect(windows.output).toMatchObject({
      logicalBounds: {
        x: -5,
        y: -40 / 6,
        width: 60,
        height: 30,
      },
      backingX: -30,
      backingY: -40,
      backingWidth: 360,
      backingHeight: 180,
    });
    expect(windows.source).toMatchObject(windows.output);
    expect(windows.sourceToOutputX).toBe(0);
    expect(windows.sourceToOutputY).toBe(0);
    expectMatrix(windows.output.renderTransform, [6, 0, 0, 6, 30, 40]);
    expectMatrix(
      windows.output.inverseRenderTransform,
      [1 / 6, 0, 0, 1 / 6, -5, -40 / 6],
    );
  });

  it('projects all four parent corners through the inverse transform before snapping', () => {
    const target = createTarget(
      { x: 0, y: 0, width: 100, height: 50 },
      new DOMMatrix().scale(2),
    );
    const parentPaintTransform = new DOMMatrix()
      .translate(20, 30)
      .rotate(90);
    const filters = resolveFilterList({ type: 'blur', radius: 1 }, context)!;

    const windows = resolveFilterWindows(
      target,
      parentPaintTransform,
      filters,
    );

    expect(windows).not.toBe('discard');
    if (windows === 'discard') return;
    expect(windows.density).toBeCloseTo(2);
    expect(windows.output).toMatchObject({
      logicalBounds: { x: -30, y: -80, width: 50, height: 100 },
      backingX: -60,
      backingY: -160,
      backingWidth: 100,
      backingHeight: 200,
    });
    const extent = Math.ceil(2 * BLUR_EXTENT_FACTOR);
    expect(windows.source).toMatchObject({
      backingX: -60 - extent,
      backingY: -160 - extent,
      backingWidth: 100 + 2 * extent,
      backingHeight: 200 + 2 * extent,
    });
    expect(windows.sourceToOutputX).toBe(-extent);
    expect(windows.sourceToOutputY).toBe(-extent);
    expectMatrix(windows.source.renderTransform, [
      2,
      0,
      0,
      2,
      60 + extent,
      160 + extent,
    ]);
  });

  it.each([
    ['non-invertible', new DOMMatrix().scale(1, 0)],
    ['non-finite', matrixWithNaN()],
  ])('discards %s parent-facing transforms', (_label, transform) => {
    const target = createTarget(
      { x: 0, y: 0, width: 100, height: 50 },
      new DOMMatrix().scale(2),
    );
    const filters = resolveFilterList({ type: 'blur', radius: 1 }, context)!;

    expect(resolveFilterWindows(target, transform, filters)).toBe('discard');
  });

  it('rejects invalid unsigned-long dimensions with the current component name', () => {
    function OverflowProbe() {}
    GLOBAL_STATE.componentRefs = {
      element: { type: OverflowProbe },
    } as unknown as NonNullable<typeof GLOBAL_STATE.componentRefs>;
    const target = createTarget(
      { x: 0, y: 0, width: 0x1_0000_0000, height: 1 },
      new DOMMatrix(),
    );
    const filters = resolveFilterList({ type: 'blur', radius: 0 }, context)!;

    expect(() => resolveFilterWindows(target, new DOMMatrix(), filters))
      .toThrow(/OverflowProbe.*backing.*4294967296.*unsigned-long/i);
  });

  it('rejects unsafe backing area arithmetic before allocation', () => {
    const target = createTarget(
      { x: 0, y: 0, width: 100_000_000, height: 100_000_000 },
      new DOMMatrix(),
    );
    const filters = resolveFilterList({ type: 'opacity', amount: 1 }, context)!;

    expect(() => resolveFilterWindows(target, new DOMMatrix(), filters))
      .toThrow(/backing.*area.*safe integer/i);
  });
});

function createTarget(
  logicalBounds: RenderTargetSnapshot['logicalBounds'],
  renderTransform: DOMMatrix,
): RenderTargetSnapshot {
  return {
    logicalBounds,
    backingWidth: Math.max(1, Math.ceil(logicalBounds.width)),
    backingHeight: Math.max(1, Math.ceil(logicalBounds.height)),
    renderTransform,
    inverseRenderTransform: renderTransform.inverse(),
  };
}

function matrixWithNaN(): DOMMatrix {
  const matrix = new DOMMatrix();
  matrix.a = Number.NaN;
  return matrix;
}

function expectMatrix(
  actual: DOMMatrix,
  expected: readonly [number, number, number, number, number, number],
): void {
  const values = [actual.a, actual.b, actual.c, actual.d, actual.e, actual.f];
  for (const [index, value] of values.entries()) {
    expect(value).toBeCloseTo(expected[index]!, 12);
  }
}
