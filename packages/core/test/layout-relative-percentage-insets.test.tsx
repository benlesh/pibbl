import { afterEach, beforeAll, expect, it } from 'vitest';
import { FocusManagement, Flex, Rectangle, signal, type FlexItemStyle, type FlexStyle, type PibblResponsiveStyle, type RectStyle, useCanvasContext, useConst, useLayoutBox } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}
function pressTab(canvas: HTMLCanvasElement): void { canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })); }

type Box = { x: number; y: number; width: number; height: number; stamp: number };
it.runIf(nativeLayout)('keeps static percentage insets inert and applies relative physical percentages from finite Flex content axes', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type Mode = 'omitted' | 'static' | 'leading' | 'trailing' | 'overflow';
  type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<Direction>('row'), wrap = signal<'wrap' | 'wrap-reverse'>('wrap'), writing = signal<'ltr' | 'rtl'>('ltr'), width = signal(204), height = signal(104), mode = signal<Mode>('leading'), ink = signal('#a63758');
  const boxes = new Map<string, Box>(); const hits: string[] = []; const focused: string[] = []; let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'B' | 'C'; readonly style: Style }) {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set(name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
    return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, cursor: 'pointer', fill: name === 'B' ? ink : '#19375b' }} />;
  }
  const flow: Style = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const next = mode.get();
    const middle: Style = next === 'omitted' ? flow
      : next === 'static' ? { ...flow, position: 'static', left: '10%', right: '15%', top: '20%', bottom: '10%' }
      : next === 'leading' ? { ...flow, position: 'relative', left: '10%', right: '15%', top: '20%', bottom: '10%' }
      : next === 'trailing' ? { ...flow, position: 'relative', right: '15%', bottom: '10%' }
      : { ...flow, position: 'relative', left: '-10%', top: '120%' };
    return <FocusManagement><Flex style={{ width: width.get(), height: height.get(), boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}><Probe key="A" name="A" style={flow} /><Probe key="B" name="B" style={middle} /><Probe key="C" name="C" style={flow} /></Flex></FocusManagement>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 144; canvas.tabIndex = 0; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  const initial = snapshotWasmLayoutDiagnostics();
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); mode.set('omitted'); await frame();
    const ordinary = boxes.get('B')!, ordinaryA = boxes.get('A')!, ordinaryC = boxes.get('C')!;
    mode.set('static'); await frame();
    expect(boxes.get('B')).toEqual(ordinary); expect(boxes.get('A')).toEqual(ordinaryA); expect(boxes.get('C')).toEqual(ordinaryC);
    mode.set('leading'); await frame();
    expect(boxes.get('B')).toEqual({ ...ordinary, x: ordinary.x + (rtl === 'ltr' ? 16 : -24), y: ordinary.y + 12 }); expect(boxes.get('A')).toEqual(ordinaryA); expect(boxes.get('C')).toEqual(ordinaryC);
    mode.set('trailing'); await frame();
    expect(boxes.get('B')).toEqual({ ...ordinary, x: ordinary.x - 24, y: ordinary.y - 6 }); expect(boxes.get('A')).toEqual(ordinaryA); expect(boxes.get('C')).toEqual(ordinaryC);
  }
  direction.set('row'); wrap.set('wrap'); writing.set('ltr'); mode.set('omitted'); await frame();
  canvas.focus({ preventScroll: true }); expect(focused).toEqual(['A']); pressTab(canvas); expect(focused).toEqual(['A', 'B']);
  const hitBox = boxes.get('B')!; click(canvas, hitBox.x + 10, hitBox.y + 10); expect(hits).toEqual(['B']);
  mode.set('leading'); await frame(); expect(focused).toEqual(['A', 'B']);
  mode.set('overflow'); await frame(); const ordinaryA = boxes.get('A')!, ordinaryC = boxes.get('C')!, overflow = boxes.get('B')!;
  mode.set('omitted'); await frame(); const ordinary = boxes.get('B')!;
  expect(overflow).toEqual({ ...ordinary, x: ordinary.x - 16, y: ordinary.y + 72 }); expect(ordinaryA).toEqual(boxes.get('A')); expect(ordinaryC).toEqual(boxes.get('C'));
  mode.set('leading'); width.set(244); height.set(144); await frame(); const resized = boxes.get('B')!;
  mode.set('omitted'); await frame(); const resizedOrdinary = boxes.get('B')!;
  expect(resized).toEqual({ ...resizedOrdinary, x: resizedOrdinary.x + 20, y: resizedOrdinary.y + 20 });
  const beforePaint = snapshotWasmLayoutDiagnostics(); ink.set('#6e9d35'); await frame(); const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves); expect(painted.nodeCreates).toBe(initial.nodeCreates); expect([...boxes.values()].map(value => value.stamp)).toEqual([1, 2, 3]);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('forwards percentage signals through a fixed direct Flex owner while static ownership stays transparent', async () => {
  type OwnerStyle = PibblResponsiveStyle<FlexStyle & FlexItemStyle>;
  type ChildStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const position = signal<'static' | 'relative'>('static'), left = signal<'10%' | '20%'>('10%'), top = signal<'20%'>('20%');
  const boxes = new Map<string, Box>(); let serial = 1;
  function Probe({ style: _style }: { readonly style: ChildStyle }) {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set('absolute', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }
  function Scene() {
    const owner: OwnerStyle = {
      position, left, top, width: 80, height: 60,
      minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
      flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const child: ChildStyle = { position: 'absolute', left: '10%', top: '20%', width: 30, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}><Flex key="owner" style={owner}><Probe key="absolute" style={child} /></Flex></Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 22, y: 22, width: 30, height: 20, stamp: 1 });
  const staticSnapshot = snapshotWasmLayoutDiagnostics();
  position.set('relative'); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 36, y: 46, width: 30, height: 20, stamp: 1 });
  left.set('20%'); await frame();
  expect(boxes.get('absolute')).toEqual({ x: 52, y: 46, width: 30, height: 20, stamp: 1 });
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(staticSnapshot.nodeCreates);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
