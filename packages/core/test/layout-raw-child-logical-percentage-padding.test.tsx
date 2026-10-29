import { afterEach, expect, it } from 'vitest';
import {
  Flex,
  Flow,
  Rectangle,
  defineLayoutComponent,
  definePrimitive,
  measureElement,
  signal,
  type BoxStyle,
  type FlowStyle,
  type LayoutBox,
  type PibblController,
  type PibblResponsiveStyle,
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

for (const variant of ['direct explicit RTL', 'described inherited RTL'] as const) {
  it.runIf(nativeLayout)(`resolves a raw logical percentage child inset in mounted Flow through ${variant}`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const width = signal(200), fill = signal('#8a3248');
    let box: (LayoutBox & { stamp: number }) | undefined, serial = 0, hits = 0;
    const Marker = definePrimitive<{}, BoxStyle, BoxStyle, SystemStyle & { readonly width: number; readonly height: number }>((_props, style) => {
      const allocation = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      box = { x: transform.e, y: transform.f, width: allocation.width, height: allocation.height, stamp };
      return <Rectangle onClick={() => { hits += 1; }} style={{ width: style.width, height: style.height, fill, cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const child = <Flex key="child" style={{ width: 160, height: 80, boxSizing: 'border-box', flexBasis: 160, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, padding: { left: 0, right: '50%', top: 0, bottom: 0 }, paddingStart: 0, paddingEnd: '10%', layoutDirection: variant === 'direct explicit RTL' ? 'rtl' : undefined, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}><Marker key="marker" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }} /></Flex>;
    const flowStyle: PibblResponsiveStyle<FlowStyle> = { width, height: 100, minWidth: 0, minHeight: 0, direction: 'horizontal', wrap: false, alignItems: 'start' };
    const DescribedFlow = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlowStyle> }) => <Flow style={props.style}>{child}</Flow>);
    const root = () => variant === 'direct explicit RTL'
      ? <Flow style={flowStyle}>{child}</Flow>
      : <Flex style={{ width, height: 100, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'rtl', alignItems: 'flex-start' }}><DescribedFlow key="flow" style={flowStyle} /></Flex>;
    const pure = measureElement(child, { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100 }, { measureText: () => { throw Error('fixed child does not measure text'); } });
    expect(pure).toMatchObject({ status: 'unsupported', reason: expect.stringMatching(/percentage padding/i) });
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
    const controller = pibblSync(canvas, root()); controllers.push(controller);
    try {
      await frame();
      expect(box).toMatchObject({ x: 20, y: 0, width: 140, height: 80 });
      const mounted = snapshotWasmLayoutDiagnostics(), stamp = box!.stamp;
      click(canvas, 18, 4); expect(hits).toBe(0);
      width.set(160); await frame();
      expect(box).toMatchObject({ x: 16, y: 0, width: 144, height: 80, stamp });
      click(canvas, 18, 4); expect(hits).toBe(1);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
      const beforePaint = snapshotWasmLayoutDiagnostics(); fill.set('#426b61'); await frame();
      const painted = snapshotWasmLayoutDiagnostics();
      expect(painted.solves).toBe(beforePaint.solves);
      expect(painted.nodeCreates).toBe(beforePaint.nodeCreates);
    } finally { controllers.pop()?.dispose(); }
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  });
}
