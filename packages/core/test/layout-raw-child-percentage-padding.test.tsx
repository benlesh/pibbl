import { afterEach, expect, it } from 'vitest';
import {
  Absolute,
  Flow,
  Grid,
  Overlay,
  Rectangle,
  definePrimitive,
  measureElement,
  signal,
  type BoxStyle,
  type GridItemStyle,
  type LayoutBox,
  type PibblController,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

for (const parent of ['Flow', 'Absolute', 'Overlay', 'Grid'] as const) {
  it.runIf(nativeLayout)(`resolves ${parent} raw child percentage padding from its actual containing content width`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const padding = signal<0 | 20 | 16 | '10%'>(0), ownerWidth = signal(200), fill = signal('#8a3248');
    const boxes = new Map<string, LayoutBox>();
    const hits: string[] = [];
    let serial = 0;
    const Marker = definePrimitive<{ readonly name: string }, BoxStyle & GridItemStyle, BoxStyle & GridItemStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const allocation = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: transform.e, y: transform.f, width: allocation.width, height: allocation.height, stamp } as LayoutBox & { stamp: number });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: style.width, height: style.height, fill, cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const child = (value: 0 | 20 | 16 | '10%') => <Flow key="box" style={{ width: 160, height: 80, boxSizing: 'border-box', padding: value, minWidth: 0, minHeight: 0, direction: 'horizontal', wrap: false, alignItems: 'start', gridColumnStart: parent === 'Grid' ? 1 : undefined, gridRowStart: parent === 'Grid' ? 1 : undefined }}><Marker key="marker" name="marker" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }} /></Flow>;
    const root = (value: 0 | 20 | 16 | '10%', width: number) => {
      if (parent === 'Flow') return <Flow style={{ width, height: 100, alignItems: 'start', direction: 'horizontal', wrap: false }}>{child(value)}</Flow>;
      if (parent === 'Absolute') return <Absolute style={{ width, height: 100 }}>{child(value)}</Absolute>;
      if (parent === 'Overlay') return <Overlay style={{ width, height: 100, alignItems: 'start', justifyItems: 'start' }}>{child(value)}</Overlay>;
      return <Grid style={{ width: 200, height: 100, gridTemplateColumns: [160], gridTemplateRows: [80] }}>{child(value)}</Grid>;
    };

    const unallocated = measureElement(child('10%'), { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100 }, { measureText: () => { throw Error('fixed layout does not measure text'); } });
    expect(unallocated).toMatchObject({ status: 'unsupported', reason: expect.stringContaining('percentage padding') });

    if (parent === 'Flow' || parent === 'Grid') {
      const pure = measureElement(root('10%', 200), { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100 }, { measureText: () => { throw Error('fixed layout does not measure text'); } });
      // These fixed parents measure from their own definite bounds; the raw child padding is not a pure owner request.
      expect(pure.status).toBe('measured');
    }

    const Scene = () => root(padding.get(), ownerWidth.get());
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
    const errors: unknown[] = [];
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', receive);
    try {
      const controller = pibblSync(canvas, <Scene />); controllers.push(controller); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('marker')).toMatchObject({ x: 0, y: 0, width: 160, height: 80 });
      const mounted = snapshotWasmLayoutDiagnostics(), stamp = (boxes.get('marker') as LayoutBox & { stamp: number }).stamp;

      padding.set(parent === 'Grid' ? 16 : 20); await frame();
      expect(errors).toEqual([]);
      const numericInset = parent === 'Grid' ? 16 : 20;
      expect(boxes.get('marker')).toMatchObject({ x: numericInset, y: numericInset, width: 160 - numericInset * 2, height: 80 - numericInset * 2, stamp });
      click(canvas, 4, 4); click(canvas, numericInset + 4, numericInset + 4); expect(hits).toEqual(['marker']);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

      padding.set('10%'); await frame();
      expect(errors).toEqual([]);
      const percentageInset = parent === 'Grid' ? 16 : 20;
      expect(boxes.get('marker')).toMatchObject({ x: percentageInset, y: percentageInset, width: 160 - percentageInset * 2, height: 80 - percentageInset * 2, stamp });
      if (parent !== 'Grid') {
        ownerWidth.set(160); await frame();
        expect(errors).toEqual([]);
        expect(boxes.get('marker')).toMatchObject({ x: 16, y: 16, width: 128, height: 48, stamp });
        click(canvas, 20, 20); expect(hits).toEqual(['marker', 'marker']);
      }
      const beforePaint = snapshotWasmLayoutDiagnostics();
      fill.set('#426b61'); await frame();
      const painted = snapshotWasmLayoutDiagnostics();
      expect(painted.nodeCreates).toBe(mounted.nodeCreates);
      expect(painted.solves).toBe(beforePaint.solves);
    } finally { window.removeEventListener('error', receive); }
    controllers.pop()?.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  });
}
