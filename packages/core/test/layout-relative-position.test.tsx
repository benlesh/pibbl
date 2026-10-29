import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  FocusManagement,
  Flex,
  Rectangle,
  signal,
  type FlexItemStyle,
  type RectStyle,
  type PibblResponsiveStyle,
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

it.runIf(nativeLayout)('keeps static and relative Flex insets coherent across slots, focus, and hits', async () => {
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
    boxes.set(name, {
      x: transform.e,
      y: transform.f,
      width: box.width,
      height: box.height,
      stamp,
    });
    return <Rectangle
      keyboardFocusable
      onFocus={() => focused.push(name)}
      onClick={() => hits.push(name)}
      style={{
        width: box.width,
        height: box.height,
        fill: name === 'A' ? ink : '#a63758',
        cursor: 'pointer',
      }}
    />;
  }

  function Scene() {
    const placement: PlacementStyle = {
      width: 50,
      height: 20,
      minWidth: 0,
      minHeight: 0,
      flexGrow: 0,
      flexShrink: 0,
      position: mode.get(),
      left: 12,
      right: 18,
      top: 8,
      bottom: 10,
    };
    return <FocusManagement><Flex style={{
      width: 160,
      height: 60,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'flex-start',
      gap: 10,
      layoutDirection: direction.get(),
    }}>
      <Probe key="A" name="A" style={placement} />
      <Probe key="B" name="B" style={{
        width: 50,
        height: 20,
        minWidth: 0,
        minHeight: 0,
        flexGrow: 0,
        flexShrink: 0,
      }} />
    </Flex></FocusManagement>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 60;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  controllers.push(controller);
  await nextFrame();

  expect([...boxes.values()]).toEqual([
    { x: 0, y: 0, width: 50, height: 20, stamp: 1 },
    { x: 60, y: 0, width: 50, height: 20, stamp: 2 },
  ]);
  canvas.focus({ preventScroll: true });
  expect(focused).toEqual(['A']);
  canvas.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab', code: 'Tab', bubbles: true, cancelable: true,
  }));
  expect(focused).toEqual(['A', 'B']);
  clickCanvas(canvas, 5, 5);
  clickCanvas(canvas, 65, 5);
  expect(hits).toEqual(['A', 'B']);
  const staticSnapshot = snapshotWasmLayoutDiagnostics();
  const focusedBeforePosition = focused.slice();

  mode.set('relative');
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 8, width: 50, height: 20, stamp: 1 },
    { x: 60, y: 0, width: 50, height: 20, stamp: 2 },
  ]);
  expect(focused).toEqual(focusedBeforePosition);
  clickCanvas(canvas, 5, 5);
  clickCanvas(canvas, 13, 9);
  clickCanvas(canvas, 65, 5);
  expect(hits).toEqual(['A', 'B', 'A', 'B']);
  const relativeSnapshot = snapshotWasmLayoutDiagnostics();
  expect(relativeSnapshot.nodeCreates).toBe(staticSnapshot.nodeCreates);

  const focusedBeforeDirection = focused.slice();
  direction.set('rtl');
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 92, y: 8, width: 50, height: 20, stamp: 1 },
    { x: 50, y: 0, width: 50, height: 20, stamp: 2 },
  ]);
  expect(focused).toEqual(focusedBeforeDirection);
  clickCanvas(canvas, 151, 9);
  clickCanvas(canvas, 120, 9);
  clickCanvas(canvas, 55, 5);
  expect(hits).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2]);

  const beforePaint = snapshotWasmLayoutDiagnostics();
  ink.set('#426b61');
  await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.nodeCreates).toBe(beforePaint.nodeCreates);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(nativeLayout)('positions direct Rectangle receivers once while preserving the next slot', async () => {
  const mode = signal<'static' | 'relative'>('static');
  const hits: string[] = [];
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 60; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 160, height: 60, gap: 10, alignItems: 'flex-start' }}>
    <Rectangle key="A" onClick={() => hits.push('A')} style={{ width: 50, height: 20, minWidth: 0, flexShrink: 0, position: mode, left: 12, right: 18, top: 8, bottom: 10, fill: '#19375b' }} />
    <Rectangle key="B" onClick={() => hits.push('B')} style={{ width: 50, height: 20, minWidth: 0, flexShrink: 0, fill: '#a63758' }} />
  </Flex>); controllers.push(controller); await nextFrame();
  clickCanvas(canvas, 5, 5); clickCanvas(canvas, 65, 5); expect(hits).toEqual(['A', 'B']);
  const initial = snapshotWasmLayoutDiagnostics();
  mode.set('relative'); await nextFrame();
  clickCanvas(canvas, 5, 5); clickCanvas(canvas, 13, 9); clickCanvas(canvas, 65, 5);
  expect(hits).toEqual(['A', 'B', 'A', 'B']);
  expect([...canvas.getContext('2d')!.getImageData(5, 5, 1, 1).data]).toEqual([0, 0, 0, 0]);
  expect([...canvas.getContext('2d')!.getImageData(13, 9, 1, 1).data]).toEqual([25, 55, 91, 255]);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
});


it.runIf(nativeLayout)('forwards a direct-Flex relative style exactly once through a function child', async () => {
  const mode = signal<'static' | 'relative'>('static');
  const hits: string[] = [];
  function Forwarded({ style }: { readonly style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    return <Rectangle onClick={() => hits.push('A')} style={{ ...style, fill: '#19375b', cursor: 'pointer' }} />;
  }
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 60; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 160, height: 60, gap: 10, alignItems: 'flex-start' }}>
    <Forwarded key="A" style={{ width: 50, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, position: mode, left: 12, right: 18, top: 8, bottom: 10 }} />
    <Rectangle key="B" style={{ width: 50, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#a63758' }} />
  </Flex>); controllers.push(controller); await nextFrame();
  mode.set('relative'); await nextFrame();
  clickCanvas(canvas, 13, 9);
  clickCanvas(canvas, 25, 17);
  expect(hits).toEqual(['A', 'A']);
  expect([...canvas.getContext('2d')!.getImageData(13, 9, 1, 1).data]).toEqual([25, 55, 91, 255]);
  expect([...canvas.getContext('2d')!.getImageData(25, 17, 1, 1).data]).toEqual([25, 55, 91, 255]);
});


it.runIf(nativeLayout)('consumes forwarded mode and opposite-only insets once', async () => {
  function Forwarded({ style }: { readonly style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    return <Rectangle style={{ ...style, fill: '#19375b' }} />;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 60; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 160, height: 60, alignItems: 'flex-start' }}>
    <Forwarded style={{ width: 50, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0,
      marginLeft: 30, marginTop: 20, position: 'relative', right: 18, bottom: 10 }} />
  </Flex>);
  controllers.push(controller);
  await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(13, 11, 1, 1).data]).toEqual([25, 55, 91, 255]);
  expect([...canvas.getContext('2d')!.getImageData(61, 11, 1, 1).data]).toEqual([25, 55, 91, 255]);
  expect([...canvas.getContext('2d')!.getImageData(63, 11, 1, 1).data]).toEqual([0, 0, 0, 0]);
});

it.runIf(nativeLayout)('preserves physical static and relative final boxes through all finite nowrap main directions', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type Directionality = 'ltr' | 'rtl';
  type PlacementStyle = RectStyle & FlexItemStyle;
  const baseline = snapshotWasmLayoutDiagnostics();
  const mode = signal<'static' | 'relative'>('static');
  const flexDirection = signal<Direction>('row');
  const layoutDirection = signal<Directionality>('ltr');
  const ink = signal('#19375b');
  const hits: string[] = [];
  const focused: string[] = [];
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: 'A' | 'B'; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{
      width: box.width, height: box.height, cursor: 'pointer', fill: name === 'A' ? ink : '#a63758',
    }} />;
  }

  function Scene() {
    const a: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      position: mode.get(), left: 12, right: 18, top: 8, bottom: 10 };
    const b: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <FocusManagement><Flex style={{
      boxSizing: 'border-box', width: 204, height: 244, padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: flexDirection.get(), flexWrap: 'nowrap', layoutDirection: layoutDirection.get(), alignItems: 'flex-start', gap: 10,
    }}><Probe key="A" name="A" style={a} /><Probe key="B" name="B" style={b} /></Flex></FocusManagement>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 204; canvas.height = 244; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();

  const expected: readonly [Direction, Directionality, readonly [{ x: number; y: number }, { x: number; y: number }], readonly [{ x: number; y: number }, { x: number; y: number }]][] = [
    ['row', 'ltr', [{ x: 12, y: 22 }, { x: 72, y: 22 }], [{ x: 24, y: 30 }, { x: 72, y: 22 }]],
    ['row', 'rtl', [{ x: 122, y: 22 }, { x: 62, y: 22 }], [{ x: 104, y: 30 }, { x: 62, y: 22 }]],
    ['row-reverse', 'ltr', [{ x: 122, y: 22 }, { x: 62, y: 22 }], [{ x: 134, y: 30 }, { x: 62, y: 22 }]],
    ['row-reverse', 'rtl', [{ x: 12, y: 22 }, { x: 72, y: 22 }], [{ x: -6, y: 30 }, { x: 72, y: 22 }]],
    ['column', 'ltr', [{ x: 12, y: 22 }, { x: 12, y: 52 }], [{ x: 24, y: 30 }, { x: 12, y: 52 }]],
    ['column', 'rtl', [{ x: 122, y: 22 }, { x: 122, y: 52 }], [{ x: 104, y: 30 }, { x: 122, y: 52 }]],
    ['column-reverse', 'ltr', [{ x: 12, y: 202 }, { x: 12, y: 172 }], [{ x: 24, y: 210 }, { x: 12, y: 172 }]],
    ['column-reverse', 'rtl', [{ x: 122, y: 202 }, { x: 122, y: 172 }], [{ x: 104, y: 210 }, { x: 122, y: 172 }]],
  ];
  const actual = () => [...boxes.values()].map(({ x, y, width, height, stamp }) => ({ x, y, width, height, stamp }));
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'B']);
  for (const [direction, writingDirection, staticBoxes, relativeBoxes] of expected) {
    flexDirection.set(direction); layoutDirection.set(writingDirection); mode.set('static');
    await nextFrame();
    expect(actual()).toEqual(staticBoxes.map((box, index) => ({ ...box, width: 50, height: 20, stamp: index + 1 })));
    mode.set('relative'); await nextFrame();
    expect(actual()).toEqual(relativeBoxes.map((box, index) => ({ ...box, width: 50, height: 20, stamp: index + 1 })));
    const hitStart = hits.length;
    clickCanvas(canvas, staticBoxes[0].x + 4, staticBoxes[0].y + 4);
    clickCanvas(canvas, relativeBoxes[0].x + 46, relativeBoxes[0].y + 4); // Exposed edge: later B covers A's left edge in RTL rows.
    clickCanvas(canvas, relativeBoxes[1].x + 4, relativeBoxes[1].y + 4);
    expect(hits.slice(hitStart), `${direction} ${writingDirection}`).toEqual(['A', 'B']);
  }
  expect(hits.filter(hit => hit === 'B').length).toBe(8);
  expect(hits.filter(hit => hit === 'A').length).toBe(8);
  const beforePaint = snapshotWasmLayoutDiagnostics();
  ink.set('#426b61'); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(beforePaint.nodeCreates);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
});
