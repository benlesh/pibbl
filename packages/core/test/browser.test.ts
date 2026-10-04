import * as CRC_ROOT from '@crc/core';
import { crc, Rectangle } from '@crc/core';
import { jsx, jsxs } from '@crc/core/jsx-runtime';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { takeScreenshot } from '../src/lib/util/test-utils';
import { createElement } from '@crc/core';

describe('crc browser tests', () => {
  it('keeps compiler constructors on their runtime entry points', () => {
    expect(CRC_ROOT).not.toHaveProperty('jsx');
    expect(CRC_ROOT).not.toHaveProperty('jsxs');
    expect(CRC_ROOT).not.toHaveProperty('jsxDEV');

    expect(jsx(Rectangle, { style: { width: 2, height: 2 } }).type)
      .toBe(Rectangle);
    expect(jsxs(Rectangle, { style: { width: 2, height: 2 } }).type)
      .toBe(Rectangle);
    expect(
      jsxDEV(
        Rectangle,
        { style: { width: 2, height: 2 } },
        undefined,
        false,
        undefined,
        undefined,
      ).type,
    ).toBe(Rectangle);
  });

  it('renders a rectangle in browser', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.border = '1px solid black';
    canvas.style.margin = '5px';
    document.body.appendChild(canvas);

    const SimpleRect = (_props: {}) => {
      return createElement(Rectangle, {
        style: {
          left: 50,
          top: 50,
          width: 100,
          height: 100,
          fill: 'red',
          stroke: 'black',
          strokeWidth: 2,
        },
      });
    };

    crc(canvas, createElement(SimpleRect, {}));

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
