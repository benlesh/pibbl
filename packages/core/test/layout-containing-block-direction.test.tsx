import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, signal, type FlexItemStyle, type FlexStyle,
  type PibblResponsiveStyle, type RectStyle, useCanvasContext, useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(nativeLayout)('keeps direct finite static and relative Flex containing blocks correct across parent and child nowrap directions', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const parentDirection = signal<Direction>('row');
  const innerDirection = signal<Direction>('row');
  const writing = signal<'ltr' | 'rtl'>('ltr');
  const mode = signal<'static' | 'relative'>('static');
  const width = signal(204), height = signal(144);
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let nextStamp = 1;
  function Probe({ name, style: _style }: { readonly name: string; readonly style: ProbeStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    const stamp = useConst(() => nextStamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: name === 'A' ? '#a63758' : '#246b61' }} />;
  }
  function Scene() {
    const owner: OwnerStyle = { position: mode.get(), width: 80, height: 60, marginLeft: 20, marginTop: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, flexDirection: innerDirection.get(), flexWrap: 'nowrap', alignItems: 'flex-start' };
    const fixed: ProbeStyle = { width: 80, height: 60, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const absolute: ProbeStyle = { position: 'absolute', width: 30, height: 20, left: 12, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const b: ProbeStyle = { width: 40, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <Flex style={{ width: width.get(), height: height.get(), boxSizing: 'border-box', padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: parentDirection.get(), flexWrap: 'nowrap', layoutDirection: writing.get(), gap: 10, alignItems: 'flex-start' }}>
      <Flex key="inner" style={owner}><Probe key="I" name="I" style={fixed} /><Probe key="A" name="A" style={absolute} /></Flex>
      <Probe key="B" name="B" style={b} />
    </Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 184; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  const expected = {
    row: { ltr: [[30, 30], [120, 20]], rtl: [[94, 30], [24, 20]] },
    'row-reverse': { ltr: [[94, 30], [24, 20]], rtl: [[30, 30], [120, 20]] },
    column: { ltr: [[30, 30], [10, 100]], rtl: [[94, 30], [134, 100]] },
    'column-reverse': { ltr: [[30, 64], [10, 24]], rtl: [[94, 64], [134, 24]] },
  } as const;
  for (const [outer, inner] of [['row', 'column'], ['row-reverse', 'column-reverse'], ['column', 'row'], ['column-reverse', 'row-reverse']] as const) for (const rtl of ['ltr', 'rtl'] as const) for (const position of ['static', 'relative'] as const) {
    parentDirection.set(outer); innerDirection.set(inner); writing.set(rtl); mode.set(position); await nextFrame();
    const [innerSlot, bSlot] = expected[outer][rtl];
    expect(boxes.get('I')).toMatchObject({ x: innerSlot[0], y: innerSlot[1], width: 80, height: 60, stamp: 1 });
    expect(boxes.get('B')).toMatchObject({ x: bSlot[0], y: bSlot[1], width: 40, height: 20, stamp: 3 });
    expect(boxes.get('A')).toMatchObject(position === 'static' ? { x: 12, y: 8, width: 30, height: 20, stamp: 2 } : { x: innerSlot[0] + 12, y: innerSlot[1] + 8, width: 30, height: 20, stamp: 2 });
  }
  parentDirection.set('column-reverse'); innerDirection.set('row'); writing.set('ltr'); mode.set('relative'); width.set(244); height.set(184); await nextFrame();
  expect(boxes.get('I')).toMatchObject({ x: 30, y: 104, width: 80, height: 60, stamp: 1 });
  expect(boxes.get('A')).toMatchObject({ x: 42, y: 112, width: 30, height: 20, stamp: 2 });
  expect(boxes.get('B')).toMatchObject({ x: 10, y: 64, width: 40, height: 20, stamp: 3 });
  controller.dispose();
  const after = snapshotWasmLayoutDiagnostics();
  expect(after.activeNodes).toBe(baseline.activeNodes);
  expect(after.activeArenas).toBe(baseline.activeArenas);
  expect(after.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('preserves wrapped fixed Flex owner slots while static inherits and relative applies physical final offsets in every parent direction', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const parentDirection = signal<Direction>('row');
  const wrap = signal<'wrap' | 'wrap-reverse'>('wrap');
  const writing = signal<'ltr' | 'rtl'>('ltr');
  const mode = signal<'static' | 'relative' | undefined>(undefined);
  const width = signal(164), height = signal(84);
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  let serial = 1;

  function Probe({ name, style: _style }: { readonly name: 'I' | 'absolute' | 'C'; readonly style: ProbeStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    const stamp = useConst(() => serial++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: name === 'absolute' ? '#a63758' : '#246b61' }} />;
  }

  function Scene() {
    const position = mode.get();
    const owner: OwnerStyle = {
      width: 80, height: 40, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
      ...(position === undefined ? {} : { position, left: 12, right: 18, top: 8 }),
    };
    const inner: ProbeStyle = { width: 80, height: 40, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const absolute: ProbeStyle = { position: 'absolute', left: 12, top: 8, width: 20, height: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const sibling: ProbeStyle = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <Flex style={{
      width: width.get(), height: height.get(), boxSizing: 'border-box', borderWidth: 2, padding: 10,
      flexDirection: parentDirection.get(), flexWrap: wrap.get(), layoutDirection: writing.get(),
      alignItems: 'flex-start', alignContent: 'flex-start', gap: 10,
    }}>
      <Flex key="owner" style={owner}><Probe key="I" name="I" style={inner} /><Probe key="absolute" name="absolute" style={absolute} /></Flex>
      <Probe key="C" name="C" style={sibling} />
    </Flex>;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 244; canvas.height = 124; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  const initial = snapshotWasmLayoutDiagnostics();

  for (const direction of ['row', 'row-reverse', 'column', 'column-reverse'] as const) {
    for (const wrapped of ['wrap', 'wrap-reverse'] as const) {
      for (const rtl of ['ltr', 'rtl'] as const) {
        parentDirection.set(direction); wrap.set(wrapped); writing.set(rtl); mode.set(undefined);
        await nextFrame();
        const ordinaryI = boxes.get('I')!, ordinaryC = boxes.get('C')!;
        const ordinaryStamps = [...boxes.values()].map(box => box.stamp);

        mode.set('static');
        await nextFrame();
        expect(boxes.get('I')).toEqual(ordinaryI);
        expect(boxes.get('C')).toEqual(ordinaryC);
        expect(boxes.get('absolute')).toEqual({ x: 14, y: 10, width: 20, height: 10, stamp: 2 });

        mode.set('relative');
        await nextFrame();
        const dx = rtl === 'ltr' ? 12 : -18;
        expect(boxes.get('I')).toEqual({ ...ordinaryI, x: ordinaryI.x + dx, y: ordinaryI.y + 8 });
        expect(boxes.get('C')).toEqual(ordinaryC);
        expect(boxes.get('absolute')).toEqual({ x: ordinaryI.x + dx + 12, y: ordinaryI.y + 16, width: 20, height: 10, stamp: 2 });
        expect([...boxes.values()].map(box => box.stamp)).toEqual(ordinaryStamps);
      }
    }
  }

  parentDirection.set('column-reverse'); wrap.set('wrap-reverse'); writing.set('rtl'); mode.set('relative');
  width.set(244); height.set(124);
  await nextFrame();
  const resizedI = boxes.get('I')!, resizedC = boxes.get('C')!;
  expect(boxes.get('absolute')).toEqual({ x: resizedI.x + 12, y: resizedI.y + 8, width: 20, height: 10, stamp: 2 });
  expect(resizedC.stamp).toBe(3);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
