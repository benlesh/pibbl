import { describe, expect, it } from 'vitest';
import { easing } from '../../index';

const SAMPLES = Object.freeze({
  easeIn: [0, 0.0934646507188247, 0.31535681257253895, 0.6218618691748893, 1],
  easeOut: [0, 0.37813813082510916, 0.68464318742746, 0.9065353492811745, 1],
  easeInOut: [0, 0.1291619310473196, 0.5, 0.8708380689526796, 1],
});
const PROGRESSES = [0, 0.25, 0.5, 0.75, 1] as const;

describe('easing', () => {
  it('provides the locked built-in cubic curves', () => {
    for (const [name, expectedSamples] of Object.entries(SAMPLES) as Array<
      [keyof typeof SAMPLES, readonly number[]]
    >) {
      for (const [index, progress] of PROGRESSES.entries()) {
        expect(easing[name](progress)).toBeCloseTo(expectedSamples[index], 9);
      }
    }

    expect(easing.linear(0)).toBe(0);
    expect(easing.linear(0.25)).toBe(0.25);
    expect(easing.linear(0.5)).toBe(0.5);
    expect(easing.linear(0.75)).toBe(0.75);
    expect(easing.linear(1)).toBe(1);
    expect(easing.easeOut(0)).toBe(0);
    expect(easing.easeOut(1)).toBe(1);
    expect(easing.easeInOut(0)).toBe(0);
    expect(easing.easeInOut(1)).toBe(1);
  });

  it('validates cubic controls, preserves endpoints, and permits y overshoot', () => {
    expect(() => easing.cubicBezier(Number.NaN, 0, 1, 1)).toThrow('finite');
    expect(() => easing.cubicBezier(-0.01, 0, 1, 1)).toThrow('[0, 1]');
    expect(() => easing.cubicBezier(0, 0, 1.01, 1)).toThrow('[0, 1]');

    const overshoot = easing.cubicBezier(0.25, -0.5, 0.75, 1.5);
    expect(overshoot(0)).toBe(0);
    expect(overshoot(1)).toBe(1);
    expect(overshoot(-1)).toBe(0);
    expect(overshoot(2)).toBe(1);
  });

  it('applies start and end step positions at their boundaries', () => {
    const end = easing.steps(4);
    const start = easing.steps(4, 'start');

    expect(end(0)).toBe(0);
    expect(end(0.249999)).toBe(0);
    expect(end(0.25)).toBe(0.25);
    expect(end(0.999999)).toBe(0.75);
    expect(end(1)).toBe(1);

    expect(start(0)).toBe(0.25);
    expect(start(0.249999)).toBe(0.25);
    expect(start(0.25)).toBe(0.5);
    expect(start(0.999999)).toBe(1);
    expect(start(1)).toBe(1);
    expect(() => easing.steps(0)).toThrow('positive integer');
    expect(() => easing.steps(1.5)).toThrow('positive integer');
  });
});
