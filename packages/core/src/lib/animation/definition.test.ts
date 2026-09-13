import { describe, expect, it } from 'vitest';
import {
  defineAnimation,
  easing,
  keyframes,
  signal,
  stepper,
  tween,
  type CRCInterpolator,
} from '../../index';
import {
  sampleSeekableDefinition,
  getDefinitionRecord,
} from './definition';

describe('seekable animation definitions', () => {
  it('validates finite nonnegative durations and snapshots caller arrays', () => {
    expect(() => tween({ to: 1, duration: -1 })).toThrow('duration');
    expect(() => tween({ to: 1, duration: Number.POSITIVE_INFINITY })).toThrow('duration');

    const values: [number, number] = [0, 10];
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

  it('snapshots mutable tween endpoints and keyframe values', () => {
    const from = { x: 0 };
    const to = { x: 10 };
    const tweenDefinition = tween({
      from,
      to,
      duration: 100,
      interpolate: (start, end, progress) => ({
        x: start.x + (end.x - start.x) * progress,
      }),
    });
    const keyframeStart = { x: 0 };
    const keyframeEnd = { x: 10 };
    const keyframeDefinition = keyframes({
      values: [keyframeStart, keyframeEnd],
      duration: 100,
      interpolate: (start, end, progress) => ({
        x: start.x + (end.x - start.x) * progress,
      }),
    });
    from.x = 50;
    to.x = 90;
    keyframeStart.x = 50;
    keyframeEnd.x = 90;
    expect(sampleSeekableDefinition(tweenDefinition, {
      initialValue: { x: -1 },
      localTime: 50,
    })).toEqual({ x: 5 });
    expect(sampleSeekableDefinition(keyframeDefinition, {
      initialValue: { x: -1 },
      localTime: 50,
    })).toEqual({ x: 5 });
  });

  it('normalizes the approved fixed-step callback contract and elapsed clamp default', () => {
    const initial = (currentValue: number): { value: number } => ({ value: currentValue });
    const advance = (state: { value: number }, delta: number): { value: number } => ({
      value: state.value + delta,
    });
    const read = (state: { value: number }): number => state.value;
    const done = (state: { value: number }): boolean => state.value >= 100;

    const definition = stepper({
      stepMilliseconds: 10,
      initial,
      step: advance,
      read,
      done,
    });

    expect(getDefinitionRecord(definition)).toMatchObject({
      kind: 'stepper',
      duration: Number.POSITIVE_INFINITY,
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial,
      step: advance,
      read,
      done,
    });
  });

  it('validates every stepper callback and elapsed-time option at construction', () => {
    const valid = {
      stepMilliseconds: 10,
      initial: (current: number) => current,
      step: (state: number) => state,
      read: (state: number) => state,
    };

    expect(() => stepper({ ...valid, initial: undefined as never })).toThrow('initial');
    expect(() => stepper({ ...valid, step: undefined as never })).toThrow('step');
    expect(() => stepper({ ...valid, read: undefined as never })).toThrow('read');
    expect(() => stepper({ ...valid, done: 1 as never })).toThrow('done');
    for (const stepMilliseconds of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => stepper({ ...valid, stepMilliseconds })).toThrow('stepMilliseconds');
    }
    for (const maxElapsedMilliseconds of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => stepper({ ...valid, maxElapsedMilliseconds })).toThrow(
        'maxElapsedMilliseconds',
      );
    }
  });

  it('snapshots cloneable arbitrary values accepted with explicit interpolators', () => {
    const startDate = new Date(0);
    const endDate = new Date(100);
    const dates = tween({
      from: startDate,
      to: endDate,
      duration: 100,
      interpolate: (from, to) => from.getTime() < to.getTime() ? from : to,
    });
    const startMap = new Map([['value', 0]]);
    const endMap = new Map([['value', 10]]);
    const maps = tween({
      from: startMap,
      to: endMap,
      duration: 100,
      interpolate: (from, to) => from.get('value')! < to.get('value')! ? from : to,
    });
    const value = (): string => 'value';
    const functions = tween({
      from: value,
      to: value,
      duration: 100,
      interpolate: from => from,
    });

    startDate.setTime(500);
    endDate.setTime(900);
    startMap.set('value', 50);
    endMap.set('value', 90);

    expect(sampleSeekableDefinition(dates, {
      initialValue: new Date(-1),
      localTime: 50,
    }).getTime()).toBe(0);
    expect(sampleSeekableDefinition(maps, {
      initialValue: new Map(),
      localTime: 50,
    }).get('value')).toBe(0);
    expect(sampleSeekableDefinition(functions, {
      initialValue: () => 'initial',
      localTime: 50,
    })).toBe(value);
  });

  it('isolates stored RegExp and binary snapshots from interpolator mutation', () => {
    const observeSamples = <T,>(
      value: T,
      read: (sample: T) => number,
      mutate: (sample: T) => void,
    ): readonly number[] => {
      const observed: number[] = [];
      const definition = tween({
        from: value,
        to: value,
        duration: 1,
        interpolate: from => {
          observed.push(read(from));
          mutate(from);
          return from;
        },
      });

      sampleSeekableDefinition(definition, { initialValue: value, localTime: 0.5 });
      sampleSeekableDefinition(definition, { initialValue: value, localTime: 0.5 });
      return observed;
    };
    const dataViewBuffer = new ArrayBuffer(1);
    new Uint8Array(dataViewBuffer)[0] = 8;
    const arrayBuffer = new ArrayBuffer(1);
    new Uint8Array(arrayBuffer)[0] = 9;

    expect([
      observeSamples(/crc/gu, value => value.lastIndex, value => {
        value.lastIndex = 4;
      }),
      observeSamples(new Uint8Array([7]), value => value[0], value => {
        value[0] = 70;
      }),
      observeSamples(new DataView(dataViewBuffer), value => value.getUint8(0), value => {
        value.setUint8(0, 80);
      }),
      observeSamples(arrayBuffer, value => new Uint8Array(value)[0], value => {
        new Uint8Array(value)[0] = 90;
      }),
    ]).toEqual([
      [0, 0],
      [7, 7],
      [8, 8],
      [9, 9],
    ]);
  });

  it('preserves shared backing buffers, view geometry, cycles, and binary immutability', () => {
    interface BinaryGraph {
      readonly buffer: ArrayBuffer;
      readonly bytes: Uint8Array;
      readonly words: Uint16Array;
      readonly data: DataView;
      self: BinaryGraph;
    }

    const buffer = new ArrayBuffer(12);
    new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const value = {
      bytes: new Uint8Array(buffer, 1, 6),
      words: new Uint16Array(buffer, 2, 3),
      data: new DataView(buffer, 3, 5),
      buffer,
      self: undefined as unknown as BinaryGraph,
    } satisfies BinaryGraph;
    value.self = value;
    const observed: Array<readonly [BinaryGraph, BinaryGraph]> = [];
    const definition = tween({
      from: value,
      to: value,
      duration: 1,
      interpolate: (from, to) => {
        observed.push([from, to]);
        return from;
      },
    });

    new Uint8Array(buffer).fill(90);
    const first = sampleSeekableDefinition(definition, {
      initialValue: value,
      localTime: 0.5,
    });

    expect(observed[0]![0]).toBe(observed[0]![1]);
    expect(first.self).toBe(first);
    expect(first.buffer).not.toBe(buffer);
    expect(first.bytes.buffer).toBe(first.buffer);
    expect(first.words.buffer).toBe(first.buffer);
    expect(first.data.buffer).toBe(first.buffer);
    expect([
      [first.bytes.byteOffset, first.bytes.byteLength],
      [first.words.byteOffset, first.words.byteLength],
      [first.data.byteOffset, first.data.byteLength],
    ]).toEqual([
      [1, 6],
      [2, 6],
      [3, 5],
    ]);
    expect(Array.from(new Uint8Array(first.buffer))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);

    first.bytes[1] = 70;
    first.data.setUint8(1, 80);
    new Uint8Array(first.buffer)[8] = 90;
    const second = sampleSeekableDefinition(definition, {
      initialValue: value,
      localTime: 0.5,
    });

    expect(second).not.toBe(first);
    expect(second.self).toBe(second);
    expect(second.bytes.buffer).toBe(second.buffer);
    expect(second.words.buffer).toBe(second.buffer);
    expect(second.data.buffer).toBe(second.buffer);
    expect(Array.from(new Uint8Array(second.buffer))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('does not expose stored mutable built-ins from terminal keyframes', () => {
    const observeTerminalSamples = <T,>(
      value: T,
      read: (sample: T) => number,
      mutate: (sample: T) => void,
    ): readonly number[] => {
      const definition = keyframes({
        values: [value, value],
        duration: 1,
        interpolate: from => from,
      });
      const first = sampleSeekableDefinition(definition, {
        initialValue: value,
        localTime: 1,
      });
      const observed = [read(first)];
      mutate(first);
      observed.push(read(sampleSeekableDefinition(definition, {
        initialValue: value,
        localTime: 1,
      })));
      return observed;
    };
    const dataViewBuffer = new ArrayBuffer(1);
    new Uint8Array(dataViewBuffer)[0] = 8;
    const arrayBuffer = new ArrayBuffer(1);
    new Uint8Array(arrayBuffer)[0] = 9;

    expect([
      observeTerminalSamples(/crc/gu, value => value.lastIndex, value => {
        value.lastIndex = 4;
      }),
      observeTerminalSamples(new Uint8Array([7]), value => value[0], value => {
        value[0] = 70;
      }),
      observeTerminalSamples(new DataView(dataViewBuffer), value => value.getUint8(0), value => {
        value.setUint8(0, 80);
      }),
      observeTerminalSamples(arrayBuffer, value => new Uint8Array(value)[0], value => {
        new Uint8Array(value)[0] = 90;
      }),
    ]).toEqual([
      [0, 0],
      [7, 7],
      [8, 8],
      [9, 9],
    ]);
  });

  it('preserves holes while snapshotting plain arrays', () => {
    const sparse: Array<{ value: number } | undefined> = [];
    sparse.length = 2;
    sparse[1] = { value: 7 };
    const definition = tween({
      from: sparse,
      to: sparse,
      duration: 1,
      interpolate: from => from,
    });

    sparse[0] = { value: 70 };
    sparse[1]!.value = 70;
    const sampled = sampleSeekableDefinition(definition, {
      initialValue: [],
      localTime: 0.5,
    });

    expect(Object.prototype.hasOwnProperty.call(sampled, 0)).toBe(false);
    expect(sampled).toHaveLength(2);
    expect(sampled[1]).toEqual({ value: 7 });
  });

  it('preserves Array subclass semantics instead of fabricating a plain array', () => {
    class TaggedArray extends Array<number> {
      #tag = 'tagged';

      describe(): string {
        return `${this.#tag}:${this.join(',')}`;
      }
    }
    const value = new TaggedArray(3, 4);
    const definition = tween({
      from: value,
      to: value,
      duration: 1,
      interpolate: from => from,
    });

    const sampled = sampleSeekableDefinition(definition, {
      initialValue: new TaggedArray(),
      localTime: 0.5,
    });

    expect(sampled).toBeInstanceOf(TaggedArray);
    expect(sampled.describe()).toBe('tagged:3,4');
  });

  it('keeps opaque values usable when their semantics cannot be cloned generically', async () => {
    class PrivateCounter {
      #value: number;

      constructor(value: number) {
        this.#value = value;
      }

      get value(): number {
        return this.#value;
      }

      set value(value: number) {
        this.#value = value;
      }
    }
    const weakKey = {};
    const weakMap = new WeakMap([[weakKey, 'weak map']]);
    const weakSet = new WeakSet([weakKey]);
    const promise = Promise.resolve('promise');
    const expression = /crc/gu;
    const bytes = new Uint8Array([7]);
    const counter = new PrivateCounter(3);
    const functionValue: (() => string) & { label: string } = Object.assign(
      () => 'function',
      { label: 'before' },
    );
    const asValue = <T,>(value: T) => tween({
      from: value,
      to: value,
      duration: 1,
      interpolate: from => from,
    });

    const weakMapDefinition = asValue(weakMap);
    const weakSetDefinition = asValue(weakSet);
    const promiseDefinition = asValue(promise);
    const expressionDefinition = asValue(expression);
    const bytesDefinition = asValue(bytes);
    const counterDefinition = asValue(counter);
    const functionDefinition = asValue<typeof functionValue>(functionValue);

    expect(sampleSeekableDefinition(weakMapDefinition, {
      initialValue: new WeakMap(), localTime: 1,
    }).get(weakKey)).toBe('weak map');
    expect(sampleSeekableDefinition(weakSetDefinition, {
      initialValue: new WeakSet(), localTime: 1,
    }).has(weakKey)).toBe(true);
    await expect(sampleSeekableDefinition(promiseDefinition, {
      initialValue: Promise.resolve('initial'), localTime: 1,
    })).resolves.toBe('promise');
    expect(sampleSeekableDefinition(expressionDefinition, {
      initialValue: /initial/u, localTime: 1,
    }).test('crc')).toBe(true);
    expect(sampleSeekableDefinition(bytesDefinition, {
      initialValue: new Uint8Array(), localTime: 1,
    })[0]).toBe(7);
    expect(sampleSeekableDefinition(counterDefinition, {
      initialValue: new PrivateCounter(-1), localTime: 1,
    }).value).toBe(3);
    expect(sampleSeekableDefinition(functionDefinition, {
      initialValue: functionValue, localTime: 1,
    })()).toBe('function');
    expect(sampleSeekableDefinition(functionDefinition, {
      initialValue: functionValue, localTime: 1,
    }).label).toBe('before');
  });

  it('preserves Date, Map, and Set own properties and accessors', () => {
    const accessorValue = 'accessor';
    const date = Object.assign(new Date(0), { own: 'date own' });
    const map = Object.assign(new Map([['value', 1]]), { own: 'map own' });
    const set = Object.assign(new Set(['value']), { own: 'set own' });
    Object.defineProperty(date, 'accessor', { get: () => accessorValue });
    const asValue = <T,>(value: T) => tween({
      from: value,
      to: value,
      duration: 1,
      interpolate: from => from,
    });

    const dateDefinition = asValue(date);
    const mapDefinition = asValue(map);
    const setDefinition = asValue(set);

    expect(sampleSeekableDefinition(dateDefinition, {
      initialValue: new Date(-1), localTime: 1,
    })).toMatchObject({ own: 'date own', accessor: 'accessor' });
    expect(sampleSeekableDefinition(mapDefinition, {
      initialValue: new Map(), localTime: 1,
    })).toMatchObject({ own: 'map own' });
    expect(sampleSeekableDefinition(setDefinition, {
      initialValue: new Set(), localTime: 1,
    })).toMatchObject({ own: 'set own' });
  });

  it('preserves shared value identity across one definition snapshot', () => {
    const shared = { value: 0 };
    const tweenDefinition = tween({
      from: shared,
      to: shared,
      duration: 100,
      interpolate: (from, to) => ({ same: from === to, value: from.value }),
    });
    const keyframeDefinition = keyframes({
      values: [shared, shared],
      duration: 100,
      interpolate: (from, to) => ({ same: from === to, value: from.value }),
    });
    shared.value = 50;

    expect(sampleSeekableDefinition(tweenDefinition, {
      initialValue: { value: -1 },
      localTime: 50,
    })).toEqual({ same: true, value: 0 });
    expect(sampleSeekableDefinition(keyframeDefinition, {
      initialValue: { value: -1 },
      localTime: 50,
    })).toEqual({ same: true, value: 0 });
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
    expect(() => keyframes<number>({
      values: [1] as unknown as readonly [number, number, ...number[]],
      duration: 1,
    })).toThrow('at least two');
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

  it('directs stateful definitions to the stateful program evaluator', () => {
    const definition = stepper({
      stepMilliseconds: 10,
      initial: (current: number) => current,
      step: state => state,
      read: state => state,
    });

    expect(() => sampleSeekableDefinition(definition, {
      initialValue: 0,
      localTime: 0,
    })).toThrow(/stateful program evaluator/iu);
  });

  it('rejects nonfinite terminal keyframe values', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const definition = keyframes({ values: [0, value], duration: 1 });

      expect(() => sampleSeekableDefinition(definition, {
        initialValue: 0,
        localTime: 1,
      })).toThrow('finite');
    }
  });
});
