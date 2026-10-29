import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, FocusManagement, Rectangle, signal, type FlexItemStyle, type PibblResponsiveStyle, type RectStyle, useCanvasContext, useConst, useLayoutBox } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void { const bounds = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 })); }

it.runIf(nativeLayout)('resolves physical percentage absolute insets from the direct Flex padding box before sizing and placement', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type Mode = 'left-top' | 'right-bottom' | 'paired-bounds' | 'aspect' | 'overflow';
  type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<Direction>('row'), wrap = signal<'wrap' | 'wrap-reverse'>('wrap'), writing = signal<'ltr' | 'rtl'>('ltr'), ownerWidth = signal(204), ownerHeight = signal(104), mode = signal<Mode>('left-top'), ink = signal('#a63758');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [], focused: string[] = []; let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'ABS' | 'C'; readonly style: Style }) { const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++); boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp }); return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: name === 'ABS' ? ink : '#19375b', cursor: 'pointer' }} />; }
  const flow: Style = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const next = mode.get();
    const absolute: Style = next === 'left-top' ? { position: 'absolute', width: 50, height: 20, left: '10%', top: '20%', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : next === 'right-bottom' ? { position: 'absolute', width: 50, height: 20, right: '10%', bottom: '20%', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : next === 'paired-bounds' ? { position: 'absolute', width: 'auto', height: 'auto', left: '10%', right: '15%', top: '10%', bottom: '20%', minWidth: 180, minHeight: 90, flexGrow: 0, flexShrink: 0 }
      : next === 'aspect' ? { position: 'absolute', width: 80, height: 'auto', aspectRatio: 2, left: '10%', top: '20%', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : { position: 'absolute', width: 50, height: 20, left: '-10%', top: '120%', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <FocusManagement><Flex style={{ width: ownerWidth.get(), height: ownerHeight.get(), boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}><Probe key="A" name="A" style={flow} /><Probe key="ABS" name="ABS" style={absolute} /><Probe key="C" name="C" style={flow} /></Flex></FocusManagement>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 244; canvas.height = 144; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
  canvas.focus({ preventScroll: true }); for (let index = 0; index < 2; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })); expect(focused).toEqual(['A', 'ABS', 'C']); click(canvas, 30, 30); click(canvas, 80, 30); expect(hits).toEqual(['ABS', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();
  const expectAbs = (x: number, y: number, width: number, height: number) => expect(boxes.get('ABS')).toEqual({ x, y, width, height, stamp: 2 });
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); mode.set('left-top'); await nextFrame(); expectAbs(22, 22, 50, 20);
    mode.set('right-bottom'); await nextFrame(); expectAbs(132, 62, 50, 20);
  }
  direction.set('column-reverse'); wrap.set('wrap-reverse'); writing.set('rtl'); mode.set('paired-bounds'); await nextFrame(); expectAbs(-8, 12, 180, 90);
  ownerWidth.set(244); ownerHeight.set(144); await nextFrame(); expectAbs(26, 16, 180, 98);
  ownerWidth.set(204); ownerHeight.set(104); mode.set('aspect'); await nextFrame(); expectAbs(22, 22, 80, 40);
  mode.set('overflow'); await nextFrame(); expectAbs(-18, 122, 50, 20);
  expect([...boxes.values()].map(box => box.stamp)).toEqual([1, 2, 3]);
  const beforePaint = snapshotWasmLayoutDiagnostics(); ink.set('#6e9d35'); await nextFrame(); const painted = snapshotWasmLayoutDiagnostics(); expect(painted.solves).toBe(beforePaint.solves); expect(painted.nodeCreates).toBe(initial.nodeCreates);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
