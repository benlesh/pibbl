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

it.runIf(nativeLayout)('keeps physically anchored direct absolute children out of every finite wrapped Flex line', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(164);
  const direction = signal<Direction>('row-reverse');
  const wrap = signal<'wrap' | 'wrap-reverse'>('wrap');
  const writing = signal<'ltr' | 'rtl'>('ltr');
  const trailing = signal(false);
  const ink = signal('#a63758');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  const focused: string[] = [];
  let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'ABS' | 'C'; readonly style: ProbeStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: name === 'ABS' ? ink : name === 'A' ? '#19375b' : '#426b61', cursor: 'pointer' }} />;
  }
  const flow: ProbeStyle = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const absolute: ProbeStyle = trailing.get() ? { position: 'absolute', width: 50, height: 30, right: 18, bottom: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 } : { position: 'absolute', width: 50, height: 30, left: 12, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <FocusManagement><Flex style={{ width: width.get(), height: 104, boxSizing: 'border-box', borderWidth: 2, padding: 10, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}>
      <Probe key="A" name="A" style={flow} /><Probe key="ABS" name="ABS" style={absolute} /><Probe key="C" name="C" style={flow} />
    </Flex></FocusManagement>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 164; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
  const slots = {
    row: {
      wrap: { ltr: [[12, 12], [82, 12]], rtl: [[92, 12], [22, 12]] },
      'wrap-reverse': { ltr: [[12, 72], [82, 72]], rtl: [[92, 72], [22, 72]] },
    },
    'row-reverse': {
      wrap: { ltr: [[92, 12], [22, 12]], rtl: [[12, 12], [82, 12]] },
      'wrap-reverse': { ltr: [[92, 72], [22, 72]], rtl: [[12, 72], [82, 72]] },
    },
    column: {
      wrap: { ltr: [[12, 12], [12, 42]], rtl: [[92, 12], [92, 42]] },
      'wrap-reverse': { ltr: [[92, 12], [92, 42]], rtl: [[12, 12], [12, 42]] },
    },
    'column-reverse': {
      wrap: { ltr: [[12, 72], [12, 42]], rtl: [[92, 72], [92, 42]] },
      'wrap-reverse': { ltr: [[92, 72], [92, 42]], rtl: [[12, 72], [12, 42]] },
    },
  } as const;
  const expectBox = (name: 'A' | 'ABS' | 'C', x: number, y: number, width: number, height: number, stamp: number) => expect(boxes.get(name)).toEqual({ x, y, width, height, stamp });
  canvas.focus({ preventScroll: true });
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'ABS', 'C']);
  click(canvas, 20, 15); click(canvas, 70, 15);
  expect(hits).toEqual(['ABS', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) for (const useTrailing of [false, true]) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); trailing.set(useTrailing); await nextFrame();
    const [a, c] = slots[axis][wrapped][rtl];
    expectBox('A', a[0], a[1], 60, 20, 1);
    expectBox('C', c[0], c[1], 60, 20, 3);
    expectBox('ABS', useTrailing ? 94 : 14, useTrailing ? 62 : 10, 50, 30, 2);
  }
  click(canvas, 110, 75);
  expect(hits.at(-1)).toBe('ABS');
  width.set(124); direction.set('row'); wrap.set('wrap'); writing.set('ltr'); trailing.set(false); await nextFrame();
  expectBox('A', 12, 12, 60, 20, 1);
  expectBox('ABS', 14, 10, 50, 30, 2);
  expectBox('C', 12, 42, 60, 20, 3);
  const resized = snapshotWasmLayoutDiagnostics();
  expect(resized.nodeCreates).toBe(initial.nodeCreates);
  ink.set('#6e9d35'); await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(resized.solves);
  expect(painted.nodeCreates).toBe(resized.nodeCreates);
  expect([...boxes.values()].map(value => value.stamp)).toEqual([1, 2, 3]);
  controller.dispose();
  const afterDispose = snapshotWasmLayoutDiagnostics();
  expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
  expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
  expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
