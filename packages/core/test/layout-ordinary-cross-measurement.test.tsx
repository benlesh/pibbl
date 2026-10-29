import { afterEach, expect, it, vi } from 'vitest';
import {
  defineLayoutComponent, definePrimitive, Flex, measureElement, Rectangle, signal,
  Text, type FlexStyle, type FlexItemStyle, type TextStyle, type PibblResponsiveStyle, type PibblController, type SystemStyle,
  useCanvasContext, useConst, useLayoutBox,
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
type Record = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

for (const [label, axis, wrap, described] of [
  ['direct row nowrap', 'row', 'nowrap', false],
  ['described row wrap', 'row', 'wrap', true],
  ['direct column nowrap', 'column', 'nowrap', false],
  ['described column nowrap', 'column', 'nowrap', true],
] as const) {
  it.runIf(nativeLayout)(`uses an ordinary measure-only ${label} result before cross-auto placement`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal<0 | 'auto'>(0), natural = signal(label === 'direct column nowrap' ? 200 : 20), peerFill = signal('#426b61');
    const hits: string[] = [];
    let serial = 0, box: Record | undefined, calls = 0;
    const row = axis === 'row';
    type Resolved = SystemStyle & { readonly width: number; readonly height: number };
    const Leaf = definePrimitive<{ readonly natural: typeof natural }, FlexStyle, FlexStyle, Resolved>((_props, style) => {
      const allocation = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      box = { x: transform.e, y: transform.f, width: allocation.width, height: allocation.height, stamp };
      return <Rectangle onClick={() => hits.push('leaf')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, {
      preserveSignalProps: ['natural'],
      resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }),
      measure: ({ props, constraints }) => {
        calls++;
        return { status: 'measured' as const, size: {
          width: row ? constraints.maxWidth : Math.min(props.natural.get(), constraints.maxWidth),
          height: row ? Math.min(props.natural.get(), constraints.maxHeight) : constraints.maxHeight,
        } };
      },
    });
    const Badge = defineLayoutComponent((props: { readonly natural: typeof natural; readonly style: PibblResponsiveStyle<FlexStyle> }) => <Leaf natural={props.natural} style={props.style} />);
    const style: PibblResponsiveStyle<FlexStyle> = row
      ? { width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop: margin }
      : { width: 'auto', height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: margin };
    const candidate = described ? <Badge key="badge" natural={natural} style={style} /> : <Leaf key="leaf" natural={natural} style={style} />;
    const pure = measureElement(candidate, row
      ? { minWidth: 80, maxWidth: 80, minHeight: 0, maxHeight: 100 }
      : { minWidth: 0, maxWidth: 180, minHeight: 40, maxHeight: 40 }, { measureText: () => { throw Error('measure-only probe has no text'); } });
    expect(pure.status).toBe('measured');

    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
    const controller = pibblSync(canvas, <Flex style={row
      ? { width: 180, height: 100, flexDirection: 'row', flexWrap: wrap, alignItems: 'flex-start', alignContent: 'flex-start' }
      : { width: 180, height: 100, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      {candidate}
      <Rectangle key="peer" style={row
        ? { width: 60, height: 40, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: peerFill }
        : { width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = box!;
    const initialCross = row ? 20 : Math.min(natural.get(), 180);
    expect(zero).toMatchObject(row ? { x: 0, y: 0, width: 80, height: initialCross } : { x: 0, y: 0, width: initialCross, height: 40 });
    const mounted = snapshotWasmLayoutDiagnostics();
    margin.set('auto'); await frame();
    const auto = box!;
    const expected = row ? { x: 0, y: wrap === 'nowrap' ? 80 : 20, width: 80, height: 20 } : { x: 180 - initialCross, y: 0, width: initialCross, height: 40 };
    expect(auto).toMatchObject({ ...expected, stamp: zero.stamp });
    click(canvas, auto.x + 4, auto.y + 4); await frame(); expect(hits).toEqual(['leaf']);
    const beforeChange = calls;
    natural.set(40); await frame();
    expect(box).toMatchObject(row ? { x: 0, y: wrap === 'nowrap' ? 60 : 0, width: 80, height: 40, stamp: zero.stamp } : { x: 140, y: 0, width: 40, height: 40, stamp: zero.stamp });
    expect(calls).toBeGreaterThan(beforeChange);
    click(canvas, box!.x + 4, box!.y + 4); await frame(); expect(hits).toEqual(['leaf', 'leaf']);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
    expect(calls).toBeGreaterThan(1);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const [label, extra] of [
  ['numeric basis', { flexBasis: 40 }],
  ['positive grow', { flexGrow: 1 }],
  ['maximum width', { maxWidth: 60 }],
  ['custom font', { font: '10px CustomFont' }],
  ['ellipsis fit', { fit: 'ellipsis' as const }],
] as const) {
  it.runIf(nativeLayout)(`keeps ordinary wrapped Text ${label} sizing when a column side margin becomes auto`, async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const marginLeft = signal<0 | 'auto'>(0), words = signal('longunbrokenwordlongunbrokenword'), peerFill = signal('#426b61');
    const hits: string[] = [];
    const canvas = document.createElement('canvas'); canvas.width = 140; canvas.height = 100; document.body.append(canvas);
    const context = canvas.getContext('2d')!, draws: Array<{ text: string; x: number; y: number }> = [], native = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maximum) {
      const transform = this.getTransform(); draws.push({ text: String(text), x: transform.e + x, y: transform.f + y });
      return maximum === undefined ? native.call(this, text, x, y) : native.call(this, text, x, y, maximum);
    });
    const style: PibblResponsiveStyle<TextStyle & FlexItemStyle> = { width: 'auto', height: 40, minWidth: 0, minHeight: 0, flexBasis: 'auto', flexGrow: 0, flexShrink: 0, marginLeft, wrap: true, font: '10px monospace', lineHeight: 10, fill: '#8a3248', cursor: 'pointer', ...extra };
    const text = <Text key="text" onClick={() => hits.push('text')} style={style}>{words}</Text>;
    const service = { measureText(value: string, font: string) { context.save(); context.font = font; const result = context.measureText(value); context.restore(); return result; } };
    const pure = measureElement(text, { minWidth: 0, maxWidth: 100, minHeight: 40, maxHeight: 40 }, service);
    expect(pure.status).toBe('measured'); if (pure.status !== 'measured') throw Error('ordinary Text zero control must measure');
    const controller = pibblSync(canvas, <Flex style={{ width: 100, height: 100, flexDirection: 'column', alignItems: 'flex-start' }}>
      {text}<Rectangle key="peer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
    </Flex>);
    controllers.push(controller); await frame();
    const zero = draws.at(-1)!;
    expect(zero.x).toBeCloseTo(0, 5);
    const mounted = snapshotWasmLayoutDiagnostics();
    marginLeft.set('auto'); await frame();
    const automatic = draws.at(-1)!;
    expect(automatic.x).toBeCloseTo(100 - Math.min(pure.size.width, label === 'maximum width' ? 60 : 100), 5);
    expect(automatic.y).toBeCloseTo(zero.y, 5);
    click(canvas, automatic.x + 4, Math.max(4, automatic.y + 4)); await frame(); expect(hits).toEqual(['text']);
    words.set('other'); await frame();
    expect(draws.at(-1)!.text).toContain('other');
    expect(draws.at(-1)!.x).toBeCloseTo(label === 'maximum width' ? 40 : 0, 5);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#19375b'); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}
