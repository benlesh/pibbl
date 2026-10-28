import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  Flex,
  Rectangle,
  Text,
  definePrimitive,
  fitContent,
  signal,
  useCanvasContext,
  useConst,
  useLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
  type PibblController,
  type SystemStyle,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

type PairStyle = SystemStyle & BoxStyle & FlexItemStyle;
type PairProps = { readonly minimum: number; readonly maximum: number };

it.runIf(experimentalLayout)('preserves intrinsic contributions through border-box canonicalization while scalar outer bounds convert once', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const limit = signal(80), hits: string[] = [], queries: number[] = [];
  let stamp = 0;
  let pair = { x: 0, y: 0, width: 0, height: 0, stamp: 0 };
  const Pair = definePrimitive<PairProps, PairStyle, PairStyle, SystemStyle & { width: number; height: number }>((_props) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform();
    pair = { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp: useConst(() => ++stamp) };
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#426b61' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: ({ props }) => ({ status: 'measured' as const, minContent: { width: props.minimum, height: 20 }, maxContent: { width: props.maximum, height: 20 } }),
    measure: ({ constraints }) => { queries.push(constraints.maxWidth); return { status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } }; },
  });
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 60; document.body.append(canvas);
  const context = canvas.getContext('2d')!; context.font = '10px monospace';
  const draws: number[] = []; const fillText = context.fillText;
  vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maxWidth) {
    draws.push(this.getTransform().e + x); fillText.call(this, text, x, y, maxWidth);
  });
  function Scene() {
    return <Flex style={{ width: 220, height: 60, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Text style={{ boxSizing: 'border-box', width: 'min-content', height: 'auto', wrap: true, font: '10px monospace', lineHeight: 10, padding: { left: 5, right: 7, top: 4, bottom: 6 }, borderWidth: 2, fill: '#a63758' }}>alpha beta</Text>
      <Pair minimum={40} maximum={120} style={{ boxSizing: 'border-box', flexBasis: fitContent(limit.get()), height: 'auto', maxWidth: 90, padding: { left: 5, right: 7, top: 4, bottom: 6 }, borderWidth: 2, flexGrow: 0, flexShrink: 0 }} />
      <Rectangle onClick={() => hits.push('tail')} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#39805d' }} />
    </Flex>;
  }
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  const textOuter = context.measureText('alpha').width + 16;
  expect(pair).toEqual({ x: textOuter, y: 0, width: 90, height: 34, stamp: 1 });
  expect(draws[0]).toBe(7);
  expect(queries).toContain(74);
  click(canvas, textOuter + 105, 4); await frame(); expect(hits).toEqual(['tail']);
  const originalStamp = pair.stamp;
  limit.set(60); await frame();
  expect(pair).toEqual({ x: textOuter, y: 0, width: 76, height: 34, stamp: originalStamp });
  expect(queries).toContain(60);
  click(canvas, textOuter + 105, 4); await frame(); expect(hits).toEqual(['tail']);
  click(canvas, textOuter + 80, 4); await frame(); expect(hits).toEqual(['tail', 'tail']);
  limit.set(20); await frame();
  expect(pair).toEqual({ x: textOuter, y: 0, width: 56, height: 34, stamp: originalStamp });
  expect(queries).toContain(40);
  click(canvas, textOuter + 80, 4); await frame(); expect(hits).toEqual(['tail', 'tail']);
  click(canvas, textOuter + 60, 4); await frame(); expect(hits).toEqual(['tail', 'tail', 'tail']);
  controller.dispose();
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
});

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}
