import { describe, expect, it, vi } from 'vitest';
import { Rectangle } from '../components/rect';
import { Text } from '../components/text';
import { crc } from '../crc';
import { useState } from '../hooks/use-state';
import { useLayoutBox } from '../hooks/use-layout-box';
import type { Length } from '../style/types';
import type { RectStyle } from '../style/types';
import { componentTest } from '../test-utils/component-test';
import type { SystemStyle } from '../types';
import type { CanvasMeasurementService } from './measure';
import { measureElement } from './measure';
import { Flow, layoutFlow } from './flow';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';

const service: CanvasMeasurementService = {
  measureText: value => ({ width: value.length * 10 } as TextMetrics),
};
const constraints = {
  minWidth: 0,
  maxWidth: 200,
  minHeight: 0,
  maxHeight: 100,
};
const measurement = {
  service,
  measureElement: (element: Parameters<typeof measureElement>[0], value: typeof constraints) =>
    measureElement(element, value, service),
};

describe('CRC-native flow geometry', () => {
  it('places literal horizontal wrapped lines in source order', () => {
    const children = [
      createElement(Rectangle, { style: { width: 40, height: 20 } }),
      createElement(Rectangle, { style: { width: 50, height: 30 } }),
      createElement(Rectangle, { style: { width: 30, height: 10 } }),
    ];

    expect(layoutFlow(
      { x: 0, y: 0, width: 100, height: 100 },
      children,
      { direction: 'horizontal', wrap: true, gap: 10, lineGap: 5 },
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 40, height: 20 },
      { x: 50, y: 0, width: 50, height: 30 },
      { x: 0, y: 35, width: 30, height: 10 },
    ]);
  });

  it('places literal vertical wrapped lines in source order', () => {
    const children = [
      createElement(Rectangle, { style: { width: 20, height: 30 } }),
      createElement(Rectangle, { style: { width: 30, height: 35 } }),
      createElement(Rectangle, { style: { width: 40, height: 20 } }),
    ];

    expect(layoutFlow(
      { x: 0, y: 0, width: 100, height: 70 },
      children,
      { direction: 'vertical', wrap: true, gap: 5, lineGap: 10 },
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 20, height: 30 },
      { x: 0, y: 35, width: 30, height: 35 },
      { x: 40, y: 0, width: 40, height: 20 },
    ]);
  });

  it('forwards cross-axis stretch size to paint, hit testing, and observation', async () => {
    interface ProbeStyle extends SystemStyle {
      width: number;
      height: number;
      alignSelf?: 'stretch';
    }
    const onClick = vi.fn();
    let observed: Readonly<{ x: number; y: number; width: number; height: number }>;
    const Probe = definePrimitive<{ onClick: () => void }, ProbeStyle>((props, style) => {
      observed = useLayoutBox();
      return createElement(Rectangle, {
        style: {
          width: style.width,
          height: style.height,
          fill: 'red',
        },
        onClick: props.onClick,
      });
    });
    const canvas = await componentTest(createElement(Flow, {
      style: { width: 100, height: 50 },
      children: [
        createElement(Probe, {
          style: { width: 10, height: 10, alignSelf: 'stretch' },
          onClick,
        }),
        createElement(Rectangle, { style: { width: 10, height: 20 } }),
      ],
    }), { width: 120, height: 70 });

    expect(observed!).toEqual({ x: 0, y: 0, width: 10, height: 20 });
    expect(canvas.element.getContext('2d')!
      .getImageData(5, 15, 1, 1).data[3]).toBe(255);
    await canvas.click({ position: { x: 5, y: 15 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('measures an auto-sized child exactly once', () => {
    interface AutoStyle extends SystemStyle {
      width?: Length;
      height?: Length;
    }
    interface ResolvedAutoStyle extends SystemStyle {
      width?: number;
      height?: number;
    }
    const measure = vi.fn(() => ({
      status: 'measured' as const,
      size: { width: 30, height: 10 },
    }));
    const Measured = definePrimitive<
      {},
      AutoStyle,
      AutoStyle,
      ResolvedAutoStyle
    >(() => undefined, {
      resolveStyle: () => ({}),
      measure,
    });

    expect(layoutFlow(
      { x: 0, y: 0, width: 100, height: 50 },
      [createElement(Measured, { style: { width: 'auto', height: 'auto' } })],
      {},
      measurement,
    )).toEqual([{ x: 0, y: 0, width: 30, height: 10 }]);
    expect(measure).toHaveBeenCalledOnce();
  });

  it('measures nested auto flows recursively without rendering', () => {
    let renders = 0;
    const Leaf = definePrimitive<
      {},
      SystemStyle & { width?: Length; height?: Length },
      SystemStyle & { width?: Length; height?: Length },
      SystemStyle & { width?: number; height?: number }
    >(
      () => { renders++; },
      {
        resolveStyle: () => ({}),
        measure: () => ({
          status: 'measured',
          size: { width: 30, height: 10 },
        }),
      },
    );
    const nested = createElement(Flow, {
      style: { width: 'auto', height: 'auto', gap: 5 },
      children: [
        createElement(Leaf, { style: { width: 'auto', height: 'auto' } }),
        createElement(Leaf, { style: { width: 'auto', height: 'auto' } }),
      ],
    });

    expect(measureElement(nested, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 65, height: 10 },
    });
    expect(renders).toBe(0);
  });

  it('returns definite content size without consuming children or own padding', () => {
    const measure = vi.fn(() => ({
      status: 'measured' as const,
      size: { width: 1, height: 1 },
    }));
    const Child = definePrimitive<
      {},
      SystemStyle & { width?: Length; height?: Length },
      SystemStyle & { width?: Length; height?: Length },
      SystemStyle & { width?: number; height?: number }
    >(() => undefined, { resolveStyle: () => ({}), measure });
    const definite = createElement(Flow, {
      style: { width: 40, height: 20, padding: 5 },
      children: [createElement(Child, { style: { width: 'auto', height: 'auto' } })],
    });

    expect(measureElement(definite, {
      minWidth: 0,
      maxWidth: Number.POSITIVE_INFINITY,
      minHeight: 0,
      maxHeight: Number.POSITIVE_INFINITY,
    }, service)).toEqual({
      status: 'measured',
      size: { width: 40, height: 20 },
    });
    expect(measure).not.toHaveBeenCalled();
  });

  it.each([200, Number.POSITIVE_INFINITY])(
    'keeps nested auto flow measurement as content under max %s',
    maxWidth => {
      const nested = createElement(Flow, {
        style: { width: 'auto', height: 'auto', padding: 5 },
        children: [createElement(Rectangle, { style: { width: 30, height: 10 } })],
      });
      const result = measureElement(nested, {
        minWidth: 0,
        maxWidth,
        minHeight: 0,
        maxHeight: maxWidth,
      }, service);

      expect(result).toEqual({
        status: 'measured',
        size: { width: 30, height: 10 },
      });
      expect(layoutFlow(
        { x: 0, y: 0, width: 100, height: 50 },
        [nested],
        {},
        measurement,
      )).toEqual([{ x: 0, y: 0, width: 40, height: 20 }]);
    },
  );

  it('normalizes a measured child once and renders the used normalized style', async () => {
    interface SpecifiedProbeStyle extends SystemStyle {
      token: 'specified';
    }
    interface NormalizedProbeStyle extends SystemStyle {
      token: 'normalized';
      width: 'auto' | number;
      height: 'auto' | number;
    }
    interface ResolvedProbeStyle extends SystemStyle {
      token: 'normalized';
      width: number;
      height: number;
    }
    const normalizeStyle = vi.fn((): NormalizedProbeStyle => ({
      token: 'normalized',
      width: 'auto',
      height: 'auto',
    }));
    const render = vi.fn((_props: {}, style: Readonly<ResolvedProbeStyle>) => {
      expect(style).toEqual({
        token: 'normalized',
        width: 30,
        height: 10,
      });
    });
    const Probe = definePrimitive<
      {},
      SpecifiedProbeStyle,
      NormalizedProbeStyle,
      ResolvedProbeStyle
    >(render, {
      normalizeStyle,
      resolveStyle: style => ({
        token: style.token,
        width: style.width as number,
        height: style.height as number,
      }),
      measure: () => ({
        status: 'measured',
        size: { width: 30, height: 10 },
      }),
    });
    const specified = Object.freeze({ token: 'specified' as const });
    const child = createElement(Probe, { style: specified });

    await componentTest(createElement(Flow, {
      style: { width: 100, height: 50 },
      children: [child],
    }));

    expect(normalizeStyle).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(child.props.style).toBe(specified);
  });

  it('uses measured auto dimensions for both placement and child rendering', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Flow, {
      style: { width: 30, height: 50 },
      children: [createElement(Text, {
        style: {
          font: '10px sans-serif',
          lineHeight: 12,
          wrap: true,
          fill: 'red',
        },
        onClick,
      }, 'aaaa bbbb')],
    }), { width: 30, height: 50 });
    const context = canvas.element.getContext('2d')!;
    const fillText = vi.spyOn(context, 'fillText');

    crc(canvas.element, createElement(Flow, {
      style: { width: 30, height: 50 },
      children: [createElement(Text, {
        style: {
          font: '10px sans-serif',
          lineHeight: 12,
          wrap: true,
          fill: 'red',
        },
        onClick,
      }, 'aaaa bbbb')],
    }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    expect(fillText).toHaveBeenCalledTimes(2);
    await canvas.click({ position: { x: 5, y: 6 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    ['start', { x: 0, y: 0, width: 10, height: 10 }],
    ['center', { x: 0, y: 5, width: 10, height: 10 }],
    ['end', { x: 0, y: 10, width: 10, height: 10 }],
    ['stretch', { x: 0, y: 0, width: 10, height: 20 }],
  ] as const)('applies %s cross-axis alignment', (alignItems, expected) => {
    const placements = layoutFlow(
      { x: 0, y: 0, width: 100, height: 50 },
      [
        createElement(Rectangle, { style: { width: 10, height: 10 } }),
        createElement(Rectangle, { style: { width: 10, height: 20 } }),
      ],
      { alignItems },
      measurement,
    );
    expect(placements[0]).toEqual(expected);
  });

  it('handles empty, falsy, and oversized wrapped children deterministically', () => {
    expect(layoutFlow(
      { x: 0, y: 0, width: 50, height: 50 },
      [undefined, false, null, '', 0],
      {},
      measurement,
    )).toEqual([]);
    expect(layoutFlow(
      { x: 0, y: 0, width: 50, height: 50 },
      [
        createElement(Rectangle, { style: { width: 80, height: 10 } }),
        createElement(Rectangle, { style: { width: 10, height: 10 } }),
      ],
      { wrap: true, lineGap: 4 },
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 80, height: 10 },
      { x: 0, y: 14, width: 10, height: 10 },
    ]);
  });

  it('clips paint and hit testing to the flow content box', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Flow, {
      style: { width: 100, height: 30, overflow: 'clip' },
      children: [createElement(Rectangle, {
        style: { width: 160, height: 20, fill: 'red' },
        onClick,
      })],
    }), { width: 180, height: 50 });

    expect(canvas.element.getContext('2d')!
      .getImageData(90, 10, 1, 1).data[3]).toBe(255);
    expect(canvas.element.getContext('2d')!
      .getImageData(120, 10, 1, 1).data[3]).toBe(0);
    await canvas.click({ position: { x: 90, y: 10 } });
    await canvas.click({ position: { x: 120, y: 10 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('preserves unkeyed child identity across keyed reflow siblings', async () => {
    let nextIdentity = 0;
    const observations = new Map<string, number>();
    const Item = ({ label }: { label: string } & { style: Readonly<SystemStyle & { width: number; height: number }> }) => {
      const [identity] = useState(++nextIdentity);
      observations.set(label, identity);
    };
    const Host = ({ keyed }: { keyed: boolean }) => createElement(Flow, {
      style: { width: 100, height: 30 },
      children: [
        keyed && createElement(Item, {
          key: 'keyed',
          label: 'keyed',
          style: { width: 20, height: 10 },
        }),
        createElement(Item, {
          label: 'unkeyed',
          style: { width: 20, height: 10 },
        }),
      ],
    });
    const canvas = await componentTest(createElement(Host, { keyed: false }));
    const identity = observations.get('unkeyed');

    crc(canvas.element, createElement(Host, { keyed: true }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    crc(canvas.element, createElement(Host, { keyed: false }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(observations.get('unkeyed')).toBe(identity);
  });

  it('bypasses measurement for definite percentage boxes', () => {
    const measure = vi.fn(() => ({
      status: 'measured' as const,
      size: { width: 1, height: 1 },
    }));
    interface ResolvedRectProbeStyle extends SystemStyle {
      width: number;
      height: number;
    }
    const MeasuredRect = definePrimitive<
      {},
      RectStyle,
      RectStyle,
      ResolvedRectProbeStyle
    >(() => undefined, {
      resolveStyle: () => ({ width: 50, height: 20 }),
      measure,
    });

    expect(layoutFlow(
      { x: 0, y: 0, width: 200, height: 100 },
      [createElement(MeasuredRect, { style: { width: '25%', height: 20 } })],
      {},
      measurement,
    )).toEqual([{ x: 0, y: 0, width: 50, height: 20 }]);
    expect(measure).not.toHaveBeenCalled();
  });

  it('names the child and unresolved axis when measurement is unsupported', () => {
    interface AutoStyle extends SystemStyle {
      width?: Length;
      height?: Length;
    }
    interface ResolvedAutoStyle extends SystemStyle {}
    function UnsupportedComponent() {}
    const Unsupported = definePrimitive<
      {},
      AutoStyle,
      AutoStyle,
      ResolvedAutoStyle
    >(UnsupportedComponent, { resolveStyle: () => ({}) });

    expect(() => layoutFlow(
      { x: 0, y: 0, width: 100, height: 50 },
      [createElement(Unsupported, { style: { width: 'auto', height: 20 } })],
      {},
      measurement,
    )).toThrowError(/UnsupportedComponent.*width.*measurement/i);
  });

  it.each([
    [{ gap: -1 }, 'gap'],
    [{ lineGap: Number.NaN }, 'lineGap'],
    [{ direction: 'diagonal' as any }, 'direction'],
  ])('rejects invalid flow option %s', (style, property) => {
    expect(() => layoutFlow(
      { x: 0, y: 0, width: 100, height: 50 },
      [],
      style,
      measurement,
    )).toThrowError(new RegExp(property));
  });

  // @ts-expect-error flow direction uses CRC-native values
  void createElement(Flow, { style: { direction: 'row' }, children: [] });
});
