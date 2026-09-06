import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { crcState } from '../hooks/crc-state';
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
      const [offset, setOffset] = crcState(0);
      move = () => setOffset(40);
      return createElement(Polygon, {
        style: {
          coords: [[40 + offset, 40], [120 + offset, 40], [80 + offset, 120]],
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

  it('derives keyboard bounds from points and honors an override', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Polygon, {
          style: triangleStyle,
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

  it('does not infer intrinsic measurement from polygon geometry', () => {
    expect(measureElement(createElement(Polygon, {
      style: { coords: [[40, 40], [160, 40], [100, 160]] },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Polygon does not provide measurement',
    });
  });
});
