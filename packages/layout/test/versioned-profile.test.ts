import { describe, expect, it } from 'vitest';
import { analyzeYoga32Tree } from '../src/index.js';

describe('pinned Yoga 3.2 migration profile', () => {
  it('keeps version-sensitive errata and reference input visible in the report', () => {
    const report = analyzeYoga32Tree({ config: { errata: ['AbsolutePositionWithoutInsetsExcludesPadding'] }, isReferenceBaseline: true });
    expect(report.convertible).toBe(false);
    expect(report.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining(['unsupported-errata', 'unsupported-reference-baseline']));
  });
});
