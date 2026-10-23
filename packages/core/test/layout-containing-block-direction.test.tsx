import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, signal, type FlexItemStyle, type FlexStyle,
  type PibblResponsiveStyle, type RectStyle, useCanvasContext, useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(experimentalLayout)('keeps direct finite static and relative Flex containing blocks correct across parent and child nowrap directions', async () => {
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
