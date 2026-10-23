import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, FocusManagement, Rectangle, signal,
  type FlexItemStyle, type PibblResponsiveStyle, type RectStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

it.runIf(experimentalLayout)('keeps a direct wrapped absolute child out of Flex lines while retaining source order, identity, and cleanup', async () => {
  type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const ownerWidth = signal(164);
  const ink = signal('#9d3654');
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
  const hits: string[] = [];
  const focused: string[] = [];
  let stamp = 1;
  function Probe({ name, style: _style }: { readonly name: string; readonly style: Style }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    const ownStamp = useConst(() => stamp++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp: ownStamp });
    return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: name === 'ABS' ? ink : '#246b61', cursor: 'pointer' }} />;
  }
  function Scene() {
    const flow: Style = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const absolute: Style = { position: 'absolute', width: 50, height: 30, left: 12, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <FocusManagement><Flex style={{ width: ownerWidth.get(), height: 104, boxSizing: 'border-box', borderWidth: 2, padding: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}>
      <Probe key="A" name="A" style={flow} />
      <Probe key="ABS" name="ABS" style={absolute} />
      <Probe key="B" name="B" style={flow} />
      <Probe key="C" name="C" style={flow} />
    </Flex></FocusManagement>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 164; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
  expect(Object.fromEntries(boxes)).toEqual({
    A: { x: 12, y: 12, width: 60, height: 20, stamp: 1 },
    ABS: { x: 14, y: 10, width: 50, height: 30, stamp: 2 },
    B: { x: 82, y: 12, width: 60, height: 20, stamp: 3 },
    C: { x: 12, y: 42, width: 60, height: 20, stamp: 4 },
  });
  canvas.focus({ preventScroll: true });
  for (let index = 0; index < 3; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['A', 'ABS', 'B', 'C']);
  click(canvas, 20, 20); click(canvas, 90, 20); click(canvas, 20, 50);
  expect(hits).toEqual(['ABS', 'B', 'C']);
  const initial = snapshotWasmLayoutDiagnostics();
  ownerWidth.set(124); await nextFrame();
  expect(Object.fromEntries(boxes)).toEqual({
    A: { x: 12, y: 12, width: 60, height: 20, stamp: 1 },
    ABS: { x: 14, y: 10, width: 50, height: 30, stamp: 2 },
    B: { x: 12, y: 42, width: 60, height: 20, stamp: 3 },
    C: { x: 12, y: 72, width: 60, height: 20, stamp: 4 },
  });
  click(canvas, 20, 20); click(canvas, 20, 50); click(canvas, 20, 80);
  expect(hits).toEqual(['ABS', 'B', 'C', 'ABS', 'B', 'C']);
  const afterResize = snapshotWasmLayoutDiagnostics();
  expect(afterResize.activeNodes).toBe(initial.activeNodes);
  ink.set('#6e9d35'); await nextFrame();
  const afterPaint = snapshotWasmLayoutDiagnostics();
  expect(afterPaint.nodeCreates).toBe(afterResize.nodeCreates);
  expect(afterPaint.solves).toBe(afterResize.solves);
  controller.dispose();
  const afterDispose = snapshotWasmLayoutDiagnostics();
  expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
  expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
  expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
