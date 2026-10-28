import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex,
  Rectangle,
  definePrimitive,
  fitContent,
  signal,
  useCanvasContext,
  useLayoutBox,
  useConst,
  type BoxStyle,
  type FlexItemStyle,
  type PibblController,
  type RectStyle,
  type Signal,
  type SystemStyle,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

type PairStyle = SystemStyle & BoxStyle & FlexItemStyle;
const typeFixture = { width: 'min-content', height: 20, flexBasis: fitContent('50%') } satisfies RectStyle;
// @ts-expect-error Intrinsic sizing values do not widen edge/padding syntax.
const invalidPadding: BoxStyle = { padding: fitContent(20) };
void typeFixture; void invalidPadding;
type PairProps = { readonly minimum: Signal<number>; readonly maximum: Signal<number>; readonly id: string; readonly onHit: () => void };

it.runIf(experimentalLayout)('uses direct paired min/max contributions for min-content and bounded fit-content bases', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  let serial = 0; const stamps = new Map<string, number>();
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const Leaf = definePrimitive<PairProps, PairStyle, PairStyle, SystemStyle & { width: number; height: number }>((props) => {
    stamps.set(props.id, useConst(() => ++serial));
    const box = useLayoutBox();
    const matrix = useCanvasContext().getTransform();
    boxes.set(props.id, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
    return <Rectangle onClick={props.onHit} style={{ width: box.width, height: box.height, fill: props.id === 'min' ? '#a63758' : '#426b61' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    preserveSignalProps: ['minimum', 'maximum'],
    measureIntrinsic: ({ props }) => ({
      status: 'measured' as const,
      minContent: { width: props.minimum.get(), height: 20 },
      maxContent: { width: props.maximum.get(), height: 20 },
    }),
    measure: ({ constraints }) => ({ status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } }),
  });
  const minimum = signal(40), maximum = signal(120), hits: string[] = [];
  const canvas = document.createElement('canvas'); canvas.width = 260; canvas.height = 40; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 240, height: 20, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start' }}>
    <Leaf key="min" id="min" minimum={minimum} maximum={maximum} onHit={() => hits.push('min')} style={{ width: 'min-content', height: 20, flexGrow: 0, flexShrink: 0 }} />
    <Leaf key="fit" id="fit" minimum={minimum} maximum={maximum} onHit={() => hits.push('fit')} style={{ flexBasis: fitContent(80), height: 20, flexGrow: 0, flexShrink: 0 }} />
    <Rectangle key="tail" onClick={() => hits.push('tail')} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#39805d' }} />
  </Flex>);
  controllers.push(controller); await frame();
  expect(boxes.get('min')).toEqual({ x: 0, y: 0, width: 40, height: 20 });
  expect(boxes.get('fit')).toEqual({ x: 40, y: 0, width: 80, height: 20 });
  expect([...canvas.getContext('2d')!.getImageData(120, 4, 1, 1).data]).toEqual([57, 128, 93, 255]);
  click(canvas, 44, 4); await frame(); expect(hits).toEqual(['fit']);
  const initialStamps = Object.fromEntries(stamps);
  minimum.set(60); maximum.set(140); await frame();
  expect(boxes.get('min')).toEqual({ x: 0, y: 0, width: 60, height: 20 });
  expect(boxes.get('fit')).toEqual({ x: 60, y: 0, width: 80, height: 20 });
  expect([...canvas.getContext('2d')!.getImageData(140, 4, 1, 1).data]).toEqual([57, 128, 93, 255]);
  click(canvas, 44, 4); await frame(); expect(hits).toEqual(['fit', 'min']);
  click(canvas, 64, 4); await frame(); expect(hits).toEqual(['fit', 'min', 'fit']);
  expect(Object.fromEntries(stamps)).toEqual(initialStamps);
  controller.dispose();
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
});

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const rect = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true, button: 0, clientX: rect.left + x, clientY: rect.top + y,
  }));
}


it.runIf(experimentalLayout)('allocates intrinsic bases through numeric grow, shrink and bounds in all horizontal directions', async () => {
  const variants = [
    ['row', 'ltr', false], ['row-reverse', 'ltr', true],
    ['row', 'rtl', true], ['row-reverse', 'rtl', false],
  ] as const;
  for (const [flexDirection, layoutDirection, reverse] of variants) {
    for (const growing of [false, true]) {
      const boxes = new Map<string, { x: number; width: number }>();
      const Leaf = definePrimitive<{ id: string }, PairStyle, PairStyle, SystemStyle & { width: number; height: number }>((props) => {
        const box = useLayoutBox(), matrix = useCanvasContext().getTransform();
        boxes.set(props.id, { x: matrix.e, width: box.width });
        return <Rectangle style={{ width: box.width, height: box.height, fill: '#39805d' }} />;
      }, {
        resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
        measureIntrinsic: () => ({ status: 'measured', minContent: { width: 40, height: 20 }, maxContent: { width: 120, height: 20 } }),
        measure: ({ constraints }) => ({ status: 'measured', size: { width: constraints.maxWidth, height: 20 } }),
      });
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 40; document.body.append(canvas);
      const controller = pibbl(canvas, <Flex style={{ width: 240, height: 20, flexDirection, layoutDirection, alignItems: 'flex-start' }}>
        <Leaf id="A" style={{ width: 'max-content', height: 20, minWidth: 0, maxWidth: growing ? 140 : undefined, flexGrow: growing ? 1 : 0, flexShrink: 1 }} />
        <Leaf id="B" style={{ width: 'min-content', flexBasis: fitContent(growing ? 80 : '50%'), height: 20, minWidth: 0, maxWidth: growing ? 90 : undefined, flexGrow: growing ? 1 : 0, flexShrink: 1 }} />
        <Rectangle style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
      </Flex>);
      controllers.push(controller); await frame();
      const a = growing ? 130 : 110, b = growing ? 90 : 110;
      expect(boxes.get('A')).toEqual({ x: reverse ? 240 - a : 0, width: a });
      expect(boxes.get('B')).toEqual({ x: reverse ? 240 - a - b : a, width: b });
      controller.dispose(); canvas.remove();
    }
  }
});

it('creates immutable validated fit-content values without widening scalar styles', () => {
  expect(Object.isFrozen(fitContent(80))).toBe(true);
  expect(fitContent('50%').limit).toBe('50%');
  expect(() => fitContent(-1)).toThrow();
  expect(() => fitContent(Infinity)).toThrow();
  expect(() => fitContent('-10%')).toThrow();
});


it('rejects intrinsic sizing without a supported owner before primitive paint', async () => {
  const errors: unknown[] = [];
  const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', receive);
  try {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
    const controller = pibbl(canvas, <Rectangle style={{ width: 'min-content', height: 20, fill: '#39805d' }} />);
    controllers.push(controller); await frame();
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toMatch(/width.*intrinsic-sizing owner/);
    expect([...canvas.getContext('2d')!.getImageData(4, 4, 1, 1).data]).toEqual([0, 0, 0, 0]);
  } finally { window.removeEventListener('error', receive); }
});
