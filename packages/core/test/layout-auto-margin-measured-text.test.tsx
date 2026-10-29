import { afterEach, expect, it, vi } from 'vitest';
import {
  Flex, Rectangle, Text, definePrimitive, measureElement, signal,
  type PibblController, type SystemStyle, type FlexStyle, useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}

const rowProfiles = [
  ['nowrap/grow', 'nowrap', { flexGrow: 1, flexShrink: 0 }],
  ['nowrap/shrink-zero', 'nowrap', { flexGrow: 0, flexShrink: 0 }],
  ['nowrap/minimum-zero', 'nowrap', { flexGrow: 0, flexShrink: 1, minWidth: 0 }],
  ['nowrap/minimum-twenty', 'nowrap', { flexGrow: 0, flexShrink: 1, minWidth: 20 }],
  ['nowrap/minimum-one-twenty', 'nowrap', { flexGrow: 0, flexShrink: 1, minWidth: 120 }],
  ['nowrap/maximum-sixty', 'nowrap', { flexGrow: 0, flexShrink: 1, maxWidth: 60 }],
  ['wrap/minimum-zero', 'wrap', { flexGrow: 0, flexShrink: 1, minWidth: 0 }],
  ['wrap/minimum-twenty', 'wrap', { flexGrow: 0, flexShrink: 1, minWidth: 20 }],
  ['numeric/grow-control', 'nowrap', { width: 80, minWidth: 0, flexGrow: 1, flexShrink: 0 }],
  ['numeric/shrink-control', 'nowrap', { width: 100, minWidth: 0, flexGrow: 0, flexShrink: 1 }],
] as const;

for (const [name, flexWrap, main] of rowProfiles) {
  it.runIf(nativeLayout)(`keeps row ${name} Text main sizing while a cross auto margin uses the final measured height`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const words = signal('alpha beta gamma');
    const marginTop = signal<0 | 'auto'>(0);
    const peerFill = signal('#426b61');
    const hits: string[] = [];
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 100; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    const lines: Array<{ readonly x: number; readonly y: number; readonly text: string }> = [];
    const fillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, value, x, y, maximum) {
      if (typeof value === 'string') {
        const transform = this.getTransform(); lines.push({ text: value, x: transform.e + x, y: transform.f + y });
      }
      return maximum === undefined ? fillText.call(this, value, x, y) : fillText.call(this, value, x, y, maximum);
    });
    let peer: Readonly<{ x: number; y: number; width: number; height: number }> | undefined;
    const Peer = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, _style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform();
      peer = { x: transform.e, y: transform.f, width: box.width, height: box.height };
      return <Rectangle style={{ width: box.width, height: box.height, fill: peerFill }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const ownerWidth = name === 'numeric/shrink-control' || flexWrap === 'wrap' ? 160 : 180;
    const controller = pibblSync(canvas, <Flex style={{ width: ownerWidth, height: 80, flexDirection: 'row', flexWrap, alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}>
      <Text key="text" onClick={() => hits.push('text')} style={{ wrap: true, font: '10px monospace', lineHeight: 10, marginTop, fill: '#19375b', ...main }}>{words}</Text>
      <Peer key="peer" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = lines.slice();
    expect(zero.length).toBeGreaterThan(0);
    expect(zero[0]!.y).toBe(0);
    const mounted = snapshotWasmLayoutDiagnostics();
    const zeroPeer = peer!;
    if (flexWrap === 'nowrap') {
      context.save(); context.font = '10px monospace'; const natural = context.measureText(words.get()).width; context.restore();
      const mainWidth = name.endsWith('/grow') || name === 'numeric/grow-control' ? 110 : name === 'numeric/shrink-control' ? 90 : name.endsWith('maximum-sixty') ? 60 : name.endsWith('minimum-one-twenty') ? 120 : natural;
      expect(zeroPeer.x).toBeCloseTo(mainWidth + 10, 5);
    }

    lines.length = 0;
    marginTop.set('auto'); await frame();
    const automatic = lines.slice();
    expect(automatic.map(line => line.text)).toEqual(zero.map(line => line.text));
    if (flexWrap === 'nowrap') {
      const finalHeight = automatic.at(-1)!.y - automatic[0]!.y + 10;
      expect(automatic[0]!.y).toBe(80 - finalHeight);
    } else {
      // The Text and peer are already on distinct wrapped lines. Cross-auto
      // therefore has no line-local free space to absorb.
      expect(automatic.map(line => [line.x, line.y])).toEqual(zero.map(line => [line.x, line.y]));
    }
    expect(automatic[0]!.x).toBe(zero[0]!.x);
    expect(peer).toEqual(zeroPeer);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, automatic[0]!.x + 3, automatic[0]!.y + 4); await frame();
    expect(hits).toEqual(['text']);

    lines.length = 0;
    words.set('alpha beta gamma alpha'); await frame();
    const changed = lines.slice();
    expect(changed.length).toBeGreaterThanOrEqual(automatic.length);
    if (flexWrap === 'nowrap') {
      const changedHeight = changed.at(-1)!.y - changed[0]!.y + 10;
      expect(changed[0]!.y).toBe(80 - changedHeight);
    }
    expect(peer!.width).toBe(60);
    expect(peer!.height).toBe(40);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#a63758'); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const [name, height, flexBasis] of [
  ['numeric-height/numeric-basis', 40, 40],
  ['automatic-height/numeric-basis', 'auto', 40],
  ['automatic-height/automatic-basis', 'auto', 'auto'],
] as const) {
  it.runIf(nativeLayout)(`keeps column ${name} Text main allocation while a finite measured cross width takes an auto margin`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const words = signal('aaaa aaaa');
    const marginLeft = signal<0 | 'auto'>(0);
    let serial = 0;
    let footer: Readonly<{ x: number; y: number; stamp: number }> | undefined;
    const Footer = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>((_props, _style) => {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform();
      const stamp = useConst(() => ++serial);
      footer = { x: transform.e, y: transform.f, stamp };
      return <Rectangle style={{ width: box.width, height: box.height, fill: '#426b61' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const node = <Text key="text" style={{ width: 'auto', height, minHeight: 0, flexBasis, flexGrow: 0, flexShrink: 0, marginLeft, wrap: false, font: '10px monospace', fill: '#19375b' }}>{words}</Text>;
    const service = { measureText(value: string, font: string) { const probe = document.createElement('canvas').getContext('2d')!; probe.font = font; return probe.measureText(value); } };
    const pure = measureElement(node, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 80 }, service);
    expect(pure.status).toBe('measured');
    const canvas = document.createElement('canvas'); canvas.width = 140; canvas.height = 100; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    const draws: Array<{ x: number; y: number }> = [];
    const fillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, value, x, y, maximum) {
      if (value.startsWith('aaaa')) { const transform = this.getTransform(); draws.push({ x: transform.e + x, y: transform.f + y }); }
      return maximum === undefined ? fillText.call(this, value, x, y) : fillText.call(this, value, x, y, maximum);
    });
    const controller = pibblSync(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      {node}
      <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = draws.at(-1)!;
    const initialFooter = footer!;
    expect(zero.x).toBe(0);
    expect(footer!.y).toBeCloseTo(typeof flexBasis === 'number' ? flexBasis : pure.status === 'measured' ? pure.size.height : Number.NaN, 5);

    marginLeft.set('auto'); await frame();
    const automatic = draws.at(-1)!;
    context.save(); context.font = '10px monospace';
    const metric = context.measureText(words.get()); context.restore();
    const inkWidth = metric.actualBoundingBoxLeft + metric.actualBoundingBoxRight;
    expect(automatic.x - zero.x).toBeCloseTo(100 - inkWidth, 5);
    expect(automatic.y).toBe(zero.y);
    expect(footer!.y).toBe(initialFooter.y);
    expect(footer!.stamp).toBe(initialFooter.stamp);

    words.set('aaaa aaaa aaaa'); await frame();
    const changed = draws.at(-1)!;
    context.save(); context.font = '10px monospace';
    const changedMetric = context.measureText(words.get()); context.restore();
    expect(changed.x).toBeCloseTo(100 - changedMetric.actualBoundingBoxLeft - changedMetric.actualBoundingBoxRight, 5);
    expect(footer!.stamp).toBe(initialFooter.stamp);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeNodes).toBe(baseline.activeNodes);
    expect(disposed.activeArenas).toBe(baseline.activeArenas);
    expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
    expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
    expect(beforePaint.nodeCreates).toBeGreaterThanOrEqual(baseline.nodeCreates + 2);
  });
}

for (const words of ['aaaa aaaa', 'aaaa aaaa aaaa aaaa'] as const) {
  it.runIf(nativeLayout)(`keeps Slice178 wrapped Text line membership in column-reverse RTL while physical right auto moves ${words.length === 9 ? 'short' : 'long'} content`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginRight = signal<0 | 'auto'>(0);
    const hits: string[] = [];
    const canvas = document.createElement('canvas'); canvas.width = 140; canvas.height = 100; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    const draws: Array<{ x: number; y: number; text: string }> = [];
    const fillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, value, x, y, maximum) {
      if (value.startsWith('aaaa')) { const transform = this.getTransform(); draws.push({ text: value, x: transform.e + x, y: transform.f + y }); }
      return maximum === undefined ? fillText.call(this, value, x, y) : fillText.call(this, value, x, y, maximum);
    });
    const controller = pibblSync(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'column-reverse', flexWrap: 'nowrap', layoutDirection: 'rtl', alignItems: 'flex-start' }}>
      <Text key="text" onClick={() => hits.push('text')} style={{ width: 'auto', height: 40, minHeight: 0, flexBasis: 'auto', flexGrow: 0, flexShrink: 0, marginRight, wrap: true, font: '10px monospace', lineHeight: 10, fill: '#19375b' }}>{words}</Text>
      <Rectangle key="peer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = draws.slice();
    expect(zero.length).toBe(words.length === 9 ? 1 : 2);
    context.save(); context.font = '10px monospace'; const metrics = context.measureText(words); context.restore();
    // This is a deliberate extension of the wrapped natural-cross policy:
    // the zero control uses the capped natural advance before cross placement.
    expect(zero[0]!.x).toBeCloseTo(Math.max(0, 100 - metrics.width), 5);
    const mounted = snapshotWasmLayoutDiagnostics();
    draws.length = 0;
    marginRight.set('auto'); await frame();
    const automatic = draws.slice();
    expect(automatic.map(draw => draw.text)).toEqual(zero.map(draw => draw.text));
    expect(automatic[0]!.x).toBeCloseTo(0, 5);
    expect(automatic.map(draw => draw.y)).toEqual(zero.map(draw => draw.y));
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, automatic[0]!.x + 3, automatic[0]!.y + 4); await frame();
    expect(hits).toEqual(['text']);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}
