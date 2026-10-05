import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { jsx } from '../element/jsx-runtime';
import { getPrimitiveDefinition } from '../element/metadata';
import { getPibblInstance } from '../global-state';
import { useSignal } from '../hooks/use-signal';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Circle } from './circle';
import { Group } from './g';
import {
  RegularPolygon,
  type RegularPolygonProps,
  type RegularPolygonStyle,
} from './regular-polygon';

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
  component: 'RegularPolygon',
  algorithm: 'render-dispatch',
};

const measurement = {
  measureText: () => ({}) as TextMetrics,
};

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

describe('RegularPolygon', () => {
  it('constructs childless JSX-lowered and createElement drawing leaves', () => {
    const style = {
      sides: 6,
      sideLength: 20,
      fill: 'red',
    } satisfies RegularPolygonStyle;
    const props: RegularPolygonProps = { onClick: () => undefined };
    const direct = createElement(RegularPolygon, { ...props, style });
    const lowered = jsx(RegularPolygon, { ...props, style });

    expect(direct.type).toBe(RegularPolygon);
    expect(lowered.type).toBe(RegularPolygon);
    expect(direct.props.style).toBe(style);
    expect(lowered.props.style).toBe(style);

    // @ts-expect-error RegularPolygon is a drawing leaf and rejects children
    createElement(RegularPolygon, { style }, 'bad');
    // @ts-expect-error RegularPolygon requires exactly one size field
    createElement(RegularPolygon, { style: { sides: 6 } });
    createElement(RegularPolygon, {
      // @ts-expect-error RegularPolygon size fields are mutually exclusive
      style: { sides: 6, circumradius: 20, inradius: 10 },
    });
  });

  it('resolves axes normally and sizes and corners against the smaller basis', () => {
    const resolve = getPrimitiveDefinition(RegularPolygon)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => Record<string, unknown>;

    expect(resolve({
      sides: 6,
      cx: '50%',
      cy: '50%',
      circumradius: '25%',
      cornerRadius: '5%',
      cornerRadii: [0, null, '10%'],
    }, resolutionContext)).toMatchObject({
      sides: 6,
      cx: 120,
      cy: 60,
      rotation: -Math.PI / 2,
      circumradius: 30,
      cornerRadius: 6,
      cornerRadii: [0, null, 12],
    });
    expect(resolve({ sides: 6, inradius: '25%' }, resolutionContext))
      .toMatchObject({ inradius: 30 });
    expect(resolve({ sides: 6, sideLength: '25%' }, resolutionContext))
      .toMatchObject({ sideLength: 30 });
  });

  it('renders equivalent fill geometry for all three size modes', async () => {
    const sides = 6;
    const circumradius = 24;
    const inradius = circumradius * Math.cos(Math.PI / sides);
    const sideLength = 2 * circumradius * Math.sin(Math.PI / sides);
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(RegularPolygon, {
          style: { sides, cx: 50, cy: 50, circumradius, fill: 'red' },
        }),
        createElement(RegularPolygon, {
          style: { sides, cx: 130, cy: 50, inradius, fill: 'red' },
        }),
        createElement(RegularPolygon, {
          style: { sides, cx: 210, cy: 50, sideLength, fill: 'red' },
        }),
      ],
    }));

    for (const cx of [50, 130, 210]) {
      expect(pixelAt(canvas.element, cx, 50)).toEqual([255, 0, 0, 255]);
      expect(pixelAt(canvas.element, cx + 25, 50)).toEqual([0, 0, 0, 0]);
    }
  });

  it('uses the default and explicit rotations for generated paint geometry', async () => {
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(RegularPolygon, {
          style: { sides: 3, cx: 60, cy: 60, circumradius: 40, fill: 'red' },
        }),
        createElement(RegularPolygon, {
          style: {
            sides: 3,
            cx: 180,
            cy: 60,
            circumradius: 40,
            rotation: 0,
            fill: 'blue',
          },
        }),
      ],
    }));

    expect(pixelAt(canvas.element, 60, 25)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 60, 90)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 215, 60)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 180, 25)).toEqual([0, 0, 0, 0]);
  });

  it('shares fill, stroke, opacity, cursor, and widened line interaction geometry', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(RegularPolygon, {
      style: {
        sides: 4,
        cx: 60,
        cy: 60,
        circumradius: 30 * Math.sqrt(2),
        rotation: -3 * Math.PI / 4,
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
    expect(pixelAt(canvas.element, 30, 60)).toEqual([85, 0, 170, 192]);
    await canvas.click({ position: { x: 25, y: 60 } });
    expect(onClick).toHaveBeenCalledOnce();
    await canvas.mouseMove({ position: { x: 25, y: 60 } });
    expect(canvas.element.style.cursor).toBe('pointer');
  });

  it('uses rounded geometry for paint, hit testing, and transforms', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Group, {
      style: { translateX: 50, translateY: 40 },
      children: [createElement(RegularPolygon, {
        style: {
          sides: 4,
          cx: 30,
          cy: 30,
          circumradius: 30 * Math.sqrt(2),
          rotation: -3 * Math.PI / 4,
          cornerRadius: 10,
          fill: 'red',
        },
        onClick,
      })],
    }));

    expect(pixelAt(canvas.element, 51, 41)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 80, 70)[3]).toBeGreaterThan(0);
    await canvas.click({ position: { x: 51, y: 41 } });
    await canvas.click({ position: { x: 80, y: 70 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses generated extrema for keyboard bounds and honors an override', async () => {
    const override = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Group, {
      children: [
        createElement(RegularPolygon, {
          style: { sides: 4, cx: 60, cy: 50, circumradius: 20, fill: 'red' },
          onClick: vi.fn(),
        }),
        createElement(RegularPolygon, {
          style: { sides: 3, cx: 160, cy: 50, circumradius: 20, fill: 'blue' },
          onClick: vi.fn(),
          keyboardNavigationBounds: override,
        }),
      ],
    }));
    const targets = Array.from(getPibblInstance(canvas.element).eventRoot.targets);

    expect(targets[0].keyboardNavigationBounds).toEqual({
      x: 40,
      y: 30,
      width: 40,
      height: 40,
    });
    expect(targets[1].keyboardNavigationBounds).toBe(override);
  });

  it('updates geometry, then replaces and removes the drawing leaf', async () => {
    let advance!: () => void;
    const onClick = vi.fn();
    function Probe() {
      const phase = useSignal(0);
      advance = () => phase.update(value => value + 1);
      if (phase.get() === 0) {
        return createElement(RegularPolygon, {
          style: { sides: 6, cx: 40, cy: 40, circumradius: 15, fill: 'red' },
          onClick,
        });
      }
      if (phase.get() === 1) {
        return createElement(RegularPolygon, {
          style: {
            sides: 6,
            cx: 100,
            cy: 40,
            sideLength: 20,
            cornerRadius: 4,
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
    expect(getPibblInstance(canvas.element).eventRoot.targets.size).toBe(0);
  });

  it('rejects numeric and rounded style failures with contextual diagnostics', () => {
    const resolve = getPrimitiveDefinition(RegularPolygon)!.resolveStyle! as (
      style: Record<string, unknown>,
      context: object,
    ) => object;
    const invalid: readonly [Record<string, unknown>, RegExp][] = [
      [{ sides: 2, circumradius: 10 }, /RegularPolygon.*sides.*at least 3/],
      [{ sides: 3.5, circumradius: 10 }, /RegularPolygon.*sides.*integer/],
      [{ sides: 4, circumradius: -1 }, /RegularPolygon.*circumradius.*nonnegative/],
      [{ sides: 4, circumradius: 10, rotation: Number.NaN }, /RegularPolygon.*rotation.*finite/],
      [{ sides: 4, circumradius: 10, cornerRadius: -1 }, /RegularPolygon.*cornerRadius.*nonnegative/],
      [{ sides: 4, circumradius: 10, cornerRadii: [0, Number.NaN] }, /RegularPolygon.*cornerRadii\[1\].*finite/],
      [{ sides: 4, circumradius: 10, cornerRadii: [0, 0, 0, 0, 0] }, /RegularPolygon.*cornerRadii.*length.*4/],
    ];

    for (const [style, expected] of invalid) {
      expect(() => resolve(style, resolutionContext)).toThrow(LayoutDiagnostic);
      expect(() => resolve(style, resolutionContext)).toThrow(expected);
    }
  });

  it('rejects missing and conflicting runtime size fields contextually', () => {
    const definition = getPrimitiveDefinition(RegularPolygon)!;
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

    for (const style of [
      { sides: 6 },
      { sides: 6, circumradius: 10, inradius: 5 },
    ]) {
      const resolved = resolve(style, resolutionContext);
      expect(() => render({}, resolved, context)).toThrow(LayoutDiagnostic);
      expect(() => render({}, resolved, context))
        .toThrow(/RegularPolygon.*circumradius\|inradius\|sideLength.*exactly one/);
    }
  });

  it('does not infer intrinsic measurement from polygon geometry', () => {
    expect(measureElement(createElement(RegularPolygon, {
      style: { sides: 6, circumradius: 20 },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'RegularPolygon does not provide measurement',
    });
  });
});
