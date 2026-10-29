import { GridStudy } from '../../scenarios/src/learning/layout/grid.example';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { createExampleMount } from '../../scenarios/src/example-host';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import {
  nativeLayout,
  snapshotWasmLayoutDiagnostics,
} from '../src/lib/layout/wasm/region';

const mountGridStudy = createExampleMount(GridStudy);
let controller: { dispose(): void } | undefined;

beforeAll(() => {
  if (nativeLayout) prepareLayoutEngineSync();
});

afterEach(() => {
  controller?.dispose();
  controller = undefined;
  document.body.replaceChildren();
});

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: bounds.left + x,
        clientY: bounds.top + y,
      }),
    );
  }
}

it(
  'drives the public mixed-track spanning Grid resize, source targets, paint reuse, and cleanup',
  async () => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 420;
    host.append(canvas);
    document.body.append(host);

    const baseline = snapshotWasmLayoutDiagnostics();
    controller = mountGridStudy(canvas);
    await nextFrame();
    await nextFrame();

    const state = () => {
      const text = host.querySelector('pre')?.textContent ?? '';
      const match = text.match(/grid state: (.+)$/mu);
      expect(match, text).toBeTruthy();
      return JSON.parse(match![1]) as {
        width: number;
        selected: string;
        hits: readonly string[];
        focused: readonly string[];
        boxes: Record<string, { x: number; y: number; width: number; height: number }>;
        stamps: Record<string, number>;
      };
    };

    const initial = state();
    expect(initial.width).toBe(560);
    expect(initial.boxes.B).toEqual({ x: 244, y: 80, width: 236, height: 160 });
    expect(initial.boxes.C).toEqual({ x: 80, y: 194, width: 264, height: 46 });
    expect(initial.boxes.D).toEqual({ x: 358, y: 194, width: 122, height: 46 });

    canvas.blur(); canvas.focus({ preventScroll: true });
    for (let index = 0; index < 3; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    await expect.poll(() => state().focused).toEqual(['A', 'B', 'C', 'D']);

    // This point is outside the initial two-column span.
    const context = canvas.getContext('2d')!;
    const beforeResizePixel = Array.from(context.getImageData(550, 100, 1, 1).data);
    expect(beforeResizePixel).toEqual([247, 240, 223, 255]);

    click(canvas, 44, 40); // Resize grid.
    await nextFrame();
    await nextFrame();
    await expect.poll(() => state().width).toBe(700);
    const resized = state();
    expect(resized.width).toBe(700);
    expect(resized.boxes.B).toEqual({ x: 244, y: 80, width: 376, height: 160 });
    expect(resized.boxes.C).toEqual({ x: 80, y: 194, width: 299, height: 46 });
    expect(resized.boxes.D).toEqual({ x: 393, y: 194, width: 227, height: 46 });
    for (const key of ['A', 'B', 'C', 'D']) {
      expect(resized.stamps[key]).toBe(initial.stamps[key]);
    }

    // The resized span now owns the previously empty point.
    click(canvas, 550, 100);
    await nextFrame();
    await expect.poll(() => state().selected).toBe('B');
    expect(state().hits.at(-1)).toBe('B');

    // Both later siblings retain topmost targeting over B in their overlap.
    click(canvas, 300, 210);
    await expect.poll(() => state().selected).toBe('C');
    expect(state().hits.at(-1)).toBe('C');

    // Row-two overlap retains source-last D targeting.
    click(canvas, 400, 210);
    await nextFrame();
    await expect.poll(() => state().selected).toBe('D');
    expect(state().hits.at(-1)).toBe('D');

    const beforePaint = snapshotWasmLayoutDiagnostics();
    const firstFill = Array.from(context.getImageData(550, 100, 1, 1).data);
    click(canvas, 220, 40); // Paint only.
    await nextFrame();
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(Array.from(context.getImageData(550, 100, 1, 1).data)).not.toEqual(firstFill);
    expect(afterPaint.gridTrackResolutions).toBe(beforePaint.gridTrackResolutions);
    expect(afterPaint.gridCellPlacements).toBe(beforePaint.gridCellPlacements);
    expect(afterPaint.nodeCreates).toBe(beforePaint.nodeCreates);

    controller.dispose();
    controller = undefined;
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeNodes).toBe(baseline.activeNodes);
    expect(disposed.activeArenas).toBe(baseline.activeArenas);
    expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
    expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
    expect(host.querySelector('pre')).toBeNull();
  },
);
