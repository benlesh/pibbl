import { crc, defineComp, rect } from '@crc/core';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { takeScreenshot } from '../src/lib/util/test-utils';

describe('crc browser tests', () => {
  it('renders a rectangle in browser', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.border = '1px solid black';
    canvas.style.margin = '5px';
    document.body.appendChild(canvas);

    const SimpleRect = defineComp(() => {
      return rect({
        style: {
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          fill: 'red',
          stroke: 'black',
          strokeWidth: 2,
        },
      });
    });

    crc(canvas, SimpleRect({}));

    // Method 1: Auto-generated name based on test name + timestamp
    await takeScreenshot(page);

    // Method 2: Custom name
    await takeScreenshot(page, 'custom-name.png');

    // Method 3: Custom name + options
    await takeScreenshot(page, 'custom-name.png', { fullPage: true });

    // Method 4: Just options (uses auto-generated name)
    await takeScreenshot(page, { fullPage: true });

    expect(document.body.contains(canvas)).toBe(true);
  });
});
