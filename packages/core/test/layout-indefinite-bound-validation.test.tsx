import { beforeAll, expect, it, vi } from 'vitest';
import { createElement, definePrimitive, Flex, measureElement, type FlexStyle, type Length, type SystemStyle } from '@pibbl/core';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const service = { measureText: () => ({ width: 0 }) as TextMetrics };
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });

it.runIf(nativeLayout)('validates percentage bounds before rejecting an indefinite containing axis without evaluating providers or allocating resources', () => {
  interface Style extends SystemStyle { width?: number; height?: number; minWidth?: Exclude<Length, 'auto'>; maxWidth?: Exclude<Length, 'auto'>; minHeight?: Exclude<Length, 'auto'>; maxHeight?: Exclude<Length, 'auto'>; flexBasis?: number; flexGrow?: number; flexShrink?: number }
  const measure = vi.fn(() => ({ status: 'measured' as const, size: { width: 40, height: 20 } }));
  const Leaf = definePrimitive<{}, Style, Style, SystemStyle>(() => undefined, { resolveStyle: () => ({}), measure });
  const baseline = snapshotWasmLayoutDiagnostics();
  for (const flexDirection of ['row', 'column'] as const) {
    const property = flexDirection === 'row' ? 'maxWidth' : 'maxHeight';
    const root = (value: string) => createElement(Flex, { style: { flexDirection, flexWrap: 'nowrap' } satisfies FlexStyle, children: createElement(Leaf, { style: { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, [property]: value as Exclude<Length, 'auto'> } }) });
    for (const max of [160, Number.POSITIVE_INFINITY]) {
      const constraints = { minWidth: 0, maxWidth: flexDirection === 'row' ? max : 100, minHeight: 0, maxHeight: flexDirection === 'column' ? max : 100 };
      expect(measureElement(root('25%'), constraints, service)).toEqual({ status: 'unsupported', reason: expect.stringMatching(/exact finite/) });
      for (const invalid of ['-10%', '25%%', `${'9'.repeat(400)}%`]) {
        expect(() => measureElement(root(invalid), constraints, service)).toThrow(new RegExp(`${property}.*(nonnegative|unsupported|finite)`));
      }
    }
  }
  expect(measure).not.toHaveBeenCalled();
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
});
