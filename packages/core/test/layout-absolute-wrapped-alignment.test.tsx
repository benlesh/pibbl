import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, FocusManagement, Rectangle, signal,
  type FlexItemStyle, type PibblResponsiveStyle, type RectStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

it.runIf(nativeLayout)('aligns omitted axes of fixed absolute primitive leaves through every wrapped Flex direction', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type Anchor = 'none' | 'left' | 'top' | 'both';
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<Direction>('row');
  const wrap = signal<'wrap' | 'wrap-reverse'>('wrap');
  const writing = signal<'ltr' | 'rtl'>('ltr');
  const anchor = signal<Anchor>('none');
  const ink = signal('#a63758');
  const cross = signal<'flex-start' | 'flex-end' | 'center' | 'stretch' | 'start' | 'end'>('flex-end');
  const main = signal<'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'>('center');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [], focused: string[] = [];
  let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'ABS' | 'C' | 'D'; readonly style: ProbeStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: name === 'ABS' ? ink : '#19375b', cursor: 'pointer' }} />;
  }
  const flow: ProbeStyle = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const choice = anchor.get();
    const absolute: ProbeStyle = choice === 'none'
      ? { position: 'absolute', width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : choice === 'left'
        ? { position: 'absolute', width: 50, height: 20, left: 12, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
        : choice === 'top'
          ? { position: 'absolute', width: 50, height: 20, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
          : { position: 'absolute', width: 50, height: 20, left: 12, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <FocusManagement><Flex style={{ width: 164, height: 84, boxSizing: 'border-box', borderWidth: 2, padding: 10, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), justifyContent: main.get(), alignItems: cross.get(), alignContent: 'flex-start', gap: 10 }}>
      <Probe key="A" name="A" style={flow} /><Probe key="ABS" name="ABS" style={absolute} /><Probe key="C" name="C" style={flow} /><Probe key="D" name="D" style={flow} />
    </Flex></FocusManagement>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 164; canvas.height = 84; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
  canvas.focus({ preventScroll: true }); for (let index = 0; index < 3; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'ABS', 'C', 'D']); click(canvas, 60, 66); click(canvas, 100, 15); expect(hits).toEqual(['ABS', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) for (const nextAnchor of ['none', 'left', 'top', 'both'] as const) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); anchor.set(nextAnchor); await nextFrame();
    const row = axis === 'row' || axis === 'row-reverse';
    const crossStart = wrapped === 'wrap-reverse' !== (row ? false : rtl === 'rtl');
    const omittedX = row ? 57 : crossStart ? 12 : 102;
    const omittedY = row ? crossStart ? 12 : 52 : 32;
    expect(boxes.get('ABS')).toEqual({ x: nextAnchor === 'left' || nextAnchor === 'both' ? 14 : omittedX, y: nextAnchor === 'top' || nextAnchor === 'both' ? 10 : omittedY, width: 50, height: 20, stamp: 2 });
    expect(boxes.get('A')!.stamp).toBe(1); expect(boxes.get('C')!.stamp).toBe(3); expect(boxes.get('D')!.stamp).toBe(4);
  }
  anchor.set('none');
  for (const [alignment, x] of [['flex-start', 12], ['flex-end', 102], ['center', 57], ['stretch', 12], ['start', 102], ['end', 12]] as const) {
    cross.set(alignment); await nextFrame(); expect(boxes.get('ABS')).toEqual({ x, y: 32, width: 50, height: 20, stamp: 2 });
  }
  cross.set('flex-end');
  for (const [alignment, y] of [['flex-start', 52], ['flex-end', 12], ['center', 32], ['space-between', 52], ['space-around', 32], ['space-evenly', 32]] as const) {
    main.set(alignment); await nextFrame(); expect(boxes.get('ABS')).toEqual({ x: 102, y, width: 50, height: 20, stamp: 2 });
  }
  const beforePaint = snapshotWasmLayoutDiagnostics(); ink.set('#6e9d35'); await nextFrame(); const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves); expect(painted.nodeCreates).toBe(initial.nodeCreates); expect([...boxes.values()].map(value => value.stamp)).toEqual([1, 2, 3, 4]);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
