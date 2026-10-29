import { afterEach, expect, it } from 'vitest';
import {
  Flow,
  Rectangle,
  definePrimitive,
  measureElement,
  signal,
  type LayoutBox,
  type BoxStyle,
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

it.runIf(nativeLayout)('resolves finite allocated Flow percentage padding without granting pure measurement an owner', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const padding = signal<0 | 20 | '10%'>(0), fill = signal('#8a3248'), width = signal(200);
  const boxes = new Map<string, LayoutBox>();
  const hits: string[] = [];
  let serial = 0;
  const Probe = definePrimitive<{ readonly name: string }, BoxStyle, BoxStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    boxes.set(props.name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp } as LayoutBox & { stamp: number });
    return <Rectangle onClick={() => hits.push(props.name)} style={{ width: style.width, height: style.height, fill, cursor: 'pointer' }} />;
  }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  const child = <Probe key="content" name="content" style={{ width: 160, height: 40 }} />;
  const Scene = () => <Flow style={{ width, height: 80, boxSizing: 'border-box', padding, direction: 'horizontal', wrap: false, alignItems: 'start' }}>{child}</Flow>;
  const pure = measureElement(<Flow style={{ width: 200, height: 80, boxSizing: 'border-box', padding: '10%', direction: 'horizontal', wrap: false, alignItems: 'start' }}>{child}</Flow>, { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 80 }, { measureText: () => { throw Error('fixed Flow does not measure text'); } });
  expect(pure).toMatchObject({ status: 'unsupported', reason: expect.stringMatching(/percentage padding/i) });

  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 80; document.body.append(canvas);
  const errors: unknown[] = [];
  const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', receive);
  try {
    const controller = pibblSync(canvas, <Scene />); controllers.push(controller); await frame();
    expect(errors).toEqual([]);
    expect(boxes.get('content')).toMatchObject({ x: 0, y: 0, width: 160, height: 40 });
    const mounted = snapshotWasmLayoutDiagnostics(), stamp = (boxes.get('content') as LayoutBox & { stamp: number }).stamp;
    click(canvas, 4, 4); expect(hits).toEqual(['content']);

    padding.set(20); await frame();
    expect(errors).toEqual([]);
    expect(boxes.get('content')).toMatchObject({ x: 20, y: 20, width: 160, height: 40, stamp });
    click(canvas, 4, 4); click(canvas, 24, 24); expect(hits).toEqual(['content', 'content']);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

    padding.set('10%'); await frame();
    expect(errors).toEqual([]);
    expect(boxes.get('content')).toMatchObject({ x: 20, y: 20, width: 160, height: 40, stamp });
    width.set(160); await frame();
    expect(errors).toEqual([]);
    // Padding refers to the 200px containing allocation, not Flow's 160px box.
    expect(boxes.get('content')).toMatchObject({ x: 20, y: 20, width: 160, height: 40, stamp });
    click(canvas, 24, 24); expect(hits).toEqual(['content', 'content', 'content']);
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
