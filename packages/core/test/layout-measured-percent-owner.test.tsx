import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  createElement,
  defineLayoutComponent,
  definePrimitive,
  Flex,
  measureElement,
  Rectangle,
  signal,
  type FlexStyle,
  type Percentage,
  type RectStyle,
  type PibblController,
  type PibblNode,
  type PibblResponsiveStyle,
  type SystemStyle,
  type Signal,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const service = { measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics };
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}

for (const axis of ['row', 'column'] as const) it.runIf(experimentalLayout)(`stages a nonexact ${axis} percentage cap from provisional owner geometry into final Flex placement`, async () => {
  const horizontal = axis === 'row';
  const row = (fill: string | Signal<string>, hits?: string[]) => <Flex key="row" style={{ width: horizontal ? 'auto' : 20, height: horizontal ? 20 : 'auto', maxWidth: horizontal ? 160 : undefined, maxHeight: horizontal ? undefined : 160, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, flexDirection: axis, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
    <Rectangle key="A" onClick={() => hits?.push('A')} style={{ width: horizontal ? 80 : 20, height: horizontal ? 20 : 80, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, maxWidth: horizontal ? '25%' : undefined, maxHeight: horizontal ? undefined : '25%', fill: '#b63d3d', cursor: 'pointer' }} />
    <Rectangle key="B" onClick={() => hits?.push('B')} style={{ width: horizontal ? 80 : 20, height: horizontal ? 20 : 80, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill, cursor: 'pointer' }} />
  </Flex>;

  expect(measureElement(row('#426b61'), { minWidth: horizontal ? 0 : 20, maxWidth: horizontal ? 200 : 20, minHeight: horizontal ? 20 : 0, maxHeight: horizontal ? 20 : 200 }, service))
    .toEqual({ status: 'measured', size: horizontal ? { width: 112.5, height: 20 } : { width: 20, height: 112.5 } });

  const baseline = snapshotWasmLayoutDiagnostics();
  const owner = signal(200), ink = signal('#426b61'); const hits: string[] = [];
  const App = () => <Flex style={{ width: horizontal ? owner : 100, height: horizontal ? 100 : owner, flexDirection: horizontal ? 'column' : 'row', alignItems: 'flex-start' }}>{row(ink, hits)}</Flex>;
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 220; document.body.append(canvas);
  const controller = pibbl(canvas, <App />); controllers.push(controller); await frame();
  const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(horizontal ? x : 10, horizontal ? 10 : x, 1, 1).data];
  expect(pixel(31)).toEqual([182, 61, 61, 255]); expect(pixel(33)).toEqual([66, 107, 97, 255]);
  click(canvas, horizontal ? 31 : 10, horizontal ? 10 : 31); click(canvas, horizontal ? 33 : 10, horizontal ? 10 : 33); expect(hits).toEqual(['A', 'B']);
  const initial = snapshotWasmLayoutDiagnostics();
  owner.set(160); await frame();
  expect(pixel(29)).toEqual([182, 61, 61, 255]); expect(pixel(31)).toEqual([66, 107, 97, 255]);
  click(canvas, horizontal ? 31 : 10, horizontal ? 10 : 31); expect(hits).toEqual(['A', 'B', 'B']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  ink.set('#a63758'); await frame();
  expect(pixel(31)).toEqual([166, 55, 88, 255]);
  const painted = snapshotWasmLayoutDiagnostics();
  expect([painted.activeWasmInstances, painted.activeArenas, painted.nodeCreates]).toEqual([initial.activeWasmInstances, initial.activeArenas, initial.nodeCreates]);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});

const ownerCases = [
  { name: 'max-only, undefined reference', min: undefined, max: 160, available: Infinity, cap: [120, 40], floor: [160, 80] },
  { name: 'max-only, reference80', min: undefined, max: 160, available: 80, cap: [100, 20], floor: [160, 80] },
  { name: 'max-only, reference160', min: undefined, max: 160, available: 160, cap: [110, 30], floor: [160, 80] },
  { name: 'max-only, reference200', min: undefined, max: 160, available: 200, cap: [112.5, 32.5], floor: [160, 100] },
  { name: 'unbounded', min: undefined, max: undefined, available: Infinity, cap: [120, 40], floor: [100, 20] },
  { name: 'min-only', min: 160, max: undefined, available: Infinity, cap: [160, 40], floor: [160, 20] },
  { name: 'min-and-max', min: 160, max: 160, available: Infinity, cap: [160, 40], floor: [160, 80] },
];
for (const axis of ['row', 'column'] as const) for (const fixture of ownerCases) for (const bound of ['cap', 'floor'] as const) {
  it.runIf(experimentalLayout)(`measures staged percentage ${bound}: ${axis}, ${fixture.name}`, () => {
    const horizontal = axis === 'row';
    const root = <Flex style={{ width: horizontal ? 'auto' : 20, height: horizontal ? 20 : 'auto',
      minWidth: horizontal ? fixture.min : undefined, maxWidth: horizontal ? fixture.max : undefined,
      minHeight: horizontal ? undefined : fixture.min, maxHeight: horizontal ? undefined : fixture.max,
      flexDirection: axis, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Rectangle style={{ width: horizontal ? (bound === 'cap' ? 80 : 20) : 20, height: horizontal ? 20 : (bound === 'cap' ? 80 : 20),
        flexBasis: bound === 'cap' ? 80 : 20, flexGrow: 0, flexShrink: 0,
        minWidth: horizontal ? (bound === 'floor' ? '50%' : 0) : undefined,
        maxWidth: horizontal && bound === 'cap' ? '25%' : undefined,
        minHeight: horizontal ? undefined : (bound === 'floor' ? '50%' : 0),
        maxHeight: !horizontal && bound === 'cap' ? '25%' : undefined, fill: '#b63d3d' }} />
      <Rectangle style={{ width: horizontal ? 80 : 20, height: horizontal ? 20 : 80, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: '#426b61' }} />
    </Flex>;
    const before = snapshotWasmLayoutDiagnostics();
    expect(measureElement(root, { minWidth: horizontal ? 0 : 20, maxWidth: horizontal ? fixture.available : 20,
      minHeight: horizontal ? 20 : 0, maxHeight: horizontal ? 20 : fixture.available }, service))
      .toEqual({ status: 'measured', size: horizontal ? { width: fixture[bound][0], height: 20 } : { width: 20, height: fixture[bound][0] } });
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances])
      .toEqual([before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances]);
  });
}


it.runIf(experimentalLayout)(
  'rejects unsupported staged percentage inputs before callbacks and releases every transient native resource',
  () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const constraints = { minWidth: 0, maxWidth: 200, minHeight: 20, maxHeight: 20 };
    type ChildStyle = Partial<PibblResponsiveStyle<RectStyle>>;
    const root = (childStyle: ChildStyle, rootStyle: Partial<FlexStyle> = {}) => (
      <Flex style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: 160, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', ...rootStyle }}>
        <Rectangle style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: '25%', fill: '#b63d3d', ...childStyle }} />
        <Rectangle style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, fill: '#426b61' }} />
      </Flex>
    );
    for (const [name, childStyle, rootStyle] of [
      ['logical margin', { marginStart: 1 }, {}],
      ['logical padding', { paddingStart: 1 }, {}],
      ['logical border', { borderStartWidth: 1 }, {}],
      ['root padding', {}, { padding: 1 }],
      ['responsive query', { when: [{ query: { minWidth: 0 }, style: { fill: '#a63758' } }] }, {}],
    ] as const) {
      expect(measureElement(root(childStyle, rootStyle), constraints, service), name).toEqual({
        status: 'unsupported', reason: expect.any(String),
      });
    }
    expect(() => measureElement(root({ minWidth: '70%', maxWidth: '25%' }), constraints, service))
      .toThrow(/minimum must not exceed maximum/i);

    interface ExplosiveStyle extends SystemStyle {
      width?: number; height?: number; minWidth?: number; maxWidth?: Percentage;
      flexBasis?: number; flexGrow?: number; flexShrink?: number;
    }
    let providerCalls = 0;
    const Explosive = definePrimitive<{}, ExplosiveStyle, ExplosiveStyle, SystemStyle>(
      () => undefined,
      { resolveStyle: () => ({}), measure: () => { providerCalls++; throw new Error('must not evaluate'); } },
    );
    const providerRoot = <Flex style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: 160, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Explosive style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: '25%' }} />
    </Flex>;
    expect(measureElement(providerRoot, constraints, service)).toEqual({ status: 'unsupported', reason: expect.any(String) });
    expect(providerCalls).toBe(0);

    const cyclicChildren: PibblNode[] = [];
    const cyclic = createElement(Flex, {
      style: { width: 'auto', height: 20, minWidth: 0, maxWidth: 160, flexDirection: 'row', flexWrap: 'nowrap' }, children: cyclicChildren,
    });
    cyclicChildren.push(cyclic);
    // This unmeasurable cyclic owner is rejected before recursive provider discovery.
    expect(measureElement(cyclic, constraints, service)).toEqual({ status: 'unsupported', reason: expect.any(String) });

    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);

it.runIf(experimentalLayout)('rebuilds staged bounds for reordered, removed and signal-updated numeric children', async () => {
  const before = snapshotWasmLayoutDiagnostics(), order = signal<'normal' | 'reverse' | 'only-b'>('normal');
  const limit = signal<Percentage>('25%'), hits: string[] = [];
  const a = <Rectangle key="A" onClick={() => hits.push('A')} style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: limit, fill: '#b63d3d' }} />;
  const b = <Rectangle key="B" onClick={() => hits.push('B')} style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, fill: '#426b61' }} />;
  const App = () => <Flex style={{ width: 200, height: 100, flexDirection: 'column', alignItems: 'flex-start' }}>
    <Flex key="row" style={{ width: 'auto', height: 20, minWidth: 0, minHeight: 0, maxWidth: 160, flexBasis: 20, flexGrow: 0, flexShrink: 0, alignItems: 'flex-start' }}>
      {order.get() === 'only-b' ? [b] : order.get() === 'reverse' ? [b, a] : [a, b]}
    </Flex>
  </Flex>;
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 120; document.body.append(canvas);
  const controller = pibbl(canvas, <App />); controllers.push(controller); await frame();
  const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(x, 10, 1, 1).data];
  const initial = snapshotWasmLayoutDiagnostics();
  click(canvas, 31, 10); expect(hits).toEqual(['A']);
  order.set('reverse'); await frame();
  expect(pixel(31)).toEqual([66, 107, 97, 255]); expect(pixel(81)).toEqual([182, 61, 61, 255]);
  click(canvas, 31, 10); click(canvas, 81, 10); expect(hits).toEqual(['A', 'B', 'A']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  limit.set('50%'); await frame();
  expect(pixel(150)).toEqual([182, 61, 61, 255]);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  order.set('only-b'); await frame();
  expect(pixel(79)).toEqual([66, 107, 97, 255]); expect(pixel(90)).toEqual([0, 0, 0, 0]);
  controller.dispose();
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
    before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances,
  ]);
});


it.runIf(experimentalLayout)(
  'stages numeric percentage bounds through a described Flex owner, including a paired owner measurement callback',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const constraints = { minWidth: 0, maxWidth: 200, minHeight: 20, maxHeight: 20 };
    const rowStyle: FlexStyle = {
      width: 'auto', height: 20, minWidth: 0, minHeight: 0, maxWidth: 160,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', flexBasis: 20, flexGrow: 0, flexShrink: 0,
    };
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={props.style}>
        <Rectangle key="A" style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: '25%', fill: '#b63d3d' }} />
        <Rectangle key="B" style={{ width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, fill: '#426b61' }} />
      </Flex>,
    );
    const card = <Card key="card" style={rowStyle} />;

    expect(measureElement(card, constraints, service)).toEqual({
      status: 'measured', size: { width: 112.5, height: 20 },
    });

    interface OwnerStyle extends SystemStyle {
      readonly width?: number | 'auto'; readonly height?: number;
      readonly minWidth?: number; readonly minHeight?: number; readonly maxWidth?: number | Percentage;
    }
    type ResolvedOwnerStyle = SystemStyle & { readonly width: number; readonly height: number };
    let ownerCalls = 0;
    const Owner = definePrimitive<{}, OwnerStyle, OwnerStyle, ResolvedOwnerStyle>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 160, height: 20 },
      }),
      measure: ({ constraints: ownerConstraints, measureElement: measure }) => {
        ownerCalls++;
        return measure(card, ownerConstraints);
      },
    });
    expect(measureElement(<Owner style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: 160 }} />, constraints, service)).toEqual({
      status: 'measured', size: { width: 112.5, height: 20 },
    });
    expect(ownerCalls).toBe(1);

    // A direct provider leaf is still outside staged numeric-owner admission.
    let leafCalls = 0;
    const Leaf = definePrimitive<{}, OwnerStyle, OwnerStyle, ResolvedOwnerStyle>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 80, height: 20 },
      }),
      measure: () => { leafCalls++; return { status: 'measured' as const, size: { width: 80, height: 20 } }; },
    });
    const unsupported = <Flex style={rowStyle}>
      <Leaf style={{ width: 80, height: 20, minWidth: 0, maxWidth: '25%' }} />
      <Rectangle style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
    </Flex>;
    expect(measureElement(unsupported, constraints, service)).toEqual({ status: 'unsupported', reason: expect.any(String) });
    expect(leafCalls).toBe(0);


    const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 120; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 200, height: 100, flexDirection: 'column', alignItems: 'flex-start' }}><Card style={rowStyle} /></Flex>);
    controllers.push(controller); await frame();
    const context = canvas.getContext('2d')!;
    expect([...context.getImageData(31, 10, 1, 1).data]).toEqual([182, 61, 61, 255]);
    expect([...context.getImageData(33, 10, 1, 1).data]).toEqual([66, 107, 97, 255]);
    controller.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);
