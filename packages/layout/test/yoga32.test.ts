import { describe, expect, it } from 'vitest';
import { analyzeYoga32Tree, assertYoga32Converted, convertYoga32Style } from '../src/index.js';

describe('Yoga 3.2 conversion', () => {
  it('materializes declared defaults without silently preserving Yoga shorthand', () => {
    const result = convertYoga32Style({ flex_direction: 'row', width: 120 }, { useWebDefaults: false, direction: 'ltr', pointScaleFactor: 0 });
    expect(result.diagnostics).toEqual([]);
    expect(assertYoga32Converted(result).style).toMatchObject({ flexDirection: 'row', flexShrink: 0, position: 'relative', boxSizing: 'border-box', width: 120 });
  });
  it('preserves supported enum and edge values while rejecting only unrepresentable inputs', () => {
    const result = convertYoga32Style({ flexDirection: 'row-reverse', justifyContent: 'space-between', padding: '10%', overflow: 'visible' });
    expect(result.diagnostics).toEqual([]);
    expect(assertYoga32Converted(result).style).toMatchObject({ flexDirection: 'row-reverse', justifyContent: 'space-between', padding: '10%', overflow: 'visible' });
  });
  it('reports reference baselines and ambiguous shorthand as executable conversion errors', () => {
    const result = convertYoga32Style({ flex: 1, isReferenceBaseline: true });
    expect(result.value).toBeUndefined();
    expect(result.diagnostics.map(item => item.code)).toEqual(['ambiguous-flex-shorthand', 'unsupported-reference-baseline']);
    expect(() => assertYoga32Converted(result)).toThrow(/reference-baseline/);
  });
  it('analyzes every owned source path without dropping unsupported nodes', () => {
    const report = analyzeYoga32Tree({ children: [{ style: { width: 20 } }, { isReferenceBaseline: true, children: [{ style: { overflow: 'scroll' } }] }] });
    expect(report).toMatchObject({ convertible: false, nodeCount: 4, unsupportedNodeCount: 2 });
    expect(report.diagnostics.map(item => [item.path, item.code])).toEqual(expect.arrayContaining([[[1], 'unsupported-reference-baseline'], [[1, 0], 'unsupported-yoga-style']]));
  });
});
