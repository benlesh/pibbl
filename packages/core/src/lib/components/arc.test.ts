import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getPibblInstance } from '../global-state';
import { useSignal } from '../hooks/use-signal';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Arc, type ArcStyle } from './arc';
import { Clip } from './clip';
import { Group } from './g';

const constraints = {
  minWidth: 0,
  maxWidth: 400,
  minHeight: 0,
  maxHeight: 200,
};
const measurement = { measureText: () => ({}) as TextMetrics };

function alphaAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
}

describe('Arc', () => {
  it('resolves numeric and percentage geometry with a circular radius basis', () => {
    const resolve = getPrimitiveDefinition(Arc)!.resolveStyle! as (
      style: {
        cx: string;
        cy: string;
        radius: string;
        startAngle: number;
        endAngle: number;
        counterclockwise?: boolean;
      },
      context: object,
    ) => object;

    expect(resolve({
      cx: '50%',
      cy: '50%',
      radius: '25%',
      startAngle: Math.PI / 4,
      endAngle: Math.PI,
      counterclockwise: true,
    }, {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Arc',
      algorithm: 'render-dispatch',
    })).toMatchObject({
      cx: 200,
      cy: 100,
      radius: 50,
      startAngle: Math.PI / 4,
      endAngle: Math.PI,
      counterclockwise: true,
    });
  });

  it('uses radians and the requested direction', async () => {
    const canvas = await componentTest(createElement(Arc, {
      style: {
        cx: 80,
        cy: 80,
        radius: 40,
        startAngle: 0,
        endAngle: Math.PI / 2,
        counterclockwise: true,
        stroke: 'red',
        strokeWidth: 6,
      },
    }));

    expect(alphaAt(canvas.element, 40, 80)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 80, 40)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 80, 120)).toBe(0);
  });

  it('defaults center and direction and remains stroke-only at runtime and in types', async () => {
    const style: ArcStyle = {
      radius: 30,
      startAngle: 0,
      endAngle: Math.PI * 2,
      // @ts-expect-error ArcStyle deliberately excludes fill.
      fill: 'red',
    };
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Arc, {
      style,
      onClick,
    }));

    expect(alphaAt(canvas.element, 0, 0)).toBe(0);
    await canvas.click({ position: { x: 0, y: 0 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses empty geometry for zero radius, zero span, and opposite-direction full turns', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, { children: [
      createElement(Arc, {
        style: {
          cx: 40, cy: 40, radius: 0, startAngle: 0, endAngle: Math.PI,
          stroke: 'red', strokeWidth: 8,
        },
        onClick,
      }),
      createElement(Arc, {
        style: {
          cx: 100, cy: 40, radius: 20, startAngle: 1, endAngle: 1,
          stroke: 'red', strokeWidth: 8,
        },
        onClick,
      }),
      createElement(Arc, {
        style: {
          cx: 160, cy: 40, radius: 20, startAngle: 0,
          endAngle: -Math.PI * 2, stroke: 'red', strokeWidth: 8,
        },
        onClick,
      }),
    ] }));

    expect(alphaAt(canvas.element, 40, 40)).toBe(0);
    expect(alphaAt(canvas.element, 120, 40)).toBe(0);
    expect(alphaAt(canvas.element, 180, 40)).toBe(0);
    await canvas.click({ position: { x: 120, y: 40 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('rejects negative radii and non-finite geometry with layout diagnostics', () => {
    const resolve = getPrimitiveDefinition(Arc)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;
    const context = {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Arc',
      algorithm: 'render-dispatch',
    };
    const valid = { radius: 10, startAngle: 0, endAngle: 1 };

    expect(() => resolve({ ...valid, radius: -1 }, context))
      .toThrow(LayoutDiagnostic);
    expect(() => resolve({ ...valid, radius: Number.NaN }, context))
      .toThrow(LayoutDiagnostic);
    expect(() => resolve({ ...valid, startAngle: Infinity }, context))
      .toThrow(LayoutDiagnostic);
    expect(() => resolve({ ...valid, endAngle: Number.NaN }, context))
      .toThrow(LayoutDiagnostic);
  });

  it('uses lineInteractionWidth for expanded stroke targeting', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Arc, {
      style: {
        cx: 80,
        cy: 80,
        radius: 40,
        startAngle: 0,
        endAngle: Math.PI,
        stroke: 'red',
        strokeWidth: 2,
        lineInteractionWidth: 20,
      },
      onClick,
    }));

    await canvas.click({ position: { x: 80, y: 128 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('supplies tight default keyboard bounds and honors a caller override', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, { children: [
      createElement(Arc, {
        style: {
          cx: 100,
          cy: 80,
          radius: 40,
          startAngle: -Math.PI / 4,
          endAngle: Math.PI / 4,
          stroke: 'red',
          strokeWidth: 4,
        },
        onClick: vi.fn(),
      }),
      createElement(Arc, {
        style: {
          cx: 200,
          cy: 80,
          radius: 40,
          startAngle: 0,
          endAngle: Math.PI,
          stroke: 'red',
          strokeWidth: 4,
        },
        onClick: vi.fn(),
        keyboardNavigationBounds: override,
      }),
    ] }));
    const targets = [...getPibblInstance(canvas.element).eventRoot.targets];

    expect(targets[0].keyboardNavigationBounds!.x)
      .toBeCloseTo(100 + Math.SQRT1_2 * 40);
    expect(targets[0].keyboardNavigationBounds!.y)
      .toBeCloseTo(80 - Math.SQRT1_2 * 40);
    expect(targets[0].keyboardNavigationBounds!.width)
      .toBeCloseTo(40 - Math.SQRT1_2 * 40);
    expect(targets[0].keyboardNavigationBounds!.height)
      .toBeCloseTo(Math.SQRT1_2 * 80);
    expect(targets[1].keyboardNavigationBounds).toEqual(override);
  });

  it('updates arc geometry', async () => {
    let move!: () => void;
    function Probe() {
      const cx = useSignal(50);
      move = () => cx.set(130);
      return createElement(Arc, {
        style: {
          cx: cx.get(), cy: 50, radius: 20, startAngle: 0, endAngle: Math.PI * 2,
          stroke: 'red', strokeWidth: 6,
        },
      });
    }
    const canvas = await componentTest(createElement(Probe, {}));

    expect(alphaAt(canvas.element, 70, 50)).toBeGreaterThan(0);
    move();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(alphaAt(canvas.element, 70, 50)).toBe(0);
    expect(alphaAt(canvas.element, 150, 50)).toBeGreaterThan(0);
  });

  it('keeps transformed interaction aligned with clipping', async () => {
    const clip = new Path2D();
    clip.rect(0, 0, 100, 60);
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, {
      style: { translateX: 50, translateY: 20 },
      children: [createElement(Clip, {
        style: { d: clip },
        children: createElement(Arc, {
          style: {
            cx: 50, cy: 50, radius: 30, startAngle: 0,
            endAngle: Math.PI * 2, stroke: 'red', strokeWidth: 8,
          },
          onClick,
        }),
      })],
    }));

    expect(alphaAt(canvas.element, 130, 70)).toBeGreaterThan(0);
    expect(alphaAt(canvas.element, 100, 100)).toBe(0);
    await canvas.click({ position: { x: 130, y: 70 } });
    await canvas.click({ position: { x: 100, y: 100 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not infer intrinsic measurement from arc geometry', () => {
    expect(measureElement(createElement(Arc, {
      style: { radius: 20, startAngle: 0, endAngle: Math.PI },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Arc does not provide measurement',
    });
  });
});
