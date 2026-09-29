import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import { createElement, definePrimitive, measureElement, signal, Text, type CRCResponsiveStyle, type TextStyle, type SystemStyle } from '@crc/core';
import { describe, expect, it, vi } from 'vitest';
const constraints = { minWidth: 0, maxWidth: 700, minHeight: 0, maxHeight: 100 };
const service = { measureText: () => ({ width: 20, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }) as TextMetrics };
function measured(when: unknown, maxHeight = 100) {
  return measureElement(createElement(Text, { children: 'label', style: {
    when,
  } as CRCResponsiveStyle<TextStyle> }), { ...constraints, maxHeight }, service);
}
describe('responsive query validation', () => {
  it('preserves zero and fractional inclusive bounds on both axes', () => {
    const seen: string[] = [];
    const Measured = definePrimitive<{}, SystemStyle & { label: string }>(() => {}, {
      measure(input) {
        seen.push(input.style.label);
        return { status: 'measured', size: { width: 0, height: 0 } };
      },
    });
    const element = createElement(Measured, { style: { label: 'base', when: [
      { query: { minWidth: 0, maxWidth: 0, minHeight: 0, maxHeight: 0 }, style: { label: 'zero' } },
      { query: { minWidth: 0.5, maxWidth: 0.5, minHeight: 1.5, maxHeight: 1.5 }, style: { label: 'fractional' } },
    ] } });
    for (const [maxWidth, maxHeight] of [[0, 0], [0.5, 1.5], [0.499, 1.5], [0.5, 1.501], [0.5, 1.5], [0, 0]]) {
      expect(measureElement(element, { minWidth: 0, maxWidth: maxWidth!, minHeight: 0, maxHeight: maxHeight! }, service).status).toBe('measured');
    }
    expect(seen).toEqual(['zero', 'fractional', 'base', 'base', 'fractional', 'zero']);
  });
  it('includes source and the queried axis in unsupported standalone diagnostics', () => {
    const element = jsxDEV(Text, { children: 'label', style: { when: [
      { query: { minHeight: 10 }, style: { lineHeight: 20 } },
    ] } }, undefined, false, { fileName: 'responsive-demo.tsx', lineNumber: 7, columnNumber: 3 }, undefined);
    const result = measureElement(element, { ...constraints, maxHeight: Infinity }, service);
    expect(result).toMatchObject({ status: 'unsupported' });
    if (result.status !== 'unsupported') throw new Error('expected unsupported measurement');
    expect(result.reason).toContain('responsive-demo.tsx:7');
    expect(result.reason).toContain('style.when[0].query.minHeight');
    expect(result.reason).toContain('Infinity');
    expect(result.reason).toContain('finite maxHeight');
  });

  it.each([
    [null, 'CRC_STYLE_QUERY_SHAPE'],
    [{}, 'CRC_STYLE_QUERY_SHAPE'],
    [signal([]), 'CRC_STYLE_QUERY_SIGNAL'],
    [[signal({})], 'CRC_STYLE_QUERY_SIGNAL'],
    [[{ query: signal({ minWidth: 0 }), style: {} }], 'CRC_STYLE_QUERY_SIGNAL'],
    [[{ query: { minWidth: 0 }, style: signal({}) }], 'CRC_STYLE_QUERY_SIGNAL'],
    [[{ query: {}, style: {} }], 'CRC_STYLE_QUERY_KEY'],
    [[{ query: { pointer: 'coarse' }, style: {} }], 'CRC_STYLE_QUERY_KEY'],
    [[{ query: { minWidth: -1 }, style: {} }], 'CRC_STYLE_QUERY_BOUND'],
    [[{ query: { minWidth: Infinity }, style: {} }], 'CRC_STYLE_QUERY_BOUND'],
    [[{ query: { minHeight: NaN }, style: {} }], 'CRC_STYLE_QUERY_BOUND'],
    [[{ query: { minWidth: 10, maxWidth: 9 }, style: {} }], 'CRC_STYLE_QUERY_RANGE'],
    [[{ query: { minHeight: 10, maxHeight: 9 }, style: {} }], 'CRC_STYLE_QUERY_RANGE'],
    [[{ query: { minWidth: 800 }, style: { when: [] } }], 'CRC_STYLE_QUERY_NESTED'],
    [[{ query: { minWidth: 0 }, style: new Date() }], 'CRC_STYLE_QUERY_SHAPE'],
  ])('rejects malformed query input with a repairable diagnostic: %j', (when, code) => {
    expect(() => measured(when)).toThrow(code as string);
  });
  it('reports malformed later rules before an unavailable standalone measurement basis', () => {
    expect(() => measured([
      { query: { minHeight: 10 }, style: {} },
      { query: { minWidth: -1 }, style: {} },
    ], Infinity)).toThrow('CRC_STYLE_QUERY_BOUND');
  });
  it('does not read base or patch signals when the standalone basis is unavailable', () => {
    const value = signal(20);
    const read = vi.spyOn(value, 'get');
    const result = measureElement(createElement(Text, { children: 'label', style: {
      lineHeight: value,
      when: [
        { query: { minWidth: 0 }, style: { lineHeight: value } },
        { query: { minHeight: 10 }, style: { lineHeight: value } },
      ],
    } }), { ...constraints, maxHeight: Infinity }, service);
    expect(result.status).toBe('unsupported');
    expect(read).not.toHaveBeenCalled();
  });
});
