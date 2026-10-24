import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  defineLayoutComponent,
  definePrimitive,
  signal,
  Flex,
  measureElement,
  Rectangle,
  type FlexStyle,
  type PibblController,
  type PibblResponsiveStyle,
  type SystemStyle,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

for (const axis of ['row', 'column'] as const) for (const described of [false, true]) {
  it.runIf(experimentalLayout)(`keeps ${described ? 'a described Card' : 'a direct Flex'} ${axis} staged contribution separate from its final minimum owner`, async () => {
    const row = axis === 'row';
    const baseline = snapshotWasmLayoutDiagnostics();
    const hits: string[] = [];
    const cardStyle: PibblResponsiveStyle<FlexStyle> = {
      width: row ? 'auto' : 20,
      height: row ? 20 : 'auto',
      minWidth: row ? 100 : 0,
      maxWidth: row ? 160 : undefined,
      minHeight: row ? 0 : 100,
      maxHeight: row ? undefined : 160,
      flexDirection: axis,
      flexWrap: 'nowrap',
      layoutDirection: 'ltr',
      alignItems: 'flex-start',
      flexBasis: 'auto',
      flexGrow: 0,
      flexShrink: 0,
    };
    const children = () => <>
      <Rectangle key="A" style={{
        width: row ? 80 : 20,
        height: row ? 20 : 80,
        minWidth: 0,
        minHeight: 0,
        maxWidth: row ? '25%' : undefined,
        maxHeight: row ? undefined : '25%',
        flexBasis: 80,
        flexGrow: 0,
        flexShrink: 0,
        fill: '#b63d3d',
        cursor: 'pointer',
      }} onClick={() => { hits.push('A'); }} />
      <Rectangle key="B" style={{
        width: row ? 80 : 20,
        height: row ? 20 : 80,
        minWidth: 0,
        minHeight: 0,
        flexBasis: 80,
        flexGrow: 0,
        flexShrink: 0,
        fill: '#426b61',
        cursor: 'pointer',
      }} onClick={() => { hits.push('B'); }} />
    </>;
    const Card = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) =>
      <Flex style={props.style}>{children()}</Flex>,
    );
    const owner = () => described
      ? <Card key="owner" style={cardStyle} />
      : <Flex key="owner" style={cardStyle}>{children()}</Flex>;
    const constraints = {
      minWidth: row ? 0 : 20,
      maxWidth: row ? 200 : 20,
      minHeight: row ? 20 : 0,
      maxHeight: row ? 20 : 200,
    };
    // This size-only query is distinct from the parent contribution used for final placement.
    expect(measureElement(owner(), constraints, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: 112.5, height: 20 } : { width: 20, height: 112.5 } });

    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{
      width: row ? 200 : 100,
      height: row ? 100 : 200,
      flexDirection: row ? 'row' : 'column',
      flexWrap: 'nowrap',
      layoutDirection: 'ltr',
      alignItems: 'flex-start',
    }}>
      {owner()}
      <Rectangle key="C" style={{
        width: row ? 20 : 20,
        height: row ? 20 : 20,
        minWidth: 0,
        minHeight: 0,
        flexBasis: 20,
        flexGrow: 0,
        flexShrink: 0,
        fill: '#6e3e79',
        cursor: 'pointer',
      }} onClick={() => { hits.push('C'); }} />
    </Flex>);
    controllers.push(controller); await frame();
    const click = (main: number) => {
      const bounds = canvas.getBoundingClientRect();
      const x = bounds.left + (row ? main : 10), y = bounds.top + (row ? 10 : main);
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
    };
    click(39); click(40); click(165); await frame();
    expect(hits).toEqual(['A', 'B', 'C']);
    const pixel = (main: number) => [...canvas.getContext('2d')!.getImageData(row ? main : 10, row ? 10 : main, 1, 1).data];
    expect(pixel(39)).toEqual([182, 61, 61, 255]);
    expect(pixel(40)).toEqual([66, 107, 97, 255]);
    expect(pixel(119)).toEqual([66, 107, 97, 255]);
    expect(pixel(120)).toEqual([0, 0, 0, 0]);
    expect(pixel(159)).toEqual([0, 0, 0, 0]);
    expect(pixel(160)).toEqual([110, 62, 121, 255]);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const axis of ['row', 'column'] as const) for (const described of [false, true]) {
  it.runIf(experimentalLayout)(`keeps ${described ? 'a described Card' : 'a direct Flex'} ${axis} numeric basis composition unchanged without staged bounds`, async () => {
    const row = axis === 'row';
    const baseline = snapshotWasmLayoutDiagnostics();
    const hits: string[] = [];
    const cardStyle: PibblResponsiveStyle<FlexStyle> = {
      width: row ? 'auto' : 20,
      height: row ? 20 : 'auto',
      minWidth: 0,
      minHeight: 0,
      flexDirection: axis,
      flexWrap: 'nowrap',
      layoutDirection: 'ltr',
      alignItems: 'flex-start',
      flexBasis: 'auto',
      flexGrow: 0,
      flexShrink: 0,
    };
    const children = () => <>
      <Rectangle key="A" style={{ width: row ? 80 : 20, height: row ? 20 : 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#b63d3d', cursor: 'pointer' }} onClick={() => { hits.push('A'); }} />
      <Rectangle key="B" style={{ width: row ? 80 : 20, height: row ? 20 : 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61', cursor: 'pointer' }} onClick={() => { hits.push('B'); }} />
    </>;
    const Card = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) => <Flex style={props.style}>{children()}</Flex>);
    const owner = () => described ? <Card key="owner" style={cardStyle} /> : <Flex key="owner" style={cardStyle}>{children()}</Flex>;
    expect(measureElement(owner(), {
      minWidth: row ? 0 : 20, maxWidth: row ? 200 : 20,
      minHeight: row ? 20 : 0, maxHeight: row ? 20 : 200,
    }, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: 160, height: 20 } : { width: 20, height: 160 } });
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: row ? 200 : 100, height: row ? 100 : 200, flexDirection: row ? 'row' : 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start' }}>
      {owner()}
      <Rectangle key="C" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: '#6e3e79', cursor: 'pointer' }} onClick={() => { hits.push('C'); }} />
    </Flex>);
    controllers.push(controller); await frame();
    const click = (main: number) => {
      const bounds = canvas.getBoundingClientRect();
      const x = bounds.left + (row ? main : 10), y = bounds.top + (row ? 10 : main);
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
    };
    click(79); click(80); click(165); await frame();
    expect(hits).toEqual(['A', 'B', 'C']);
    const pixel = (main: number) => [...canvas.getContext('2d')!.getImageData(row ? main : 10, row ? 10 : main, 1, 1).data];
    expect(pixel(79)).toEqual([182, 61, 61, 255]);
    expect(pixel(80)).toEqual([66, 107, 97, 255]);
    expect(pixel(159)).toEqual([66, 107, 97, 255]);
    expect(pixel(160)).toEqual([110, 62, 121, 255]);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const axis of ['row', 'column'] as const) for (const described of [false, true]) {
  it.runIf(experimentalLayout)(`uses the staged native auto margin for ${described ? 'a described Card' : 'a direct Flex'} ${axis} numeric bounds`, async () => {
    const row = axis === 'row';
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal<0 | 'auto'>(0);
    const hits: string[] = [];
    const cardStyle: PibblResponsiveStyle<FlexStyle> = {
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      minWidth: row ? 100 : 0, maxWidth: row ? 160 : undefined,
      minHeight: row ? 0 : 100, maxHeight: row ? undefined : 160,
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start',
      flexBasis: 'auto', flexGrow: 0, flexShrink: 0,
    };
    const children = () => <>
      <Rectangle key="A" onClick={() => { hits.push('A'); }} style={{
        width: row ? 80 : 20, height: row ? 20 : 80, minWidth: 0, minHeight: 0,
        maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%',
        flexBasis: 80, flexGrow: 0, flexShrink: 0,
        marginLeft: row ? margin : undefined, marginTop: row ? undefined : margin,
        fill: '#b63d3d', cursor: 'pointer',
      }} />
      <Rectangle key="B" onClick={() => { hits.push('B'); }} style={{ width: row ? 80 : 20, height: row ? 20 : 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61', cursor: 'pointer' }} />
    </>;
    const Card = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) => <Flex style={props.style}>{children()}</Flex>);
    const owner = () => described ? <Card key="owner" style={cardStyle} /> : <Flex key="owner" style={cardStyle}>{children()}</Flex>;
    const constraints = { minWidth: row ? 0 : 20, maxWidth: row ? 200 : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : 200 };
    expect(measureElement(owner(), constraints, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: 112.5, height: 20 } : { width: 20, height: 112.5 } });
    margin.set('auto');
    expect(measureElement(owner(), constraints, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: 112.5, height: 20 } : { width: 20, height: 112.5 } });
    margin.set(0);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: row ? 200 : 100, height: row ? 100 : 200, flexDirection: row ? 'row' : 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start' }}>
      {owner()}
      <Rectangle key="C" onClick={() => { hits.push('C'); }} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: '#6e3e79', cursor: 'pointer' }} />
    </Flex>);
    controllers.push(controller); await frame();
    const click = (main: number) => {
      const bounds = canvas.getBoundingClientRect();
      const x = bounds.left + (row ? main : 10), y = bounds.top + (row ? 10 : main);
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
    };
    click(39); click(40); click(165); await frame();
    expect(hits).toEqual(['A', 'B', 'C']);
    const initial = snapshotWasmLayoutDiagnostics();
    margin.set('auto'); await frame();
    click(10); click(35); click(75); click(165); await frame();
    expect(hits).toEqual(['A', 'B', 'C', 'A', 'B', 'C']);
    const pixel = (main: number) => [...canvas.getContext('2d')!.getImageData(row ? main : 10, row ? 10 : main, 1, 1).data];
    expect(pixel(29)).toEqual([0, 0, 0, 0]);
    expect(pixel(30)).toEqual([182, 61, 61, 255]);
    expect(pixel(70)).toEqual([66, 107, 97, 255]);
    expect(pixel(160)).toEqual([110, 62, 121, 255]);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    const beforeDetached = snapshotWasmLayoutDiagnostics().solves;
    margin.set(0); await frame();
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforeDetached);
  });
}

for (const axis of ['row', 'column'] as const) for (const described of [false, true]) {
  it.runIf(experimentalLayout)(`uses the staged native auto margin for ${described ? 'a described Card' : 'a direct Flex'} ${axis} paired bounds`, async () => {
    const row = axis === 'row';
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal<0 | 'auto'>(0);
    const hits: string[] = [];
    type LeafStyle = FlexStyle;
    type ResolvedLeafStyle = SystemStyle & { readonly width: number; readonly height: number };
    const Leaf = definePrimitive<{}, LeafStyle, LeafStyle, ResolvedLeafStyle>((_props, style) =>
      <Rectangle onClick={() => { hits.push('A'); }} style={{ width: style.width, height: style.height, fill: '#b63d3d', cursor: 'pointer' }} />,
    {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 0 }, maxContent: row ? { width: 80, height: 20 } : { width: 20, height: 80 } }),
      measure: () => ({ status: 'measured' as const, size: row ? { width: 80, height: 20 } : { width: 20, height: 80 } }),
    });
    const cardStyle: PibblResponsiveStyle<FlexStyle> = {
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      minWidth: row ? 100 : 0, maxWidth: row ? 160 : undefined,
      minHeight: row ? 0 : 100, maxHeight: row ? undefined : 160,
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start',
      flexBasis: 'auto', flexGrow: 0, flexShrink: 0,
    };
    const children = () => <>
      <Leaf key="A" style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: 0, minHeight: 0, maxWidth: row ? '25%' : undefined, maxHeight: row ? undefined : '25%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0, marginLeft: row ? margin : undefined, marginTop: row ? undefined : margin }} />
      <Rectangle key="B" onClick={() => { hits.push('B'); }} style={{ width: row ? 80 : 20, height: row ? 20 : 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61', cursor: 'pointer' }} />
    </>;
    const Card = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) => <Flex style={props.style}>{children()}</Flex>);
    const owner = () => described ? <Card key="owner" style={cardStyle} /> : <Flex key="owner" style={cardStyle}>{children()}</Flex>;
    const constraints = { minWidth: row ? 0 : 20, maxWidth: row ? 200 : 20, minHeight: row ? 20 : 0, maxHeight: row ? 20 : 200 };
    expect(measureElement(owner(), constraints, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: 110, height: 20 } : { width: 20, height: 110 } });
    margin.set('auto');
    expect(measureElement(owner(), constraints, { measureText: () => { throw new Error('No text.'); } }))
      .toEqual({ status: 'measured', size: row ? { width: 110, height: 20 } : { width: 20, height: 110 } });
    margin.set(0);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: row ? 200 : 100, height: row ? 100 : 200, flexDirection: row ? 'row' : 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start' }}>
      {owner()}
      <Rectangle key="C" onClick={() => { hits.push('C'); }} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: '#6e3e79', cursor: 'pointer' }} />
    </Flex>);
    controllers.push(controller); await frame();
    const click = (main: number) => {
      const bounds = canvas.getBoundingClientRect();
      const x = bounds.left + (row ? main : 10), y = bounds.top + (row ? 10 : main);
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
    };
    click(5); click(35); click(125); await frame();
    expect(hits).toEqual(['A', 'B', 'C']);
    const initial = snapshotWasmLayoutDiagnostics();
    margin.set('auto'); await frame();
    click(5); click(15); click(45); click(125); await frame();
    expect(hits).toEqual(['A', 'B', 'C', 'A', 'B', 'C']);
    const pixel = (main: number) => [...canvas.getContext('2d')!.getImageData(row ? main : 10, row ? 10 : main, 1, 1).data];
    expect(pixel(9)).toEqual([0, 0, 0, 0]);
    expect(pixel(10)).toEqual([182, 61, 61, 255]);
    expect(pixel(40)).toEqual([66, 107, 97, 255]);
    expect(pixel(120)).toEqual([110, 62, 121, 255]);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    const beforeDetached = snapshotWasmLayoutDiagnostics().solves;
    margin.set(0); await frame();
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforeDetached);
  });
}
