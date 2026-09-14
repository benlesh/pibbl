import { describe, expect, it } from 'vitest';
import { defineParticleEffect2D, particle } from '../index.js';
import { defineParticleEffect3D } from '../webgl.js';
import {
  getParticleEffect2DRecord,
  getParticleEffect3DRecord,
} from './definition-records.js';
import type {
  CRCParticleEmitter3D,
  CRCParticleMotion3D,
  CRCParticleRenderer3D,
  CRCParticleShape3D,
} from './webgl-types.js';

function emitter(
  overrides: Partial<CRCParticleEmitter3D> = {},
): CRCParticleEmitter3D {
  return {
    name: 'embers',
    capacity: 128,
    emission: [{ type: 'rate', particlesPerSecond: 20, durationMilliseconds: 2_000 }],
    shape: { type: 'sphere', radius: 1, sample: 'volume' },
    initial: { lifetimeMilliseconds: 1_000, velocity: [0, 2, 0], size: 0.1 },
    renderer: { type: 'point', material: 'unlit', blend: 'additive' },
    ...overrides,
  };
}

describe('defineParticleEffect3D', () => {
  it('accepts matching whole-vector and initial-color parameter references', () => {
    expect(() => defineParticleEffect3D({
      parameters: {
        launch: { type: 'vector3', default: [1, 2, 3], timing: 'spawn' },
        axis: { type: 'vector3', default: [0, 1, 0], timing: 'simulation' },
        spin: { type: 'vector3', default: [10, 20, 30], timing: 'simulation' },
        tint: { type: 'color', default: 'rebeccapurple', timing: 'render' },
      },
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: 1_000,
          velocity: particle.parameter('launch'),
          color: particle.parameter('tint'),
        },
        motion: [
          {
            type: 'sway',
            direction: particle.parameter('axis'),
            amplitude: 1,
            frequency: 1,
          },
          {
            type: 'angularVelocity',
            degreesPerSecond: particle.parameter('spin'),
          },
        ],
        bounds: { min: [-20, -20, -20], max: [20, 20, 20] },
      })],
    })).not.toThrow();
  });

  it('classifies an automatic analytic effect as stateless WebGL capable', () => {
    const effect = defineParticleEffect3D({
      debugName: 'embers effect',
      emitters: [emitter()],
    });
    const record = getParticleEffect3DRecord(effect);

    expect(effect).toEqual({ dimension: 3 });
    expect(record.capabilities).toEqual({
      statelessCanvas: false,
      statelessWebGL: true,
      requiresStateful: [],
    });
    expect(record.emitters[0]!.boundsSource).toBe('derived');
  });

  it('keeps manual emitters valid while recording why stateless WebGL cannot bind them', () => {
    const record = getParticleEffect3DRecord(defineParticleEffect3D({
      emitters: [emitter({ emission: [{ type: 'manual', count: 4 }] })],
    }));

    expect(record.capabilities.statelessWebGL).toBe(false);
    expect(record.capabilities.requiresStateful).toEqual([
      'emitter "embers" uses manual emission',
    ]);
  });

  it('records distance sorting as a stateful-only WebGL reason', () => {
    const record = getParticleEffect3DRecord(defineParticleEffect3D({
      emitters: [emitter({
        renderer: {
          type: 'billboard',
          material: 'unlit',
          blend: 'alpha',
          sorting: 'distance',
        },
      })],
    }));

    expect(record.capabilities.statelessWebGL).toBe(false);
    expect(record.capabilities.requiresStateful).toEqual([
      'emitter "embers" uses distance sorting',
    ]);
  });

  it('keeps fixed spawn and simulation parameter references stateless-WebGL capable', () => {
    const record = getParticleEffect3DRecord(defineParticleEffect3D({
      parameters: {
        launchSpeed: { type: 'number', default: 2, timing: 'spawn' },
        wind: { type: 'number', default: 1, timing: 'simulation' },
        tint: { type: 'color', default: '#fff', timing: 'render' },
      },
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: 1_000,
          velocity: [0, particle.parameter('launchSpeed'), 0],
        },
        motion: [{ type: 'drift', velocity: [particle.parameter('wind'), 0, 0] }],
        bounds: { min: [-10, -10, -10], max: [10, 10, 10] },
      })],
    }));

    expect(record.capabilities.statelessWebGL).toBe(true);
    expect(record.capabilities.requiresStateful).toEqual([]);
  });

  it('requires explicit bounds for render parameters that affect billboard size', () => {
    expect(() => defineParticleEffect3D({
      debugName: 'live billboard size',
      parameters: {
        size: { type: 'number', default: 0.1, timing: 'render' },
      },
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: 1_000,
          size: particle.parameter('size'),
        },
      })],
    })).toThrowError(/live billboard size.*embers.*bounds.*explicit.*parameter/i);
  });

  it('rejects nonfinite arithmetic in compiler-derived 3D bounds', () => {
    expect(() => defineParticleEffect3D({
      debugName: 'overflowing volume',
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: Number.MAX_VALUE,
          velocity: [Number.MAX_VALUE, 0, 0],
        },
      })],
    })).toThrowError(
      /overflowing volume.*embers.*bounds\.max\[0\].*finite.*Infinity/i,
    );
  });

  it.each(['depthTest', 'depthWrite'] as const)(
    'rejects a nonboolean WebGL renderer %s value contextually',
    property => {
      expect(() => defineParticleEffect3D({
        debugName: 'bad depth state',
        emitters: [emitter({
          renderer: {
            type: 'point',
            material: 'unlit',
            blend: 'alpha',
            [property]: 1,
          } as never,
        })],
      })).toThrowError(
        new RegExp(`bad depth state.*embers.*renderer point.*${property}.*boolean.*1`, 'i'),
      );
    },
  );

  it('accepts additive 3D drift and sway writers without inventing a conflict', () => {
    expect(() => defineParticleEffect3D({
      emitters: [emitter({
        motion: [
          { type: 'drift', velocity: [1, 0, 0] },
          { type: 'sway', direction: [0, 1, 0], amplitude: 2, frequency: 1 },
        ],
      })],
    })).not.toThrow();
  });

  it('reports malformed 3D emitter and motion records contextually', () => {
    expect(() => defineParticleEffect3D({
      debugName: 'malformed volume',
      emitters: [null as never],
    })).toThrowError(/malformed volume.*emitter.*record/i);
    expect(() => defineParticleEffect3D({
      debugName: 'malformed volume',
      emitters: [emitter({ motion: [null as never] })],
    })).toThrowError(/malformed volume.*embers.*motion\[0\].*record/i);
  });

  it.each([
    [{ type: 'box', size: [1, 0, 1], sample: 'volume' }, 'size\\[1\\]'],
    [{ type: 'sphere', radius: -1, sample: 'surface' }, 'radius'],
    [{ type: 'ring', innerRadius: 2, outerRadius: 1 }, 'outerRadius'],
    [{
      type: 'cone', direction: [0, 0, 0], spreadDegrees: 30,
      length: 2, sample: 'volume',
    }, 'direction'],
  ] as const)('rejects invalid 3D shape %#', (shape, property) => {
    expect(() => defineParticleEffect3D({
      debugName: 'bad volume',
      emitters: [emitter({ shape: shape as CRCParticleShape3D })],
    })).toThrowError(new RegExp(`bad volume.*embers.*shape.*${property}`, 'i'));
  });

  it('copies and deeply freezes 3D caller storage while retaining billboard source identity', () => {
    const size: [number, number, number] = [2, 3, 4];
    const direction: [number, number, number] = [0, 1, 0];
    const source = document.createElement('canvas');
    const effect = defineParticleEffect3D({
      emitters: [emitter({
        shape: { type: 'box', size, sample: 'surface' },
        initial: {
          lifetimeMilliseconds: 1_000,
          velocity: { type: 'cone', direction, speed: 2, spreadDegrees: 20 },
        },
        renderer: {
          type: 'billboard', source, material: 'emissive', blend: 'cutout',
        },
      })],
    });

    size[0] = 99;
    direction[1] = 99;
    const record = getParticleEffect3DRecord(effect);
    const renderer = record.emitters[0]!.renderer;
    if (renderer.type !== 'billboard') throw new Error('expected billboard renderer');
    expect(record.emitters[0]!.shape).toMatchObject({ size: [2, 3, 4] });
    expect(record.emitters[0]!.initial.velocity).toMatchObject({ direction: [0, 1, 0] });
    expect(renderer.source).toBe(source);
    expect(Object.isFrozen(record.emitters[0]!.shape)).toBe(true);
    expect(Object.isFrozen(record.emitters[0]!.initial.velocity)).toBe(true);
  });

  it('accepts every closed 3D shape, motion, and renderer variant', () => {
    const shapes: CRCParticleShape3D[] = [
      { type: 'point' },
      { type: 'line', from: [0, 0, 0], to: [1, 1, 1] },
      { type: 'box', size: [1, 2, 3], sample: 'surface' },
      { type: 'sphere', radius: 2, thickness: 0.5, sample: 'volume' },
      { type: 'ring', innerRadius: 1, outerRadius: 2 },
      {
        type: 'cone', direction: [0, 1, 0], spreadDegrees: 20,
        length: 3, sample: 'surface',
      },
    ];
    const motions: CRCParticleMotion3D[] = [
      { type: 'acceleration', value: [1, 2, 3] },
      { type: 'gravity', value: [0, -9.8, 0] },
      { type: 'drag', amount: 0.1 },
      { type: 'drift', velocity: [1, 0, 0] },
      { type: 'radialAcceleration', center: [0, 0, 0], amount: 1 },
      {
        type: 'orbit', center: [0, 0, 0], axis: [0, 1, 0],
        degreesPerSecond: 20,
      },
      { type: 'sway', direction: [1, 0, 0], amplitude: 2, frequency: [1, 2] },
      { type: 'angularVelocity', degreesPerSecond: [0, 20, 0] },
    ];
    const renderers: CRCParticleRenderer3D[] = [
      { type: 'point', material: 'unlit', blend: 'additive' },
      {
        type: 'billboard', source: document.createElement('canvas'),
        material: 'emissive', blend: 'alpha',
      },
    ];

    for (const shape of shapes) {
      expect(() => defineParticleEffect3D({ emitters: [emitter({ shape })] }))
        .not.toThrow();
    }
    for (const motion of motions) {
      expect(() => defineParticleEffect3D({ emitters: [emitter({ motion: [motion] })] }))
        .not.toThrow();
    }
    for (const renderer of renderers) {
      expect(() => defineParticleEffect3D({ emitters: [emitter({ renderer })] }))
        .not.toThrow();
    }
  });

  it('rejects a two-dimensional nominal value at the 3D record boundary', () => {
    const effect2D = defineParticleEffect2D({
      emitters: [{
        name: 'dots', capacity: 1,
        emission: [{ type: 'burst', atMilliseconds: 0, count: 1 }],
        shape: { type: 'point' },
        initial: { lifetimeMilliseconds: 1_000 },
        renderer: { type: 'circle' },
      }],
    });

    expect(() => getParticleEffect3DRecord(effect2D as never))
      .toThrowError(/3D.*defineParticleEffect3D/i);
    expect(getParticleEffect2DRecord(effect2D).dimension).toBe(2);
  });
});
