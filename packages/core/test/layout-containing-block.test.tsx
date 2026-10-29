import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Absolute,
  Group,
  FocusManagement,
  Flex,
  Flow,
  Grid,
  Overlay,
  type PibblNode,
  Rectangle,
  signal,
  type FlexItemStyle,
  type FlexStyle,
  type PibblResponsiveStyle,
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

it.runIf(nativeLayout)('makes a static nested Flex transparent to the nearest containing Flex while relative and omitted Flex own their local absolute child', async () => {
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const mode = signal<'static' | 'relative' | undefined>('static');
  const hits: string[] = [];
  const focused: string[] = [];
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;

  function Probe({ name, style: _style }: { readonly name: string; readonly style: ProbeStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle
      keyboardFocusable
      onFocus={() => focused.push(name)}
      onClick={() => hits.push(name)}
      style={{ width: box.width, height: box.height, cursor: 'pointer', fill: name === 'absolute' ? '#a63758' : '#246b61' }}
    />;
  }

  function Scene() {
    const position = mode.get();
    const owner: OwnerStyle = {
      width: 80, height: 60,
      marginLeft: 20, marginTop: 10,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
      ...(position === undefined ? {} : { position }),
    };
    const absolute: ProbeStyle = {
      position: 'absolute', left: 12, top: 8,
      width: 30, height: 20,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    const sibling: ProbeStyle = {
      width: 40, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    return <FocusManagement><Flex style={{
      width: 204, height: 104,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}>
      <Flex key="owner" style={owner}>
        <Probe key="absolute" name="absolute" style={absolute} />
      </Flex>
      <Probe key="B" name="B" style={sibling} />
    </Flex></FocusManagement>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();

  // Yoga static: ancestor Flex is the containing block, so the child's local
  // coordinates in the inner Flex are negative even though world placement is 12,8.
  expect([...boxes.values()]).toEqual([
    { x: 12, y: 8, width: 30, height: 20, stamp: 1 },
    { x: 100, y: 0, width: 40, height: 20, stamp: 2 },
  ]);
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['absolute', 'B']);
  clickCanvas(canvas, 14, 10);
  clickCanvas(canvas, 102, 2);
  expect(hits).toEqual(['absolute', 'B']);
  const staticSnapshot = snapshotWasmLayoutDiagnostics();

  mode.set('relative');
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 32, y: 18, width: 30, height: 20, stamp: 1 },
    { x: 100, y: 0, width: 40, height: 20, stamp: 2 },
  ]);
  clickCanvas(canvas, 14, 10); // static containing-block position is now empty.
  clickCanvas(canvas, 34, 20);
  expect(hits).toEqual(['absolute', 'B', 'absolute']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(staticSnapshot.nodeCreates);

  mode.set(undefined);
  await nextFrame();
  expect([...boxes.values()]).toEqual([
    { x: 32, y: 18, width: 30, height: 20, stamp: 1 },
    { x: 100, y: 0, width: 40, height: 20, stamp: 2 },
  ]);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2]);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(nativeLayout)('passes two static Flex boxes to the nearest owner, while a relative middle Flex resets that containing block', async () => {
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  const mode = signal<'static' | 'relative'>('static');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;

  function Probe({ style: _style }: { readonly style: ProbeStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set('absolute', { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }

  function Scene() {
    const middle: OwnerStyle = {
      position: mode.get(), width: 120, height: 80,
      marginLeft: 20, marginTop: 10,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const inner: OwnerStyle = {
      position: 'static', width: 80, height: 60,
      marginLeft: 15, marginTop: 5,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const absolute: ProbeStyle = {
      position: 'absolute', left: 12, top: 8,
      width: 30, height: 20,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    return <Flex style={{ width: 204, height: 104, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Flex key="middle" style={middle}>
        <Flex key="inner" style={inner}>
          <Probe key="absolute" style={absolute} />
        </Flex>
      </Flex>
    </Flex>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect(boxes.get('absolute')).toEqual({ x: 12, y: 8, width: 30, height: 20, stamp: 1 });
  const staticSnapshot = snapshotWasmLayoutDiagnostics();

  mode.set('relative');
  await nextFrame();
  expect(boxes.get('absolute')).toEqual({ x: 32, y: 18, width: 30, height: 20, stamp: 1 });
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(staticSnapshot.nodeCreates);
});

it.runIf(nativeLayout)('keeps a static decorated Flex transparent when the nearest owner derives paired-inset absolute dimensions', async () => {
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(204);
  const height = signal(104);
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  let nextStamp = 1;

  function Probe({ style: _style }: { readonly style: ProbeStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set('absolute', { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push('absolute')} style={{ width: box.width, height: box.height, fill: '#a63758', cursor: 'pointer' }} />;
  }

  function Scene() {
    const owner: OwnerStyle = {
      position: 'static', width: 80, height: 60,
      marginLeft: 20, marginTop: 10,
      boxSizing: 'border-box', padding: 4, borderWidth: 3,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const absolute: ProbeStyle = {
      position: 'absolute', left: 12, right: 18, top: 8, bottom: 10,
      width: 'auto', height: 'auto',
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    return <Flex style={{
      width: width.get(), height: height.get(), boxSizing: 'border-box',
      padding: { left: 10, right: 30, top: 20, bottom: 20 }, borderWidth: 2,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}><Flex key="owner" style={owner}><Probe key="absolute" style={absolute} /></Flex></Flex>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 244; canvas.height = 124; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect(boxes.get('absolute')).toEqual({ x: 14, y: 10, width: 170, height: 82, stamp: 1 });
  clickCanvas(canvas, 15, 11);
  expect(hits).toEqual(['absolute']);
  const initial = snapshotWasmLayoutDiagnostics();

  width.set(244); height.set(124);
  await nextFrame();
  expect(boxes.get('absolute')).toEqual({ x: 14, y: 10, width: 210, height: 102, stamp: 1 });
  clickCanvas(canvas, 200, 20);
  expect(hits).toEqual(['absolute', 'absolute']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(nativeLayout)('keeps a fixed direct static or relative Flex owner stable across wrapped outer allocation while its primitive absolute leaf uses the selected containing box', async () => {
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const mode = signal<'static' | 'relative'>('static');
  const ink = signal('#a63758');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  const focused: string[] = [];
  let serial = 1;

  function Probe({ name, style: _style }: { readonly name: 'absolute' | 'C'; readonly style: ProbeStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const stamp = useConst(() => serial++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle
      keyboardFocusable
      onFocus={() => focused.push(name)}
      onClick={() => hits.push(name)}
      style={{ width: box.width, height: box.height, cursor: 'pointer', fill: name === 'absolute' ? ink : '#246b61' }}
    />;
  }

  function Scene() {
    const owner: OwnerStyle = {
      position: mode.get(), left: 12, top: 8,
      width: 80, height: 40,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const absolute: ProbeStyle = {
      position: 'absolute', left: 12, top: 8,
      width: 20, height: 10,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    const sibling: ProbeStyle = {
      width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    return <FocusManagement><Flex style={{
      width: 164, height: 84, boxSizing: 'border-box', borderWidth: 2, padding: 10,
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', gap: 10,
    }}>
      <Flex key="owner" style={owner}><Probe key="absolute" name="absolute" style={absolute} /></Flex>
      <Probe key="C" name="C" style={sibling} />
    </Flex></FocusManagement>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 164; canvas.height = 84; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();

  // The wrapped static owner reserves its first-line 80×40 slot. Its child sees
  // the outer padding box (2,2,160,80), so left/top produce world (14,10).
  expect([...boxes.entries()]).toEqual([
    ['absolute', { x: 14, y: 10, width: 20, height: 10, stamp: 1 }],
    ['C', { x: 12, y: 62, width: 60, height: 20, stamp: 2 }],
  ]);
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['absolute', 'C']);
  clickCanvas(canvas, 16, 12);
  clickCanvas(canvas, 14, 64);
  expect(hits).toEqual(['absolute', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();

  mode.set('relative');
  await nextFrame();
  // Relative moves only final owner paint (12,8); its leaf uses the owner box.
  expect([...boxes.entries()]).toEqual([
    ['absolute', { x: 36, y: 28, width: 20, height: 10, stamp: 1 }],
    ['C', { x: 12, y: 62, width: 60, height: 20, stamp: 2 }],
  ]);
  clickCanvas(canvas, 16, 12);
  clickCanvas(canvas, 38, 30);
  expect(hits).toEqual(['absolute', 'C', 'absolute']);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

  const beforePaint = snapshotWasmLayoutDiagnostics();
  ink.set('#6e9d35');
  await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.nodeCreates).toBe(initial.nodeCreates);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2]);

  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('inherits the positioned layout box through an opaque component wrapper', async () => {
  let absolute: { x: number; y: number; width: number; height: number } | undefined;
  function Probe({ style: _style }: { readonly style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    const box = useLayoutBox();
    const matrix = useCanvasContext().getTransform();
    absolute = { x: matrix.e, y: matrix.f, width: box.width, height: box.height };
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }
  function Wrapper({ style: _style }: { readonly style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    return <Flex style={{ position: 'static', width: 80, height: 60, alignItems: 'flex-start' }}>
      <Probe style={{ position: 'absolute', left: 12, top: 8, width: 30, height: 20, minWidth: 0, minHeight: 0 }} />
    </Flex>;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 200; canvas.height = 100; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 200, height: 100, alignItems: 'flex-start' }}>
    <Rectangle style={{ width: 40, height: 20, minWidth: 0, flexShrink: 0 }} />
    <Wrapper style={{ width: 80, height: 60, minWidth: 0, flexShrink: 0 }} />
  </Flex>);
  controllers.push(controller);
  await nextFrame();
  expect(absolute).toEqual({ x: 12, y: 8, width: 30, height: 20 });
});

it.runIf(nativeLayout)('uses a positioned Absolute padding box through an opaque static Flex for right-inset descendants', async () => {
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  let absolute: { x: number; y: number; width: number; height: number } | undefined;

  function Probe({ style: _style }: { readonly style: ProbeStyle }) {
    const box = useLayoutBox();
    const matrix = useCanvasContext().getTransform();
    absolute = { x: matrix.e, y: matrix.f, width: box.width, height: box.height };
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }

  function StaticCard({ style: _style }: { readonly style: OwnerStyle }) {
    return <Flex style={{
      position: 'static', width: 200, height: 80,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}>
      <Probe style={{
        position: 'absolute', right: 0, top: 0,
        width: 20, height: 10, minWidth: 0, minHeight: 0,
      }} />
    </Flex>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 120; document.body.append(canvas);
  const controller = pibbl(canvas, <Absolute style={{
    width: 200, height: 80, boxSizing: 'border-box',
    padding: { left: 10, right: 20, top: 4, bottom: 6 },
    borderWidth: { left: 3, right: 7, top: 2, bottom: 8 },
  }}>
    <StaticCard style={{ width: 200, height: 80 }} />
  </Absolute>);
  controllers.push(controller);
  await nextFrame();

  // The containing block is the outer padding box: x=3, width=190, y=2.
  // The static Flex remains transparent, so right: 0 places the 20px leaf at x=173.
  expect(absolute).toEqual({ x: 173, y: 2, width: 20, height: 10 });
});

it.runIf(nativeLayout)('gives every positioned layout owner the same padding-box context while preflighting a static known descendant', async () => {
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  let absolute: { x: number; y: number; width: number; height: number } | undefined;

  function Probe({ style: _style }: { readonly style: ProbeStyle }) {
    const box = useLayoutBox();
    const matrix = useCanvasContext().getTransform();
    absolute = { x: matrix.e, y: matrix.f, width: box.width, height: box.height };
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }

  function StaticCard({ style: _style }: { readonly style: OwnerStyle }) {
    return <Flex style={{
      position: 'static', width: 200, height: 80,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}>
      <Probe style={{
        position: 'absolute', right: 0, top: 0,
        width: 20, height: 10, minWidth: 0, minHeight: 0,
      }} />
    </Flex>;
  }

  for (const owner of ['Absolute', 'Overlay', 'Flow', 'Grid'] as const) {
    absolute = undefined;
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 120; document.body.append(canvas);
    const ownerStyle = {
      width: 200, height: 80, boxSizing: 'border-box' as const,
      padding: { left: 10, right: 20, top: 4, bottom: 6 },
      borderWidth: { left: 3, right: 7, top: 2, bottom: 8 },
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    };
    const card = <StaticCard style={{ width: 200, height: 80 }} />;
    const ownerNode: PibblNode = owner === 'Absolute' ? <Absolute style={ownerStyle}>{card}</Absolute>
      : owner === 'Overlay' ? <Overlay style={ownerStyle}>{card}</Overlay>
      : owner === 'Flow' ? <Flow style={ownerStyle}>{card}</Flow>
      : <Grid style={{ ...ownerStyle, gridTemplateColumns: [160], gridTemplateRows: [68] }}>{card}</Grid>;
    const node: PibblNode = <Flex style={{
      width: 300, height: 120,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    }}>{ownerNode}</Flex>;
    const controller = pibbl(canvas, node); controllers.push(controller);
    await nextFrame();
    expect(absolute, owner).toEqual({ x: 173, y: 2, width: 20, height: 10 });
    controller.dispose();
    controllers.splice(controllers.indexOf(controller), 1);
    canvas.remove();
  }
});

it.runIf(nativeLayout).each(['normal', 'contents'] as const)('keeps a transformed %s Group transparent to logical containing-block selection', async participation => {
  let geometry: { x: number; y: number; width: number; height: number } | undefined;
  let hits = 0;
  function Probe({ style: _style }: { style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform();
    geometry = { x: matrix.e, y: matrix.f, width: box.width, height: box.height };
    return <Rectangle onClick={() => hits++} style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }
  function Wrapper({ style: _style }: { style: PibblResponsiveStyle<RectStyle & FlexItemStyle> }) {
    return <Group style={{ layoutParticipation: participation, translateX: 11, translateY: 7 }}>
      <Flex style={{ position: 'static', width: 80, height: 40 }}>
        <Probe style={{ position: 'absolute', right: 0, top: 0, width: 20, height: 10, minWidth: 0, minHeight: 0 }} />
      </Flex>
    </Group>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 120; document.body.append(canvas);
  const controller = pibbl(canvas, <Absolute style={{ width: 200, height: 80, boxSizing: 'border-box', padding: { left: 10, right: 20, top: 4, bottom: 6 }, borderWidth: { left: 3, right: 7, top: 2, bottom: 8 } }}>
    <Wrapper style={{ width: 80, height: 40 }} />
  </Absolute>);
  controllers.push(controller); await nextFrame();
  expect(geometry).toEqual({ x: 184, y: 9, width: 20, height: 10 });
  clickCanvas(canvas, 185, 10); expect(hits).toBe(1);
  clickCanvas(canvas, 175, 3); expect(hits).toBe(1);
});
