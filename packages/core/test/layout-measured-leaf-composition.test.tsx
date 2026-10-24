import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  defineLayoutComponent,
  definePrimitive,
  Flex,
  measureElement,
  Rectangle,
  signal,
  type FlexStyle,
  type PibblController,
  type Percentage,
  type SystemStyle,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(experimentalLayout)(
  'keeps a described Card handoff receiver-scoped while an opaque measured Owner paints its returned subtree normally',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const service = { measureText: () => { throw new Error('The Card only uses numeric constrained measurement.'); } };
    interface LeafStyle extends SystemStyle {
      readonly width?: number | 'auto'; readonly height?: number;
      readonly minWidth?: number; readonly maxWidth?: number | Percentage;
      readonly flexGrow?: number; readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedLeafStyle = SystemStyle & { readonly width: number; readonly height: number; readonly fill?: string };
    let calls = 0;
    const paintedWidths: number[] = [], ownerWidths: number[] = [];
    const Leaf = definePrimitive<{}, LeafStyle, LeafStyle, ResolvedLeafStyle>((_props, style) => {
      const box = useLayoutBox();
      paintedWidths.push(box.width);
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ fill: style.fill, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 80, height: 20 } }),
      measure: ({ constraints }) => {
        calls++;
        expect(constraints).toEqual({ minWidth: 0, maxWidth: 40, minHeight: 20, maxHeight: 20 });
        return { status: 'measured' as const, size: { width: 80, height: 20 } };
      },
    });
    const cardStyle: FlexStyle = {
      width: 'auto', height: 20, minWidth: 0, minHeight: 0, maxWidth: 160,
      flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
    };
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={props.style}>
        <Leaf key="A" style={{ width: 'auto', height: 20, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0, fill: '#b63d3d' }} />
        <Rectangle key="B" style={{ width: 80, height: 20, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
      </Flex>,
    );
    const card = <Card key="card" style={cardStyle} />;
    const constraints = { minWidth: 0, maxWidth: 200, minHeight: 20, maxHeight: 20 };
    expect(measureElement(card, constraints, service)).toEqual({ status: 'measured', size: { width: 110, height: 20 } });

    const delegatedSizes: number[] = [];
    const Owner = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => { ownerWidths.push(style.width); return card; }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 160, height: 20 } }),
      measure: ({ constraints: ownerConstraints, measureElement: measure }) => {
        const primary = measure(card, ownerConstraints);
        const discarded = measure(card, { ...ownerConstraints, minWidth: 0, maxWidth: 80 });
        if (primary.status === 'measured') delegatedSizes.push(primary.size.width);
        if (discarded.status === 'measured') delegatedSizes.push(discarded.size.width);
        return primary;
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 100; document.body.append(canvas);
    const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(x, 10, 1, 1).data];
    const outer = (child: import('@pibbl/core').PibblNode) => <Flex style={{ width: 200, height: 80, flexDirection: 'column', alignItems: 'flex-start' }}>{child}</Flex>;

    const direct = pibbl(canvas, outer(card)); controllers.push(direct); await frame();
    expect(pixel(29)).toEqual([182, 61, 61, 255]);
    expect(pixel(31)).toEqual([66, 107, 97, 255]);
    direct.dispose();
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

    const delegated = pibbl(canvas, outer(<Owner key="owner" style={cardStyle} />)); controllers.push(delegated); await frame();
    // `measureElement(card, …)` supplies Owner's content size only. The returned
    // Card is a new normal subtree at Owner's final 110px allocation, so its raw
    // 25% cap resolves to 27.5px rather than reusing Card's direct prepared plan.
    expect(pixel(26)).toEqual([182, 61, 61, 255]);
    expect(pixel(29)).toEqual([66, 107, 97, 255]);
    expect(paintedWidths).toEqual([30, 27.5]);
    expect(ownerWidths).toEqual([110]);
    expect(delegatedSizes).toEqual([110, 100]);
    expect(calls).toBe(4);
    delegated.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);

for (const axis of ['row', 'column'] as const) for (const fixture of [
  { available: 40, leaf: 160, queries: [40, 80] },
  { available: 100, leaf: 400, queries: [100, 200] },
  { available: 200, leaf: 800, queries: [200, 400] },
]) {
  it.runIf(experimentalLayout)(`preserves native finite recursive percentage-owner phases for a known ${axis} chain at ${fixture.available}`, async () => {
    const row = axis === 'row', baseline = snapshotWasmLayoutDiagnostics();
    const queries: number[] = [], painted: number[] = [];
    const natural = signal(40);
    let failAllocated = false;
    const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
      const box = useLayoutBox(); painted.push(row ? box.width : box.height);
      return <Rectangle style={{ width: style.width, height: style.height, fill: '#b63d3d' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 0 }, maxContent: row ? { width: 40, height: 20 } : { width: 20, height: 40 } }),
      measure: ({ constraints }) => {
        expect(row ? [constraints.minWidth, constraints.minHeight, constraints.maxHeight] : [constraints.minHeight, constraints.minWidth, constraints.maxWidth]).toEqual([0, 20, 20]);
        queries.push(row ? constraints.maxWidth : constraints.maxHeight);
        if (failAllocated && (row ? constraints.maxWidth : constraints.maxHeight) === fixture.available * 2) throw new Error('allocated owner failed');
        const main = natural.get();
        return { status: 'measured', size: row ? { width: main, height: 20 } : { width: 20, height: main } };
      },
    });
    const Inner = defineLayoutComponent(() => <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, flexDirection: axis, alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
      <Leaf style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row ? '200%' : 0, minHeight: row ? 0 : '200%', flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    const root = <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', flexDirection: axis, alignItems: 'flex-start' }}><Inner /></Flex>;
    const service = { measureText: () => { throw new Error('Numeric owner chains do not shape text.'); } };
    expect(measureElement(root, { minWidth: row ? 0 : 20, maxWidth: row ? Infinity : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : Infinity }, service))
      .toEqual({ status: 'measured', size: row ? { width: 40, height: 20 } : { width: 20, height: 40 } });
    expect(queries).toEqual([Infinity]); queries.length = 0;
    const canvas = document.createElement('canvas'); canvas.width = row ? fixture.available : 20; canvas.height = row ? 20 : fixture.available; document.body.append(canvas);
    const controller = pibbl(canvas, root); controllers.push(controller); await frame();
    expect({ painted, queries }).toEqual({ painted: [fixture.leaf], queries: fixture.queries });
    const mounted = snapshotWasmLayoutDiagnostics();
    natural.set(20); await frame();
    expect({ painted, queries }).toEqual({ painted: [fixture.leaf, fixture.leaf], queries: [...fixture.queries, ...fixture.queries] });
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    controller.dispose();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    if (fixture.available === 40) {
      failAllocated = true;
      const errors: unknown[] = [];
      const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
      window.addEventListener('error', prevent);
      try {
        const failedController = pibbl(canvas, root); controllers.push(failedController);
        await frame();
        expect(errors).toHaveLength(1);
        expect(String(errors[0])).toContain('allocated owner failed');
        failedController.dispose();
      } finally { window.removeEventListener('error', prevent); }
      const failed = snapshotWasmLayoutDiagnostics();
      expect([failed.activeNodes, failed.activeArenas, failed.cachedMeasurements, failed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
      failAllocated = false;
      const recovered = pibbl(canvas, root); controllers.push(recovered); await frame();
      expect(painted.at(-1)).toBe(fixture.leaf);
      recovered.dispose();
      const cleaned = snapshotWasmLayoutDiagnostics();
      expect([cleaned.activeNodes, cleaned.activeArenas, cleaned.cachedMeasurements, cleaned.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    }
  });
}
