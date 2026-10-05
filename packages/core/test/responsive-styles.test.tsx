import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  pibbl, Absolute, Group, Flow, Grid, Rectangle, Text, signal, useCanvasContext, useLayoutBox,
  createElement, definePrimitive, measureElement, type MeasureResult, type SystemStyle,
  type PibblController, type BoxStyle, type LayoutItemStyle, type PibblResponsiveStyle, type TextStyle,
} from '@pibbl/core';

const mounts: PibblController[] = [];
afterEach(() => {
  for (const mount of mounts.splice(0)) mount.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function settle() { await frame(); await frame(); await frame(); }
function canvas(width: number, height = 200) {
  const result = document.createElement('canvas');
  result.style.width = `${width}px`;
  result.style.height = `${height}px`;
  document.body.append(result);
  return result;
}

describe('public responsive local styles', () => {
  it('keeps shared plain-component occurrences independent and leaves author props raw', async () => {
    const outerStyle = signal<PibblResponsiveStyle<BoxStyle & LayoutItemStyle>>({
      width: '100%', height: 160,
      when: [{ query: { maxWidth: 500 }, style: { left: 10 } }],
    });
    const read = vi.spyOn(outerStyle, 'get');
    const observations: Array<{ width: number; x: number; y: number }> = [];
    function Second({ width }: { width: number; style: BoxStyle }) {
      const matrix = useCanvasContext().getTransform();
      observations.push({ width, x: matrix.e, y: matrix.f });
      return <Rectangle style={{ width: 10, height: 10 }} />;
    }
    function Content({ style }: { style: typeof outerStyle }) {
      expect(style).toBe(outerStyle);
      const box = useLayoutBox();
      return <Flow style={{ direction: 'horizontal', gap: 12, when: [
        { query: { maxWidth: 500 }, style: { direction: 'vertical' } },
      ] }}>
        <Rectangle style={{ width: 10, height: 10 }} />
        <Second width={box.width} style={{ width: 10, height: 10 }} />
      </Flow>;
    }
    const shared = <Content style={outerStyle} />;
    mounts.push(pibbl(canvas(1000, 400), <Group>
      <Absolute style={{ width: 700, height: 160 }}>{shared}</Absolute>
      <Group style={{ translateY: 200 }}><Absolute style={{ width: 320, height: 160 }}>{shared}</Absolute></Group>
    </Group>, { viewport: 'responsive', pixelRatio: 1 }));
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(observations).toEqual([{ width: 700, x: 22, y: 0 }, { width: 320, x: 10, y: 222 }]);
  });

  it('can return from definite responsive placement to query-free intrinsic measurement', async () => {
    const style = signal<PibblResponsiveStyle<TextStyle>>({
      width: 120, height: 44,
      when: [{ query: { minWidth: 600 }, style: { font: '20px sans-serif' } }],
    });
    const sizes: number[] = [];
    function Following({ style: _style }: { style: BoxStyle }) {
      sizes.push(useCanvasContext().getTransform().e);
      return null;
    }
    mounts.push(pibbl(canvas(700), <Flow style={{ direction: 'horizontal', gap: 10 }}>
      <Text style={style}>hello</Text>
      <Following style={{ width: 20, height: 20 }} />
    </Flow>, { viewport: 'responsive', pixelRatio: 1 }));
    await settle();
    expect(sizes.at(-1)).toBe(130);
    style.set({ font: '12px monospace' });
    await settle();
    expect(sizes.at(-1)).toBeGreaterThan(10);
    expect(sizes.at(-1)).toBeLessThan(100);
  });

  it('adapts the same component to the root and its allocated Grid cell in both directions', async () => {
    const observations = new Map<string, { x: number; y: number }>();
    const gap = signal(12);
    const cellWidth = signal(320);
    function Probe({ id }: { id: string; style: BoxStyle }) {
      const matrix = useCanvasContext().getTransform();
      observations.set(id, { x: matrix.e, y: matrix.f });
      return <Rectangle style={{ width: 112, height: 44 }} />;
    }
    function Actions({ id }: { id: string; style?: BoxStyle & LayoutItemStyle }) {
      useLayoutBox();
      return <Flow style={{
        width: '100%', height: 112, direction: 'vertical', gap,
        when: [{ query: { minWidth: 600 }, style: { direction: 'horizontal', height: 44 } }],
      }}>
        <Probe id={`${id}-first`} style={{ width: 112, height: 44 }} />
        <Probe id={id} style={{ width: 112, height: 44 }} />
      </Flow>;
    }
    const wide = canvas(1000);
    const phone = canvas(360);
    const nested = canvas(1000);
    mounts.push(pibbl(wide, <Actions id="wide" />, { viewport: 'responsive', pixelRatio: 1 }));
    mounts.push(pibbl(phone, <Actions id="phone" />, { viewport: 'responsive', pixelRatio: 1 }));
    function Nested() {
      return <Grid style={{ gridTemplateColumns: [cellWidth.get(), '1fr'], gridTemplateRows: [160] }}>
        <Actions id="cell" style={{ width: '100%', height: 160, gridColumnStart: 1, gridRowStart: 1 }} />
      </Grid>;
    }
    mounts.push(pibbl(nested, <Nested />, { viewport: 'responsive', pixelRatio: 1 }));
    await settle();
    expect(observations.get('wide')).toEqual({ x: 124, y: 0 });
    expect(observations.get('phone')).toEqual({ x: 0, y: 56 });
    expect(observations.get('cell')).toEqual({ x: 0, y: 56 });
    for (const width of [599, 600, 601, 599, 600]) {
      cellWidth.set(width);
      phone.style.width = `${width}px`;
      await settle();
      const expected = width >= 600 ? { x: 124, y: 0 } : { x: 0, y: 56 };
      expect(observations.get('cell')).toEqual(expected);
      expect(observations.get('phone')).toEqual(expected);
    }
    gap.set(20);
    await settle();
    expect(observations.get('wide')).toEqual({ x: 132, y: 0 });
    expect(observations.get('cell')).toEqual({ x: 132, y: 0 });
  });
  it('uses inclusive height bounds and combines axes in root and allocated contexts', async () => {
    const gaps = new Map<string, number>();
    const Probe = definePrimitive<{ id: string }, SystemStyle & { gap?: number }>((props, style) => {
      gaps.set(props.id, style.gap!);
    });
    const rules = [
      { query: { maxHeight: 400 }, style: { gap: 8 } },
      { query: { minWidth: 600, minHeight: 500 }, style: { gap: 24 } },
    ];
    const innerHeight = signal(401);
    const innerWidth = signal(700);
    function Inner({ style: _placement }: { style: BoxStyle }) {
      return <Probe id="cell" style={{ gap: 16, when: rules }} />;
    }
    function Container() {
      return <Absolute style={{ width: innerWidth.get(), height: innerHeight.get() }}>
        <Inner style={{ width: '100%', height: '100%' }} />
      </Absolute>;
    }
    const target = canvas(700, 401);
    mounts.push(pibbl(target, <Probe id="root" style={{ gap: 16, when: rules }} />, { viewport: 'responsive', pixelRatio: 1 }));
    mounts.push(pibbl(canvas(1000, 700), <Container />, { viewport: 'responsive', pixelRatio: 1 }));
    for (const [height, gap] of [[401, 16], [400, 8], [399, 8], [401, 16], [499, 16], [500, 24], [501, 24], [499, 16]]) {
      target.style.height = `${height}px`;
      innerHeight.set(height);
      await settle();
      expect(gaps.get('root')).toBe(gap);
      expect(gaps.get('cell')).toBe(gap);
    }
    target.style.height = '500px';
    innerHeight.set(500);
    for (const [width, gap] of [[600, 24], [599, 16], [600, 24]]) {
      target.style.width = `${width}px`;
      innerWidth.set(width);
      await settle();
      expect(gaps.get('root')).toBe(gap);
      expect(gaps.get('cell')).toBe(gap);
    }
  });

  it('reads a prepared whole style and its active fields once, leaving inactive signals unread', async () => {
    const active = signal('red');
    const inactive = signal('blue');
    const activeRead = vi.spyOn(active, 'get');
    const inactiveRead = vi.spyOn(inactive, 'get');
    const style = signal({ width: 100, height: 44, when: [
      { query: { minWidth: 600 }, style: { fill: active } },
      { query: { maxWidth: 599 }, style: { fill: inactive } },
    ] });
    const wholeRead = vi.spyOn(style, 'get');
    const target = canvas(700);
    mounts.push(pibbl(target, <Flow><Rectangle style={style} /></Flow>, { viewport: 'responsive', pixelRatio: 1 }));
    await settle();
    expect(wholeRead).toHaveBeenCalledTimes(1);
    expect(activeRead).toHaveBeenCalledTimes(1);
    expect(inactiveRead).not.toHaveBeenCalled();
    target.style.width = '320px';
    await settle();
    const reads = wholeRead.mock.calls.length;
    active.set('green');
    await settle();
    expect(wholeRead).toHaveBeenCalledTimes(reads);
    inactive.set('purple');
    await settle();
    expect(wholeRead.mock.calls.length).toBe(reads + 1);
  });

  it('supports only finite queried axes in standalone measurement and rejects recursive queries', () => {
    const service = { measureText: () => ({ width: 20, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }) as TextMetrics };
    const constraints = { minWidth: 0, maxWidth: 700, minHeight: 0, maxHeight: Infinity };
    const label = createElement(Text, { children: 'label', style: { font: '12px sans-serif', wrap: true, width: 100, when: [
      { query: { minWidth: 600 }, style: { lineHeight: 24 } },
    ] } });
    expect(measureElement(label, constraints, service)).toEqual({ status: 'measured', size: { width: 100, height: 24 } });
    const heightLabel = createElement(Text, { children: 'label', style: { when: [
      { query: { minHeight: 100 }, style: { lineHeight: 24 } },
    ] } });
    expect(measureElement(heightLabel, constraints, service)).toMatchObject({ status: 'unsupported', reason: expect.stringContaining('PIBBL_STYLE_QUERY_BASIS') });
    const parent = createElement(Flow, { children: label, style: { width: 700 } });
    expect(measureElement(parent, constraints, service)).toMatchObject({ status: 'unsupported', reason: expect.stringContaining('PIBBL_STYLE_QUERY_MEASUREMENT') });
  });

  it('rejects responsive intrinsic measurement invoked during mounted evaluation without reading patch signals', async () => {
    const lineHeight = signal(24);
    const read = vi.spyOn(lineHeight, 'get');
    let result: MeasureResult | undefined;
    function Scene() {
      result = measureElement(createElement(Text, { children: 'label', style: { when: [
        { query: { minWidth: 100 }, style: { lineHeight } },
      ] } }), { minWidth: 0, maxWidth: 700, minHeight: 0, maxHeight: 100 }, {
        measureText: () => ({ width: 20, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }) as TextMetrics,
      });
      return null;
    }
    mounts.push(pibbl(canvas(700), <Scene />, { pixelRatio: 1 }));
    await settle();
    expect(result).toMatchObject({ status: 'unsupported', reason: expect.stringContaining('PIBBL_STYLE_QUERY_MEASUREMENT') });
    expect(read).not.toHaveBeenCalled();
  });

});
