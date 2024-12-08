import { crc, defineComp, rect } from '@crc/core';
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import '../src/lib/testing/matchers';

describe('browser tests', () => {
  it('should match the baseline screenshot', async () => {
    // Setup canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.border = '1px solid black';
    canvas.style.margin = '5px';
    document.body.appendChild(canvas);

    // Draw a red rectangle
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

    // Compare with snapshot
    const screenshot = await page.screenshot({ base64: true });
    await expect({ base64: screenshot.base64 }).toMatchScreenshot({
      // Allow up to 1% difference for anti-aliasing and rendering variations
      failureThreshold: 1,
    });
  });
});
