import {
  Absolute,
  Arc,
  Circle,
  createElement,
  type CRCElement,
  Ellipse,
  Wedge,
} from '@crc/core';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../src/lib/test-utils/component-test';

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number) {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function inDeclaredBox<P>(child: CRCElement<P>) {
  return createElement(Absolute, {
    children: [
      createElement(Absolute, {
        style: { width: 400, height: 200 },
        children: [child],
      }),
    ],
  });
}

describe('public standard-shape declared-box allocation', () => {
  it('resolves Circle percentages through render and hit behavior', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(inDeclaredBox(
      createElement(Circle, {
        style: {
          width: 400,
          height: 200,
          cx: '50%',
          cy: '50%',
          radius: '25%',
          fill: 'red',
        },
        onClick,
      }),
    ));

    expect(pixelAt(canvas.element, 200, 100)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas.element, 249, 100)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 251, 100)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 200, 150)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 200, y: 100 } });
    await canvas.click({ position: { x: 251, y: 100 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('resolves Ellipse radii against separate declared width and height bases', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(inDeclaredBox(
      createElement(Ellipse, {
        style: {
          width: 400,
          height: 200,
          cx: '50%',
          cy: '50%',
          radiusX: '25%',
          radiusY: '25%',
          fill: 'red',
        },
        onClick,
      }),
    ));

    expect(pixelAt(canvas.element, 299, 100)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 301, 100)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas.element, 200, 149)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 200, 151)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 200, y: 100 } });
    await canvas.click({ position: { x: 301, y: 100 } });
    await canvas.click({ position: { x: 200, y: 151 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('resolves Arc radius against the smaller declared-box dimension', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(inDeclaredBox(
      createElement(Arc, {
        style: {
          width: 400,
          height: 200,
          cx: '50%',
          cy: '50%',
          radius: '25%',
          startAngle: 0,
          endAngle: Math.PI * 2,
          stroke: 'red',
          strokeWidth: 4,
        },
        onClick,
      }),
    ));

    expect(pixelAt(canvas.element, 250, 100)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas.element, 260, 100)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 250, y: 100 } });
    await canvas.click({ position: { x: 260, y: 100 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('resolves Wedge radius against the smaller declared-box dimension', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(inDeclaredBox(
      createElement(Wedge, {
        style: {
          width: 400,
          height: 200,
          cx: '50%',
          cy: '50%',
          radius: '25%',
          startAngle: 0,
          endAngle: Math.PI / 2,
          fill: 'red',
        },
        onClick,
      }),
    ));

    expect(pixelAt(canvas.element, 249, 101)[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas.element, 251, 101)).toEqual([0, 0, 0, 0]);
    await canvas.click({ position: { x: 225, y: 125 } });
    await canvas.click({ position: { x: 251, y: 101 } });
    expect(onClick).toHaveBeenCalledOnce();
  });
});
