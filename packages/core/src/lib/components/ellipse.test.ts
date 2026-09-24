import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { useSignal } from '../hooks/use-signal';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Ellipse } from './ellipse';

const constraints = {
  minWidth: 0,
  maxWidth: 400,
  minHeight: 0,
  maxHeight: 200,
};
const measurement = { measureText: () => ({}) as TextMetrics };

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

describe('Ellipse', () => {
  it('renders fill and stroke', async () => {
    const canvas = await componentTest(createElement(Ellipse, {
      style: {
        cx: 200,
        cy: 100,
        radiusX: 100,
        radiusY: 50,
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 4,
      },
    }));

    expect(pixelAt(canvas.element, 200, 100)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas.element, 299, 100)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvas.element, 200, 160)).toEqual([0, 0, 0, 0]);
  });

  it('resolves axis-specific percentages against its declared box', () => {
    const resolve = getPrimitiveDefinition(Ellipse)!.resolveStyle! as (
      style: { cx: string; cy: string; radiusX: string; radiusY: string },
      context: object,
    ) => object;
    expect(resolve({
      cx: '50%', cy: '50%', radiusX: '25%', radiusY: '25%',
    }, {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Ellipse',
      algorithm: 'render-dispatch',
    })).toMatchObject({ cx: 200, cy: 100, radiusX: 100, radiusY: 50 });
  });

  it('defaults center and rotation to zero', async () => {
    const canvas = await componentTest(createElement(Ellipse, {
      style: { radiusX: 20, radiusY: 10, fill: 'red' },
    }));

    expect(pixelAt(canvas.element, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas.element, 21, 0)).toEqual([0, 0, 0, 0]);
  });

  it('updates geometry and targets its fill', async () => {
    const onClick = vi.fn();
    let move!: () => void;
    function Probe() {
      const cx = useSignal(30);
      move = () => cx.set(90);
      return createElement(Ellipse, {
        style: { cx: cx.get(), cy: 30, radiusX: 20, radiusY: 10, fill: 'red' },
        onClick,
      });
    }
    const canvas = await componentTest(createElement(Probe, {}));

    await canvas.click({ position: { x: 30, y: 30 } });
    move();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(pixelAt(canvas.element, 30, 30)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 90, 30)).toEqual([255, 0, 0, 255]);
    await canvas.click({ position: { x: 90, y: 30 } });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('rejects negative radii and non-finite rotation with layout diagnostics', () => {
    const resolve = getPrimitiveDefinition(Ellipse)!.resolveStyle! as (
      style: { radiusX: number; radiusY: number; rotation?: number },
      context: object,
    ) => object;
    const context = {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Ellipse',
      algorithm: 'render-dispatch' as const,
    };

    expect(() => resolve({ radiusX: -1, radiusY: 1 }, context)).toThrow(LayoutDiagnostic);
    expect(() => resolve({ radiusX: 1, radiusY: 1, rotation: NaN }, context)).toThrow(LayoutDiagnostic);
  });

  it('uses empty geometry for a zero radius', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Ellipse, {
      style: { cx: 30, cy: 30, radiusX: 0, radiusY: 10, fill: 'red' },
      onClick,
    }));

    expect(pixelAt(canvas.element, 30, 30)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 30, y: 30 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses rotation-aware default keyboard-navigation bounds', async () => {
    const cx = 100;
    const cy = 80;
    const radiusX = 40;
    const radiusY = 20;
    const rotation = Math.PI / 4;
    const canvas = await componentTest(createElement(Ellipse, {
      style: { cx, cy, radiusX, radiusY, rotation, fill: 'red' },
      onClick: vi.fn(),
    }));
    const halfWidth = Math.sqrt(
      (radiusX * Math.cos(rotation)) ** 2 + (radiusY * Math.sin(rotation)) ** 2,
    );
    const halfHeight = Math.sqrt(
      (radiusX * Math.sin(rotation)) ** 2 + (radiusY * Math.cos(rotation)) ** 2,
    );

    expect([...getCRCInstance(canvas.element).eventRoot.targets][0]
      .keyboardNavigationBounds).toEqual({
      x: cx - halfWidth,
      y: cy - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    });
  });

  it('does not infer intrinsic measurement from radii', () => {
    expect(measureElement(createElement(Ellipse, {
      style: { radiusX: 20, radiusY: 10 },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Ellipse does not provide measurement',
    });
  });
});
