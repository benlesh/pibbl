import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  FocusManagement,
  Flex,
  Rectangle,
  signal,
  type FlexItemStyle,
  type RectStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];

beforeAll(() => {
  if (nativeLayout) prepareLayoutEngineSync();
});

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
});

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function clickCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      clientX: bounds.left + x,
      clientY: bounds.top + y,
      bubbles: true,
      button: 0,
    }));
  }
}

it.runIf(nativeLayout)('keeps decorated Flex static and relative insets in the content box', async () => {
  type PlacementStyle = RectStyle & FlexItemStyle;
  const baseline = snapshotWasmLayoutDiagnostics();
  const mode = signal<'static' | 'relative'>('static');
  const direction = signal<'ltr' | 'rtl'>('ltr');
  const ink = signal('#19375b');
  const hits: string[] = [];
  const focused: string[] = [];
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const stamp = useConst(() => nextStamp++);
    const transform = useCanvasContext().getTransform();
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle
      keyboardFocusable
      onFocus={() => focused.push(name)}
      onClick={() => hits.push(name)}
      style={{ width: box.width, height: box.height, fill: name === 'A' ? ink : '#a63758', cursor: 'pointer' }}
    />;
  }

  function Scene() {
    const placement: PlacementStyle = {
      width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      position: mode.get(), left: 12, right: 18, top: 8, bottom: 10,
    };
    return <FocusManagement><Flex style={{
      width: 204, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
      layoutDirection: direction.get(),
    }}>
      <Probe key="A" name="A" style={placement} />
      <Probe key="B" name="B" style={{ width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
    </Flex></FocusManagement>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 2 },
  ]);
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'B']);
  clickCanvas(canvas, 16, 26); clickCanvas(canvas, 78, 26);
  expect(hits).toEqual(['A', 'B']);
  const staticSnapshot = snapshotWasmLayoutDiagnostics();

  direction.set('rtl'); await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 122, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 62, y: 22, width: 50, height: 20, stamp: 2 },
  ]);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(staticSnapshot.nodeCreates);
  clickCanvas(canvas, 168, 26); // RTL static A exposed edge
  clickCanvas(canvas, 66, 26);
  expect(hits).toEqual(['A', 'B', 'A', 'B']);
  const focusBeforeRelative = focused.slice();

  direction.set('ltr'); mode.set('relative'); await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 24, y: 30, width: 50, height: 20, stamp: 1 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 2 },
  ]);
  expect(focused).toEqual(focusBeforeRelative);
  clickCanvas(canvas, 16, 26); // former exposed A corner is outside its relative box
  clickCanvas(canvas, 28, 34); // A's new exposed corner
  clickCanvas(canvas, 73, 31); // overlap belongs to later B
  expect(hits).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2]);

  direction.set('rtl'); await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 104, y: 30, width: 50, height: 20, stamp: 1 },
    { x: 62, y: 22, width: 50, height: 20, stamp: 2 },
  ]);
  clickCanvas(canvas, 150, 34); // RTL A exposed edge
  clickCanvas(canvas, 108, 31); // overlap belongs to later B
  expect(hits).toEqual(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);

  const beforePaint = snapshotWasmLayoutDiagnostics();
  ink.set('#426b61'); await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.nodeCreates).toBe(beforePaint.nodeCreates);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});
