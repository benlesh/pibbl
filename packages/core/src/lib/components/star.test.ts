import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { jsx } from '../element/jsx-runtime';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { useSignal } from '../hooks/use-signal';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Circle } from './circle';
import { Group } from './g';
import { Star, type StarProps, type StarStyle } from './star';

const constraints = {
  minWidth: 0,
  maxWidth: 240,
  minHeight: 0,
  maxHeight: 120,
};

const resolutionContext = {
  allocation: { x: 0, y: 0, width: 240, height: 120 },
  percentageBasis: { x: 0, y: 0, width: 240, height: 120 },
  constraints,
  component: 'Star',
  algorithm: 'render-dispatch',
};

const measurement = {
  measureText: () => ({}) as TextMetrics,
};

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

describe('Star', () => {
  it('constructs childless JSX-lowered and createElement drawing leaves', () => {
    const style = {
      points: 5,
      outerRadius: 20,
      innerRadius: 8,
      fill: 'red',
    } satisfies StarStyle;
    const props: StarProps = { onClick: () => undefined };
    const direct = createElement(Star, { ...props, style });
    const lowered = jsx(Star, { ...props, style });

    expect(direct.type).toBe(Star);
    expect(lowered.type).toBe(Star);
    expect(direct.props.style).toBe(style);
    expect(lowered.props.style).toBe(style);

    // @ts-expect-error Star is a drawing leaf and rejects children
    createElement(Star, { style }, 'bad');
    // @ts-expect-error Star requires both radii
    createElement(Star, { style: { points: 5, outerRadius: 20 } });
  });

  it('resolves centers by axis and radii and corners against the smaller basis', () => {
    const resolve = getPrimitiveDefinition(Star)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => Record<string, unknown>;

    expect(resolve({
      width: 200,
      height: 120,
      points: 6,
      cx: '50%',
      cy: '50%',
      outerRadius: '40%',
      innerRadius: '20%',
      cornerRadius: '5%',
      cornerRadii: [2, 0, null, '10%'],
      fill: '#fc0',
    }, resolutionContext)).toMatchObject({
      points: 6,
      cx: 120,
      cy: 60,
      rotation: -Math.PI / 2,
      outerRadius: 48,
      innerRadius: 24,
      cornerRadius: 6,
      cornerRadii: [2, 0, null, 12],
      fill: '#fc0',
    });
  });

  it('uses default and explicit rotations for its alternating-radius paint geometry', async () => {
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Star, {
          style: {
            points: 5,
            cx: 60,
            cy: 60,
            outerRadius: 40,
            innerRadius: 16,
            fill: 'red',
          },
        }),
        createElement(Star, {
          style: {
            points: 5,
            cx: 180,
            cy: 60,
            outerRadius: 40,
            innerRadius: 16,
            rotation: 0,
            fill: 'blue',
          },
        }),
      ],
    }));

    expect(pixelAt(canvas.element, 60, 25)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 60, 100)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 215, 60)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 180, 20)).toEqual([0, 0, 0, 0]);
  });

  it('shares paint, cursor, and widened line interaction geometry', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Star, {
      style: {
        points: 4,
        cx: 60,
        cy: 60,
        outerRadius: 40,
        innerRadius: 18,
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 2,
        opacity: 0.5,
        cursor: 'pointer',
        lineInteractionWidth: 12,
      },
      onClick,
    }));

    expect(pixelAt(canvas.element, 60, 60)).toEqual([255, 0, 0, 128]);
    expect(pixelAt(canvas.element, 60, 21)[2]).toBeGreaterThan(0);
    await canvas.click({ position: { x: 68, y: 30 } });
    expect(onClick).toHaveBeenCalledOnce();
    await canvas.mouseMove({ position: { x: 68, y: 30 } });
    expect(canvas.element.style.cursor).toBe('pointer');
  });

  it('uses rounded geometry for paint, targeting, and transforms', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, {
      style: { translateX: 50, translateY: 40 },
      children: [createElement(Star, {
        style: {
          points: 5,
          cx: 30,
          cy: 30,
          outerRadius: 30,
          innerRadius: 12,
          cornerRadius: 4,
          fill: 'red',
        },
        onClick,
      })],
    }));

    expect(pixelAt(canvas.element, 80, 70)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 92, 45)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 30, y: 30 } });
    await canvas.click({ position: { x: 80, y: 70 } });
    await canvas.click({ position: { x: 92, y: 45 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses generated extrema for keyboard bounds and honors an override', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Star, {
          style: {
            points: 4,
            cx: 60,
            cy: 50,
            outerRadius: 20,
            innerRadius: 8,
            fill: 'red',
          },
          onClick: vi.fn(),
        }),
        createElement(Star, {
          style: {
            points: 5,
            cx: 160,
            cy: 50,
            outerRadius: 20,
            innerRadius: 8,
            fill: 'blue',
          },
          onClick: vi.fn(),
          keyboardNavigationBounds: override,
        }),
      ],
    }));
    const targets = Array.from(getCRCInstance(canvas.element).eventRoot.targets);

    expect(targets[0].keyboardNavigationBounds).toEqual({
      x: 40,
      y: 30,
      width: 40,
      height: 40,
    });
    expect(targets[1].keyboardNavigationBounds).toBe(override);
  });

  it('keeps zero-radius generated-extrema bounds while an explicit override wins', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(Star, {
          style: {
            points: 5,
            cx: 60,
            cy: 50,
            outerRadius: 20,
            innerRadius: 0,
            fill: 'red',
          },
          onClick: vi.fn(),
        }),
        createElement(Star, {
          style: {
            points: 5,
            cx: 160,
            cy: 50,
            outerRadius: 20,
            innerRadius: 0,
            fill: 'blue',
          },
          onClick: vi.fn(),
          keyboardNavigationBounds: override,
        }),
      ],
    }));
    const targets = Array.from(getCRCInstance(canvas.element).eventRoot.targets);

    expect(targets[0].keyboardNavigationBounds!.x)
      .toBeCloseTo(60 - 20 * Math.cos(Math.PI / 10), 10);
    expect(targets[0].keyboardNavigationBounds!.y).toBe(30);
    expect(targets[0].keyboardNavigationBounds!.width)
      .toBeCloseTo(40 * Math.cos(Math.PI / 10), 10);
    expect(targets[0].keyboardNavigationBounds!.height)
      .toBeCloseTo(20 + 20 * Math.sin((3 * Math.PI) / 10), 10);
    expect(targets[1].keyboardNavigationBounds).toBe(override);
  });

  it('updates geometry, then replaces and removes the drawing leaf', async () => {
    let advance!: () => void;
    const onClick = vi.fn();
    function Probe() {
      const phase = useSignal(0);
      advance = () => phase.update(value => value + 1);
      if (phase.get() === 0) {
        return createElement(Star, {
          style: {
            points: 5,
            cx: 40,
            cy: 40,
            outerRadius: 20,
            innerRadius: 8,
            fill: 'red',
          },
          onClick,
        });
      }
      if (phase.get() === 1) {
        return createElement(Star, {
          style: {
            points: 6,
            cx: 100,
            cy: 40,
            outerRadius: 20,
            innerRadius: 10,
            cornerRadii: [3, 0],
            fill: 'blue',
          },
          onClick,
        });
      }
      if (phase.get() === 2) {
        return createElement(Circle, {
          style: { cx: 160, cy: 40, radius: 10, fill: 'green' },
          onClick,
        });
      }
      return undefined;
    }
    const canvas = await componentTest(createElement(Probe, {}));

    expect(pixelAt(canvas.element, 40, 40)[3]).toBeGreaterThan(0);
    advance();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(pixelAt(canvas.element, 40, 40)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 100, 40)).toEqual([0, 0, 255, 255]);

    advance();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(pixelAt(canvas.element, 100, 40)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 160, 40)).toEqual([0, 128, 0, 255]);

    advance();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(pixelAt(canvas.element, 160, 40)).toEqual([0, 0, 0, 0]);
    expect(getCRCInstance(canvas.element).eventRoot.targets.size).toBe(0);
  });

  it('rejects count, radius, rotation, and corner failures contextually', () => {
    const resolve = getPrimitiveDefinition(Star)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;
    const invalid: readonly [Record<string, unknown>, RegExp][] = [
      [{ points: 2, outerRadius: 10, innerRadius: 5 }, /Star.*points.*at least 3/],
      [{ points: 3.5, outerRadius: 10, innerRadius: 5 }, /Star.*points.*integer/],
      [{ points: 5, outerRadius: -1, innerRadius: 0 }, /Star.*outerRadius.*nonnegative/],
      [{ points: 5, outerRadius: 10, innerRadius: -1 }, /Star.*innerRadius.*nonnegative/],
      [{ points: 5, outerRadius: 10, innerRadius: 5, rotation: Number.NaN }, /Star.*rotation.*finite/],
      [{ points: 5, outerRadius: 10, innerRadius: 5, cornerRadius: -1 }, /Star.*cornerRadius.*nonnegative/],
      [{ points: 5, outerRadius: 10, innerRadius: 5, cornerRadii: [0, Number.NaN] }, /Star.*cornerRadii\[1\].*finite/],
      [{
        points: 5,
        outerRadius: 10,
        innerRadius: 5,
        cornerRadii: Array.from({ length: 11 }, () => 0),
      }, /Star.*cornerRadii.*length.*10/],
    ];

    for (const [style, expected] of invalid) {
      expect(() => resolve(style, resolutionContext)).toThrow(LayoutDiagnostic);
      expect(() => resolve(style, resolutionContext)).toThrow(expected);
    }
  });

  it('rejects inner radius greater than outer radius contextually', () => {
    const definition = getPrimitiveDefinition(Star)!;
    const resolve = definition.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;
    const render = definition.program as (
      props: object,
      style: object,
      context: CanvasRenderingContext2D,
    ) => void;
    const context = document.createElement('canvas').getContext('2d')!;
    const resolved = resolve({
      points: 5,
      outerRadius: 8,
      innerRadius: 9,
    }, resolutionContext);

    expect(() => render({}, resolved, context)).toThrow(LayoutDiagnostic);
    expect(() => render({}, resolved, context))
      .toThrow(/Star.*innerRadius.*outerRadius/);
  });

  it('does not infer intrinsic measurement from star geometry', () => {
    expect(measureElement(createElement(Star, {
      style: { points: 6, outerRadius: 20, innerRadius: 8 },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Star does not provide measurement',
    });
  });
});
