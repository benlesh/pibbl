import { afterEach, expect, it } from 'vitest';
import {
  Absolute,
  Overlay,
  Rectangle,
  definePrimitive,
  measureElement,
  signal,
  type BoxStyle,
  type LayoutBox,
  type PibblController,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

for (const family of ['Absolute', 'Overlay'] as const) {
  it.runIf(experimentalLayout)(`resolves root ${family} percentage padding from the 200px allocation`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const padding = signal<0 | 20 | '10%'>(0), width = signal(200), fill = signal('#8a3248');
    const boxes = new Map<string, LayoutBox>();
    const hits: string[] = [];
    let serial = 0;
    const Marker = definePrimitive<{ readonly name: string }, BoxStyle, BoxStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const allocation = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: transform.e, y: transform.f, width: allocation.width, height: allocation.height, stamp } as LayoutBox & { stamp: number });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: style.width, height: style.height, fill, cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const marker = <Marker key="marker" name="marker" style={{ width: 100, height: 40 }} />;
    const root = (paddingValue: 0 | 20 | '10%', rootWidth = 200) => family === 'Absolute'
      ? <Absolute style={{ width: rootWidth, height: 80, boxSizing: 'border-box', padding: paddingValue }}>{marker}</Absolute>
      : <Overlay style={{ width: rootWidth, height: 80, boxSizing: 'border-box', padding: paddingValue, alignItems: 'start', justifyItems: 'start' }}>{marker}</Overlay>;

    const constraints = { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 80 };
    const service = { measureText: () => { throw Error('fixed root does not measure text'); } };
    expect(measureElement(root(0), constraints, service)).toEqual({ status: 'unsupported', reason: `${family} does not provide measurement` });
    expect(measureElement(root('10%'), constraints, service)).toEqual({ status: 'unsupported', reason: `${family} does not provide measurement` });

    const Scene = () => root(padding.get(), width.get());
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 80; document.body.append(canvas);
    const errors: unknown[] = [];
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', receive);
    try {
      const controller = pibblSync(canvas, <Scene />); controllers.push(controller); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('marker')).toMatchObject({ x: 0, y: 0, width: 100, height: 40 });
      const mounted = snapshotWasmLayoutDiagnostics(), stamp = (boxes.get('marker') as LayoutBox & { stamp: number }).stamp;
      click(canvas, 4, 4); expect(hits).toEqual(['marker']);

      padding.set(20); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('marker')).toMatchObject({ x: 20, y: 20, width: 100, height: 40, stamp });
      click(canvas, 4, 4); click(canvas, 24, 24); expect(hits).toEqual(['marker', 'marker']);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

      padding.set('10%'); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('marker')).toMatchObject({ x: 20, y: 20, width: 100, height: 40, stamp });
      width.set(160); await frame();
      expect(errors).toEqual([]);
      // Root percentages continue to use the 200px canvas allocation, not the 160px border box.
      expect(boxes.get('marker')).toMatchObject({ x: 20, y: 20, width: 100, height: 40, stamp });
      click(canvas, 24, 24); expect(hits).toEqual(['marker', 'marker', 'marker']);
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
