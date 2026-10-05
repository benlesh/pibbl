import { describe, expect, it } from 'vitest';
import {
  decodeDisplacementChannel,
  expandDisplacementInput,
} from './displacement-math.js';

describe('displacement map math', () => {
  it('maps Pibbl RG bytes to exact signed extrema and neutral', () => {
    expect(decodeDisplacementChannel(0)).toBe(-1);
    expect(decodeDisplacementChannel(128)).toBe(0);
    expect(decodeDisplacementChannel(255)).toBe(1);
  });

  it('expands input by maximum strength plus bilinear support', () => {
    expect(expandDisplacementInput(
      { x: 10, y: 20, width: 30, height: 40 },
      2,
      3,
    )).toEqual({ x: 3, y: 13, width: 44, height: 54 });
  });
});
