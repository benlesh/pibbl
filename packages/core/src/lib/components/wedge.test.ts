import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Group } from './g';
import { Wedge } from './wedge';

const constraints = {
  minWidth: 0,
  maxWidth: 400,
  minHeight: 0,
  maxHeight: 200,
};
const measurement = { measureText: () => ({}) as TextMetrics };
const fullTurn = Math.PI * 2;

function alphaAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
}

describe('Wedge', () => {
  it('targets its filled interior and not the area outside the partial wedge', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Wedge, {
      style: {
        cx: 80,
        cy: 80,
        radius: 50,
        startAngle: 0,
        endAngle: Math.PI / 2,
        fill: 'red',
      },
      onClick,
    }));

    expect(alphaAt(canvas.element, 100, 100)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 60, 60)).toBe(0);
    await canvas.click({ position: { x: 100, y: 100 } });
    await canvas.click({ position: { x: 60, y: 60 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('targets the radial edges through stroke interaction width', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Wedge, {
      style: {
        cx: 80,
        cy: 80,
        radius: 50,
        startAngle: 0,
        endAngle: Math.PI / 2,
        stroke: 'blue',
        strokeWidth: 2,
        lineInteractionWidth: 16,
      },
      onClick,
    }));

    await canvas.click({ position: { x: 105, y: 86 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('follows clockwise and counterclockwise sweeps', async () => {
    const canvas = await componentTest(createElement(Group, { children: [
      createElement(Wedge, {
        style: {
          cx: 70,
          cy: 70,
          radius: 45,
          startAngle: 0,
          endAngle: Math.PI / 2,
          fill: 'red',
        },
      }),
      createElement(Wedge, {
        style: {
          cx: 190,
          cy: 70,
          radius: 45,
          startAngle: 0,
          endAngle: Math.PI / 2,
          counterclockwise: true,
          fill: 'blue',
        },
      }),
    ] }));

    expect(alphaAt(canvas.element, 90, 90)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 50, 50)).toBe(0);
    expect(alphaAt(canvas.element, 170, 50)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 210, 90)).toBe(0);
  });

  it('resolves percentages and rejects invalid radius and angles', () => {
    const resolve = getPrimitiveDefinition(Wedge)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;
    const context = {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Wedge',
      algorithm: 'render-dispatch',
    };

    expect(resolve({
      cx: '50%', cy: '50%', radius: '25%', startAngle: 0, endAngle: 1,
    }, context)).toMatchObject({
      cx: 200, cy: 100, radius: 50, startAngle: 0, endAngle: 1,
      counterclockwise: false,
    });
    expect(() => resolve({ radius: -1, startAngle: 0, endAngle: 1 }, context))
      .toThrow(LayoutDiagnostic);
    expect(() => resolve({ radius: 1, startAngle: NaN, endAngle: 1 }, context))
      .toThrow(LayoutDiagnostic);
    expect(() => resolve({ radius: 1, startAngle: 0, endAngle: Infinity }, context))
      .toThrow(LayoutDiagnostic);
  });

  it('includes the center in default keyboard bounds', async () => {
    const canvas = await componentTest(createElement(Wedge, {
      style: {
        cx: 100,
        cy: 80,
        radius: 40,
        startAngle: -Math.PI / 4,
        endAngle: Math.PI / 4,
        fill: 'red',
      },
      onClick: vi.fn(),
    }));
    const bounds = [...getCRCInstance(canvas.element).eventRoot.targets][0]
      .keyboardNavigationBounds!;

    expect(bounds.x).toBe(100);
    expect(bounds.y).toBeCloseTo(80 - Math.SQRT1_2 * 40);
    expect(bounds.width).toBe(40);
    expect(bounds.height).toBeCloseTo(Math.SQRT1_2 * 80);
  });

  it('uses empty geometry for zero radius, zero span, and opposite-direction turns', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, { children: [
      createElement(Wedge, {
        style: {
          cx: 40, cy: 40, radius: 0, startAngle: 0, endAngle: Math.PI,
          fill: 'red',
        },
        onClick,
      }),
      createElement(Wedge, {
        style: {
          cx: 100, cy: 40, radius: 20, startAngle: 1, endAngle: 1,
          fill: 'red',
        },
        onClick,
      }),
      createElement(Wedge, {
        style: {
          cx: 160, cy: 40, radius: 20, startAngle: 0,
          endAngle: fullTurn, counterclockwise: true, fill: 'red',
        },
        onClick,
      }),
    ] }));

    expect(alphaAt(canvas.element, 40, 40)).toBe(0);
    expect(alphaAt(canvas.element, 100, 40)).toBe(0);
    expect(alphaAt(canvas.element, 160, 40)).toBe(0);
    await canvas.click({ position: { x: 160, y: 40 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fills direction-matching full circles in either direction', async () => {
    const canvas = await componentTest(createElement(Group, { children: [
      createElement(Wedge, {
        style: {
          cx: 60, cy: 60, radius: 30, startAngle: 0, endAngle: fullTurn,
          fill: 'red',
        },
      }),
      createElement(Wedge, {
        style: {
          cx: 140, cy: 60, radius: 30, startAngle: fullTurn, endAngle: 0,
          counterclockwise: true, fill: 'blue',
        },
      }),
    ] }));

    expect(alphaAt(canvas.element, 60, 60)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 140, 60)).toBeGreaterThan(0);
  });

  it('strokes a full circle without a center or radial seam', async () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const arc = vi.spyOn(Path2D.prototype, 'arc');

    const canvas = await componentTest(createElement(Wedge, {
      style: {
        cx: 80,
        cy: 80,
        radius: 40,
        startAngle: 0,
        endAngle: fullTurn,
        stroke: 'red',
        strokeWidth: 4,
      },
    }));

    expect(moveTo).not.toHaveBeenCalled();
    expect(lineTo).not.toHaveBeenCalled();
    expect(arc).toHaveBeenCalledWith(80, 80, 40, 0, fullTurn, false);
    expect(alphaAt(canvas.element, 80, 80)).toBe(0);
    vi.restoreAllMocks();
  });

  it('honors an explicit keyboard-navigation bounds override', async () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Wedge, {
      style: {
        cx: 80, cy: 80, radius: 40, startAngle: 0,
        endAngle: Math.PI / 2, fill: 'red',
      },
      onClick: vi.fn(),
      keyboardNavigationBounds: bounds,
    }));

    expect([...getCRCInstance(canvas.element).eventRoot.targets][0]
      .keyboardNavigationBounds).toEqual(bounds);
  });

  it('does not infer intrinsic measurement from wedge geometry', () => {
    expect(measureElement(createElement(Wedge, {
      style: { radius: 20, startAngle: 0, endAngle: Math.PI },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Wedge does not provide measurement',
    });
  });
});
