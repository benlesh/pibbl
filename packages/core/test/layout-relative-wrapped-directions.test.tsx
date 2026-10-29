import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, FocusManagement, Rectangle, signal, type FlexItemStyle, type PibblResponsiveStyle, type RectStyle, useCanvasContext, useConst, useLayoutBox } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void { const rect = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: rect.left + x, clientY: rect.top + y, bubbles: true, button: 0 })); }

it.runIf(nativeLayout)('keeps wrapped primitive static slots while relative physical offsets move final paint once in every main direction', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<Direction>('row-reverse'), wrap = signal<'wrap' | 'wrap-reverse'>('wrap'), writing = signal<'ltr' | 'rtl'>('ltr'), position = signal<'static' | 'relative' | undefined>('relative'), ink = signal('#a63758');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [], focused: string[] = []; let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'B' | 'C'; readonly style: ProbeStyle }) { const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++); boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp }); return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: name === 'B' ? ink : '#19375b', cursor: 'pointer' }} />; }
  const flow: ProbeStyle = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() { const middle: ProbeStyle = position.get() === undefined ? flow : { ...flow, position: position.get(), left: 12, right: 18, top: 8 }; return <FocusManagement><Flex style={{ width: 164, height: 84, boxSizing: 'border-box', borderWidth: 2, padding: 10, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}><Probe key="A" name="A" style={flow} /><Probe key="B" name="B" style={middle} /><Probe key="C" name="C" style={flow} /></Flex></FocusManagement>; }
  const canvas = document.createElement('canvas'); canvas.width = 164; canvas.height = 84; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
  canvas.focus({ preventScroll: true }); for (let tab = 0; tab < 2; tab++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'B', 'C']); click(canvas, 40, 25); click(canvas, 100, 15); expect(hits).toEqual(['B', 'A']);
  const initial = snapshotWasmLayoutDiagnostics();
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); position.set(undefined); await nextFrame();
    const ordinary = [...boxes.values()].map(box => ({ ...box }));
    position.set('static'); await nextFrame();
    expect([...boxes.values()]).toEqual(ordinary);
    const staticA = boxes.get('A')!, staticB = boxes.get('B')!, staticC = boxes.get('C')!;
    position.set('relative'); await nextFrame();
    expect(boxes.get('A')).toEqual(staticA); expect(boxes.get('C')).toEqual(staticC);
    expect(boxes.get('B')).toEqual({ ...staticB, x: staticB.x + (rtl === 'ltr' ? 12 : -18), y: staticB.y + 8 });
  }
  const beforePaint = snapshotWasmLayoutDiagnostics(); ink.set('#6e9d35'); await nextFrame(); const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves); expect(painted.nodeCreates).toBe(initial.nodeCreates); expect([...boxes.values()].map(value => value.stamp)).toEqual([1, 2, 3]);
  controller.dispose();
  const afterDispose = snapshotWasmLayoutDiagnostics(); expect(afterDispose.activeNodes).toBe(baseline.activeNodes); expect(afterDispose.activeArenas).toBe(baseline.activeArenas); expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
