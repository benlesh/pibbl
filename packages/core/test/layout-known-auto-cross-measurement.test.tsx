import { afterEach, expect, it } from 'vitest';
import {
  Absolute, Overlay, defineLayoutComponent, definePrimitive, Flex, Flow, Grid, measureElement, Rectangle, signal,
  type FlexStyle, type PibblController, type PibblResponsiveStyle, type SystemStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
  }));
}

type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;
for (const family of ['Flow', 'Grid'] as const) for (const flexWrap of ['nowrap', 'wrap'] as const) {
  it.runIf(experimentalLayout)(`measures ${family} before ${flexWrap} row cross-auto placement`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginTop = signal<0 | 'auto'>(0), ownerWidth = signal(180), peerFill = signal('#426b61');
    const hits: string[] = [];
    let serial = 0, marker: Box | undefined;
    type Resolved = SystemStyle & { readonly width: number; readonly height: number };
    const Marker = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>((_props, style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      marker = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
      return <Rectangle onClick={() => hits.push('marker')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
    const candidate = family === 'Flow'
      ? <Flow key="known" style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop, direction: 'horizontal', wrap: false }}>
          <Marker key="marker" style={{ width: 40, height: 20 }} />
          <Rectangle key="tail" style={{ width: 40, height: 20, fill: '#6e3e79' }} />
        </Flow>
      : <Grid key="known" style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop, gridTemplateColumns: [40, 40], gridTemplateRows: [20] }}>
          <Marker key="marker" style={{ width: 40, height: 20, gridColumnStart: 1, gridRowStart: 1 }} />
          <Rectangle key="tail" style={{ width: 40, height: 20, gridColumnStart: 2, gridRowStart: 1, fill: '#6e3e79' }} />
        </Grid>;
    const pure = measureElement(candidate, { minWidth: 80, maxWidth: 80, minHeight: 0, maxHeight: 100 }, { measureText: () => { throw Error('numeric known layout does not shape text'); } });
    expect(pure).toEqual({ status: 'measured', size: { width: 80, height: 20 } });

    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
    const controller = pibblSync(canvas, <Flex style={{ width: ownerWidth, height: 100, flexDirection: 'row', flexWrap, alignItems: 'flex-start', alignContent: 'flex-start' }}>
      {candidate}
      <Rectangle key="peer" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = marker!;
    expect(zero).toMatchObject({ x: 0, y: 0, width: 40, height: 20 });
    const mounted = snapshotWasmLayoutDiagnostics();

    marginTop.set('auto'); await frame();
    const sameLineY = flexWrap === 'nowrap' ? 80 : 20;
    expect(marker).toMatchObject({ x: 0, y: sameLineY, width: 40, height: 20, stamp: zero.stamp });
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
    click(canvas, 4, sameLineY + 4); await frame(); expect(hits).toEqual(['marker']);

    ownerWidth.set(100); await frame();
    const splitY = flexWrap === 'wrap' ? 0 : 80;
    expect(marker).toMatchObject({ x: 0, y: splitY, width: 40, height: 20, stamp: zero.stamp });
    click(canvas, 4, splitY + 4); await frame(); expect(hits).toEqual(['marker', 'marker']);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    expect(marker!.stamp).toBe(zero.stamp);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const family of ['Flow', 'Grid'] as const) {
  it.runIf(experimentalLayout)(`measures ${family} before column cross-auto placement`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginLeft = signal<0 | 'auto'>(0), ownerWidth = signal(180), peerFill = signal('#426b61');
    const hits: string[] = [];
    let serial = 0, marker: Box | undefined;
    type Resolved = SystemStyle & { readonly width: number; readonly height: number };
    const Marker = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>((_props, style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      marker = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
      return <Rectangle onClick={() => hits.push('marker')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
    const candidate = family === 'Flow'
      ? <Flow key="known" style={{ width: 'auto', height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft, direction: 'horizontal', wrap: false }}>
          <Marker key="marker" style={{ width: 40, height: 20 }} />
          <Rectangle key="tail" style={{ width: 40, height: 20, fill: '#6e3e79' }} />
        </Flow>
      : <Grid key="known" style={{ width: 'auto', height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft, gridTemplateColumns: [40, 40], gridTemplateRows: [20] }}>
          <Marker key="marker" style={{ width: 40, height: 20, gridColumnStart: 1, gridRowStart: 1 }} />
          <Rectangle key="tail" style={{ width: 40, height: 20, gridColumnStart: 2, gridRowStart: 1, fill: '#6e3e79' }} />
        </Grid>;
    const pure = measureElement(candidate, { minWidth: 0, maxWidth: Infinity, minHeight: 40, maxHeight: 40 }, { measureText: () => { throw Error('numeric known layout does not shape text'); } });
    expect(pure).toEqual({ status: 'measured', size: { width: 80, height: 20 } });

    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
    const controller = pibblSync(canvas, <Flex style={{ width: ownerWidth, height: 120, flexDirection: 'column', alignItems: 'flex-start' }}>
      {candidate}
      <Rectangle key="peer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = marker!;
    expect(zero).toMatchObject({ x: 0, y: 0, width: 40, height: 20 });
    const mounted = snapshotWasmLayoutDiagnostics();

    marginLeft.set('auto'); await frame();
    expect(marker).toMatchObject({ x: 100, y: 0, width: 40, height: 20, stamp: zero.stamp });
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
    click(canvas, 104, 4); await frame(); expect(hits).toEqual(['marker']);

    ownerWidth.set(100); await frame();
    expect(marker).toMatchObject({ x: 20, y: 0, width: 40, height: 20, stamp: zero.stamp });
    click(canvas, 24, 4); await frame(); expect(hits).toEqual(['marker', 'marker']);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    expect(marker!.stamp).toBe(zero.stamp);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const family of ['Absolute', 'Overlay'] as const) it.runIf(experimentalLayout)(`keeps ${family} automatic cross size behind its missing pure-query prerequisite`, async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const errors: unknown[] = [];
  const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', receive);
  try {
    for (const marginTop of [0, 'auto'] as const) {
      const style = { width: 80, height: 'auto' as const, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop };
      const candidate = family === 'Absolute' ? <Absolute style={style}><Rectangle style={{ width: 40, height: 20, fill: '#8a3248' }} /></Absolute> : <Overlay style={style}><Rectangle style={{ width: 40, height: 20, fill: '#8a3248' }} /></Overlay>;
      expect(measureElement(candidate, { minWidth: 80, maxWidth: 80, minHeight: 0, maxHeight: 100 }, { measureText: () => { throw Error('No text'); } })).toEqual({ status: 'unsupported', reason: `${family} does not provide measurement` });
      const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 120; document.body.append(canvas);
      errors.length = 0;
      const controller = pibblSync(canvas, <Flex style={{ width: 180, height: 100, alignItems: 'flex-start' }}>{candidate}</Flex>); controllers.push(controller); await frame();
      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toMatch(marginTop === 0 ? /does not provide measurement/ : /auto cross-axis margins/);
      expect(canvas.getContext('2d')!.getImageData(4, 4, 1, 1).data[3]).toBe(0);
      controller.dispose(); canvas.remove();
    }
  } finally { window.removeEventListener('error', receive); }
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
});

for (const flexWrap of ['nowrap', 'wrap'] as const) {
  it.runIf(experimentalLayout)(`measures a described paired leaf before ${flexWrap} row cross-auto placement`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginTop = signal<0 | 'auto'>(0), ownerWidth = signal(180), peerFill = signal('#426b61');
    const hits: string[] = [];
    let serial = 0, marker: Box | undefined, queries = 0;
    type Resolved = SystemStyle & { readonly width: number; readonly height: number };
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>((_props, style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      marker = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
      return <Rectangle onClick={() => hits.push('leaf')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 80, height: 20 }, maxContent: { width: 80, height: 20 } }),
      measure: () => { queries++; return { status: 'measured' as const, size: { width: 80, height: 20 } }; },
    });
    const Badge = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) => <Leaf style={props.style} />);
    const candidate = <Badge key="badge" style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop }} />;
    expect(measureElement(candidate, { minWidth: 80, maxWidth: 80, minHeight: 0, maxHeight: 100 }, { measureText: () => { throw Error('no text'); } })).toEqual({ status: 'measured', size: { width: 80, height: 20 } });

    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
    const controller = pibblSync(canvas, <Flex style={{ width: ownerWidth, height: 100, flexDirection: 'row', flexWrap, alignItems: 'flex-start', alignContent: 'flex-start' }}>
      {candidate}
      <Rectangle key="peer" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = marker!;
    expect(zero).toMatchObject({ x: 0, y: 0, width: 80, height: 20 });
    const mounted = snapshotWasmLayoutDiagnostics(), queryCount = queries;

    marginTop.set('auto'); await frame();
    const automaticY = flexWrap === 'nowrap' ? 80 : 20;
    expect(marker).toMatchObject({ x: 0, y: automaticY, width: 80, height: 20, stamp: zero.stamp });
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(queries).toBeGreaterThanOrEqual(queryCount);
    click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
    click(canvas, 4, automaticY + 4); await frame(); expect(hits).toEqual(['leaf']);

    ownerWidth.set(100); await frame();
    const splitY = flexWrap === 'wrap' ? 0 : 80;
    expect(marker).toMatchObject({ x: 0, y: splitY, width: 80, height: 20, stamp: zero.stamp });
    click(canvas, 4, splitY + 4); await frame(); expect(hits).toEqual(['leaf', 'leaf']);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    expect(marker!.stamp).toBe(zero.stamp);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}
