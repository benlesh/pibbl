import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { useSignal } from '../hooks/use-signal';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Group } from './g';
import { Polygon, type PolygonStyle } from './polygon';

const constraints = {
  minWidth: 0,
  maxWidth: 400,
  minHeight: 0,
  maxHeight: 200,
};

const measurement = {
  measureText: () => ({}) as TextMetrics,
};

const triangleStyle = {
  coords: [[40, 40], [160, 40], [100, 160]],
  fill: 'red',
} satisfies PolygonStyle;

function alphaAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
}

describe('Polygon', () => {
  it('resolves rounded lengths against the smaller percentage basis', () => {
    const resolve = getPrimitiveDefinition(Polygon)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => Record<string, unknown>;

    expect(resolve({
      coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
      cornerRadius: '25%',
      cornerRadii: [0, null, '50%', undefined],
    }, {
      allocation: { x: 0, y: 0, width: 200, height: 120 },
      percentageBasis: { x: 0, y: 0, width: 200, height: 120 },
      constraints,
      component: 'Polygon',
      algorithm: 'render-dispatch',
    })).toMatchObject({
      cornerRadius: 30,
      cornerRadii: [0, null, 60, undefined],
    });
  });

  it('renders and targets a filled triangle', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Polygon, {
      style: triangleStyle,
      onClick,
    }));

    expect(alphaAt(canvas.element, 100, 80)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 100, 24)).toBe(0);

    await canvas.click({ position: { x: 100, y: 80 } });
    await canvas.click({ position: { x: 100, y: 24 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('closes an open triangle for stroke rendering and edge hit testing', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Polygon, {
      style: {
        coords: [[40, 40], [160, 40], [100, 160]],
        stroke: 'blue',
        strokeWidth: 6,
        lineInteractionWidth: 16,
      },
      onClick,
    }));

    expect(alphaAt(canvas.element, 70, 100)).toBeGreaterThan(0);
    await canvas.click({ position: { x: 74, y: 100 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('updates polygon geometry', async () => {
    let move!: () => void;
    function Probe() {
      const offset = useSignal(0);
      move = () => offset.set(40);
      return createElement(Polygon, {
        style: {
          coords: [[40 + offset.get(), 40], [120 + offset.get(), 40], [80 + offset.get(), 120]],
          fill: 'red',
        },
      });
    }

    const canvas = await componentTest(createElement(Probe, {}));

    expect(alphaAt(canvas.element, 80, 70)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 120, 70)).toBe(0);

    move();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    expect(alphaAt(canvas.element, 80, 70)).toBe(0);
    expect(alphaAt(canvas.element, 120, 70)).toBeGreaterThan(0);
  });

  it('updates, replaces, and removes rounded-corner style', async () => {
    let advance!: () => void;
    function Probe() {
      const phase = useSignal(0);
      advance = () => phase.update(value => value + 1);
      const corners = phase.get() === 0 ? { cornerRadius: 12 } :
        phase.get() === 1 ? { cornerRadius: 12, cornerRadii: [0] } :
        {};
      return createElement(Polygon, {
        style: {
          coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
          fill: 'red',
          ...corners,
        },
      });
    }

    const canvas = await componentTest(createElement(Probe, {}));
    expect(alphaAt(canvas.element, 1, 1)).toBe(0);
    expect(alphaAt(canvas.element, 39, 1)).toBe(0);

    advance();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(alphaAt(canvas.element, 1, 1)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 39, 1)).toBe(0);

    advance();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(alphaAt(canvas.element, 1, 1)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 39, 1)).toBeGreaterThan(0);
  });

  it('uses rounded geometry for painting and coordinate targeting', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Polygon, {
      style: {
        coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
        cornerRadius: 10,
        fill: 'red',
      },
      onClick,
    }));

    expect(alphaAt(canvas.element, 1, 1)).toBe(0);
    expect(alphaAt(canvas.element, 20, 20)).toBeGreaterThan(0);
    await canvas.click({ position: { x: 1, y: 1 } });
    expect(onClick).not.toHaveBeenCalled();
    await canvas.click({ position: { x: 20, y: 20 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps rounded painting and interaction aligned through transforms', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, {
      style: { translateX: 50, translateY: 40 },
      children: [createElement(Polygon, {
        style: {
          coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
          cornerRadius: 10,
          fill: 'red',
        },
        onClick,
      })],
    }));

    expect(alphaAt(canvas.element, 51, 41)).toBe(0);
    expect(alphaAt(canvas.element, 70, 60)).toBeGreaterThan(0);
    await canvas.click({ position: { x: 51, y: 41 } });
    await canvas.click({ position: { x: 70, y: 60 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('derives keyboard bounds from points and honors an override', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Polygon, {
          style: { ...triangleStyle, cornerRadius: 20 },
          onClick: vi.fn(),
        }),
        createElement(Polygon, {
          style: {
            coords: [[200, 40], [260, 40], [230, 120]],
            fill: 'blue',
          },
          onClick: vi.fn(),
          keyboardNavigationBounds: override,
        }),
      ],
    }));
    const targets = Array.from(getCRCInstance(canvas.element).eventRoot.targets);

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        keyboardNavigationBounds: {
          x: 40,
          y: 40,
          width: 120,
          height: 120,
        },
      }),
      expect.objectContaining({
        keyboardNavigationBounds: override,
      }),
    ]));
  });

  it('leaves empty, one-point, and two-point polygons unpainted and uninteractive', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Polygon, {
          style: { coords: [], fill: 'red' },
          onClick,
        }),
        createElement(Polygon, {
          style: { coords: [[40, 40]], fill: 'red' },
          onClick,
        }),
        createElement(Polygon, {
          style: { coords: [[80, 40], [120, 80]], fill: 'red' },
          onClick,
        }),
      ],
    }));

    expect(alphaAt(canvas.element, 40, 40)).toBe(0);
    expect(alphaAt(canvas.element, 80, 40)).toBe(0);
    expect(alphaAt(canvas.element, 100, 60)).toBe(0);

    await canvas.click({ position: { x: 40, y: 40 } });
    await canvas.click({ position: { x: 80, y: 40 } });
    await canvas.click({ position: { x: 100, y: 60 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('rejects non-finite coordinates with a contextual diagnostic', () => {
    const resolve = getPrimitiveDefinition(Polygon)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;

    expect(() => resolve({
      coords: [[40, 40], [Number.NaN, 80], [100, 160]],
    }, {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Polygon',
      algorithm: 'render-dispatch',
    })).toThrow(LayoutDiagnostic);
    expect(() => resolve({
      coords: [[40, 40], [Number.NaN, 80], [100, 160]],
    }, {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Polygon',
      algorithm: 'render-dispatch',
    })).toThrow(/coords\[1]\[0]/);
  });

  it('rejects invalid rounded style with contextual indexed diagnostics', () => {
    const resolve = getPrimitiveDefinition(Polygon)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;
    const context = {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Polygon',
      algorithm: 'render-dispatch',
    };
    const coords = [[0, 0], [40, 0], [40, 40]];

    expect(() => resolve({ coords, cornerRadius: -1 }, context))
      .toThrow(LayoutDiagnostic);
    expect(() => resolve({ coords, cornerRadius: -1 }, context))
      .toThrow(/Polygon.*cornerRadius.*nonnegative/);
    expect(() => resolve({ coords, cornerRadii: [1, Number.NaN] }, context))
      .toThrow(/Polygon.*cornerRadii\[1\].*finite/);
    expect(() => resolve({ coords, cornerRadii: [1, 2, 3, null] }, context))
      .toThrow(/Polygon.*cornerRadii.*length.*3/);
  });

  it('does not infer intrinsic measurement from polygon geometry', () => {
    expect(measureElement(createElement(Polygon, {
      style: { coords: [[40, 40], [160, 40], [100, 160]] },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Polygon does not provide measurement',
    });
  });
});
