import { afterEach, expect, it } from 'vitest';
import { Flex, Rectangle, signal, type PibblController, type RectStyle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

for (const profile of [
  { name: 'aspect-derived cross size', style: { height: 'auto', aspectRatio: 2 }, height: 20, narrowHeight: 20 },
  { name: 'resolved percentage cross size', style: { height: '50%' }, height: 50, narrowHeight: 40 },
  { name: 'resolved percentage cross bounds', style: { height: 20, minHeight: '50%' }, height: 50, narrowHeight: 40 },
] satisfies Array<{ name: string; style: Partial<RectStyle>; height: number; narrowHeight: number }>) {
  it.runIf(nativeLayout)(`places auto margins after ${profile.name}, preserving the numeric-zero sizing baseline`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal<0 | 'auto'>(0);
    const height = signal(100);
    const errors: unknown[] = [];
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', prevent);
    try {
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 110; document.body.append(canvas);
      let hits = 0;
      const controller = pibblSync(canvas, <Flex style={{ width: 100, height, alignItems: 'flex-start' }}>
        <Rectangle onClick={() => { hits++; }} style={{ width: 40, minWidth: 0, minHeight: 0, flexShrink: 0,
          ...profile.style, marginTop: margin, fill: '#ff0000' }} />
      </Flex>); controllers.push(controller); await frame();
      const pixel = (y: number) => [...canvas.getContext('2d')!.getImageData(4, y, 1, 1).data];
      expect(errors).toEqual([]);
      expect(pixel(0)).toEqual([255, 0, 0, 255]);
      expect(pixel(profile.height)).toEqual([0, 0, 0, 0]);
      const mounted = snapshotWasmLayoutDiagnostics();
      margin.set('auto'); await frame();
      expect(errors).toEqual([]);
      expect(pixel(0)).toEqual([0, 0, 0, 0]);
      expect(pixel(100 - profile.height)).toEqual([255, 0, 0, 255]);
      expect(pixel(99)).toEqual([255, 0, 0, 255]);
      height.set(80); await frame();
      expect(errors).toEqual([]);
      expect(pixel(80 - profile.narrowHeight)).toEqual([255, 0, 0, 255]);
      expect(pixel(79)).toEqual([255, 0, 0, 255]);
      const bounds = canvas.getBoundingClientRect();
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true, button: 0, clientX: bounds.left + 4, clientY: bounds.top + 79,
      }));
      expect(hits).toBe(1);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    } finally { window.removeEventListener('error', prevent); }
  });
}
