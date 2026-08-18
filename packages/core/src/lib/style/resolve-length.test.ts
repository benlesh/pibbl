import { describe, expect, it } from 'vitest';
import { LayoutDiagnostic } from './diagnostics';
import { normalizeEdges } from './normalize';
import { resolveLength } from './resolve-length';

describe('resolveLength', () => {
  it('resolves finite numbers, decimal percentages, zero, and auto', () => {
    expect(resolveLength(24, 300, 'width')).toBe(24);
    expect(resolveLength(0, 300, 'width')).toBe(0);
    expect(resolveLength(-12, 300, 'left')).toBe(-12);
    expect(resolveLength('25%', 300, 'width')).toBe(75);
    expect(resolveLength('12.5%', 80, 'width')).toBe(10);
    expect(resolveLength('.5%', 200, 'left')).toBe(1);
    expect(resolveLength('-10%', 200, 'left')).toBe(-20);
    expect(resolveLength('auto', 300, 'width')).toBeUndefined();
  });

  it('rejects non-finite numbers and malformed or unsupported strings', () => {
    expect(() => resolveLength(Number.NaN, 300, 'width')).toThrow(
      /width.*finite/,
    );
    expect(() =>
      resolveLength(Number.POSITIVE_INFINITY, 300, 'height'),
    ).toThrow(/height.*finite/);
    expect(() => resolveLength('12px' as any, 300, 'width')).toThrow(
      /unsupported.*12px/,
    );
    expect(() => resolveLength('25%%' as any, 300, 'width')).toThrow(
      /unsupported.*25%%/,
    );
    expect(() => resolveLength('%' as any, 300, 'width')).toThrow(
      /unsupported.*%/,
    );
    expect(() => resolveLength('1e2%' as any, 300, 'width')).toThrow(
      /unsupported.*1e2%/,
    );
  });

  it('rejects percentages when the reference is indefinite or invalid', () => {
    expect(() => resolveLength('25%', undefined, 'width')).toThrow(
      /width.*25%.*definite/,
    );
    expect(() =>
      resolveLength('25%', Number.POSITIVE_INFINITY, 'width'),
    ).toThrow(/width.*25%.*definite/);
    expect(() => resolveLength('25%', -1, 'width')).toThrow(
      /width.*reference.*nonnegative/,
    );
    expect(resolveLength('25%', 0, 'width')).toBe(0);
  });

  it('rejects percentage arithmetic that overflows finite inputs', () => {
    const context = {
      component: 'absolute',
      algorithm: 'absolute-layout',
      constraints: {
        minWidth: 0,
        maxWidth: Number.MAX_VALUE,
        minHeight: 0,
        maxHeight: 100,
      },
    };

    expect(() =>
      resolveLength('200%', Number.MAX_VALUE, 'width', context),
    ).toThrow(LayoutDiagnostic);
    expect(() =>
      resolveLength('199.999%', Number.MAX_VALUE, 'width', context),
    ).toThrow(/absolute.*width.*199\.999%.*absolute-layout.*maxWidth.*finite/);
  });

  it('includes the diagnostic context in failures', () => {
    expect(() =>
      resolveLength(Number.NaN, 300, 'width', {
        component: 'absolute',
        algorithm: 'absolute-layout',
        constraints: {
          minWidth: 0,
          maxWidth: 300,
          minHeight: 0,
          maxHeight: 200,
        },
      }),
    ).toThrow(/absolute.*width.*NaN.*absolute-layout.*minWidth.*maxWidth.*300/);
  });
});

describe('normalizeEdges', () => {
  it('expands numeric and partial edge values', () => {
    expect(normalizeEdges(8, 'padding')).toEqual({
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    });
    expect(normalizeEdges({ top: 1, right: 2 }, 'padding')).toEqual({
      top: 1,
      right: 2,
      bottom: 0,
      left: 0,
    });
    expect(normalizeEdges(undefined, 'padding')).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('rejects negative, non-finite, and malformed edge values', () => {
    expect(() => normalizeEdges(-1, 'padding')).toThrow(/padding.*nonnegative/);
    expect(() => normalizeEdges({ left: Number.NaN }, 'padding')).toThrow(
      /padding\.left.*finite/,
    );
    expect(() =>
      normalizeEdges({ bottom: Number.POSITIVE_INFINITY }, 'padding'),
    ).toThrow(/padding\.bottom.*finite/);
    expect(() => normalizeEdges('10%' as any, 'padding')).toThrow(
      /padding.*unsupported.*10%/,
    );
    expect(() => normalizeEdges([1, 2] as any, 'padding')).toThrow(
      /padding.*unsupported/,
    );
  });
});
