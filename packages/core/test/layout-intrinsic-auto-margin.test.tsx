import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, defineLayoutComponent, definePrimitive, measureElement, signal, useConst, type SystemStyle, type FlexStyle, type RectStyle, type PibblController } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

for (const axis of ['row', 'column'] as const) for (const mode of ['start', 'both'] as const) {
  it.runIf(experimentalLayout)(`treats ${axis} ${mode} auto main margins as zero for pure contribution, then allocates final free space`, async () => {
    const row = axis === 'row';
    const minimum = 200;
    const firstStyle: RectStyle = row ? {
      width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginLeft: 'auto', ...(mode === 'both' ? { marginRight: 'auto' } : {}),
    } : {
      width: 20, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginTop: 'auto', ...(mode === 'both' ? { marginBottom: 'auto' } : {}),
    };
    const secondStyle: RectStyle = row ? {
      width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0,
    } : {
      width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0,
    };
    const owner = <Flex style={{
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      minWidth: row ? minimum : 0, minHeight: row ? 0 : minimum,
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    }}>
      <Rectangle style={firstStyle} />
      <Rectangle style={secondStyle} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : 20, maxWidth: row ? Number.POSITIVE_INFINITY : 20,
      minHeight: row ? 20 : 0, maxHeight: row ? 20 : Number.POSITIVE_INFINITY,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: 20 } : { width: 20, height: 120 },
    });

    const baseline = snapshotWasmLayoutDiagnostics();
    let hits = 0;
    const mounted = <Flex style={{ width: row ? 200 : 20, height: row ? 20 : 200, flexDirection: axis, alignItems: 'flex-start' }}>
      <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row ? minimum : 0, minHeight: row ? 0 : minimum, flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
        <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: "#8a3248" }} />
        <Rectangle key="B" style={{ ...secondStyle, fill: "#426b61" }} />
      </Flex>
    </Flex>;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, mounted); controllers.push(controller); await frame();
    const mainA = mode === 'start' ? 80 : 40;
    const pixel = (main: number) => [...canvas.getContext('2d')!.getImageData(row ? main : 4, row ? 4 : main, 1, 1).data];
    expect(pixel(mainA - 1)).toEqual([0, 0, 0, 0]);
    expect(pixel(mainA)).toEqual([138, 50, 72, 255]);
    expect(pixel(mainA + 39)).toEqual([138, 50, 72, 255]);
    expect(pixel(120)).toEqual([66, 107, 97, 255]);
    expect(pixel(199)).toEqual([66, 107, 97, 255]);
    expect(pixel(200)).toEqual([0, 0, 0, 0]);
    const initial = snapshotWasmLayoutDiagnostics();
    const point = row ? { x: mainA + 4, y: 4 } : { x: 4, y: mainA + 4 };
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + point.x, clientY: rect.top + point.y })); await frame();
    expect(hits).toBe(1);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    expect(initial.nodeCreates).toBeGreaterThanOrEqual(baseline.nodeCreates + 2);
  });
}


it.runIf(experimentalLayout)('keeps automatic physical main margins out of pure size, across finite and unbounded availability', () => {
  for (const axis of ['row', 'column'] as const) for (const maximum of [200, Number.POSITIVE_INFINITY]) {
    const row = axis === 'row';
    const owner = <Flex style={{
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      maxWidth: row ? 160 : undefined, maxHeight: row ? undefined : 160,
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start',
    }}>
      <Rectangle style={row ? { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 'auto' } : { width: 20, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: 'auto' }} />
      <Rectangle style={row ? { width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 } : { width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : 20, maxWidth: row ? maximum : 20,
      minHeight: row ? 20 : 0, maxHeight: row ? 20 : maximum,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: 20 } : { width: 20, height: 120 },
    });
  }
  const crossAuto = <Flex style={{ width: 'auto', height: 20, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr' }}>
    <Rectangle style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: 'auto', marginStart: '5%' }} />
  </Flex>;
  expect(measureElement(crossAuto, { minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: 20, maxHeight: 20 }, { measureText: () => { throw new Error('No text.'); } }))
    .toEqual({ status: 'unsupported', reason: expect.stringMatching(/percentage margin/i) });
});

it.runIf(experimentalLayout)('reuses direct automatic-margin targets while an owner minimum changes final free space', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const minimum = signal(200), hits: string[] = [];
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 80; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 200, height: 20, alignItems: 'flex-start' }}>
    <Flex style={{ width: 'auto', height: 20, minWidth: minimum, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
      <Rectangle key="A" onClick={() => { hits.push('A'); }} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 'auto', fill: '#8a3248', cursor: 'pointer' }} />
      <Rectangle key="B" onClick={() => { hits.push('B'); }} style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61', cursor: 'pointer' }} />
    </Flex>
  </Flex>);
  controllers.push(controller); await frame();
  const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(x, 4, 1, 1).data];
  expect(pixel(79)).toEqual([0, 0, 0, 0]); expect(pixel(80)).toEqual([138, 50, 72, 255]); expect(pixel(120)).toEqual([66, 107, 97, 255]);
  for (const type of ['mousedown', 'mouseup', 'click']) { const rect = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + 84, clientY: rect.top + 4 })); } await frame();
  expect(hits).toEqual(['A']);
  const mounted = snapshotWasmLayoutDiagnostics();
  minimum.set(120); await frame();
  expect(pixel(0)).toEqual([138, 50, 72, 255]); expect(pixel(40)).toEqual([66, 107, 97, 255]);
  for (const type of ['mousedown', 'mouseup', 'click']) { const rect = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + 84, clientY: rect.top + 4 })); } await frame();
  expect(hits).toEqual(['A', 'B']);
  const moved = snapshotWasmLayoutDiagnostics();
  expect(moved.nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});

for (const axis of ['row', 'column'] as const) {
  it.runIf(experimentalLayout)(`treats a physical ${axis} cross auto margin as zero for pure size, then places it in the final cross owner`, async () => {
    const row = axis === 'row';
    const firstStyle: RectStyle = row
      ? { width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: 'auto' }
      : { width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 'auto' };
    const secondStyle: RectStyle = row
      ? { width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }
      : { width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 };
    const owner = <Flex style={{
      width: row ? 'auto' : 200, height: row ? 200 : 'auto',
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    }}>
      <Rectangle style={firstStyle} />
      <Rectangle style={secondStyle} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : 200, maxWidth: row ? Number.POSITIVE_INFINITY : 200,
      minHeight: row ? 200 : 0, maxHeight: row ? 200 : Number.POSITIVE_INFINITY,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: 200 } : { width: 200, height: 120 },
    });

    const baseline = snapshotWasmLayoutDiagnostics();
    const cross = signal(200);
    let hits = 0;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, row
      ? <Flex style={{ width: 120, height: cross, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Flex style={{ width: 'auto', height: cross, minWidth: 0, minHeight: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>
      : <Flex style={{ width: cross, height: 120, flexDirection: 'column', alignItems: 'flex-start' }}>
          <Flex style={{ width: cross, height: 'auto', minWidth: 0, minHeight: 0, flexDirection: 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>,
    );
    controllers.push(controller); await frame();
    const pixel = (x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
    const initialPoint = row ? { x: 4, y: 164 } : { x: 164, y: 4 };
    const movedPoint = row ? { x: 4, y: 124 } : { x: 124, y: 4 };
    const emptyPoint = row ? { x: 4, y: 156 } : { x: 156, y: 4 };
    expect(pixel(initialPoint.x, initialPoint.y)).toEqual([138, 50, 72, 255]);
    expect(pixel(emptyPoint.x, emptyPoint.y)).toEqual([0, 0, 0, 0]);
    const dispatch = (point: { x: number; y: number }) => {
      const rect = canvas.getBoundingClientRect();
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + point.x, clientY: rect.top + point.y }));
    };
    dispatch(initialPoint); await frame(); expect(hits).toBe(1);
    const initial = snapshotWasmLayoutDiagnostics();
    cross.set(160); await frame();
    expect(pixel(initialPoint.x, initialPoint.y)).toEqual([0, 0, 0, 0]);
    expect(pixel(movedPoint.x, movedPoint.y)).toEqual([138, 50, 72, 255]);
    dispatch(initialPoint); await frame(); expect(hits).toBe(1);
    dispatch(movedPoint); await frame(); expect(hits).toBe(2);
    const moved = snapshotWasmLayoutDiagnostics();
    expect(moved.nodeCreates).toBe(initial.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const axis of ['row', 'column'] as const) for (const profile of [
  { name: 'both auto', cross: 200, expected: 80, margins: { before: 'auto' as const, after: 'auto' as const } },
  { name: 'overflow', cross: 20, expected: 0, margins: { before: 'auto' as const, after: undefined } },
  { name: 'numeric opposite', cross: 200, expected: 150, margins: { before: 'auto' as const, after: 10 } },
]) {
  it.runIf(experimentalLayout)(`keeps ${axis} ${profile.name} cross auto margins out of pure contribution and applies final cross placement`, async () => {
    const row = axis === 'row';
    const firstStyle: RectStyle = row ? {
      width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginTop: profile.margins.before, marginBottom: profile.margins.after,
    } : {
      width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginLeft: profile.margins.before, marginRight: profile.margins.after,
    };
    const secondStyle: RectStyle = row
      ? { width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }
      : { width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 };
    const owner = <Flex style={{
      width: row ? 'auto' : profile.cross, height: row ? profile.cross : 'auto',
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    }}>
      <Rectangle style={firstStyle} />
      <Rectangle style={secondStyle} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : profile.cross, maxWidth: row ? Number.POSITIVE_INFINITY : profile.cross,
      minHeight: row ? profile.cross : 0, maxHeight: row ? profile.cross : Number.POSITIVE_INFINITY,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: profile.cross } : { width: profile.cross, height: 120 },
    });

    const baseline = snapshotWasmLayoutDiagnostics();
    let hits = 0;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, row
      ? <Flex style={{ width: 120, height: profile.cross, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Flex style={{ width: 'auto', height: profile.cross, minWidth: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>
      : <Flex style={{ width: profile.cross, height: 120, flexDirection: 'column', alignItems: 'flex-start' }}>
          <Flex style={{ width: profile.cross, height: 'auto', minHeight: 0, flexDirection: 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>,
    );
    controllers.push(controller); await frame();
    const point = row ? { x: 4, y: profile.expected + 4 } : { x: profile.expected + 4, y: 4 };
    const pixel = [...canvas.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data];
    expect(pixel).toEqual([138, 50, 72, 255]);
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + point.x, clientY: rect.top + point.y }));
    await frame(); expect(hits).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.nodeCreates).toBeGreaterThanOrEqual(baseline.nodeCreates + 2);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}


it.runIf(experimentalLayout)('normalizes shorthand, paired-provider cross, logical known-owner, and wrapped numeric auto margins after their existing admissions succeed', () => {
  const service = { measureText: () => { throw new Error('No text.'); } };
  const rowConstraints = { minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: 20, maxHeight: 20 };
  const direct = (edge: Partial<RectStyle>) => <Flex style={{ width: 'auto', height: 20, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
    <Rectangle style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, ...edge }} />
    <Rectangle style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }} />
  </Flex>;
  const directExpected = { status: 'measured' as const, size: { width: 120, height: 20 } };
  expect(measureElement(direct({ marginLeft: 0 }), rowConstraints, service)).toEqual(directExpected);
  expect(measureElement(direct({ margin: 'auto', marginLeft: 0 }), rowConstraints, service)).toEqual(directExpected);

  type ProviderStyle = FlexStyle;
  type ResolvedProviderStyle = SystemStyle & { readonly width: number; readonly height: number };
  const measured = (calls: number[]) => definePrimitive<{}, ProviderStyle, ProviderStyle, ResolvedProviderStyle>(() => null, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 40, height: 20 }, maxContent: { width: 40, height: 20 } }),
    measure: ({ constraints }) => {
      calls.push(constraints.maxWidth);
      return { status: 'measured' as const, size: { width: 40, height: 20 } };
    },
  });
  const providerCalls: number[] = [], autoProviderCalls: number[] = [];
  const Fixed = measured(providerCalls), AutoCross = measured(autoProviderCalls);
  const providerOwner = (Leaf: typeof Fixed, marginTop: 0 | 'auto') => <Flex style={{ width: 200, height: 'auto', flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
    <Leaf style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop }} />
    <Rectangle style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }} />
  </Flex>;
  const providerConstraints = { minWidth: 200, maxWidth: 200, minHeight: 0, maxHeight: Number.POSITIVE_INFINITY };
  expect(measureElement(providerOwner(Fixed, 0), providerConstraints, service)).toEqual({ status: 'measured', size: { width: 200, height: 20 } });
  expect(measureElement(providerOwner(AutoCross, 'auto'), providerConstraints, service)).toEqual({ status: 'measured', size: { width: 200, height: 20 } });
  expect(providerCalls.length).toBeGreaterThan(0); expect(autoProviderCalls.length).toBeGreaterThan(0);

  const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) => <Flex style={props.style}>
    <Rectangle key="A" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
    <Rectangle key="B" style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }} />
  </Flex>);
  const knownOwner = (marginStart: 0 | 'auto') => <Flex style={{ width: 'auto', height: 20, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
    <Card style={{ width: 'auto', height: 20, minWidth: 0, minHeight: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0, marginStart }} />
    <Rectangle style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
  </Flex>;
  const knownExpected = { status: 'measured' as const, size: { width: 140, height: 20 } };
  expect(measureElement(knownOwner(0), rowConstraints, service)).toEqual(knownExpected);
  expect(measureElement(knownOwner('auto'), rowConstraints, service)).toEqual(knownExpected);

  const wrapped = <Flex style={{ width: 160, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
    <Rectangle style={{ width: 70, height: 20, minWidth: 0, minHeight: 0, flexBasis: 'auto', flexGrow: 0, flexShrink: 0, margin: 'auto', marginLeft: 0 }} />
  </Flex>;
  expect(measureElement(wrapped, { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 300 }, service)).toEqual({ status: 'measured', size: { width: 160, height: 20 } });
});


it.runIf(experimentalLayout)('keeps a paired provider’s pure cross query and final logical/main plus physical/cross auto placement coherent', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const natural = signal(20);
  const calls: number[] = [];
  const hits: string[] = [];
  let stamps = 0;
  type ProviderStyle = FlexStyle & { readonly fill?: string };
  type ResolvedProviderStyle = SystemStyle & { readonly width: number; readonly height: number; readonly fill?: string };
  const Leaf = definePrimitive<{ readonly natural: typeof natural }, ProviderStyle, ProviderStyle, ResolvedProviderStyle>((_props, style) => {
    const stamp = useConst(() => ++stamps);
    return <Rectangle onClick={() => hits.push(`A:${stamp}`)} style={{ width: style.width, height: style.height, fill: style.fill, cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['natural'],
    resolveStyle: (style, context) => ({ width: context.allocation.width, height: context.allocation.height, fill: style.fill }),
    measureIntrinsic: ({ props }) => ({ status: 'measured' as const, minContent: { width: 40, height: props.natural.get() }, maxContent: { width: 40, height: props.natural.get() } }),
    measure: ({ props, constraints }) => {
      calls.push(constraints.maxWidth);
      return { status: 'measured' as const, size: { width: 40, height: props.natural.get() } };
    },
  });
  const owner = (height: number | 'auto' = 'auto') => <Flex style={{ width: 200, height, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
    <Leaf key="A" natural={natural} style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginStart: 'auto', marginTop: 'auto', fill: '#8a3248' }} />
    <Rectangle key="B" style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
  </Flex>;
  const service = { measureText: () => { throw new Error('No text.'); } };
  const constraints = { minWidth: 200, maxWidth: 200, minHeight: 0, maxHeight: Number.POSITIVE_INFINITY };
  expect(measureElement(owner(), constraints, service)).toEqual({ status: 'measured', size: { width: 200, height: 20 } });
  natural.set(40);
  expect(measureElement(owner(), constraints, service)).toEqual({ status: 'measured', size: { width: 200, height: 40 } });
  natural.set(20);

  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 100; document.body.append(canvas);
  const controller = pibbl(canvas, owner(80));
  controllers.push(controller); await frame();
  const pixel = (x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
  expect(pixel(90, 50)).toEqual([0, 0, 0, 0]);
  expect(pixel(90, 64)).toEqual([138, 50, 72, 255]);
  expect(pixel(124, 10)).toEqual([66, 107, 97, 255]);
  const click = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + x, clientY: rect.top + y }));
  };
  click(90, 50); await frame(); expect(hits).toEqual([]);
  const initial = snapshotWasmLayoutDiagnostics();
  natural.set(40); await frame();
  expect(pixel(90, 50)).toEqual([138, 50, 72, 255]);
  click(90, 50); await frame(); expect(hits).toEqual(['A:1']);
  const moved = snapshotWasmLayoutDiagnostics();
  expect(moved.nodeCreates).toBe(initial.nodeCreates);
  expect(stamps).toBe(1);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
  const afterDispose = calls.length;
  natural.set(60); await frame();
  expect(calls.length).toBe(afterDispose);
});

it.runIf(experimentalLayout)('measures a paired provider at exact column height before a physical side auto margin absorbs cross free space', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const natural = signal(40);
  const calls: (readonly [number, number, number, number])[] = [];
  const hits: string[] = [];
  let stamps = 0;
  type ProviderStyle = FlexStyle & { readonly fill?: string };
  type ResolvedProviderStyle = SystemStyle & { readonly width: number; readonly height: number; readonly fill?: string };
  const Leaf = definePrimitive<{ readonly natural: typeof natural }, ProviderStyle, ProviderStyle, ResolvedProviderStyle>((_props, style) => {
    const stamp = useConst(() => ++stamps);
    return <Rectangle onClick={() => hits.push(`A:${stamp}`)} style={{ width: style.width, height: style.height, fill: style.fill, cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['natural'],
    resolveStyle: (style, context) => ({ width: context.allocation.width, height: context.allocation.height, fill: style.fill }),
    measureIntrinsic: ({ props }) => ({ status: 'measured' as const, minContent: { width: props.natural.get(), height: 40 }, maxContent: { width: props.natural.get(), height: 40 } }),
    measure: ({ props, constraints }) => {
      calls.push([constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]);
      return { status: 'measured' as const, size: { width: props.natural.get(), height: 40 } };
    },
  });
  const service = { measureText: () => { throw new Error('No text.'); } };
  const leaf = (fill = '#8a3248') => <Leaf key="A" natural={natural} style={{
    width: 'auto', height: 40, minHeight: 0,
    flexBasis: 'auto', flexGrow: 0, flexShrink: 0,
    marginLeft: 'auto', fill,
  }} />;
  expect(measureElement(leaf(), {
    minWidth: 0, maxWidth: Number.POSITIVE_INFINITY,
    minHeight: 40, maxHeight: 40,
  }, service)).toEqual({ status: 'measured', size: { width: 40, height: 40 } });
  natural.set(80);
  expect(measureElement(leaf(), {
    minWidth: 0, maxWidth: Number.POSITIVE_INFINITY,
    minHeight: 40, maxHeight: 40,
  }, service)).toEqual({ status: 'measured', size: { width: 80, height: 40 } });
  natural.set(40);

  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 200, height: 120, flexDirection: 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start' }}>
    {leaf()}
    <Rectangle key="B" style={{ width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
  </Flex>);
  controllers.push(controller); await frame();
  const pixel = (x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
  expect(pixel(130, 10)).toEqual([0, 0, 0, 0]);
  expect(pixel(160, 10)).toEqual([138, 50, 72, 255]);
  expect(pixel(4, 44)).toEqual([66, 107, 97, 255]);
  expect(calls).toContainEqual([0, Number.POSITIVE_INFINITY, 40, 40]);
  const click = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + x, clientY: rect.top + y }));
  };
  click(130, 10); await frame(); expect(hits).toEqual([]);
  const initial = snapshotWasmLayoutDiagnostics();
  natural.set(80); await frame();
  expect(pixel(130, 10)).toEqual([138, 50, 72, 255]);
  expect(pixel(120, 10)).toEqual([138, 50, 72, 255]);
  click(130, 10); await frame(); expect(hits).toEqual(['A:1']);
  const moved = snapshotWasmLayoutDiagnostics();
  expect(moved.nodeCreates).toBe(initial.nodeCreates);
  expect(stamps).toBe(1);
  natural.set(240); await frame();
  expect(pixel(4, 10)).toEqual([138, 50, 72, 255]);
  expect(pixel(220, 10)).toEqual([138, 50, 72, 255]);
  click(220, 10); await frame(); expect(hits).toEqual(['A:1', 'A:1']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
  const afterDispose = calls.length;
  natural.set(120); await frame();
  expect(calls.length).toBe(afterDispose);
});

it.runIf(experimentalLayout)('fails a required column provider cross query before paint, releases ownership, and permits an explicit remount', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const available = signal(false);
  let paints = 0;
  type ProviderStyle = FlexStyle;
  type ResolvedProviderStyle = SystemStyle & { readonly width: number; readonly height: number };
  const Leaf = definePrimitive<{ readonly available: typeof available }, ProviderStyle, ProviderStyle, ResolvedProviderStyle>((_props, style) => {
    paints++;
    return <Rectangle style={{ width: style.width, height: style.height, fill: '#8a3248' }} />;
  }, {
    preserveSignalProps: ['available'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 40, height: 40 }, maxContent: { width: 40, height: 40 } }),
    measure: ({ props }) => props.available.get() ?
      { status: 'measured' as const, size: { width: 40, height: 40 } } :
      { status: 'unsupported' as const, reason: 'column width unavailable' },
  });
  const root = <Flex style={{ width: 200, height: 120, flexDirection: 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'stretch' }}>
    <Leaf key="A" available={available} style={{ width: 'auto', height: 40, minHeight: 0, flexBasis: 'auto', flexGrow: 0, flexShrink: 0, marginLeft: 'auto' }} />
    <Rectangle key="B" style={{ width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }} />
  </Flex>;
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
  const errors: unknown[] = [];
  const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', prevent);
  try {
    const failed = pibbl(canvas, root); controllers.push(failed); await frame();
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toMatch(/column width unavailable/i);
    expect(paints).toBe(0);
    failed.dispose();
    const released = snapshotWasmLayoutDiagnostics();
    expect([released.activeNodes, released.activeArenas, released.cachedMeasurements, released.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    available.set(true);
    const recovered = pibbl(canvas, root); controllers.push(recovered); await frame();
    expect(paints).toBe(1);
    recovered.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  } finally { window.removeEventListener('error', prevent); }
});
