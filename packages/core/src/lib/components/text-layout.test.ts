import { describe, expect, it } from 'vitest';
import type { TextStyle } from '../style/types.js';
import { resolveTextLayout } from './text-layout.js';

describe('resolveTextLayout', () => {
  it('returns literal wrapped lines, baseline positions, and measured bounds', () => {
    const widths: Record<string, number> = {
      one: 30,
      'one two': 70,
      'one two three': 130,
      three: 50,
      four: 40,
      'three four': 100,
      '...': 30,
      'thr...': 60,
      'thre...': 70,
      'three...': 80,
    };
    const measureText = (value: string) =>
      ({
        width: widths[value] ?? value.length * 10,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: widths[value] ?? value.length * 10,
      }) as TextMetrics;
    const style = {
      text: 'one two three four',
      x: 10,
      y: 30,
      width: 75,
      height: 40,
      lineHeight: 20,
      wrap: true,
      fit: 'ellipsis',
      font: '16px sans-serif',
      textAlign: 'left',
      textBaseline: 'top',
      fill: '#111827',
    } satisfies TextStyle;

    expect(resolveTextLayout(measureText, style)).toEqual({
      lines: [
        {
          text: 'one two',
          x: 10,
          y: 30,
          bounds: { x: 10, y: 22, width: 70, height: 10 },
        },
        {
          text: 'thre...',
          x: 10,
          y: 50,
          bounds: { x: 10, y: 42, width: 70, height: 10 },
        },
      ],
      bounds: { x: 10, y: 22, width: 70, height: 30 },
      clipBounds: undefined,
    });
  });
});
