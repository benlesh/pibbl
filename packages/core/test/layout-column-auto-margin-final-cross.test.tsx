import { afterEach, expect, it, vi } from 'vitest';
import {
  defineLayoutComponent, definePrimitive, Flex, Rectangle, Text, signal,
  type FlexStyle, type PibblController, type PibblResponsiveStyle, type SystemStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}

for (const [label, flexBasis, flexGrow, finalHeight] of [['basis', 40, 0, 40], ['grow', 40, 1, 100]] as const) it.runIf(experimentalLayout)(`uses the final ${label} column main target for a paired cross query before side-auto placement`, async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const margin = signal<0 | 'auto'>(0);
  const fills = signal('#8a3248');
  const queries: number[][] = [], hits: string[] = [];
  let serial = 0;
  let leaf: Readonly<{ x: number; y: number; width: number; height: number; stamp: number }> | undefined;
  let footer: Readonly<{ y: number; stamp: number }> | undefined;
  type Resolved = SystemStyle & { readonly width: number; readonly height: number; readonly fill?: string };
  const Leaf = definePrimitive<{ readonly fill: typeof fills }, FlexStyle, FlexStyle, Resolved>((props, style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    leaf = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
    return <Rectangle onClick={() => hits.push('leaf')} style={{ width: style.width, height: style.height, fill: props.fill, cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['fill'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 40, height: 40 }, maxContent: { width: 40, height: 40 } }),
    measure: ({ constraints }) => {
      queries.push([constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]);
      return { status: 'measured' as const, size: { width: constraints.maxHeight / 2, height: 40 } };
    },
  });
  const Footer = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>((_props, style) => {
    const transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    footer = { y: transform.f, stamp };
    return <Rectangle style={{ width: style.width, height: style.height, fill: '#426b61' }} />;
  }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
  const controller = pibblSync(canvas, <Flex style={{ width: 200, height: 120, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
    <Leaf key="leaf" fill={fills} style={{ width: 'auto', height: 40, minWidth: 0, minHeight: 0, flexBasis, flexGrow, flexShrink: 0, marginLeft: margin }} />
    <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
  </Flex>);
  controllers.push(controller); await frame();
  const zero = leaf!, zeroFooter = footer!;
  expect(zero.y).toBe(0); expect(zero.height).toBe(finalHeight); expect(zeroFooter.y).toBe(finalHeight);

  queries.length = 0;
  margin.set('auto'); await frame();
  expect(queries).toContainEqual([0, Number.POSITIVE_INFINITY, finalHeight, finalHeight]);
  expect(leaf).toMatchObject({ x: 200 - finalHeight / 2, y: 0, width: finalHeight / 2, height: finalHeight, stamp: zero.stamp });
  expect(footer).toMatchObject({ y: finalHeight, stamp: zeroFooter.stamp });
  click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
  click(canvas, 200 - finalHeight / 2 + 4, 4); await frame(); expect(hits).toEqual(['leaf']);
  const mounted = snapshotWasmLayoutDiagnostics();
  fills.set('#19375b'); await frame();
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  expect(leaf!.stamp).toBe(zero.stamp);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});

for (const [label, flexBasis, flexGrow, expectedY] of [['basis', 40, 0, 40], ['grow', 'auto', 1, 100]] as const) {
  it.runIf(experimentalLayout)(`measures a ${label} known Flex root at its final column height before side-auto placement`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal<0 | 'auto'>(0), width = signal(40);
    const hits: string[] = [];
    let leaf: Readonly<{ x: number; y: number; width: number; height: number; stamp: number }> | undefined;
    let footer: Readonly<{ y: number; stamp: number }> | undefined;
    let serial = 0;
    let footerSerial = 0;
    const Footer = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((_props, style) => {
      const stamp = useConst(() => ++footerSerial);
      footer = { y: useCanvasContext().getTransform().f, stamp };
      return <Rectangle style={{ width: style.width, height: style.height, fill: '#426b61' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const KnownLeaf = definePrimitive<{ readonly width: typeof width }, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      leaf = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
      return <Rectangle onClick={() => hits.push('known')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, { preserveSignalProps: ['width'], resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const Card = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) => <Flex style={props.style}>
      <KnownLeaf key="known-leaf" width={width} style={{ width, height: 40, minWidth: 0, minHeight: 0, flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }} />
      <Rectangle key="tail" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: '#6e3e79' }} />
    </Flex>);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
    const controller = pibblSync(canvas, <Flex style={{ width: 200, height: 120, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Card key="card" style={{ width: 'auto', height: 'auto', minWidth: 0, minHeight: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexBasis, flexGrow, flexShrink: 0, marginLeft: margin }} />
      <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = leaf!, zeroFooter = footer!;
    expect(zero).toMatchObject({ x: 0, y: 0, width: 40, height: 40 });
    expect(zeroFooter.y).toBe(expectedY);
    margin.set('auto'); await frame();
    expect(leaf).toMatchObject({ x: 140, y: 0, width: 40, height: 40, stamp: zero.stamp });
    expect(footer).toMatchObject({ y: expectedY, stamp: zeroFooter.stamp });
    click(canvas, 4, 4); click(canvas, 144, 4); await frame(); expect(hits).toEqual(['known']);
    width.set(80); await frame();
    expect(leaf).toMatchObject({ x: 100, y: 0, width: 80, height: 40, stamp: zero.stamp });
    expect(footer).toMatchObject({ y: expectedY, stamp: zeroFooter.stamp });
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

const textProfiles = [
  ['grow', { flexBasis: 40, flexGrow: 1, flexShrink: 0 }, 100],
  ['shrink', { flexBasis: 80, flexGrow: 0, flexShrink: 1 }, 60],
  ['min-zero', { flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0 }, 40],
  ['min-twenty', { flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 20 }, 40],
  ['min-one-twenty', { flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 120 }, 40],
  ['max-sixty', { flexBasis: 40, flexGrow: 0, flexShrink: 0, maxWidth: 60 }, 40],
] as const;
for (const [label, main, expectedFooterY] of textProfiles) {
  it.runIf(experimentalLayout)(`keeps column Text ${label} main allocation while auto cross margins use its final measured width`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal<0 | 'auto'>(0), hits: string[] = [];
    const words = signal('alpha beta gamma');
    let footerY = Number.NaN;
    const Footer = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((_props, style) => {
      footerY = useCanvasContext().getTransform().f;
      return <Rectangle style={{ width: style.width, height: style.height, fill: '#426b61' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
    const context = canvas.getContext('2d')!, draws: Array<{ x: number; y: number }> = [], native = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, value, x, y, maximum) { if (value.startsWith('alpha')) { const t = this.getTransform(); draws.push({ x: t.e + x, y: t.f + y }); } return maximum === undefined ? native.call(this, value, x, y) : native.call(this, value, x, y, maximum); });
    const controller = pibblSync(canvas, <Flex style={{ width: 200, height: label === 'shrink' ? 80 : 120, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Text key="text" onClick={() => hits.push('text')} style={{ width: 'auto', height: 40, minHeight: 0, marginLeft: margin, wrap: false, font: '10px monospace', fill: '#19375b', ...main }}>{words}</Text>
      <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = draws.at(-1)!; expect(zero.x).toBe(0); expect(footerY).toBe(expectedFooterY);
    margin.set('auto'); await frame();
    const automatic = draws.at(-1)!;
    context.save(); context.font = '10px monospace'; const metrics = context.measureText(words.get()); context.restore();
    const natural = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const expectedWidth = label === 'max-sixty' ? Math.min(60, natural) : label === 'min-twenty' ? Math.max(20, natural) : label === 'min-one-twenty' ? Math.max(120, natural) : natural;
    expect(automatic.x).toBeCloseTo(200 - expectedWidth, 5);
    expect(automatic.y).toBe(zero.y); expect(footerY).toBe(expectedFooterY);
    click(canvas, 4, 4); click(canvas, automatic.x + 4, 4); await frame(); expect(hits).toEqual(['text']);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}


it.runIf(experimentalLayout)('fails an unsupported exact final column cross query before painting, releases ownership, and permits a remount', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const available = signal(false);
  let paints = 0;
  type Resolved = SystemStyle & { readonly width: number; readonly height: number };
  const Leaf = definePrimitive<{ readonly available: typeof available }, FlexStyle, FlexStyle, Resolved>((_props, style) => {
    paints++;
    return <Rectangle style={{ width: style.width, height: style.height, fill: '#8a3248' }} />;
  }, {
    preserveSignalProps: ['available'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 40, height: 40 }, maxContent: { width: 40, height: 40 } }),
    measure: ({ props, constraints }) => constraints.minHeight === 100 && constraints.maxHeight === 100 && !props.available.get()
      ? { status: 'unsupported' as const, reason: 'final column cross query is unavailable' }
      : { status: 'measured' as const, size: { width: constraints.maxHeight / 2, height: 40 } },
  });
  const root = <Flex style={{ width: 200, height: 120, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' }}>
    <Leaf key="leaf" available={available} style={{ width: 'auto', height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 1, flexShrink: 0, marginLeft: 'auto' }} />
    <Rectangle key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
  </Flex>;
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
  const errors: unknown[] = [];
  const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', receive);
  try {
    const failed = pibblSync(canvas, root); controllers.push(failed); await frame();
    expect(errors).toHaveLength(1); expect(String(errors[0])).toMatch(/final column cross query is unavailable/i); expect(paints).toBe(0);
    failed.dispose();
    expect([snapshotWasmLayoutDiagnostics().activeNodes, snapshotWasmLayoutDiagnostics().activeArenas, snapshotWasmLayoutDiagnostics().cachedMeasurements, snapshotWasmLayoutDiagnostics().activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    available.set(true);
    const recovered = pibblSync(canvas, root); controllers.push(recovered); await frame();
    expect(paints).toBe(1);
    recovered.dispose();
  } finally { window.removeEventListener('error', receive); }
});
