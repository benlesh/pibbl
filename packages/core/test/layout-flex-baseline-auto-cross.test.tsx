import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex,
  Rectangle,
  definePrimitive,
  signal,
  type BaselineMeasureInput,
  type BaselinesResult,
  type LayoutBox,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

interface CrossStyle extends SystemStyle {
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly flexBasis?: number;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly marginTop?: number | 'auto' | ReturnType<typeof signal<0 | 'auto'>>;
  readonly marginBottom?: number | 'auto';
  readonly fill?: string;
}
interface CrossProps { readonly name: string; readonly first: number; readonly skipBaseline?: boolean; }
type ResolvedCrossStyle = CrossStyle & { readonly width: number; readonly height: number };

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

it.runIf(experimentalLayout)('places first-baseline automatic cross margins after excluding their baseline providers', async () => {
  const cases = [
    { name: 'before', style: { marginTop: 'auto' as const }, y: 60 },
    { name: 'after', style: { marginBottom: 'auto' as const }, y: 0 },
    { name: 'both', style: { marginTop: 'auto' as const, marginBottom: 'auto' as const }, y: 30 },
  ];
  for (const sample of cases) {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, LayoutBox>();
    const paints: string[] = [];
    const Leaf = definePrimitive<CrossProps, CrossStyle, CrossStyle, ResolvedCrossStyle>((props, style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform();
      boxes.set(props.name, { x: transform.e, y: transform.f, width: box.width, height: box.height });
      paints.push(props.name);
      return <Rectangle onClick={() => paints.push(`hit:${props.name}`)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ fill: style.fill, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }: BaselineMeasureInput<CrossProps, CrossStyle>): BaselinesResult => {
        if (props.skipBaseline) throw new Error('cross-auto leaf must not query a baseline');
        return { status: 'measured', first: props.first, last: props.first };
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 160, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Leaf key="A" name="A" first={100} skipBaseline style={{ width: 40, height: 20, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: '#8a3248', ...sample.style }} />
      <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: '#426b61' }} />
    </Flex>); controllers.push(controller); await frame();
    expect(boxes.get('A'), sample.name).toEqual({ x: 0, y: sample.y, width: 40, height: 20 });
    expect(boxes.get('B'), sample.name).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    expect(paints, sample.name).toEqual(['A', 'B']);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], sample.name).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  }
});

it.runIf(experimentalLayout)('moves a numeric first-baseline leaf to top-auto without changing identity, and clamps overflow to zero', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), margin = signal<0 | 'auto'>(0), ownerHeight = signal(80), baselineInput = signal(12);
  const boxes = new Map<string, LayoutBox>(), stamps = new Map<string, number>(), hits: string[] = [];
  const baselineCalls = { A: 0, B: 0 }; let serial = 0;
  const Leaf = definePrimitive<CrossProps, CrossStyle, CrossStyle, ResolvedCrossStyle>((props, style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    boxes.set(props.name, { x: transform.e, y: transform.f, width: box.width, height: box.height }); stamps.set(props.name, stamp);
    return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
  }, {
    resolveStyle: (style, context) => ({ fill: style.fill, width: context.allocation.width, height: context.allocation.height }),
    measureBaselines: ({ props }) => { baselineCalls[props.name as 'A' | 'B']++; return { status: 'measured' as const, first: props.name === 'A' ? baselineInput.get() : props.first, last: props.name === 'A' ? baselineInput.get() : props.first }; },
  });
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80; document.body.append(canvas);
  const Root = () => <Flex style={{ width: 160, height: ownerHeight, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
    <Leaf key="A" name="A" first={12} style={{ width: 40, height: 20, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, marginTop: margin, fill: '#8a3248' }} />
    <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: '#426b61' }} />
  </Flex>;
  const controller = pibbl(canvas, <Root />); controllers.push(controller); await frame();
  expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20 });
  expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
  const initialStamps = new Map(stamps), initial = snapshotWasmLayoutDiagnostics(), zeroCalls = baselineCalls.A;
  expect(zeroCalls).toBeGreaterThan(0);
  margin.set('auto'); await frame();
  expect(boxes.get('A')).toEqual({ x: 0, y: 60, width: 40, height: 20 });
  expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
  expect(stamps).toEqual(initialStamps); expect(baselineCalls.A).toBe(zeroCalls); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  click(canvas, 4, 64); expect(hits).toEqual(['A']);
  await frame(); const detached = snapshotWasmLayoutDiagnostics();
  baselineInput.set(100); await frame();
  expect(baselineCalls.A).toBe(zeroCalls);
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(detached.solves);
  ownerHeight.set(10); await frame();
  expect(boxes.get('A')).toEqual({ x: 0, y: 0, width: 40, height: 20 });
  expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
});
