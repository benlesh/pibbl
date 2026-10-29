import { afterEach, expect, it, vi } from 'vitest';
import {
  definePrimitive, Flex, measureElement, Rectangle, signal, Text,
  type FlexStyle, type PibblController, type SystemStyle,
  useCanvasContext, useConst,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
  }));
}

const policies = [
  ['custom font', { font: '10px CustomFont' }, false],
  ['ellipsis', { font: '10px monospace', fit: 'ellipsis' }, true],
  ['overflow clip', { font: '10px monospace', overflow: 'clip' }, true],
  ['fit clip', { font: '10px monospace', fit: 'clip' }, true],
  ['squish', { font: '10px monospace', fit: 'squish' }, true],
] as const;

for (const [name, policy, cacheable] of policies) {
  it.runIf(nativeLayout)(`measures ${name} Text before a row cross auto margin`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginTop = signal<0 | 'auto'>(0), words = signal('alphabetalphabetalphabet'), peerFill = signal('#426b61');
    const hits: string[] = [], draws: Array<{ x: number; y: number; text: string; maximum?: number }> = [];
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 140; document.body.append(canvas);
    const context = canvas.getContext('2d')!, nativeFillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maximum) {
      const transform = this.getTransform(); draws.push({ x: transform.e + x, y: transform.f + y, text, maximum });
      return maximum === undefined ? nativeFillText.call(this, text, x, y) : nativeFillText.call(this, text, x, y, maximum);
    });
    let peer: Readonly<{ x: number; y: number; stamp: number }> | undefined;
    let serial = 0;
    const Peer = definePrimitive<{ readonly fill: typeof peerFill }, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      peer = { x: transform.e, y: transform.f, stamp };
      return <Rectangle style={{ width: style.width, height: style.height, fill: props.fill }} />;
    }, { preserveSignalProps: ['fill'], resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
    const service = {
      measureText(value: string, font: string) {
        context.save(); context.font = font;
        const metrics = context.measureText(value);
        context.restore();
        return metrics;
      },
    };
    const inkMiddle = (text: string) => { context.save(); context.font = policy.font; context.textBaseline = 'top'; const metrics = context.measureText(text); context.restore(); return (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2; };
    const pure = (content: string) => measureElement(
      <Text style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop: 0, wrap: false, lineHeight: 10, fill: '#8a3248', ...policy }}>{content}</Text>,
      { minWidth: 0, maxWidth: 80, minHeight: 0, maxHeight: 100 }, service,
    );
    const initialPure = pure(words.get());
    expect(initialPure.status).toBe('measured');
    if (initialPure.status !== 'measured') throw Error(`${name} Text measurement unavailable`);
    expect(initialPure.size.width).toBeGreaterThan(0);
    expect(initialPure.size.height).toBeGreaterThan(0);

    const controller = pibblSync(canvas, <Flex style={{ width: 180, height: 100, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Text key="text" onClick={() => hits.push('text')} style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop, wrap: false, lineHeight: 10, fill: '#8a3248', cursor: 'pointer', ...policy }}>{words}</Text>
      <Peer key="peer" fill={peerFill} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = draws.at(-1)!;
    expect(zero).toMatchObject({ x: 0, y: 0 });
    if (name === 'ellipsis') expect(zero.text.endsWith('...')).toBe(true);
    if (name === 'squish') expect(zero.maximum).toBe(80);
    expect(peer).toMatchObject({ x: 80, y: 0 });
    const mounted = snapshotWasmLayoutDiagnostics(), initialPeer = peer!;

    marginTop.set('auto'); await frame();
    const automatic = draws.at(-1)!;
    expect(automatic).toMatchObject({ x: 0, y: 100 - initialPure.size.height, text: zero.text });
    expect(peer).toEqual(initialPeer);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
    click(canvas, 4, automatic.y + inkMiddle(automatic.text)); await frame(); expect(hits).toEqual(['text']);

    words.set('gammajgammajgammajgammaj'); await frame();
    const changedPure = pure(words.get());
    expect(changedPure.status).toBe('measured');
    if (changedPure.status !== 'measured') throw Error(`${name} changed Text measurement unavailable`);
    const changed = draws.at(-1)!;
    expect(changed).toMatchObject({ x: 0, y: 100 - changedPure.size.height });
    expect(changed.text).not.toBe(zero.text);
    click(canvas, 4, changed.y + Math.min(inkMiddle(changed.text), changedPure.size.height - 0.5)); await frame(); expect(hits).toEqual(['text', 'text']);

    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    const painted = snapshotWasmLayoutDiagnostics();
    expect(painted.nodeCreates).toBe(mounted.nodeCreates);
    expect(peer!.stamp).toBe(initialPeer.stamp);
    if (cacheable) {
      expect(painted.solves).toBe(beforePaint.solves);
      expect(painted.measuredLeaves).toBe(beforePaint.measuredLeaves);
    }
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

const columnPolicies = [
  ['column custom font', { font: '10px CustomFont' }, false],
  ['column ellipsis', { font: '10px monospace', fit: 'ellipsis' }, true],
  ['column overflow clip', { font: '10px monospace', overflow: 'clip' }, true],
] as const;

for (const [name, policy, cacheable] of columnPolicies) {
  it.runIf(nativeLayout)(`measures ${name} before a column cross auto margin`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginLeft = signal<0 | 'auto'>(0), words = signal('alpha beta'), peerFill = signal('#426b61');
    const hits: string[] = [], draws: Array<{ x: number; y: number; text: string }> = [];
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
    const context = canvas.getContext('2d')!, nativeFillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maximum) {
      const transform = this.getTransform(); draws.push({ x: transform.e + x, y: transform.f + y, text });
      return maximum === undefined ? nativeFillText.call(this, text, x, y) : nativeFillText.call(this, text, x, y, maximum);
    });
    let peer: Readonly<{ x: number; y: number; stamp: number }> | undefined;
    let serial = 0;
    const Peer = definePrimitive<{ readonly fill: typeof peerFill }, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      peer = { x: transform.e, y: transform.f, stamp };
      return <Rectangle style={{ width: style.width, height: style.height, fill: props.fill }} />;
    }, { preserveSignalProps: ['fill'], resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
    const service = {
      measureText(value: string, font: string) {
        context.save(); context.font = font;
        const metrics = context.measureText(value);
        context.restore();
        return metrics;
      },
    };
    const inkMiddle = (text: string) => { context.save(); context.font = policy.font; context.textBaseline = 'top'; const metrics = context.measureText(text); context.restore(); return (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2; };
    const pure = (content: string) => measureElement(
      <Text style={{ width: 'auto', height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 0, wrap: false, lineHeight: 10, fill: '#8a3248', ...policy }}>{content}</Text>,
      { minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: 40, maxHeight: 40 }, service,
    );
    const initialPure = pure(words.get());
    expect(initialPure.status).toBe('measured');
    if (initialPure.status !== 'measured') throw Error(`${name} Text measurement unavailable`);
    expect(initialPure.size.width).toBeGreaterThan(0);
    expect(initialPure.size.height).toBeGreaterThan(0);

    const controller = pibblSync(canvas, <Flex style={{ width: 180, height: 100, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Text key="text" onClick={() => hits.push('text')} style={{ width: 'auto', height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft, wrap: false, lineHeight: 10, fill: '#8a3248', cursor: 'pointer', ...policy }}>{words}</Text>
      <Peer key="peer" fill={peerFill} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = draws.at(-1)!;
    expect(zero).toMatchObject({ x: 0, y: 0 });
    expect(peer).toMatchObject({ x: 0, y: 40 });
    const mounted = snapshotWasmLayoutDiagnostics(), initialPeer = peer!;

    marginLeft.set('auto'); await frame();
    const automatic = draws.at(-1)!;
    expect(automatic).toMatchObject({ x: 180 - initialPure.size.width, y: 0, text: zero.text });
    expect(peer).toEqual(initialPeer);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
    click(canvas, automatic.x + 4, inkMiddle(automatic.text)); await frame(); expect(hits).toEqual(['text']);

    words.set('gamma delta epsilon'); await frame();
    const changedPure = pure(words.get());
    expect(changedPure.status).toBe('measured');
    if (changedPure.status !== 'measured') throw Error(`${name} changed Text measurement unavailable`);
    const changed = draws.at(-1)!;
    expect(changed).toMatchObject({ x: 180 - changedPure.size.width, y: 0 });
    expect(changed.text).not.toBe(zero.text);
    click(canvas, changed.x + 4, inkMiddle(changed.text)); await frame(); expect(hits).toEqual(['text', 'text']);

    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    const painted = snapshotWasmLayoutDiagnostics();
    expect(painted.nodeCreates).toBe(mounted.nodeCreates);
    expect(peer!.stamp).toBe(initialPeer.stamp);
    if (cacheable) {
      expect(painted.solves).toBe(beforePaint.solves);
      expect(painted.measuredLeaves).toBe(beforePaint.measuredLeaves);
    }
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}
