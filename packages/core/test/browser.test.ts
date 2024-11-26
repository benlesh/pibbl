import { crc, defineComp, rect } from '@crc/core';
import { describe, expect, it } from 'vitest';

describe('crc browser tests', () => {
  it('renders a rectangle in browser', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.border = '1px solid black';
    canvas.style.margin = '20px';
    document.body.appendChild(canvas);

    const SimpleRect = defineComp(() => {
      return rect({
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fillStyle: 'red',
        strokeStyle: 'black',
        lineWidth: 2,
      });
    });

    crc(canvas, { type: SimpleRect, props: {} });

    // Keep the test running to inspect the render
    expect(document.body.contains(canvas)).toBe(true);
  });
});
