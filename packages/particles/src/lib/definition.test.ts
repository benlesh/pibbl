import { describe, expect, it } from 'vitest';
import { defineParticleEffect2D, particle } from '../index.js';
import {
  getParticleEffect2DRecord,
  getParticleEffect3DRecord,
} from './definition-records.js';
import type {
  CRCParticleEmitter2D,
  CRCParticleMotion2D,
  CRCParticleRenderer2D,
  CRCParticleShape2D,
} from './types.js';

function emitter(
  overrides: Partial<CRCParticleEmitter2D> = {},
): CRCParticleEmitter2D {
  return {
    name: 'sparks',
    capacity: 64,
    emission: [{ type: 'burst', atMilliseconds: 0, count: 8 }],
    shape: { type: 'point', position: [1, 2] },
    initial: {
      lifetimeMilliseconds: 1_000,
      velocity: [3, -4],
      size: 2,
    },
    renderer: { type: 'circle' },
    ...overrides,
  };
}

describe('defineParticleEffect2D', () => {
  it('publishes a frozen nominal value and keeps emitter order with stable name hashes', () => {
    const effect = defineParticleEffect2D({
      debugName: 'ordered effect',
      emitters: [emitter(), emitter({ name: 'smoke' })],
    });
    const record = getParticleEffect2DRecord(effect);

    expect(effect).toEqual({ dimension: 2 });
    expect(Object.isFrozen(effect)).toBe(true);
    expect(record.emitters.map(value => value.name)).toEqual(['sparks', 'smoke']);
    expect(record.emitters.map(value => value.nameHash)).toEqual([
      2_419_137_115,
      1_611_018_502,
    ]);
    expect(record.capabilities).toEqual({
      statelessCanvas: true,
      statelessWebGL: false,
      requiresStateful: [],
    });
  });

  it('derives finite conservative bounds from shape, lifetime, velocity, and size', () => {
    const record = getParticleEffect2DRecord(defineParticleEffect2D({
      emitters: [emitter()],
    }));

    expect(record.emitters[0]!.bounds).toEqual({ min: [0, -3], max: [5, 3] });
    expect(record.emitters[0]!.boundsSource).toBe('derived');
  });

  it('rejects unknown parameter references with complete diagnostic context', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'weather',
      parameters: {
        breeze: { type: 'number', default: 1, timing: 'simulation' },
      },
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: 1_000,
          velocity: [particle.parameter('missing'), 0],
        },
        bounds: { min: [-10, -10], max: [10, 10] },
      })],
    })).toThrowError(
      /weather.*emitter.*sparks.*initial\.velocity\[0\].*missing/i,
    );
  });

  it('rejects empty and duplicate emitter names and empty effects', () => {
    expect(() => defineParticleEffect2D({ emitters: [] as never }))
      .toThrowError(/emitters.*nonempty/i);
    expect(() => defineParticleEffect2D({ emitters: [emitter({ name: '' })] }))
      .toThrowError(/emitter.*name.*nonempty/i);
    expect(() => defineParticleEffect2D({
      debugName: 'duplicates',
      emitters: [emitter(), emitter()],
    })).toThrowError(/duplicates.*emitter.*sparks.*duplicate/i);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid capacity %s with effect, emitter, property, and value',
    capacity => {
      expect(() => defineParticleEffect2D({
        debugName: 'bad capacity',
        emitters: [emitter({ capacity })],
      })).toThrowError(
        new RegExp(`bad capacity.*emitter.*sparks.*capacity.*${String(capacity)}`, 'i'),
      );
    },
  );

  it.each([
    [{ type: 'rectangle', width: -1, height: 2, sample: 'interior' }, 'width'],
    [{ type: 'circle', radius: -1, sample: 'interior' }, 'radius'],
    [{ type: 'ring', innerRadius: 3, outerRadius: 2 }, 'outerRadius'],
    [{ type: 'point', position: [0, Number.NaN] }, 'position\\[1\\]'],
  ] as const)('rejects invalid shape %#', (shape, property) => {
    expect(() => defineParticleEffect2D({
      debugName: 'bad shape',
      emitters: [emitter({ shape: shape as CRCParticleShape2D })],
    })).toThrowError(new RegExp(`bad shape.*sparks.*shape.*${property}`, 'i'));
  });

  it.each([
    [{ min: [1, 0], max: [0, 1] }, 'min\\[0\\]'],
    [{ min: [0, 0], max: [1, Number.NaN] }, 'max\\[1\\]'],
  ] as const)('rejects invalid explicit bounds %#', (bounds, property) => {
    expect(() => defineParticleEffect2D({
      debugName: 'bad bounds',
      emitters: [emitter({ bounds: bounds as never })],
    })).toThrowError(new RegExp(`bad bounds.*sparks.*bounds.*${property}`, 'i'));
  });

  it('rejects ambiguous same-attribute motion writers', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'writer conflict',
      emitters: [emitter({
        motion: [
          { type: 'orbit', center: [0, 0], degreesPerSecond: 30 },
          { type: 'orbit', center: [1, 1], degreesPerSecond: 60 },
        ],
      })],
    })).toThrowError(/writer conflict.*sparks.*motion\[1\].*orbit.*position/i);
  });

  it('accepts additive drift and sway writers without inventing a conflict', () => {
    expect(() => defineParticleEffect2D({
      emitters: [emitter({
        motion: [
          { type: 'drift', velocity: [1, 0] },
          { type: 'sway', amplitude: 2, frequency: 1 },
        ],
      })],
    })).not.toThrow();
  });

  it('reports malformed nested records through contextual definition errors', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'malformed effect',
      emitters: [null as never],
    })).toThrowError(/malformed effect.*emitter.*record/i);

    const malformed: readonly [Partial<CRCParticleEmitter2D>, string][] = [
      [{ shape: null as never }, 'shape'],
      [{ initial: null as never }, 'initial'],
      [{ emission: [null as never] }, 'emission\\[0\\]'],
      [{ motion: [null as never] }, 'motion\\[0\\]'],
      [{ appearance: null as never }, 'appearance'],
      [{ renderer: null as never }, 'renderer'],
      [{ bounds: null as never }, 'bounds'],
    ];
    for (const [overrides, property] of malformed) {
      expect(() => defineParticleEffect2D({
        debugName: 'malformed effect',
        emitters: [emitter(overrides)],
      })).toThrowError(new RegExp(`malformed effect.*sparks.*${property}.*record`, 'i'));
    }
  });

  it('requires explicit finite bounds when parameterized motion is dynamic', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'dynamic wind',
      parameters: {
        wind: { type: 'number', default: 1, timing: 'simulation' },
      },
      emitters: [emitter({
        motion: [{ type: 'drift', velocity: [particle.parameter('wind'), 0] }],
      })],
    })).toThrowError(/dynamic wind.*sparks.*bounds.*explicit.*dynamic/i);
  });

  it('requires explicit bounds for render parameters that affect particle size', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'live size',
      parameters: {
        size: { type: 'number', default: 2, timing: 'render' },
      },
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: 1_000,
          size: particle.parameter('size'),
        },
      })],
    })).toThrowError(/live size.*sparks.*bounds.*explicit.*parameter/i);
  });

  it('rejects nonfinite arithmetic in compiler-derived bounds', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'overflowing bounds',
      emitters: [emitter({
        initial: {
          lifetimeMilliseconds: Number.MAX_VALUE,
          velocity: [Number.MAX_VALUE, 0],
        },
      })],
    })).toThrowError(
      /overflowing bounds.*sparks.*bounds\.max\[0\].*finite.*Infinity/i,
    );
  });

  it('reports a null emission repeat through a contextual definition error', () => {
    expect(() => defineParticleEffect2D({
      debugName: 'malformed repeat',
      emitters: [emitter({
        emission: [{
          type: 'rate',
          particlesPerSecond: 10,
          repeat: null,
        } as never],
      })],
    })).toThrowError(
      /malformed repeat.*sparks.*emission\[0\].*repeat.*record.*null/i,
    );
  });

  it('copies caller records, deeply freezes normalized storage, and retains sprite identity', () => {
    const velocity: [number, number] = [3, -4];
    const motion: CRCParticleMotion2D[] = [{ type: 'acceleration', value: [1, 2] }];
    const emission = [{ type: 'burst' as const, atMilliseconds: 0, count: 8 }];
    const parameters = {
      strength: { type: 'number' as const, default: 1, timing: 'spawn' as const },
    };
    const source = document.createElement('canvas');
    const effect = defineParticleEffect2D({
      parameters,
      emitters: [emitter({
        emission,
        initial: { lifetimeMilliseconds: 1_000, velocity },
        motion,
        renderer: { type: 'sprite', source, anchor: [0.25, 0.75] },
        bounds: { min: [-10, -10], max: [10, 10] },
      })],
    });

    velocity[0] = 99;
    motion[0] = { type: 'drag', amount: 99 };
    emission[0]!.count = 99;
    parameters.strength.default = 99;

    const record = getParticleEffect2DRecord(effect);
    const renderer = record.emitters[0]!.renderer;
    if (renderer.type !== 'sprite') throw new Error('expected sprite renderer');
    expect(record.emitters[0]!.initial.velocity).toEqual([3, -4]);
    expect(record.emitters[0]!.motion).toEqual([
      { type: 'acceleration', value: [1, 2] },
    ]);
    expect(record.emitters[0]!.emission[0]).toMatchObject({ count: 8 });
    expect(record.parameters.strength!.default).toBe(1);
    expect(renderer.source).toBe(source);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.parameters)).toBe(true);
    expect(Object.isFrozen(record.emitters)).toBe(true);
    expect(Object.isFrozen(record.emitters[0]!.initial.velocity)).toBe(true);
    expect(Object.isFrozen(record.emitters[0]!.motion![0]!)).toBe(true);
    expect(Object.isFrozen(record.emitters[0]!.bounds.min)).toBe(true);
  });

  it('clones Path2D renderer assets instead of retaining caller-owned mutable paths', () => {
    const source = new Path2D();
    source.rect(0, 0, 10, 10);
    const effect = defineParticleEffect2D({
      emitters: [emitter({
        renderer: { type: 'path', path: source },
        bounds: { min: [-10, -10], max: [10, 10] },
      })],
    });
    const path = getParticleEffect2DRecord(effect).emitters[0]!.renderer;
    if (path.type !== 'path') throw new Error('expected path renderer');

    source.rect(100, 100, 10, 10);
    const context = document.createElement('canvas').getContext('2d')!;
    expect(path.path).not.toBe(source);
    expect(context.isPointInPath(path.path, 5, 5)).toBe(true);
    expect(context.isPointInPath(path.path, 105, 105)).toBe(false);
  });

  it('accepts every closed 2D shape, motion, and renderer variant', () => {
    const shapes: CRCParticleShape2D[] = [
      { type: 'point' },
      { type: 'line', from: [0, 0], to: [1, 1] },
      { type: 'rectangle', width: 2, height: 3, sample: 'edge' },
      { type: 'circle', radius: 2, sample: 'circumference' },
      { type: 'ring', innerRadius: 1, outerRadius: 2 },
    ];
    const motions: CRCParticleMotion2D[] = [
      { type: 'acceleration', value: [1, 2] },
      { type: 'gravity', value: [0, 9.8] },
      { type: 'drag', amount: 0.1 },
      { type: 'drift', velocity: [1, 0] },
      { type: 'radialAcceleration', center: [0, 0], amount: 1 },
      { type: 'orbit', center: [0, 0], degreesPerSecond: 20 },
      { type: 'sway', amplitude: 2, frequency: [1, 2] },
      { type: 'angularVelocity', degreesPerSecond: 30 },
    ];
    const renderers: CRCParticleRenderer2D[] = [
      { type: 'circle' },
      { type: 'rectangle', aspectRatio: 2, blend: 'additive' },
      { type: 'path', path: new Path2D() },
      { type: 'sprite', source: document.createElement('canvas') },
    ];

    for (const shape of shapes) {
      expect(() => defineParticleEffect2D({ emitters: [emitter({ shape })] }))
        .not.toThrow();
    }
    for (const motion of motions) {
      expect(() => defineParticleEffect2D({ emitters: [emitter({ motion: [motion] })] }))
        .not.toThrow();
    }
    for (const renderer of renderers) {
      expect(() => defineParticleEffect2D({
        emitters: [emitter({
          renderer,
          bounds: { min: [-10, -10], max: [10, 10] },
        })],
      })).not.toThrow();
    }
  });

  it('rejects a three-dimensional nominal value at the 2D record boundary', async () => {
    const { defineParticleEffect3D } = await import('../webgl.js');
    const effect3D = defineParticleEffect3D({
      emitters: [{
        name: 'stars',
        capacity: 1,
        emission: [{ type: 'burst', atMilliseconds: 0, count: 1 }],
        shape: { type: 'point' },
        initial: { lifetimeMilliseconds: 1_000 },
        renderer: { type: 'point', material: 'unlit', blend: 'additive' },
      }],
    });

    expect(() => getParticleEffect2DRecord(effect3D as never))
      .toThrowError(/2D.*defineParticleEffect2D/i);
    expect(getParticleEffect3DRecord(effect3D).dimension).toBe(3);
  });
});
