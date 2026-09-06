import { describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { getPrimitiveDefinition } from '../element/metadata';
import { getCRCInstance } from '../global-state';
import { crcState } from '../hooks/crc-state';
import { measureElement } from '../layout/measure';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import { Circle } from './circle';

const constraints = {
  minWidth: 0,
  maxWidth: 400,
  minHeight: 0,
  maxHeight: 200,
};

const measurement = {
  measureText: () => ({}) as TextMetrics,
};

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

describe('Circle', () => {
  it('renders and targets only its filled radius', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Circle, {
      style: {
        cx: 200,
        cy: 100,
        radius: 50,
        fill: 'red',
      },
      onClick,
    }));

    expect(pixelAt(canvas.element, 200, 100)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas.element, 260, 100)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 200, y: 100 } });
    await canvas.click({ position: { x: 260, y: 100 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('resolves percentage geometry against its declared box', () => {
    const resolve = getPrimitiveDefinition(Circle)!.resolveStyle! as (
      style: { cx: string; cy: string; radius: string },
      context: object,
    ) => object;
    expect(resolve({
      cx: '50%', cy: '50%', radius: '25%',
    }, {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Circle',
      algorithm: 'render-dispatch',
    })).toMatchObject({ cx: 200, cy: 100, radius: 50 });
  });

  it('defaults its center to the local origin', async () => {
    const canvas = await componentTest(createElement(Circle, {
      style: { radius: 20, fill: 'red' },
    }));

    expect(pixelAt(canvas.element, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas.element, 25, 0)).toEqual([0, 0, 0, 0]);
  });

  it('updates circle geometry', async () => {
    let move!: () => void;
    function Probe() {
      const [cx, setCx] = crcState(20);
      move = () => setCx(80);
      return createElement(Circle, { style: { cx, cy: 20, radius: 10, fill: 'red' } });
    }
    const canvas = await componentTest(createElement(Probe, {}));

    expect(pixelAt(canvas.element, 20, 20)).toEqual([255, 0, 0, 255]);
    move();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(pixelAt(canvas.element, 20, 20)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 80, 20)).toEqual([255, 0, 0, 255]);
  });

  it('rejects a negative radius with a layout diagnostic', async () => {
    const resolve = getPrimitiveDefinition(Circle)!.resolveStyle! as (
      style: { radius: number },
      context: object,
    ) => object;
    expect(() => resolve({ radius: -1 }, {
      allocation: { x: 0, y: 0, width: 400, height: 200 },
      percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
      constraints,
      component: 'Circle',
      algorithm: 'render-dispatch',
    })).toThrow(LayoutDiagnostic);
  });

  it('uses empty paint and hit geometry for a zero radius', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Circle, {
      style: { cx: 40, cy: 40, radius: 0, fill: 'red', stroke: 'blue' },
      onClick,
    }));

    expect(pixelAt(canvas.element, 40, 40)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 40, y: 40 } });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps an opacity-zero fill interactive without painting it', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Circle, {
      style: { cx: 40, cy: 40, radius: 20, fill: 'red', opacity: 0 },
      onClick,
    }));

    expect(pixelAt(canvas.element, 40, 40)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 40, y: 40 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses an explicit keyboard-navigation bounds override', async () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 };
    const canvas = await componentTest(createElement(Circle, {
      style: { cx: 50, cy: 50, radius: 25, fill: 'red' },
      onClick: vi.fn(),
      keyboardNavigationBounds: bounds,
    }));

    const target = [...getCRCInstance(canvas.element).eventRoot.targets][0];
    expect(target.keyboardNavigationBounds).toEqual(bounds);
  });

  it('does not infer intrinsic measurement from radius', () => {
    expect(measureElement(createElement(Circle, {
      style: { radius: 20 },
    }), constraints, measurement)).toEqual({
      status: 'unsupported',
      reason: 'Circle does not provide measurement',
    });
  });
});
