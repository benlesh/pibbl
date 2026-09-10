import { describe, expect, it } from 'vitest';
import {
  defineAnimation,
  easing,
  keyframes,
  signal,
  tween,
  type CRCInterpolator,
} from '../../index';
import {
  sampleSeekableDefinition,
} from './definition';

describe('seekable animation definitions', () => {
  it('validates finite nonnegative durations and snapshots caller arrays', () => {
    expect(() => tween({ to: 1, duration: -1 })).toThrow('duration');
    expect(() => tween({ to: 1, duration: Number.POSITIVE_INFINITY })).toThrow('duration');

    const values = [0, 10] as number[];
    const offsets = [0, 1] as number[];
    const definition = keyframes({ values, offsets, duration: 100 });
    values[1] = 500;
    offsets[1] = 0.5;

    expect(sampleSeekableDefinition(definition, {
      initialValue: 0,
      localTime: 100,
    })).toBe(10);
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it('uses a captured activation value for an omitted tween start', () => {
    const definition = tween({ to: 20, duration: 100 });

    expect(sampleSeekableDefinition(definition, {
      initialValue: 4,
      localTime: 25,
    })).toBe(8);
  });

  it('uses numeric interpolation by default and explicit interpolation for objects', () => {
    const numberTween = tween({ from: 2, to: 10, duration: 100 });
    const interpolatePoint: CRCInterpolator<{ x: number }> = (from, to, progress) => ({
      x: from.x + (to.x - from.x) * progress,
    });
    const objectTween = tween({
      from: { x: 0 },
      to: { x: 8 },
      duration: 100,
      interpolate: interpolatePoint,
    });

    expect(sampleSeekableDefinition(numberTween, {
      initialValue: 0,
      localTime: 25,
    })).toBe(4);
    expect(sampleSeekableDefinition(objectTween, {
      initialValue: { x: -1 },
      localTime: 25,
    })).toEqual({ x: 2 });
  });

  it('does not guess interpolation for nonnumeric values', () => {
    const definition = tween({ from: 'before', to: 'after', duration: 100 });

    expect(() => sampleSeekableDefinition(definition, {
      initialValue: 'initial',
      localTime: 50,
    })).toThrow('interpolator');
  });

  it('passes custom easing output through to the interpolator without clamping', () => {
    const observed: number[] = [];
    const definition = tween({
      from: 0,
      to: 10,
      duration: 100,
      easing: () => 1.5,
      interpolate: (from, to, progress) => {
        observed.push(progress);
        return from + (to - from) * progress;
      },
    });

    expect(sampleSeekableDefinition(definition, {
      initialValue: 0,
      localTime: 50,
    })).toBe(15);
    expect(observed).toEqual([1.5]);
  });

  it('normalizes keyframe offsets and selects the later equal-offset keyframe', () => {
    const generated = keyframes({ values: [0, 10, 20], duration: 100 });
    const jumped = keyframes({
      values: [0, 10, 20, 30],
      offsets: [0, 0.5, 0.5, 1],
      duration: 100,
      easing: [easing.linear, easing.linear, easing.linear],
    });

    expect(sampleSeekableDefinition(generated, {
      initialValue: -1,
      localTime: 25,
    })).toBe(5);
    expect(sampleSeekableDefinition(jumped, {
      initialValue: -1,
      localTime: 49.9,
    })).toBeCloseTo(9.98, 10);
    expect(sampleSeekableDefinition(jumped, {
      initialValue: -1,
      localTime: 50,
    })).toBe(20);
    expect(sampleSeekableDefinition(jumped, {
      initialValue: -1,
      localTime: 50.1,
    })).toBeCloseTo(20.02, 10);
  });

  it('validates keyframe shapes, offsets, and per-segment easing lists', () => {
    expect(() => keyframes({ values: [1], duration: 1 })).toThrow('at least two');
    expect(() => keyframes({
      values: [0, 1], offsets: [0, 0.9, 1], duration: 1,
    })).toThrow('offsets');
    expect(() => keyframes({
      values: [0, 1], offsets: [0.1, 1], duration: 1,
    })).toThrow('start');
    expect(() => keyframes({
      values: [0, 1], offsets: [0, 1], duration: 1,
      easing: [easing.linear, easing.linear],
    })).toThrow('easing');
  });

  it('samples zero-duration tween and custom definitions at completed progress', () => {
    const tweenDefinition = tween({ from: 1, to: 5, duration: 0 });
    const inputs: Array<{ initialValue: number; localTime: number; progress: number }> = [];
    const customDefinition = defineAnimation<number>({
      duration: 0,
      sample: input => {
        inputs.push(input);
        return input.initialValue + input.progress;
      },
    });

    expect(sampleSeekableDefinition(tweenDefinition, {
      initialValue: 1,
      localTime: 0,
    })).toBe(5);
    expect(sampleSeekableDefinition(customDefinition, {
      initialValue: 4,
      localTime: 0,
    })).toBe(5);
    expect(inputs).toEqual([{ initialValue: 4, localTime: 0, progress: 1 }]);
  });

  it('forbids signal writes in user callbacks and reports a contextual debug name', () => {
    const target = signal(0);
    const definition = defineAnimation<number>({
      debugName: 'dangerous sampler',
      duration: 10,
      sample: () => {
        target.set(1);
        return 0;
      },
    });

    expect(() => sampleSeekableDefinition(definition, {
      initialValue: 0,
      localTime: 1,
    })).toThrow('dangerous sampler');
    expect(target.get()).toBe(0);
  });

  it('rejects nonfinite numeric custom samples', () => {
    const definition = defineAnimation<number>({
      duration: 1,
      sample: () => Number.NaN,
    });

    expect(() => sampleSeekableDefinition(definition, {
      initialValue: 0,
      localTime: 1,
    })).toThrow('finite');
  });
});
