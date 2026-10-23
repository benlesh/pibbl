import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Absolute,
  FocusManagement,
  Flex,
  Rectangle,
  createElement,
  measureElement,
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
