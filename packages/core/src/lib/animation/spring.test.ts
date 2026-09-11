import { describe, expect, it } from 'vitest';
import { spring } from '../../index';
import {
  getDefinitionRecord,
  sampleSeekableDefinition,
} from './definition';
import { sampleSpring } from './spring';

describe('analytic spring definitions', () => {
  it('normalizes defaults into an immutable snapshot', () => {
    const options = { from: 0, to: 1 };
    const definition = spring(options);
    options.from = 20;
    options.to = 30;
    const record = getDefinitionRecord(definition);

    expect(record).toMatchObject({
      from: 0,
      to: 1,
      mass: 1,
      stiffness: 170,
      damping: 26,
      initialVelocity: 0,
      restSpeed: 0.01,
      restDelta: 0.001,
      maxDuration: 10_000,
    });
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('rejects invalid numeric options at construction', () => {
    for (const property of [
      'from',
      'to',
      'mass',
      'stiffness',
      'damping',
      'initialVelocity',
      'restSpeed',
      'restDelta',
      'maxDuration',
    ] as const) {
      expect(() => spring({ from: 0, to: 1, [property]: Number.NaN })).toThrow('finite');
      expect(() => spring({
        from: 0,
        to: 1,
        [property]: Number.POSITIVE_INFINITY,
      })).toThrow('finite');
      expect(() => spring({
        from: 0,
        to: 1,
        [property]: null,
      } as never)).toThrow('finite');
    }
    for (const property of ['mass', 'stiffness', 'maxDuration'] as const) {
      expect(() => spring({ from: 0, to: 1, [property]: 0 })).toThrow('positive');
      expect(() => spring({ from: 0, to: 1, [property]: -1 })).toThrow('positive');
    }
    for (const property of ['damping', 'restSpeed', 'restDelta'] as const) {
      expect(() => spring({ from: 0, to: 1, [property]: -1 })).toThrow('nonnegative');
    }
  });

  it('preserves representable motion across extreme finite parameter scales', () => {
    const tinyFrequency = spring({
      from: 0,
      to: 0,
      mass: Number.MAX_VALUE,
      stiffness: Number.MIN_VALUE,
      damping: 0,
      initialVelocity: 1,
    });
    const scaledUnderdamped = spring({
      from: 0,
      to: 1,
      mass: Number.MAX_VALUE,
      stiffness: Number.MAX_VALUE,
      damping: Number.MAX_VALUE,
    });
    const tinyFrequencyRecord = getDefinitionRecord(tinyFrequency);
    const scaledRecord = getDefinitionRecord(scaledUnderdamped);
    if (tinyFrequencyRecord.kind !== 'spring' || scaledRecord.kind !== 'spring') {
      throw new Error('Expected spring records.');
    }

    expect(sampleSpring(tinyFrequencyRecord, 1)).toEqual({
      position: 1,
      velocity: 1,
    });
    const scaledSample = sampleSpring(scaledRecord, 0.5);
    expect(scaledSample.position).toBeCloseTo(0.10440547345507933, 14);
    expect(scaledSample.velocity).toBeCloseTo(0.3773452034749068, 14);
  });

  it('does not derive unused frequencies or coefficients for settled motion', () => {
    const settledExtreme = spring({
      from: 0,
      to: 0,
      mass: Number.MIN_VALUE,
      stiffness: Number.MAX_VALUE,
      damping: 0,
      initialVelocity: 0,
    });
    const settledExtremeRecord = getDefinitionRecord(settledExtreme);
    expect(settledExtremeRecord.duration).toBe(0);
    expect(sampleSeekableDefinition(settledExtreme, {
      initialValue: 1,
      localTime: 0,
    })).toBe(0);

    const activationDependent = spring({ to: Number.MAX_VALUE });
    expect(sampleSeekableDefinition(activationDependent, {
      initialValue: Number.MAX_VALUE,
      localTime: 0,
    })).toBe(Number.MAX_VALUE);
  });

  it('samples finite overdamped roots without squaring a huge damping ratio', () => {
    const definition = spring({
      from: 0,
      to: 1,
      mass: 1,
      stiffness: 1e200,
      damping: 2e300,
    });
    const record = getDefinitionRecord(definition);
    if (record.kind !== 'spring') throw new Error('Expected a spring record.');

    const sample = sampleSpring(record, 1);
    expect(sample.position).toBe(0);
    expect(sample.velocity / 5e-101).toBeCloseTo(1, 12);
  });

  it.each([
    {
      regime: 'underdamped',
      damping: 10,
      samples: [
        [0, 0, 2],
        [0.05, 1.1195237752457743, 38.77101899363071],
        [0.2, 8.578112274474389, 41.39055243759229],
        [0.75, 9.742659911282034, 0.611685576844968],
      ],
    },
    {
      regime: 'critically damped',
      damping: 20,
      samples: [
        [0, 0, 2],
        [0.05, 0.9626931702817618, 30.933063645344305],
        [0.2, 5.994075616196263, 26.796386080849317],
        [0.75, 9.953817455092656, 0.4076231807989534],
      ],
    },
    {
      regime: 'overdamped',
      damping: 30,
      samples: [
        [0, 0, 2],
        [0.05, 0.8384034079428382, 25.21801080053563],
        [0.2, 4.596232608622473, 20.44794763093781],
        [0.75, 9.337757816624439, 2.5295399452105505],
      ],
    },
  ])('samples the $regime closed form independently of frame cadence', ({
    damping,
    samples,
  }) => {
    const definition = spring({
      from: 0,
      to: 10,
      mass: 1,
      stiffness: 100,
      damping,
      initialVelocity: 2,
      maxDuration: 5_000,
    });
    const record = getDefinitionRecord(definition);
    if (record.kind !== 'spring') throw new Error('Expected a spring record.');

    for (const [seconds, position, velocity] of samples) {
      const sampled = sampleSpring(record, seconds);
      expect(sampled.position).toBeCloseTo(position, 11);
      expect(sampled.velocity).toBeCloseTo(velocity, 11);
      expect(sampleSeekableDefinition(definition, {
        initialValue: -1,
        localTime: seconds * 1000,
      })).toBeCloseTo(position, 11);
    }

    const direct = sampleSpring(record, 0.75);
    let framed = sampleSpring(record, 0);
    for (const seconds of [0.007, 0.031, 0.084, 0.173, 0.411, 0.75]) {
      framed = sampleSpring(record, seconds);
    }
    expect(framed.position).toBe(direct.position);
    expect(framed.velocity).toBe(direct.velocity);
  });

  it('normalizes nearly critical ratios to the stable critical form', () => {
    const critical = spring({
      from: 0,
      to: 10,
      mass: 1,
      stiffness: 100,
      damping: 20,
      initialVelocity: 2,
    });
    const nearlyCritical = spring({
      from: 0,
      to: 10,
      mass: 1,
      stiffness: 100,
      damping: 20.000001,
      initialVelocity: 2,
    });

    expect(sampleSeekableDefinition(nearlyCritical, {
      initialValue: -1,
      localTime: 200,
    })).toBe(sampleSeekableDefinition(critical, {
      initialValue: -1,
      localTime: 200,
    }));
  });

  it.each([
    {
      regime: 'underdamped',
      damping: 10,
      expectedDuration: 1269.7103641967983,
      displacementEnvelope: (seconds: number) =>
        11.433284742365162 * Math.exp(-5 * seconds),
      velocityEnvelope: (seconds: number) =>
        114.33284742365161 * Math.exp(-5 * seconds),
    },
    {
      regime: 'critically damped',
      damping: 20,
      expectedDuration: 831.4906680262643,
      displacementEnvelope: (seconds: number) =>
        (10 + 98 * seconds) * Math.exp(-10 * seconds),
      velocityEnvelope: (seconds: number) =>
        (2 + 980 * seconds) * Math.exp(-10 * seconds),
    },
    {
      regime: 'overdamped',
      damping: 30,
      expectedDuration: 1414.3196865155617,
      displacementEnvelope: (seconds: number) =>
        11.618761213399377 * Math.exp(-3.819660112501051 * seconds) +
        1.6187612133993774 * Math.exp(-26.18033988749895 * seconds),
      velocityEnvelope: (seconds: number) =>
        44.379718763495916 * Math.exp(-3.819660112501051 * seconds) +
        42.379718763495916 * Math.exp(-26.18033988749895 * seconds),
    },
  ])('resolves the earliest conservative $regime settlement', ({
    damping,
    expectedDuration,
    displacementEnvelope,
    velocityEnvelope,
  }) => {
    const definition = spring({
      from: 0,
      to: 10,
      mass: 1,
      stiffness: 100,
      damping,
      initialVelocity: 2,
      restDelta: 0.1,
      restSpeed: 0.2,
      maxDuration: 5_000,
    });
    const record = getDefinitionRecord(definition);
    if (record.kind !== 'spring') throw new Error('Expected a spring record.');
    const durationSeconds = record.duration / 1000;
    const earlierSeconds = durationSeconds - 0.000001;

    expect(record.duration).toBeCloseTo(expectedDuration, 9);
    expect(displacementEnvelope(durationSeconds)).toBeLessThanOrEqual(0.1 + 1e-12);
    expect(velocityEnvelope(durationSeconds)).toBeLessThanOrEqual(0.2 + 1e-12);
    expect(
      displacementEnvelope(earlierSeconds) > 0.1 ||
      velocityEnvelope(earlierSeconds) > 0.2,
    ).toBe(true);
  });

  it('returns the exact target at settlement and at the maximum duration', () => {
    const settledDefinition = spring({ from: 0, to: 10 });
    const settledRecord = getDefinitionRecord(settledDefinition);
    if (settledRecord.kind !== 'spring') throw new Error('Expected a spring record.');

    expect(settledRecord.duration).toBeGreaterThan(0);
    expect(settledRecord.duration).toBeLessThan(settledRecord.maxDuration);
    expect(sampleSpring(settledRecord, settledRecord.duration / 1000)).toEqual({
      position: 10,
      velocity: 0,
    });
    expect(sampleSeekableDefinition(settledDefinition, {
      initialValue: -1,
      localTime: settledRecord.duration,
    })).toBe(10);

    const cappedDefinition = spring({
      from: 0,
      to: 10,
      damping: 0,
      maxDuration: 100,
    });
    const cappedRecord = getDefinitionRecord(cappedDefinition);
    expect(cappedRecord.duration).toBe(100);
    expect(sampleSeekableDefinition(cappedDefinition, {
      initialValue: -1,
      localTime: 100,
    })).toBe(10);

    const velocityOnlyDefinition = spring({
      from: 5,
      to: 5,
      initialVelocity: 20,
      maxDuration: 5_000,
    });
    const velocityOnlyRecord = getDefinitionRecord(velocityOnlyDefinition);
    if (velocityOnlyRecord.kind !== 'spring') throw new Error('Expected a spring record.');
    expect(velocityOnlyRecord.duration).toBeGreaterThan(0);
    expect(sampleSpring(
      velocityOnlyRecord,
      velocityOnlyRecord.duration / 1000,
    )).toEqual({ position: 5, velocity: 0 });
  });

  it('resolves an omitted start from the activation value without retaining frame history', () => {
    const definition = spring({ to: 10 });

    const direct = sampleSeekableDefinition(definition, {
      initialValue: 2,
      localTime: 300,
    });
    for (const localTime of [5, 17, 91, 144]) {
      sampleSeekableDefinition(definition, { initialValue: 2, localTime });
    }
    expect(sampleSeekableDefinition(definition, {
      initialValue: 2,
      localTime: 300,
    })).toBe(direct);
  });
});
