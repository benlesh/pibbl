import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Absolute,
  FocusManagement,
  Flex,
  Rectangle,
  createElement,
  definePrimitive,
  measureElement,
  signal,
  type FlexItemStyle,
  type BoxStyle,
  type RectStyle,
  type PibblResponsiveStyle,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];

beforeAll(() => {
  if (experimentalLayout) prepareLayoutEngineSync();
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

it.runIf(experimentalLayout)('keeps a direct absolute Flex child out of sibling allocation but in source paint order', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const left = signal(12);
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
      style={{ width: box.width, height: box.height, fill: name === 'absolute' ? '#a63758' : '#19375b', cursor: 'pointer' }}
    />;
  }

  function Scene() {
    const absolute: PlacementStyle = {
      width: 30, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      position: 'absolute',
      left, right: 18, top: 8, bottom: 10,
    };
    const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <FocusManagement><Flex style={{
      width: 204, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
    }}>
      <Probe key="A" name="A" style={ordinary} />
      <Probe key="absolute" name="absolute" style={absolute} />
      <Probe key="B" name="B" style={ordinary} />
    </Flex></FocusManagement>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();

  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 30, height: 20, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'absolute', 'B']);
  clickCanvas(canvas, 20, 25); // A/absolute overlap: later absolute remains topmost.
  clickCanvas(canvas, 78, 26);
  expect(hits).toEqual(['absolute', 'B']);
  const beforeMove = snapshotWasmLayoutDiagnostics();
  const focusBeforeMove = focused.slice();

  left.set(32);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 34, y: 10, width: 30, height: 20, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  expect(focused).toEqual(focusBeforeMove);
  clickCanvas(canvas, 16, 12); // old absolute exposed corner is empty.
  clickCanvas(canvas, 36, 12);
  clickCanvas(canvas, 40, 25); // A/absolute overlap stays topmost at the moved box.
  clickCanvas(canvas, 78, 26);
  expect(hits).toEqual(['absolute', 'B', 'absolute', 'absolute', 'B']);
  const moved = snapshotWasmLayoutDiagnostics();
  expect(moved.nodeCreates).toBe(beforeMove.nodeCreates);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);

  left.set(72); await nextFrame();
  expect(boxes.get('absolute')).toEqual({ x: 74, y: 10, width: 30, height: 20, stamp: 2 });
  clickCanvas(canvas, 78, 26); // later B covers the interleaved absolute child.
  expect(hits.at(-1)).toBe('B');
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(beforeMove.nodeCreates);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});


it.runIf(experimentalLayout)('retains absolute padding-box geometry through an Absolute-hosted known Flex preflight', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return <Rectangle style={{ width: box.width, height: box.height, fill: name === 'absolute' ? '#a63758' : '#19375b' }} />;
  }
  function Forward({ name, style }: { readonly name: string; readonly style: PlacementStyle }) {
    return <Probe name={name} style={style} />;
  }

  const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  const absolute: PlacementStyle = {
    width: 30, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    position: 'absolute', left: 12, top: 8,
  };
  const canvas = document.createElement('canvas'); canvas.width = 260; canvas.height = 140; document.body.append(canvas);
  const controller = pibbl(canvas, <Absolute style={{ width: 260, height: 140 }}>
    <Flex style={{
      left: 20, top: 10, width: 204, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
    }}>
      <Forward key="A" name="A" style={ordinary} />
      <Forward key="absolute" name="absolute" style={absolute} />
      <Forward key="B" name="B" style={ordinary} />
    </Flex>
  </Absolute>);
  controllers.push(controller);
  await nextFrame();

  expect([...boxes.entries()]).toEqual([
    ['A', { x: 32, y: 32, width: 50, height: 20 }],
    ['absolute', { x: 34, y: 20, width: 30, height: 20 }],
    ['B', { x: 92, y: 32, width: 50, height: 20 }],
  ]);
});

it.runIf(experimentalLayout)('keeps absolute direct children out of automatic Flex intrinsic measurement', () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const owner = createElement(Flex, {
    style: { width: 160, flexDirection: 'row', alignItems: 'flex-start' },
    children: createElement(Rectangle, {
      style: { position: 'absolute', left: 12, top: 8, width: 30, height: 20 },
    }),
  });
  const result = measureElement(owner, {
    minWidth: 0, maxWidth: 160, minHeight: 0, maxHeight: 100,
  }, { measureText: () => ({ width: 0 } as TextMetrics) });
  expect(result).toMatchObject({
    status: 'unsupported',
    reason: expect.stringContaining('absolute children during intrinsic Flex measurement'),
  });
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.nodeCreates, after.activeArenas]).toEqual([baseline.nodeCreates, baseline.activeArenas]);
});


it.runIf(experimentalLayout)('uses Flex alignment only on an absolute axis with no physical inset', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const left = signal<number | undefined>(undefined);
  const ink = signal('#a63758');
  const hits: string[] = [];
  const focused: string[] = [];
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle
      keyboardFocusable
      onFocus={() => focused.push(name)}
      onClick={() => hits.push(name)}
      style={{ width: box.width, height: box.height, cursor: 'pointer', fill: name === 'absolute' ? ink : name === 'A' ? '#19375b' : '#246b61' }}
    />;
  }

  const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  const absolute: PlacementStyle = {
    width: 30, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    position: 'absolute', left,
  };
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <FocusManagement><Flex style={{
    width: 204, height: 104, boxSizing: 'border-box',
    padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
    flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'flex-end', gap: 10,
  }}>
    <Probe key="A" name="A" style={ordinary} />
    <Probe key="absolute" name="absolute" style={absolute} />
    <Probe key="C" name="C" style={ordinary} />
  </Flex></FocusManagement>);
  controllers.push(controller);
  await nextFrame();

  expect([...boxes.values()]).toEqual([
    { x: 37, y: 62, width: 50, height: 20, stamp: 1 },
    { x: 77, y: 62, width: 30, height: 20, stamp: 2 },
    { x: 97, y: 62, width: 50, height: 20, stamp: 3 },
  ]);
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'absolute', 'C']);
  clickCanvas(canvas, 80, 63); // absolute-only space.
  clickCanvas(canvas, 100, 63); // later C remains topmost in the overlap.
  expect(hits).toEqual(['absolute', 'C']);
  const aligned = snapshotWasmLayoutDiagnostics();

  left.set(12);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 37, y: 62, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 62, width: 30, height: 20, stamp: 2 },
    { x: 97, y: 62, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 40, 63); // absolute now follows the supplied left inset over A.
  clickCanvas(canvas, 80, 63); // A is exposed at the former aligned absolute position.
  expect(hits).toEqual(['absolute', 'C', 'absolute', 'A']);
  const inset = snapshotWasmLayoutDiagnostics();
  expect(inset.nodeCreates).toBe(aligned.nodeCreates);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);

  ink.set('#2c8d7d');
  await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(inset.solves);
  expect(painted.nodeCreates).toBe(inset.nodeCreates);
  expect([...canvas.getContext('2d')!.getImageData(40, 63, 1, 1).data]).toEqual([44, 141, 125, 255]);

  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
  ]);
});


it.runIf(experimentalLayout)('centers an overflowing no-inset absolute child for distributed main alignment', async () => {
  let worldBox: { x: number; y: number; width: number; height: number } | undefined;
  function Wide({ style: _style }: { readonly style: RectStyle & FlexItemStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    worldBox = { x: transform.e, y: transform.f, width: box.width, height: box.height };
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#19375b' }} />;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  controllers.push(pibbl(canvas, <Flex style={{ width: 204, height: 104, boxSizing: 'border-box',
    padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
    justifyContent: 'space-around', alignItems: 'flex-end', gap: 10 }}>
    <Wide style={{ position: 'absolute', width: 200, height: 20, minWidth: 0, flexShrink: 0 }} />
  </Flex>));
  await nextFrame();
  expect(worldBox).toEqual({ x: -8, y: 62, width: 200, height: 20 });
});


it.runIf(experimentalLayout)('derives a fixed absolute child size from opposing physical insets without changing Flex siblings', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const ownerWidth = signal(204);
  const ownerHeight = signal(104);
  const hits: string[] = [];
  const focused: string[] = [];
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle
      keyboardFocusable
      onFocus={() => focused.push(name)}
      onClick={() => hits.push(name)}
      style={{ width: box.width, height: box.height, cursor: 'pointer', fill: name === 'absolute' ? '#a63758' : '#19375b' }}
    />;
  }

  const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  const absolute: PlacementStyle = {
    width: 'auto', height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    position: 'absolute', left: 12, right: 18, top: 8, bottom: 10,
  };
  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 124; document.body.append(canvas);
  const controller = pibbl(canvas, <FocusManagement><Flex style={{
    width: ownerWidth, height: ownerHeight, boxSizing: 'border-box',
    padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
    flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
  }}>
    <Probe key="A" name="A" style={ordinary} />
    <Probe key="absolute" name="absolute" style={absolute} />
    <Probe key="C" name="C" style={ordinary} />
  </Flex></FocusManagement>);
  controllers.push(controller);
  await nextFrame();

  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 170, height: 82, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'absolute', 'C']);
  clickCanvas(canvas, 20, 15);
  clickCanvas(canvas, 80, 26); // C is later in source order over the absolute box.
  expect(hits).toEqual(['absolute', 'C']);
  const mounted = snapshotWasmLayoutDiagnostics();

  ownerWidth.set(244); ownerHeight.set(124);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 210, height: 102, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 190, 20); // newly allocated absolute extent.
  expect(hits).toEqual(['absolute', 'C', 'absolute']);
  const resized = snapshotWasmLayoutDiagnostics();
  expect(resized.nodeCreates).toBe(mounted.nodeCreates);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);

  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
  ]);
});


it.runIf(experimentalLayout).each([false, true])('resolves automatic Rectangle dimensions before paint and hit testing, forwarded=%s', async forwarded => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const ownerWidth = signal(204), ownerHeight = signal(104);
  const hits: string[] = [];
  function Forwarded({ style }: { readonly style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    return <Rectangle onClick={() => hits.push('absolute')} style={{ ...style, fill: '#19375b' }} />;
  }
  const style = { position: 'absolute' as const, width: 'auto' as const, height: 'auto' as const,
    left: 12, right: 18, top: 8, bottom: 10 };
  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 124; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: ownerWidth, height: ownerHeight, boxSizing: 'border-box',
    padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2 }}>
    {forwarded ? <Forwarded style={style} /> : <Rectangle onClick={() => hits.push('absolute')} style={{ ...style, fill: '#19375b' }} />}
  </Flex>);
  controllers.push(controller); await nextFrame();
  clickCanvas(canvas, 20, 20); clickCanvas(canvas, 200, 100);
  expect(hits).toEqual(['absolute']);
  expect([...canvas.getContext('2d')!.getImageData(200, 100, 1, 1).data]).toEqual([0, 0, 0, 0]);
  ownerWidth.set(244); ownerHeight.set(124); await nextFrame();
  clickCanvas(canvas, 200, 100);
  expect(hits).toEqual(['absolute', 'absolute']);
  expect([...canvas.getContext('2d')!.getImageData(200, 100, 1, 1).data]).toEqual([25, 55, 91, 255]);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
  ]);
});


it.runIf(experimentalLayout).each(['ltr', 'rtl'] as const)('clamps omitted derived dimensions to zero while preserving %s inset precedence', async direction => {
  let worldBox: { x: number; y: number; width: number; height: number } | undefined;
  function Empty({ style: _style }: { readonly style: BoxStyle & FlexItemStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    worldBox = { x: transform.e, y: transform.f, width: box.width, height: box.height };
    return null;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  controllers.push(pibbl(canvas, <Flex style={{ width: 204, height: 104, boxSizing: 'border-box',
    padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2, layoutDirection: direction }}>
    <Empty style={{ position: 'absolute', left: 120, right: 120, top: 60, bottom: 60 }} />
  </Flex>));
  await nextFrame();
  expect(worldBox).toEqual({ x: direction === 'ltr' ? 122 : 82, y: 62, width: 0, height: 0 });
});

it.runIf(experimentalLayout)('clamps fixed absolute numeric dimensions before LTR left and RTL right placement without consuming sibling slots', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<'ltr' | 'rtl'>('ltr');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: '#a63758', cursor: 'pointer' }} />;
  }

  function Scene() {
    const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const absolute: PlacementStyle = {
      position: 'absolute', left: 12, right: 18, top: 8, bottom: 10,
      width: 100, height: 50, minWidth: 120, maxHeight: 30,
      flexGrow: 0, flexShrink: 0,
    };
    return <Flex style={{
      width: 204, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
      layoutDirection: direction.get(),
    }}>
      <Probe key="A" name="A" style={ordinary} />
      <Probe key="absolute" name="absolute" style={absolute} />
      <Probe key="C" name="C" style={ordinary} />
    </Flex>;
  }

  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 120, height: 30, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 20, 15);
  clickCanvas(canvas, 80, 26); // C stays topmost where it overlaps absolute.
  expect(hits).toEqual(['absolute', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();

  direction.set('rtl');
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 122, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 64, y: 10, width: 120, height: 30, stamp: 2 },
    { x: 62, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 170, 15);
  clickCanvas(canvas, 70, 26);
  expect(hits).toEqual(['absolute', 'C', 'absolute', 'C']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('clamps opposing-inset automatic absolute axes before resizing and RTL right placement', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(204);
  const height = signal(104);
  const direction = signal<'ltr' | 'rtl'>('ltr');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: '#a63758', cursor: 'pointer' }} />;
  }

  function Scene() {
    const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const absolute: PlacementStyle = {
      position: 'absolute', left: 12, right: 18, top: 8, bottom: 10,
      width: 'auto', height: 'auto', minWidth: 180, maxHeight: 70,
      flexGrow: 0, flexShrink: 0,
    };
    return <Flex style={{
      width: width.get(), height: height.get(), boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
      layoutDirection: direction.get(),
    }}>
      <Probe key="A" name="A" style={ordinary} />
      <Probe key="absolute" name="absolute" style={absolute} />
      <Probe key="C" name="C" style={ordinary} />
    </Flex>;
  }

  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 124; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 180, height: 70, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 150, 60);
  expect(hits).toEqual(['absolute']);
  const initial = snapshotWasmLayoutDiagnostics();

  width.set(244); height.set(124);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 210, height: 70, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 200, 60);
  expect(hits).toEqual(['absolute', 'absolute']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

  direction.set('rtl');
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 162, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 210, height: 70, stamp: 2 },
    { x: 102, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 220, 60);
  clickCanvas(canvas, 110, 26); // later C stays topmost in the resized overlap.
  expect(hits).toEqual(['absolute', 'absolute', 'absolute', 'C']);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('derives exactly one automatic absolute axis from a finite outer aspect ratio without intrinsic measurement', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const axis = signal<'width' | 'height'>('width');
  const size = signal(90);
  const direction = signal<'ltr' | 'rtl'>('ltr');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle
      keyboardFocusable
      onClick={() => hits.push(name)}
      style={{ width: box.width, height: box.height, fill: '#a63758', cursor: 'pointer' }}
    />;
  }

  function Scene() {
    const ordinary: PlacementStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const absolute: PlacementStyle = axis.get() === 'width' ? {
      position: 'absolute', left: 12, right: 18, top: 8,
      width: size.get(), height: 'auto', aspectRatio: 3,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    } : {
      position: 'absolute', right: 18, top: 8, bottom: 10,
      width: 'auto', height: size.get(), aspectRatio: 3,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    return <Flex style={{
      width: 204, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10,
      layoutDirection: direction.get(),
    }}>
      <Probe key="A" name="A" style={ordinary} />
      <Probe key="absolute" name="absolute" style={absolute} />
      <Probe key="C" name="C" style={ordinary} />
    </Flex>;
  }

  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 14, y: 10, width: 90, height: 30, stamp: 2 },
    { x: 72, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  canvas.focus({ preventScroll: true });
  clickCanvas(canvas, 20, 15);
  clickCanvas(canvas, 80, 26); // later C remains topmost in the overlap.
  expect(hits).toEqual(['absolute', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();

  direction.set('rtl'); size.set(120);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 122, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 64, y: 10, width: 120, height: 40, stamp: 2 },
    { x: 62, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 170, 15);
  clickCanvas(canvas, 70, 26);
  expect(hits).toEqual(['absolute', 'C', 'absolute', 'C']);
  const widthDerived = snapshotWasmLayoutDiagnostics();
  expect(widthDerived.measuredLeaves).toBe(initial.measuredLeaves);
  expect(widthDerived.nodeCreates).toBe(initial.nodeCreates);

  axis.set('height'); size.set(50);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 122, y: 22, width: 50, height: 20, stamp: 1 },
    { x: 34, y: 10, width: 150, height: 50, stamp: 2 },
    { x: 62, y: 22, width: 50, height: 20, stamp: 3 },
  ]);
  clickCanvas(canvas, 170, 45);
  clickCanvas(canvas, 70, 26);
  expect(hits).toEqual(['absolute', 'C', 'absolute', 'C', 'absolute', 'C']);
  const heightDerived = snapshotWasmLayoutDiagnostics();
  expect(heightDerived.measuredLeaves).toBe(widthDerived.measuredLeaves);
  expect(heightDerived.nodeCreates).toBe(initial.nodeCreates);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('applies absolute aspect derivation before bounds and lets opposing insets override its automatic axis', async () => {
  type PlacementStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const mode = signal<'bound' | 'insets'>('bound');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  function Probe({ name, style: _style }: { readonly name: string; readonly style: PlacementStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }

  function Scene() {
    const absolute: PlacementStyle = mode.get() === 'bound' ? {
      position: 'absolute', left: 12, right: 18, top: 8,
      width: 80, height: 'auto', aspectRatio: 2, minWidth: 100,
      minHeight: 0, flexGrow: 0, flexShrink: 0,
    } : {
      position: 'absolute', left: 12, right: 18, top: 8, bottom: 10,
      width: 80, height: 'auto', aspectRatio: 2,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    return <Flex style={{
      width: 204, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}>
      <Probe name="absolute" style={absolute} />
    </Flex>;
  }

  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  controllers.push(pibbl(canvas, <Scene />));
  await nextFrame();
  // Width clamps from 80 to 100, while height remains the 80 / 2 derivation.
  expect(boxes.get('absolute')).toEqual({ x: 14, y: 10, width: 100, height: 40 });

  mode.set('insets');
  await nextFrame();
  // The explicit top/bottom pair supplies the automatic height instead of aspect ratio.
  expect(boxes.get('absolute')).toEqual({ x: 14, y: 10, width: 80, height: 82 });
});


it.runIf(experimentalLayout)('measures one automatic absolute width with unbounded horizontal availability and exact declared height', async () => {
  type AbsoluteProviderStyle = BoxStyle & FlexItemStyle;
  type Resolved = SystemStyle & { readonly width: number; readonly height: number };
  const baseline = snapshotWasmLayoutDiagnostics();
  const ownerWidth = signal(204), jobs = signal(3), paint = signal('#426b61'), visible = signal(true);
  const constraints: Array<readonly [number, number, number, number]> = [];
  const hits: string[] = [];
  let calls = 0;
  const Leaf = definePrimitive<{ readonly jobs: typeof jobs }, AbsoluteProviderStyle, AbsoluteProviderStyle, Resolved>((_props, _style) => {
    const box = useLayoutBox();
    return <Rectangle onClick={() => hits.push('absolute')} style={{ width: box.width, height: box.height, fill: '#a63758', cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['jobs'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 160, height: 20 } }),
    measure: ({ props, constraints: input }) => {
      calls++;
      constraints.push([input.minWidth, input.maxWidth, input.minHeight, input.maxHeight]);
      return { status: 'measured' as const, size: { width: props.jobs.get() * 20, height: 20 } };
    },
  });
  function Scene() {
    const leaf = useConst(() => <Leaf key="absolute" jobs={jobs} style={{ position: 'absolute', right: 18, top: 8, width: 'auto', height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />);
    const sibling = useConst(() => <Rectangle key="sibling" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: paint }} />);
    return <Flex style={{
      width: ownerWidth, height: 104, boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}>{[visible.get() ? leaf : null, sibling]}</Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  const initial = snapshotWasmLayoutDiagnostics();
  expect(constraints).toEqual([[0, Infinity, 20, 20]]);
  clickCanvas(canvas, 130, 15);
  expect(hits).toEqual(['absolute']);

  ownerWidth.set(244);
  await nextFrame();
  expect(calls).toBe(2);
  expect(constraints).toEqual([[0, Infinity, 20, 20], [0, Infinity, 20, 20]]);
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(initial.measuredLeaves + 1);
  clickCanvas(canvas, 170, 15);
  expect(hits).toEqual(['absolute', 'absolute']);
  paint.set('#6e3e79');
  await nextFrame();
  expect(calls).toBe(2);
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(initial.measuredLeaves + 1);

  jobs.set(6);
  await nextFrame();
  expect(constraints).toEqual([[0, Infinity, 20, 20], [0, Infinity, 20, 20], [0, Infinity, 20, 20]]);
  clickCanvas(canvas, 110, 15);
  expect(hits).toEqual(['absolute', 'absolute', 'absolute']);
  const resized = snapshotWasmLayoutDiagnostics();
  expect(resized.measuredLeaves).toBe(initial.measuredLeaves + 2);
  expect(resized.nodeCreates).toBe(initial.nodeCreates);

  visible.set(false);
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  const removedCalls = calls;
  const removedPasses = snapshotWasmLayoutDiagnostics().allocationPasses;
  jobs.set(4);
  await nextFrame();
  expect(calls).toBe(removedCalls);
  expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(removedPasses);
  visible.set(true);
  await nextFrame();
  expect(calls).toBe(removedCalls + 1);
  clickCanvas(canvas, 150, 15);
  expect(hits).toEqual(['absolute', 'absolute', 'absolute', 'absolute']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
  ]);
});


it.runIf(experimentalLayout)('owns a natural-width measurement cache without creating an absolute-only native line item', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const paint = signal('#a63758');
  let calls = 0;
  const Leaf = definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
    const box = useLayoutBox();
    return <Rectangle style={{width:box.width,height:box.height,fill:paint}} />;
  }, {
    resolveStyle: () => ({}),
    measureIntrinsic: () => ({status:'measured',minContent:{width:20,height:20},maxContent:{width:60,height:20}}),
    measure: () => { calls++; return {status:'measured',size:{width:60,height:20}}; },
  });
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;document.body.append(canvas);
  const controller=pibbl(canvas,<Flex style={{width:200,height:100}}><Leaf style={{position:'absolute',left:12,top:8,width:'auto',height:20}} /></Flex>);controllers.push(controller);
  await nextFrame();
  const initial=snapshotWasmLayoutDiagnostics();
  expect([initial.activeNodes,initial.activeArenas,initial.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas+1,baseline.cachedMeasurements+1]);
  paint.set('#426b61');await nextFrame();
  expect(calls).toBe(1);
  expect([...canvas.getContext('2d')!.getImageData(14,10,1,1).data]).toEqual([66,107,97,255]);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});
