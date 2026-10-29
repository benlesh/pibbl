import { afterEach, beforeAll, expect, it } from 'vitest';
import { defineLayoutComponent, definePrimitive, Flex, measureElement, Rectangle, signal, type FlexStyle, type PibblController, type SystemStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

for (const axis of ['row', 'column'] as const) for (const maximum of [160, '75%'] as const) for (const described of [false, true]) {
  it.runIf(nativeLayout)(`keeps a ${described ? 'described' : 'direct'} ${axis} owner's main contribution distinct from final content under max${maximum}`, async () => {
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
    const card = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row ? 100 : 0, minHeight: row ? 0 : 100, maxWidth: row ? maximum : undefined, maxHeight: row ? undefined : maximum, flexDirection: axis, alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
      <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%', flexGrow: 0, flexShrink: 0 }} />
      <Rectangle style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>;
    const Card = defineLayoutComponent(() => card);
    const owner = described ? <Card /> : card;
    const naturalMain = maximum === 160 ? 110 : 109.375;
    expect(measureElement(owner, { minWidth: row ? 0 : 20, maxWidth: row ? 200 : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : 200 }, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: naturalMain, height: 20 } : { width: 20, height: naturalMain } });
    expect(queries).toEqual([maximum === 160 ? 40 : 37.5]); queries.length = 0;
    const parent = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexDirection: axis, alignItems: 'flex-start' }}>{owner}</Flex>;
    const contribution = maximum === 160 ? 120 : 117.5;
    const parentQuery = measureElement(parent, { minWidth: row ? 0 : 20, maxWidth: row ? 200 : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : 200 }, { measureText: () => { throw new Error('No text.'); } });
    if (maximum === 160) {
      expect(parentQuery).toEqual({ status: 'measured', size: row ? { width: contribution, height: 20 } : { width: 20, height: contribution } });
      expect(queries).toEqual([40]);
    } else {
      // The extra auto parent leaves a percentage child-bound graph outside the
      // current pure structural measurement admission. Do not call it parity.
      expect(parentQuery).toEqual({ status: 'unsupported', reason: expect.stringContaining(`requires an exact finite ${row ? 'row width' : 'column height'} to resolve percentage main bounds`) });
      expect(queries).toEqual([]);
    }
    queries.length = 0;
    const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 220; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: row ? 200 : 20, height: row ? 20 : 200, flexDirection: axis, alignItems: 'flex-start' }}>{owner}</Flex>);
    controllers.push(controller); await frame();
    expect({ allocated, queries }).toEqual(maximum === 160 ? { allocated: [30], queries: [40, 30] } : { allocated: [29.375], queries: [37.5, 29.375] });
    controller.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

it.runIf(nativeLayout)('keeps query roles separate across parent direction changes and provider-only updates', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<'row' | 'column'>('column'), natural = signal(80);
  const queries: number[] = [], allocated: number[] = [];
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
    allocated.push(style.width);
    return <Rectangle style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: { width: 80, height: 20 } }),
    measure: ({ constraints }) => { queries.push(constraints.maxWidth); return { status: 'measured', size: { width: natural.get(), height: 20 } }; },
  });
  const Card = defineLayoutComponent(() => <Flex style={{ width: 'auto', height: 20, minWidth: 100, minHeight: 0, maxWidth: 160, flexDirection: 'row', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
    <Leaf style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0 }} />
    <Rectangle style={{ width: 80, height: 20, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0 }} />
  </Flex>);
  const App = () => <Flex style={{ width: 200, height: 100, flexDirection: direction, alignItems: 'flex-start' }}><Card key="card" /></Flex>;
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 120; document.body.append(canvas);
  const controller = pibbl(canvas, <App />); controllers.push(controller); await frame();
  expect({ allocated, queries }).toEqual({ allocated: [30], queries: [40] });
  const mounted = snapshotWasmLayoutDiagnostics();
  direction.set('row'); await frame();
  expect({ allocated, queries }).toEqual({ allocated: [30, 30], queries: [40, 40, 30] });
  natural.set(20); await frame();
  expect({ allocated, queries }).toEqual({ allocated: [30, 30, 20], queries: [40, 40, 30, 40, 25] });
  direction.set('column'); await frame();
  expect({ allocated, queries }).toEqual({ allocated: [30, 30, 20, 20], queries: [40, 40, 30, 40, 25, 40] });
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
  const queryCount = queries.length;
  natural.set(80); direction.set('row'); await frame();
  expect(queries).toHaveLength(queryCount);
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});
