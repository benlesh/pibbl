import { describe, expect, it } from 'vitest';
import {
  resolveSurface,
  validateSurfaceConfig,
} from './resolve-surface.js';

describe('resolveSurface', () => {
  it('renders a fixed viewport at the rounded backing density with contain', () => {
    const surface = resolveSurface(
      {
        mode: 'fixed',
        width: 720,
        height: 420,
        fit: 'contain',
        pixelRatio: 2,
      },
      { width: 873, height: 509.25 },
      2,
    );

    expect(surface).toBeDefined();
    expect(surface).toMatchObject({
      logicalWidth: 720,
      logicalHeight: 420,
      displayWidth: 873,
      displayHeight: 509.25,
      backingWidth: 1746,
      backingHeight: 1019,
      backingPixelsPerCssPixelX: 2,
      backingPixelsPerLogicalUnitX: 2.425,
    });
    expect(surface!.backingPixelsPerCssPixelY).toBeCloseTo(1019 / 509.25);
    expect(surface!.backingPixelsPerLogicalUnitY).toBeCloseTo(1019 / 420);
    expect(surface!.renderTransform.a).toBeCloseTo(2.425);
    expect(surface!.renderTransform.d).toBeCloseTo(1019 / 420);

    const physicalCenter = surface!.renderTransform.transformPoint(
      new DOMPoint(360, 210),
    );
    const logicalCenter = surface!.inverseRenderTransform.transformPoint(
      physicalCenter,
    );
    expect(logicalCenter.x).toBeCloseTo(360);
    expect(logicalCenter.y).toBeCloseTo(210);
  });

  it.each([
    {
      fit: 'contain' as const,
      matrix: { a: 2, d: 2, e: 400, f: 0 },
    },
    {
      fit: 'cover' as const,
      matrix: { a: 4, d: 4, e: 0, f: -400 },
    },
    {
      fit: 'fill' as const,
      matrix: { a: 4, d: 2, e: 0, f: 0 },
    },
    {
      fit: 'none' as const,
      matrix: { a: 2, d: 2, e: 400, f: 0 },
    },
    {
      fit: 'scale-down' as const,
      matrix: { a: 2, d: 2, e: 400, f: 0 },
    },
  ])('projects a fixed viewport with $fit', ({ fit, matrix }) => {
    const surface = resolveSurface(
      {
        mode: 'fixed',
        width: 400,
        height: 400,
        fit,
        pixelRatio: 2,
      },
      { width: 800, height: 400 },
      2,
    )!;

    expect(surface.renderTransform.a).toBeCloseTo(matrix.a);
    expect(surface.renderTransform.d).toBeCloseTo(matrix.d);
    expect(surface.renderTransform.e).toBeCloseTo(matrix.e);
    expect(surface.renderTransform.f).toBeCloseTo(matrix.f);
  });

  it('does not enlarge scale-down content', () => {
    const surface = resolveSurface(
      {
        mode: 'fixed',
        width: 400,
        height: 200,
        fit: 'scale-down',
        pixelRatio: 2,
      },
      { width: 800, height: 400 },
      2,
    )!;

    expect(surface.renderTransform).toEqual(
      expect.objectContaining({ a: 2, d: 2, e: 400, f: 200 }),
    );
  });

  it('uses the CSS content size as the responsive logical viewport', () => {
    const surface = resolveSurface(
      { mode: 'responsive', pixelRatio: 2 },
      { width: 300.5, height: 150.25 },
      2,
    )!;

    expect(surface).toMatchObject({
      logicalWidth: 300.5,
      logicalHeight: 150.25,
      backingWidth: 601,
      backingHeight: 301,
      backingPixelsPerLogicalUnitX: 2,
    });
    expect(surface.backingPixelsPerLogicalUnitY).toBeCloseTo(301 / 150.25);
    expect(surface.renderTransform.e).toBe(0);
    expect(surface.renderTransform.f).toBe(0);
  });

  it('defers resolution while a display axis is zero', () => {
    expect(resolveSurface(
      { mode: 'responsive', pixelRatio: 2 },
      { width: 0, height: 100 },
      2,
    )).toBeUndefined();
  });
});

describe('validateSurfaceConfig', () => {
  it('captures the initial Canvas attributes for the default fixed viewport', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 420;

    expect(validateSurfaceConfig(canvas)).toEqual({
      mode: 'fixed',
      width: 720,
      height: 420,
      fit: 'contain',
      pixelRatio: 'device',
    });
  });

  it.each([
    [{ viewport: { width: 0, height: 100 } }, 'viewport width'],
    [{ viewport: { width: 100, height: Number.NaN } }, 'viewport height'],
    [{ pixelRatio: 0 }, 'pixelRatio'],
    [{ pixelRatio: Number.POSITIVE_INFINITY }, 'pixelRatio'],
  ] as const)('rejects invalid config %#', (config, message) => {
    const canvas = document.createElement('canvas');
    expect(() => validateSurfaceConfig(canvas, config)).toThrow(message);
  });

  it('rejects fit when responsive config comes from untyped JavaScript', () => {
    const canvas = document.createElement('canvas');
    expect(() => validateSurfaceConfig(canvas, {
      viewport: 'responsive',
      fit: 'contain',
    } as never)).toThrow('fit');
  });
});
