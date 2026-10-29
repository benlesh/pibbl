import { afterEach, beforeAll, expect, it } from 'vitest';
import { defineLayoutComponent, definePrimitive, Flex, measureElement, Rectangle, type FlexStyle, type PibblController, type SystemStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

for (const axis of ['row', 'column'] as const) for (const available of [200, Infinity]) for (const own of ['maximum', 'minimum', 'mixed'] as const) {
  it.runIf(nativeLayout)(`resolves a ${axis} owner's percentage ${own} before its leaf percentage phases at ${available}`, async () => {
    const row = axis === 'row', baseline = snapshotWasmLayoutDiagnostics();
    const queries: number[] = [], allocated: number[] = [];
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
      allocated.push(row ? style.width : style.height);
      return <Rectangle style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: row ? { width: 80, height: 20 } : { width: 20, height: 80 } }),
      measure: ({ constraints }) => { queries.push(row ? constraints.maxWidth : constraints.maxHeight); return { status: 'measured', size: row ? { width: 80, height: 20 } : { width: 20, height: 80 } }; },
    });
    const Card = defineLayoutComponent(() => <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row && own !== 'maximum' ? own === 'minimum' ? '75%' : '50%' : 0, minHeight: !row && own !== 'maximum' ? own === 'minimum' ? '75%' : '50%' : 0, maxWidth: row && own !== 'minimum' ? '75%' : undefined, maxHeight: !row && own !== 'minimum' ? '75%' : undefined, flexDirection: axis, alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
      <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%', flexGrow: 0, flexShrink: 0 }} />
      <Rectangle style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>);
    const expectedMain = available === 200 ? own === 'minimum' ? 150 : 109.375 : 120;
    const expectedQuery = available === 200 ? own === 'minimum' ? 50 : 37.5 : Infinity;
    expect(measureElement(<Card />, { minWidth: row ? 0 : 20, maxWidth: row ? available : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : available }, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: expectedMain, height: 20 } : { width: 20, height: expectedMain } });
    expect(queries).toEqual([expectedQuery]); queries.length = 0;
    if (available === 200) {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
      const controller = pibbl(canvas, <Flex style={{ width: row ? 200 : 100, height: row ? 100 : 200, flexDirection: row ? 'column' : 'row', alignItems: 'flex-start' }}><Card /></Flex>);
      controllers.push(controller); await frame();
      expect(allocated).toEqual([own === 'minimum' ? 37.5 : 29.375]); expect(queries).toEqual([expectedQuery]);
      controller.dispose();
    }
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

it.runIf(nativeLayout)('validates own bound syntax, sign, arithmetic and resolved conflicts before provider evaluation', () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  let calls = 0;
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: { width: 80, height: 20 } }),
    measure: () => { calls++; return { status: 'measured', size: { width: 80, height: 20 } }; },
  });
  for (const axis of ['row', 'column'] as const) for (const available of [200, Infinity]) {
    const row = axis === 'row', constraints = { minWidth: row ? 0 : 20, maxWidth: row ? available : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : available };
    const root = (own: Partial<FlexStyle>) => <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexDirection: axis, ...own }}>
      <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%', flexGrow: 0, flexShrink: 0 }} />
    </Flex>;
    for (const property of [row ? 'minWidth' : 'minHeight', row ? 'maxWidth' : 'maxHeight']) for (const value of ['-10%', '25%%', `${'9'.repeat(400)}%`]) {
      expect(() => measureElement(root({ [property]: value } as FlexStyle), constraints, { measureText: () => { throw new Error('No text.'); } }))
        .toThrow(new RegExp(`${property}.*(nonnegative|unsupported|finite)`));
    }
    if (available === 200) {
      expect(() => measureElement(root(row ? { minWidth: '90%', maxWidth: '75%' } : { minHeight: '90%', maxHeight: '75%' }), constraints, { measureText: () => { throw new Error('No text.'); } }))
        .toThrow(/minimum must not exceed maximum/);
      expect(() => measureElement(root({ [row ? 'maxWidth' : 'maxHeight']: `${'1' + '0'.repeat(308)}%` } as FlexStyle), constraints, { measureText: () => { throw new Error('No text.'); } }))
        .toThrow(/resolved percentage arithmetic must remain finite/);
    }
  }
  expect(calls).toBe(0);
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});
