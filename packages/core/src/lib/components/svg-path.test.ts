import { describe, expect, it } from 'vitest';
import { pibbl } from '../pibbl';
import { componentTest } from '../test-utils/component-test';
import { SvgPath } from './svg-path';
import { createElement } from '../element/create-element';

describe('svgPath', () => {
  it('renders and updates SVG path data through the public component', async () => {
    const canvas = await componentTest(createElement(SvgPath, {
      style: {
        d: 'M 10 10 H 30 V 30 H 10 Z',
        fill: '#ff0000',
      },
    }));
    expect(pixel(canvas.element, 20, 20)).toEqual([255, 0, 0, 255]);

    pibbl(canvas.element, createElement(SvgPath, {
      style: {
        d: 'M 40 10 H 60 V 30 H 40 Z',
        fill: '#0000ff',
      },
    }));
    await nextFrame();

    expect(pixel(canvas.element, 20, 20)).toEqual([0, 0, 0, 0]);
    expect(pixel(canvas.element, 50, 20)).toEqual([0, 0, 255, 255]);
  });

  it('delegates malformed data handling to the platform Path2D parser', async () => {
    const canvas = await componentTest(createElement(SvgPath, {
      style: {
        d: 'this is not svg path data',
        fill: 'red',
      },
    }));

    expect(pixel(canvas.element, 20, 20)).toEqual([0, 0, 0, 0]);
  });
});

function pixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
