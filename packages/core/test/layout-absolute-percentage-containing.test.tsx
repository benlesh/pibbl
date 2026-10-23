import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, signal, type FlexItemStyle, type FlexStyle, type PibblResponsiveStyle, type RectStyle, useCanvasContext, useLayoutBox } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(experimentalLayout)('forwards percentage absolute insets unchanged and resolves them through static or relative direct Flex ownership once', async () => {
  type LeafStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const left = signal<`${number}%`>('10%'), right = signal<`${number}%`>('15%'), top = signal<`${number}%`>('20%'), bottom = signal<`${number}%`>('10%');
  const ownerMode = signal<'static' | 'relative'>('static');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  function Leaf({ name, style: _style }: { readonly name: string; readonly style: LeafStyle }) { const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set(name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height }); return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />; }
  function Scene() {
    const owner: OwnerStyle = { position: ownerMode.get(), width: 80, height: 60, marginLeft: 20, marginTop: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' };
    const absolute: LeafStyle = { position: 'absolute', width: 30, height: 20, left, right, top, bottom, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}><Flex key="owner" style={owner}><Leaf key="absolute" name="absolute" style={absolute} /></Flex></Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 22, y: 22, width: 30, height: 20 });
  left.set('15%'); top.set('10%'); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 32, y: 12, width: 30, height: 20 });
  ownerMode.set('relative'); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 44, y: 38, width: 30, height: 20 });
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});


it.runIf(experimentalLayout)('forwards signal-owned physical percentage absolute insets once through a direct function leaf', async () => {
  type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const left = signal<`${number}%`>('10%'), top = signal<`${number}%`>('20%'); const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  function Probe({ style: _style }: { readonly style: Style }) { const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set('absolute', { x: matrix.e, y: matrix.f, width: box.width, height: box.height }); return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />; }
  function Forwarded({ style }: { readonly style: Style }) { return <Probe style={{ ...style }} />; }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, alignItems: 'flex-start' }}><Forwarded style={{ position: 'absolute', width: 30, height: 20, left, top, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} /></Flex>); controllers.push(controller); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 22, y: 22, width: 30, height: 20 }); left.set('15%'); top.set('10%'); await frame(); expect(boxes.get('absolute')).toEqual({ x: 32, y: 12, width: 30, height: 20 });
});
