import { afterEach, beforeAll, expect, it } from 'vitest';
import { definePrimitive, Flex, measureElement, Rectangle, signal, Text, type PibblController, type FlexStyle, type PibblNode, type PibblElement, type PibblResponsiveStyle, type MeasureResult, type SystemStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
const service = { measureText: () => { throw new Error('Numeric provider must not shape text.'); } };
const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });

for (const axis of ['row', 'column'] as const) it.runIf(nativeLayout)(`uses the initial max envelope for a paired ${axis} leaf query before the later native percentage cap`, async () => {
  const row = axis === 'row';
  const before = snapshotWasmLayoutDiagnostics();
  const natural = signal(80), owner = signal(200);
  let expectedArenas = before.activeArenas;
  const hits: string[] = [];
  const calls: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number }[] = [];
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => <Rectangle onClick={() => hits.push('A')} style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 20 }, maxContent: { width: 80, height: 20 } }),
    measure: ({ constraints }) => {
      expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(expectedArenas);
      calls.push({ ...constraints });
      return { status: 'measured', size: row ? { width: natural.get(), height: 20 } : { width: 20, height: natural.get() } };
    },
  });
  const root = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? 160 : undefined, maxHeight: row ? undefined : 160, flexDirection: axis, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
    <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%', flexGrow: 0, flexShrink: 0 }} />
    <Rectangle style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0 }} />
  </Flex>;
  expect(measureElement(root, { minWidth: row ? 0 : 20, maxWidth: row ? Infinity : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : Infinity }, { measureText: () => { throw new Error('Numeric provider must not shape text.'); } }))
    .toEqual({ status: 'measured', size: row ? { width: 110, height: 20 } : { width: 20, height: 110 } });
  expect(calls).toEqual([row ? { minWidth: 0, maxWidth: 40, minHeight: 20, maxHeight: 20 } : { minWidth: 20, maxWidth: 20, minHeight: 0, maxHeight: 40 }]);

  calls.length = 0;
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 220; document.body.append(canvas);
  const App = () => <Flex style={{ width: row ? owner : 100, height: row ? 100 : owner, flexDirection: row ? 'column' : 'row', alignItems: 'flex-start' }}>
    <Flex key="row" style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? 160 : undefined, maxHeight: row ? undefined : 160, flexBasis: 20, flexGrow: 0, flexShrink: 0, flexDirection: axis, alignItems: 'flex-start' }}>
      <Leaf key="A" style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%', flexGrow: 0, flexShrink: 0 }} />
      <Rectangle key="B" onClick={() => hits.push('B')} style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>
  </Flex>;
  expectedArenas = before.activeArenas;
  const controller = pibbl(canvas, <App />); controllers.push(controller); await frame();
  const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(row ? x : 10, row ? 10 : x, 1, 1).data];
  expect(pixel(29)).toEqual([182, 61, 61, 255]); expect(pixel(31)).toEqual([66, 107, 97, 255]);
  const mounted = snapshotWasmLayoutDiagnostics(); expectedArenas = mounted.activeArenas;
  expect(calls).toHaveLength(1);
  owner.set(160); await frame(); expect(calls).toHaveLength(2);
  expect(pixel(29)).toEqual([182, 61, 61, 255]); expect(pixel(31)).toEqual([66, 107, 97, 255]);
  natural.set(20); await frame(); expect(calls).toHaveLength(3);
  expect(pixel(19)).toEqual([182, 61, 61, 255]); expect(pixel(21)).toEqual([66, 107, 97, 255]);
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + (row ? 25 : 10), clientY: bounds.top + (row ? 10 : 25) }));
  expect(hits).toEqual(['B']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances])
    .toEqual([before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances]);
});

const phases = [
  { name: 'max, no external reference', min: undefined, max: 160, available: Infinity, cap: 110, floor: 160, queryCap: 40, queryFloor: 160 },
  { name: 'max, external80', min: undefined, max: 160, available: 80, cap: 100, floor: 160, queryCap: 40, queryFloor: 160 },
  { name: 'max, external160', min: undefined, max: 160, available: 160, cap: 110, floor: 160, queryCap: 40, queryFloor: 160 },
  { name: 'max, external200', min: undefined, max: 160, available: 200, cap: 110, floor: 160, queryCap: 40, queryFloor: 160 },
  { name: 'unbounded', min: undefined, max: undefined, available: Infinity, cap: 120, floor: 100, queryCap: Infinity, queryFloor: Infinity },
  { name: 'min-only', min: 160, max: undefined, available: Infinity, cap: 160, floor: 160, queryCap: Infinity, queryFloor: Infinity },
  { name: 'min-and-max', min: 160, max: 160, available: Infinity, cap: 160, floor: 160, queryCap: 40, queryFloor: 160 },
];
for (const axis of ['row', 'column'] as const) for (const phase of phases) for (const bound of ['cap', 'floor'] as const) {
  it.runIf(nativeLayout)(`keeps measured ${axis} ${bound} query and continuation phases separate: ${phase.name}`, () => {
    const row = axis === 'row', natural = bound === 'cap' ? 80 : 20;
    const before = snapshotWasmLayoutDiagnostics(), queries: number[] = [];
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: row ? { width: natural, height: 20 } : { width: 20, height: natural } }),
      measure: ({ constraints }) => {
        expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(before.activeArenas);
        queries.push(row ? constraints.maxWidth : constraints.maxHeight);
        expect(row ? [constraints.minHeight, constraints.maxHeight] : [constraints.minWidth, constraints.maxWidth]).toEqual([20, 20]);
        return { status: 'measured', size: row ? { width: natural, height: 20 } : { width: 20, height: natural } };
      },
    });
    const root = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      minWidth: row ? phase.min : undefined, maxWidth: row ? phase.max : undefined,
      minHeight: row ? undefined : phase.min, maxHeight: row ? undefined : phase.max,
      flexDirection: axis, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexGrow: 0, flexShrink: 0,
        minWidth: row ? bound === 'floor' ? '50%' : 0 : undefined, maxWidth: row && bound === 'cap' ? '25%' : undefined,
        minHeight: row ? undefined : bound === 'floor' ? '50%' : 0, maxHeight: !row && bound === 'cap' ? '25%' : undefined }} />
      <Rectangle style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
    </Flex>;
    expect(measureElement(root, { minWidth: row ? 0 : 20, maxWidth: row ? phase.available : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : phase.available }, { measureText: () => { throw new Error('Numeric provider must not shape text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: phase[bound], height: 20 } : { width: 20, height: phase[bound] } });
    expect(queries).toEqual([bound === 'cap' ? phase.queryCap : phase.queryFloor]);
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances])
      .toEqual([before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances]);
  });
}


it.runIf(nativeLayout)(
  'releases the native query arena for paired-leaf failure, unsupported and cyclic callback outcomes',
  () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const constraints = { minWidth: 0, maxWidth: Infinity, minHeight: 20, maxHeight: 20 };
    type Result = MeasureResult;
    const root = (leaf: PibblNode) => <Flex style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: 160, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      {leaf}
      <Rectangle style={{ width: 80, height: 20, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0 }} />
    </Flex>;
    interface LeafStyle extends FlexStyle { readonly width?: number | 'auto'; readonly height?: number; }
    type ResolvedLeafStyle = SystemStyle & { readonly width: number; readonly height: number };
    const makeLeaf = (result: () => Result) => {
      const Leaf = definePrimitive<{}, LeafStyle, LeafStyle, ResolvedLeafStyle>(() => null, {
        resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
        measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 80, height: 20 } }),
        measure: () => {
          expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
          return result();
        },
      });
      return <Leaf style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0 }} />;
    };

    expect(() => measureElement(root(makeLeaf(() => { throw new Error('provider boom'); })), constraints, service)).toThrow('provider boom');
    expect(measureElement(root(makeLeaf(() => ({ status: 'unsupported', reason: 'deliberate provider boundary' }))), constraints, service))
      .toEqual({ status: 'unsupported', reason: 'deliberate provider boundary' });
    expect(() => measureElement(root(makeLeaf(() => ({ status: 'measured', size: { width: Number.NaN, height: 20 } }))), constraints, service))
      .toThrow(/finite|invalid/i);

    let cyclic: PibblElement;
    const Cyclic = definePrimitive<{}, LeafStyle, LeafStyle, ResolvedLeafStyle>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 80, height: 20 } }),
      measure: ({ constraints: nestedConstraints, measureElement: measure }) => {
        expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
        return measure(cyclic, nestedConstraints);
      },
    });
    cyclic = <Cyclic style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0 }} />;
    expect(() => measureElement(root(cyclic), constraints, service)).toThrow(/cyclic measurement dependency/i);

    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);

it.runIf(nativeLayout)(
  'uses every paired leaf’s own finite cross constraint and rejects out-of-profile direct children before callbacks',
  () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const constraints = { minWidth: 0, maxWidth: Infinity, minHeight: 50, maxHeight: 50 };
    let calls = 0;
    interface LeafStyle extends FlexStyle { readonly width?: number | 'auto'; readonly height?: number; }
    type ResolvedLeafStyle = SystemStyle & { readonly width: number; readonly height: number };
    const Leaf = definePrimitive<{ readonly children?: PibblNode }, LeafStyle, LeafStyle, ResolvedLeafStyle>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 30 }, maxContent: { width: 80, height: 30 } }),
      measure: ({ constraints: leafConstraints }) => {
        calls++;
        expect(leafConstraints).toEqual({ minWidth: 0, maxWidth: 40, minHeight: 30, maxHeight: 30 });
        return { status: 'measured' as const, size: { width: 80, height: 30 } };
      },
    });
    const root = (child: PibblNode, style: Partial<FlexStyle> = {}) => <Flex style={{ width: 'auto', height: 50, minWidth: 0, maxWidth: 160, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', ...style }}>
      {child}
      <Rectangle style={{ width: 80, height: 30, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0 }} />
    </Flex>;
    const direct = (style: Partial<PibblResponsiveStyle<LeafStyle>> = {}, children?: PibblNode) => children === undefined ?
      <Leaf style={{ width: 'auto', height: 30, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0, ...style }} /> :
      <Leaf style={{ width: 'auto', height: 30, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0, ...style }}>{children}</Leaf>;

    expect(measureElement(root(direct()), constraints, service)).toEqual({ status: 'measured', size: { width: 110, height: 50 } });
    expect(calls).toBe(1);
    expect(() => measureElement(root(direct({ minWidth: 100 })), constraints, service)).toThrow(/minimum must not exceed maximum/i);
    expect(calls).toBe(1);
    for (const [name, child, rootStyle] of [
      ['child-bearing leaf', direct({}, <Rectangle style={{ width: 1, height: 1 }} />), {}],
      ['known Flex child', <Flex children={null} style={{ width: 'auto', height: 30, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0 }} />, {}],
      ['Text child', <Text style={{ width: 'auto', height: 30, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0 }}>text</Text>, {}],
      ['nonzero grow', direct({ flexGrow: 1 }), {}],
      ['nonzero shrink', direct({ flexShrink: 1 }), {}],
      ['responsive query', direct({ when: [{ query: { minWidth: 0 }, style: { left: 0 } }] }), {}],
      ['active cross bound', direct({ minHeight: 1 }), {}],
      ['root cross bound', direct(), { minHeight: 1 }],
    ] as const) {
      expect(measureElement(root(child, rootStyle), constraints, service), name).toEqual({ status: 'unsupported', reason: expect.any(String) });
    }
    expect(calls).toBe(1);
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);
