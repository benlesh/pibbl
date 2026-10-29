import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, definePrimitive, fitContent, signal, useCanvasContext, useConst, useLayoutBox, type BoxStyle, type FlexItemStyle, type PibblController, type Signal, type SystemStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
type PairStyle = SystemStyle & BoxStyle & FlexItemStyle;

it.runIf(nativeLayout)('resolves direct paired intrinsic min/max width bounds before native main-axis clamping', async () => {
  const before = snapshotWasmLayoutDiagnostics();
  const minimum = signal(40), maximum = signal(120), hits: string[] = [], queries: number[] = [];
  let serial = 0, intrinsicCalls = 0;
  const boxes = new Map<string, { x: number; width: number; stamp: number }>();
  const Pair = definePrimitive<{ readonly id: 'A'; readonly minimum: Signal<number>; readonly maximum: Signal<number> }, PairStyle, PairStyle, SystemStyle & { width: number; height: number }>((props) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    boxes.set(props.id, { x: matrix.e, width: box.width, stamp });
    return <Rectangle onClick={() => hits.push(props.id)} style={{ width: box.width, height: box.height, fill: '#426b61', cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['minimum', 'maximum'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: ({ props }) => { intrinsicCalls++; return { status: 'measured' as const, minContent: { width: props.minimum.get(), height: 20 }, maxContent: { width: props.maximum.get(), height: 20 } }; },
    measure: ({ constraints }) => { queries.push(constraints.maxWidth); return { status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } }; },
  });
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 30; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 180, height: 20, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
    <Pair key="A" id="A" minimum={minimum} maximum={maximum} style={{ width: 100, minWidth: 'min-content', maxWidth: fitContent(80), height: 'auto', flexGrow: 0, flexShrink: 0 }} />
    <Rectangle key="tail" onClick={() => hits.push('tail')} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#39805d' }} />
  </Flex>); controllers.push(controller); await frame();
  expect(boxes.get('A')).toEqual({ x: 0, width: 80, stamp: 1 }); expect(queries).toContain(80);
  click(canvas, 84); expect(hits).toEqual(['tail']); click(canvas, 44); expect(hits).toEqual(['tail', 'A']);
  const stamp = boxes.get('A')!.stamp, calls = queries.length, contributions = intrinsicCalls;
  minimum.set(60); maximum.set(140); await frame();
  expect(boxes.get('A')).toEqual({ x: 0, width: 80, stamp }); expect(intrinsicCalls).toBeGreaterThan(contributions); expect(queries).toHaveLength(calls); expect(queries).toContain(80);
  controller.dispose(); const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances]);
});

it.runIf(nativeLayout)('rejects an intrinsic resolved min/max inversion before primitive paint', async () => {
  const errors: unknown[] = [], onError = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', onError);
  try {
    const Leaf = definePrimitive<{}, PairStyle, PairStyle, SystemStyle & { width: number; height: number }>((_props, _style) => <Rectangle style={{ width: 1, height: 1, fill: '#a63758' }} />, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 40, height: 20 }, maxContent: { width: 120, height: 20 } }),
      measure: ({ constraints }) => ({ status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } }),
    });
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 30; document.body.append(canvas);
    controllers.push(pibbl(canvas, <Flex style={{ width: 160, height: 20 }}><Leaf style={{ width: 80, minWidth: 'max-content', maxWidth: 'min-content', height: 'auto', flexGrow: 0, flexShrink: 0 }} /></Flex>)); await frame();
    expect(errors).toHaveLength(1); expect(String(errors[0])).toMatch(/minimum must not exceed maximum/);
    expect([...canvas.getContext('2d')!.getImageData(4, 4, 1, 1).data]).toEqual([0, 0, 0, 0]);
  } finally { window.removeEventListener('error', onError); }
});
function click(canvas: HTMLCanvasElement, x: number): void { const bounds = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + 4 })); }
