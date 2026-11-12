import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  defineLayoutComponent,
  definePrimitive,
  Flex,
  measureElement,
  Rectangle,
  signal,
  type FlexStyle,
  type PibblController,
  type Percentage,
  type SystemStyle,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(nativeLayout)(
  'keeps a described Card handoff receiver-scoped while an opaque measured Owner paints its returned subtree normally',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const service = { measureText: () => { throw new Error('The Card only uses numeric constrained measurement.'); } };
    interface LeafStyle extends SystemStyle {
      readonly width?: number | 'auto'; readonly height?: number;
      readonly minWidth?: number; readonly maxWidth?: number | Percentage;
      readonly flexGrow?: number; readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedLeafStyle = SystemStyle & { readonly width: number; readonly height: number; readonly fill?: string };
    let calls = 0;
    const paintedWidths: number[] = [], ownerWidths: number[] = [];
    const Leaf = definePrimitive<{}, LeafStyle, LeafStyle, ResolvedLeafStyle>((_props, style) => {
      const box = useLayoutBox();
      paintedWidths.push(box.width);
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ fill: style.fill, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 80, height: 20 } }),
      measure: ({ constraints }) => {
        calls++;
        expect(constraints).toEqual({ minWidth: 0, maxWidth: 40, minHeight: 20, maxHeight: 20 });
        return { status: 'measured' as const, size: { width: 80, height: 20 } };
      },
    });
    const cardStyle: FlexStyle = {
      width: 'auto', height: 20, minWidth: 0, minHeight: 0, maxWidth: 160,
      flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={props.style}>
        <Leaf key="A" style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0, fill: '#b63d3d' }} />
        <Rectangle key="B" style={{ width: 80, height: 20, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
      </Flex>,
    );
    const card = <Card key="card" style={cardStyle} />;
    const constraints = { minWidth: 0, maxWidth: 200, minHeight: 20, maxHeight: 20 };
    expect(measureElement(card, constraints, service)).toEqual({ status: 'measured', size: { width: 110, height: 20 } });
    expect(calls).toBe(1);

    const delegatedSizes: number[] = [];
    const Owner = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => { ownerWidths.push(style.width); return card; }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 160, height: 20 } }),
      measure: ({ constraints: ownerConstraints, measureElement: measure }) => {
        const primary = measure(card, ownerConstraints);
        const discarded = measure(card, { ...ownerConstraints, minWidth: 0, maxWidth: 80 });
        if (primary.status === 'measured') delegatedSizes.push(primary.size.width);
        if (discarded.status === 'measured') delegatedSizes.push(discarded.size.width);
        return primary;
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 100; document.body.append(canvas);
    const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(x, 10, 1, 1).data];
    const outer = (child: import('@pibbl/core').PibblNode) => <Flex style={{ width: 200, height: 80, flexDirection: 'column', alignItems: 'flex-start' }}>{child}</Flex>;

    const direct = pibbl(canvas, outer(card)); controllers.push(direct); await frame();
    expect(pixel(29)).toEqual([182, 61, 61, 255]);
    expect(pixel(31)).toEqual([66, 107, 97, 255]);
    expect(calls).toBe(2);
    direct.dispose();
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

    const delegated = pibbl(canvas, outer(<Owner key="owner" style={cardStyle} />)); controllers.push(delegated); await frame();
    // `measureElement(card, …)` supplies Owner's content size only. The returned
    // Card is a new normal subtree at Owner's final 110px allocation, so its raw
    // 25% cap resolves to 27.5px rather than reusing Card's direct prepared plan.
    expect(pixel(26)).toEqual([182, 61, 61, 255]);
    expect(pixel(29)).toEqual([66, 107, 97, 255]);
    expect(paintedWidths).toEqual([30, 27.5]);
    expect(ownerWidths).toEqual([110]);
    expect(delegatedSizes).toEqual([110, 100]);
    // Distinct parent envelopes retain their own continuation results, while the
    // identical pure 0..40 by 20 leaf demand is shared within this transaction.
    expect(calls).toBe(3);
    delegated.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);

for (const axis of ['row', 'column'] as const) for (const fixture of [
  { available: 40, leaf: 160, queries: [40, 80] },
  { available: 100, leaf: 400, queries: [100, 200] },
  { available: 200, leaf: 800, queries: [200, 400] },
]) {
  it.runIf(nativeLayout)(`preserves native finite recursive percentage-owner phases for a known ${axis} chain at ${fixture.available}`, async () => {
    const row = axis === 'row', baseline = snapshotWasmLayoutDiagnostics();
    const queries: number[] = [], painted: number[] = [];
    const natural = signal(40);
    let failAllocated = false;
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
      const box = useLayoutBox(); painted.push(row ? box.width : box.height);
      return <Rectangle style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: row ? { width: 40, height: 20 } : { width: 20, height: 40 } }),
      measure: ({ constraints }) => {
        expect(row ? [constraints.minWidth, constraints.minHeight, constraints.maxHeight] : [constraints.minHeight, constraints.minWidth, constraints.maxWidth]).toEqual([0, 20, 20]);
        queries.push(row ? constraints.maxWidth : constraints.maxHeight);
        if (failAllocated && (row ? constraints.maxWidth : constraints.maxHeight) === fixture.available * 2) throw new Error('allocated owner failed');
        const main = natural.get();
        return { status: 'measured', size: row ? { width: main, height: 20 } : { width: 20, height: main } };
      },
    });
    const Inner = defineLayoutComponent(() => <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, flexDirection: axis, alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
      <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row ? '200%' : 0, minHeight: row ? 0 : '200%', flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    const root = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexDirection: axis, alignItems: 'flex-start' }}><Inner /></Flex>;
    const service = { measureText: () => { throw new Error('Numeric owner chains do not shape text.'); } };
    expect(measureElement(root, { minWidth: row ? 0 : 20, maxWidth: row ? Infinity : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : Infinity }, service))
      .toEqual({ status: 'measured', size: row ? { width: 40, height: 20 } : { width: 20, height: 40 } });
    expect(queries).toEqual([Infinity]); queries.length = 0;
    const canvas = document.createElement('canvas'); canvas.width = row ? fixture.available : 20; canvas.height = row ? 20 : fixture.available; document.body.append(canvas);
    const controller = pibbl(canvas, root); controllers.push(controller); await frame();
    expect({ painted, queries }).toEqual({ painted: [fixture.leaf], queries: fixture.queries });
    const mounted = snapshotWasmLayoutDiagnostics();
    natural.set(20); await frame();
    expect({ painted, queries }).toEqual({ painted: [fixture.leaf, fixture.leaf], queries: [...fixture.queries, ...fixture.queries] });
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    controller.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    if (fixture.available === 40) {
      failAllocated = true;
      const errors: unknown[] = [];
      const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
      window.addEventListener('error', prevent);
      try {
        const failedController = pibbl(canvas, root); controllers.push(failedController);
        await frame();
        expect(errors).toHaveLength(1);
        expect(String(errors[0])).toContain('allocated owner failed');
        failedController.dispose();
      } finally { window.removeEventListener('error', prevent); }
      const failed = snapshotWasmLayoutDiagnostics();
      expect([failed.activeNodes, failed.activeArenas, failed.cachedMeasurements, failed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
      failAllocated = false;
      const recovered = pibbl(canvas, root); controllers.push(recovered); await frame();
      expect(painted.at(-1)).toBe(fixture.leaf);
      recovered.dispose();
      const cleaned = snapshotWasmLayoutDiagnostics();
      expect([cleaned.activeNodes, cleaned.activeArenas, cleaned.cachedMeasurements, cleaned.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    }
  });
}

for (const axis of ['row', 'column'] as const) for (const branches of [1, 2]) it.runIf(nativeLayout)(`continues finite native owner phases through two known ${axis} descriptors with ${branches} branches`, async () => {
  const row = axis === 'row', baseline = snapshotWasmLayoutDiagnostics();
  const queries: number[] = [], widths: number[] = [];
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
    const box = useLayoutBox(); widths.push(row ? box.width : box.height);
    return <Rectangle style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: row ? { width: 40, height: 20 } : { width: 20, height: 40 } }),
    measure: ({ constraints }) => { queries.push(row ? constraints.maxWidth : constraints.maxHeight); return { status: 'measured', size: row ? { width: 40, height: 20 } : { width: 20, height: 40 } }; },
  });
  const ownerStyle: FlexStyle = { width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, flexDirection: axis, alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 };
  const Inner = defineLayoutComponent(() => <Flex style={ownerStyle}><Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row ? '200%' : 0, minHeight: row ? 0 : '200%', flexGrow: 0, flexShrink: 0 }} /></Flex>);
  const Middle = defineLayoutComponent(() => <Flex style={ownerStyle}>{branches === 1 ? <Inner key="inner" /> : [<Inner key="A" />, <Inner key="B" />]}</Flex>);
  const root = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexDirection: axis, alignItems: 'flex-start' }}><Middle key="middle" /></Flex>;
  expect(measureElement(root, { minWidth: row ? 0 : 20, maxWidth: row ? Infinity : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : Infinity }, { measureText: () => { throw new Error('No text.'); } }))
    .toEqual({ status: 'measured', size: row ? { width: branches * 40, height: 20 } : { width: 20, height: branches * 40 } });
  expect(queries).toEqual(branches === 1 ? [Infinity] : [Infinity, Infinity]); queries.length = 0;
  const canvas = document.createElement('canvas'); canvas.width = row ? 100 : 20; canvas.height = row ? 20 : 100; document.body.append(canvas);
  const controller = pibbl(canvas, root); controllers.push(controller); await frame();
  expect({ widths, queries }).toEqual(branches === 1 ? { widths: [800], queries: [100, 200, 400] } : { widths: [1600, 1600], queries: [100, 100, 400, 400, 800, 800] });
  controller.dispose();
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});

const stagedKnownOwnerCases = [
  { name: 'max-only, no external reference', min: undefined, max: 160, available: Infinity, numericCap: 120, numericFloor: 160, pairedCap: 110, pairedFloor: 160, capQuery: 40, floorQuery: 160 },
  { name: 'max-only, external80', min: undefined, max: 160, available: 80, numericCap: 100, numericFloor: 160, pairedCap: 100, pairedFloor: 160, capQuery: 40, floorQuery: 160 },
  { name: 'max-only, external160', min: undefined, max: 160, available: 160, numericCap: 110, numericFloor: 160, pairedCap: 110, pairedFloor: 160, capQuery: 40, floorQuery: 160 },
  { name: 'max-only, external200', min: undefined, max: 160, available: 200, numericCap: 112.5, numericFloor: 160, pairedCap: 110, pairedFloor: 160, capQuery: 40, floorQuery: 160 },
  { name: 'unbounded', min: undefined, max: undefined, available: Infinity, numericCap: 120, numericFloor: 100, pairedCap: 120, pairedFloor: 100, capQuery: Infinity, floorQuery: Infinity },
  { name: 'min-only', min: 160, max: undefined, available: Infinity, numericCap: 160, numericFloor: 160, pairedCap: 160, pairedFloor: 160, capQuery: Infinity, floorQuery: Infinity },
  { name: 'min-and-max', min: 160, max: 160, available: Infinity, numericCap: 160, numericFloor: 160, pairedCap: 160, pairedFloor: 160, capQuery: 40, floorQuery: 160 },
] as const;

for (const axis of ['row', 'column'] as const) for (const owner of stagedKnownOwnerCases) for (const bound of ['cap', 'floor'] as const) for (const kind of ['numeric', 'paired'] as const) {
  it.runIf(nativeLayout)(`measures a described ${kind} ${axis} Card through the staged ${bound} owner branch: ${owner.name}`, () => {
    const row = axis === 'row';
    const natural = bound === 'cap' ? 80 : 20;
    const queries: number[] = [];
    const before = snapshotWasmLayoutDiagnostics();
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 0 }, maxContent: row ? { width: natural, height: 20 } : { width: 20, height: natural } }),
      measure: ({ constraints }) => {
        queries.push(row ? constraints.maxWidth : constraints.maxHeight);
        expect(row ? [constraints.minHeight, constraints.maxHeight] : [constraints.minWidth, constraints.maxWidth]).toEqual([20, 20]);
        return { status: 'measured' as const, size: row ? { width: natural, height: 20 } : { width: 20, height: natural } };
      },
    });
    const cardStyle: FlexStyle = {
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      minWidth: row ? owner.min : undefined, maxWidth: row ? owner.max : undefined,
      minHeight: row ? undefined : owner.min, maxHeight: row ? undefined : owner.max,
      flexDirection: axis, flexWrap: 'nowrap', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    };
    const child = kind === 'numeric' ?
      <Rectangle key="A" style={{ width: row ? natural : 20, height: row ? 20 : natural, flexBasis: natural, flexGrow: 0, flexShrink: 0, minWidth: row ? (bound === 'floor' ? '50%' : 0) : undefined, maxWidth: row && bound === 'cap' ? '25%' : undefined, minHeight: row ? undefined : (bound === 'floor' ? '50%' : 0), maxHeight: !row && bound === 'cap' ? '25%' : undefined, fill: '#b63d3d' }} /> :
      <Leaf key="A" style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexGrow: 0, flexShrink: 0, minWidth: row ? (bound === 'floor' ? '50%' : 0) : undefined, maxWidth: row && bound === 'cap' ? '25%' : undefined, minHeight: row ? undefined : (bound === 'floor' ? '50%' : 0), maxHeight: !row && bound === 'cap' ? '25%' : undefined }} />;
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) => <Flex style={props.style}>
      {child}
      <Rectangle key="B" style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: '#426b61' }} />
    </Flex>);
    const result = measureElement(<Card style={cardStyle} />, {
      minWidth: row ? 0 : 20, maxWidth: row ? owner.available : 20,
      minHeight: row ? 20 : 0, maxHeight: row ? 20 : owner.available,
    }, { measureText: () => { throw new Error('Known numeric Cards do not shape text.'); } });
    const main = kind === 'numeric' ? owner[bound === 'cap' ? 'numericCap' : 'numericFloor'] : owner[bound === 'cap' ? 'pairedCap' : 'pairedFloor'];
    expect(result).toEqual({ status: 'measured', size: row ? { width: main, height: 20 } : { width: 20, height: main } });
    expect(queries).toEqual(kind === 'paired' ? [owner[bound === 'cap' ? 'capQuery' : 'floorQuery']] : []);
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances]);
  });
}

for (const axis of ['row', 'column'] as const) for (const owner of stagedKnownOwnerCases.slice(1, 4)) for (const bound of ['cap', 'floor'] as const) for (const kind of ['numeric', 'paired'] as const) {
  it.runIf(nativeLayout)(`places a described ${kind} ${axis} Card with staged ${bound} bounds under external${owner.available}`, async () => {
    const row = axis === 'row';
    const natural = bound === 'cap' ? 80 : 20;
    const baseline = snapshotWasmLayoutDiagnostics();
    const hits: string[] = [], queries: number[] = [], allocated: number[] = [];
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
      const box = useLayoutBox(); allocated.push(row ? box.width : box.height);
      return <Rectangle onClick={() => hits.push('A')} style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 0 }, maxContent: row ? { width: natural, height: 20 } : { width: 20, height: natural } }),
      measure: ({ constraints }) => { queries.push(row ? constraints.maxWidth : constraints.maxHeight); return { status: 'measured' as const, size: row ? { width: natural, height: 20 } : { width: 20, height: natural } }; },
    });
    const cardStyle: FlexStyle = { width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? 160 : undefined, maxHeight: row ? undefined : 160, flexDirection: axis, flexWrap: 'nowrap', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 };
    const child = kind === 'numeric' ?
      <Rectangle key="A" onClick={() => hits.push('A')} style={{ width: row ? natural : 20, height: row ? 20 : natural, flexBasis: natural, flexGrow: 0, flexShrink: 0, minWidth: row ? (bound === 'floor' ? '50%' : 0) : undefined, maxWidth: row && bound === 'cap' ? '25%' : undefined, minHeight: row ? undefined : (bound === 'floor' ? '50%' : 0), maxHeight: !row && bound === 'cap' ? '25%' : undefined, fill: '#b63d3d' }} /> :
      <Leaf key="A" style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexGrow: 0, flexShrink: 0, minWidth: row ? (bound === 'floor' ? '50%' : 0) : undefined, maxWidth: row && bound === 'cap' ? '25%' : undefined, minHeight: row ? undefined : (bound === 'floor' ? '50%' : 0), maxHeight: !row && bound === 'cap' ? '25%' : undefined }} />;
    const Card = defineLayoutComponent(() => <Flex style={cardStyle}>{child}<Rectangle key="B" onClick={() => hits.push('B')} style={{ width: row ? 80 : 20, height: row ? 20 : 80, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: '#426b61' }} /></Flex>);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: row ? owner.available : 100, height: row ? 100 : owner.available, flexDirection: row ? 'column' : 'row', alignItems: 'flex-start' }}><Card /></Flex>);
    controllers.push(controller); await frame();
    const main = kind === 'numeric' ? owner[bound === 'cap' ? 'numericCap' : 'numericFloor'] : owner[bound === 'cap' ? 'pairedCap' : 'pairedFloor'];
    // The root max160 can cap the owner below its children's 180px sum.
    // External200 retains its earlier 50%=100 floor; it is not erased by max160.
    const a = bound === 'floor' ? owner.available === 200 ? 100 : 80 : main - 80;
    const context = canvas.getContext('2d')!;
    const pixel = (offset: number) => [...context.getImageData(row ? offset : 10, row ? 10 : offset, 1, 1).data];
    if (kind === 'paired') expect(allocated).toEqual([a]);
    expect(pixel(Math.max(0, Math.floor(a) - 1))).toEqual([182, 61, 61, 255]);
    expect(pixel(Math.ceil(a) + 1)).toEqual([66, 107, 97, 255]);
    const bounds = canvas.getBoundingClientRect();
    const clickAt = (mainOffset: number) => { const x = bounds.left + (row ? mainOffset : 10), y = bounds.top + (row ? 10 : mainOffset); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })); };
    clickAt(Math.max(0, Math.floor(a) - 1)); clickAt(Math.ceil(a) + 1);
    expect(hits).toEqual(['A', 'B']);
    expect(queries).toEqual(kind === 'paired' ? [owner[bound === 'cap' ? 'capQuery' : 'floorQuery']] : []);
    controller.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  });
}
