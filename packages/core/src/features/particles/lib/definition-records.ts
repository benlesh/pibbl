import { PathGeometry, toPath2D } from '@crc/core';
import type {
  CRCParticleAppearance,
  CRCParticleBounds2D,
  CRCParticleEffect2D,
  CRCParticleEmission,
  CRCParticleEmitter2D,
  CRCParticleParameterDefinition,
  CRCParticleParameterDefinitions,
  CRCParticleRenderer2D,
  CRCParticleScalar,
} from './types.js';
import { getParticleDescriptorRecord } from './particle.js';

export interface ParticleDefinitionCapabilities {
  readonly statelessCanvas: boolean;
  readonly requiresStateful: readonly string[];
}

type NativeParticleRenderer2D = Exclude<CRCParticleRenderer2D, { type: 'path' }> | Readonly<{ type: 'path'; path: Path2D; blend?: 'source-over' | 'additive' }>;

export interface ParticleEmitter2DRecord
  extends Omit<CRCParticleEmitter2D, 'bounds' | 'renderer'> {
  readonly renderer: NativeParticleRenderer2D;
  readonly nameHash: number;
  readonly bounds: CRCParticleBounds2D;
  readonly boundsSource: 'explicit' | 'derived';
}

interface BaseParticleEffectRecord {
  readonly debugName: string | undefined;
  readonly parameters: CRCParticleParameterDefinitions;
  readonly emitterNames: readonly string[];
  readonly capabilities: ParticleDefinitionCapabilities;
}

export interface ParticleEffect2DRecord extends BaseParticleEffectRecord {
  readonly dimension: 2;
  readonly emitters: readonly ParticleEmitter2DRecord[];
}

export interface ParticleValidationContext {
  readonly debugName?: string;
  readonly emitter?: string;
  readonly module?: string;
  readonly property?: string;
}

export interface ParticleScalarRange {
  readonly min: number;
  readonly max: number;
  readonly dynamic: boolean;
}

const effect2DRecords = new WeakMap<CRCParticleEffect2D, ParticleEffect2DRecord>();

function effectLabel(debugName: string | undefined): string {
  return debugName === undefined ? 'CRC particle effect' :
    `CRC particle effect "${debugName}"`;
}

function valueLabel(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function particleDefinitionError(
  context: ParticleValidationContext,
  message: string,
  value?: unknown,
  ErrorConstructor: typeof TypeError | typeof RangeError = TypeError,
): never {
  const path = [
    effectLabel(context.debugName),
    context.emitter === undefined ? undefined : `emitter "${context.emitter}"`,
    context.module,
    context.property,
  ].filter((part): part is string => part !== undefined).join(' ');
  const received = arguments.length >= 3 ? `; received ${valueLabel(value)}` : '';
  throw new ErrorConstructor(`${path} ${message}${received}.`);
}

export function assertFiniteNumber(
  value: unknown,
  context: ParticleValidationContext,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    particleDefinitionError(context, 'must be finite', value, RangeError);
  }
}

export function assertNonnegativeNumber(
  value: unknown,
  context: ParticleValidationContext,
): asserts value is number {
  assertFiniteNumber(value, context);
  if (value < 0) particleDefinitionError(context, 'must be nonnegative', value, RangeError);
}

export function assertPositiveNumber(
  value: unknown,
  context: ParticleValidationContext,
): asserts value is number {
  assertFiniteNumber(value, context);
  if (value <= 0) particleDefinitionError(context, 'must be positive', value, RangeError);
}

export function assertFiniteVector(
  value: unknown,
  dimension: 2,
  context: ParticleValidationContext,
): asserts value is readonly number[] {
  if (!Array.isArray(value) || value.length !== dimension) {
    particleDefinitionError(context, `must be a ${dimension}-dimensional vector`, value);
  }
  for (let index = 0; index < dimension; index += 1) {
    assertFiniteNumber(value[index], {
      ...context,
      property: `${context.property ?? 'value'}[${index}]`,
    });
  }
}

export function freezeParticleRecord<T>(
  value: T,
  seen = new WeakSet<object>(),
): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  if (getParticleDescriptorRecord(value) !== undefined) return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return value;
  }
  seen.add(value);
  for (const entry of Object.values(value)) freezeParticleRecord(entry, seen);
  return Object.freeze(value);
}

export function cloneParticleRecord<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
): T {
  if (value === null || typeof value !== 'object') return value;
  if (getParticleDescriptorRecord(value) !== undefined) return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const entry of value) clone.push(cloneParticleRecord(entry, seen));
    return Object.freeze(clone) as T;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const clone: Record<string, unknown> = Object.create(prototype);
  seen.set(value, clone);
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneParticleRecord(entry, seen);
  }
  return Object.freeze(clone) as T;
}

export function hashParticleEmitterName(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeParameters(
  parameters: CRCParticleParameterDefinitions | undefined,
  debugName: string | undefined,
): CRCParticleParameterDefinitions {
  if (parameters === undefined) return Object.freeze({});
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    particleDefinitionError({ debugName, property: 'parameters' }, 'must be a record', parameters);
  }
  const normalized: Record<string, CRCParticleParameterDefinition> = {};
  for (const [name, definition] of Object.entries(parameters)) {
    if (name.trim().length === 0) {
      particleDefinitionError(
        { debugName, property: 'parameters' },
        'parameter names must be nonempty',
        name,
      );
    }
    if (definition === null || typeof definition !== 'object') {
      particleDefinitionError(
        { debugName, module: `parameter "${name}"`, property: 'definition' },
        'must be a record',
        definition,
      );
    }
    if (!['spawn', 'simulation', 'render'].includes(definition.timing)) {
      particleDefinitionError(
        { debugName, module: `parameter "${name}"`, property: 'timing' },
        'must be spawn, simulation, or render',
        definition.timing,
      );
    }
    switch (definition.type) {
      case 'number':
        assertFiniteNumber(definition.default, {
          debugName, module: `parameter "${name}"`, property: 'default',
        });
        break;
      case 'vector2':
        assertFiniteVector(definition.default, 2, {
          debugName, module: `parameter "${name}"`, property: 'default',
        });
        break;
      case 'color':
        if (typeof definition.default !== 'string' || definition.default.trim().length === 0) {
          particleDefinitionError(
            { debugName, module: `parameter "${name}"`, property: 'default' },
            'must be a nonempty color string',
            definition.default,
          );
        }
        break;
      default:
        particleDefinitionError(
          { debugName, module: `parameter "${name}"`, property: 'type' },
          'uses an unsupported parameter type',
          (definition as { type?: unknown }).type,
        );
    }
    normalized[name] = cloneParticleRecord(definition);
  }
  return Object.freeze(normalized);
}

function descriptorScalarRange(
  value: object,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): ParticleScalarRange {
  const descriptor = getParticleDescriptorRecord(value);
  if (descriptor === undefined) {
    particleDefinitionError(
      context,
      'must use a descriptor created by particle',
      value,
    );
  }
  switch (descriptor.type) {
    case 'between':
    case 'integer':
      return Object.freeze({ min: descriptor.min, max: descriptor.max, dynamic: false });
    case 'choice': {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < descriptor.choices.length; index += 1) {
        const choice = descriptor.choices[index]!;
        assertFiniteNumber(choice.value, {
          ...context, property: `${context.property ?? 'value'}.choices[${index}].value`,
        });
        min = Math.min(min, choice.value);
        max = Math.max(max, choice.value);
      }
      return Object.freeze({ min, max, dynamic: false });
    }
    case 'parameter': {
      const definition = parameters[descriptor.name];
      if (definition === undefined) {
        particleDefinitionError(
          context,
          'references an unknown parameter',
          descriptor.name,
        );
      }
      if (definition.type !== 'number') {
        particleDefinitionError(
          context,
          'requires a number parameter',
          `${descriptor.name}:${definition.type}`,
        );
      }
      return Object.freeze({
        min: definition.default,
        max: definition.default,
        dynamic: true,
      });
    }
    default:
      particleDefinitionError(context, 'must be a scalar particle descriptor', descriptor.type);
  }
}

export function particleScalarRange(
  value: CRCParticleScalar,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): ParticleScalarRange {
  if (typeof value === 'number') {
    assertFiniteNumber(value, context);
    return Object.freeze({ min: value, max: value, dynamic: false });
  }
  if (value === null || typeof value !== 'object') {
    particleDefinitionError(context, 'must be a finite particle scalar', value);
  }
  return descriptorScalarRange(value, parameters, context);
}

export function validateScalarVector(
  value: unknown,
  dimension: 2,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): readonly ParticleScalarRange[] {
  if (!Array.isArray(value)) {
    const descriptor = getParticleDescriptorRecord(value);
    if (descriptor?.type !== 'parameter') {
      particleDefinitionError(context, `must be a ${dimension}-dimensional particle vector`, value);
    }
    const definition = parameters[descriptor.name];
    if (definition === undefined) {
      particleDefinitionError(context, 'references an unknown parameter', descriptor.name);
    }
    if (definition.type !== 'vector2') {
      particleDefinitionError(
        context,
        `parameter "${descriptor.name}" has type ${definition.type}; expected a ${dimension}-dimensional vector parameter`,
      );
    }
    return Object.freeze(definition.default.map(entry => Object.freeze({
      min: entry,
      max: entry,
      dynamic: true,
    })));
  }
  if (value.length !== dimension) {
    particleDefinitionError(context, `must be a ${dimension}-dimensional particle vector`, value);
  }
  return Object.freeze(value.map((entry, index) => particleScalarRange(
    entry as CRCParticleScalar,
    parameters,
    { ...context, property: `${context.property ?? 'value'}[${index}]` },
  )));
}

function validateRepeat(
  repeat: { readonly everyMilliseconds: number; readonly count: number } | undefined,
  context: ParticleValidationContext,
): void {
  if (repeat === undefined) return;
  if (repeat === null || typeof repeat !== 'object') {
    particleDefinitionError(context, 'must be a record', repeat);
  }
  assertPositiveNumber(repeat.everyMilliseconds, {
    ...context, property: `${context.property}.everyMilliseconds`,
  });
  if (!Number.isSafeInteger(repeat.count) || repeat.count <= 0) {
    particleDefinitionError(
      { ...context, property: `${context.property}.count` },
      'must be a positive safe integer',
      repeat.count,
      RangeError,
    );
  }
}

function validateProbability(value: number | undefined, context: ParticleValidationContext): void {
  if (value === undefined) return;
  assertFiniteNumber(value, context);
  if (value < 0 || value > 1) {
    particleDefinitionError(context, 'must be within [0, 1]', value, RangeError);
  }
}

function validateCount(
  value: number | CRCParticleScalar,
  context: ParticleValidationContext,
): void {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      particleDefinitionError(context, 'must be a positive safe integer', value, RangeError);
    }
    return;
  }
  const descriptor = getParticleDescriptorRecord(value);
  if (descriptor?.type !== 'integer' || descriptor.min <= 0) {
    particleDefinitionError(
      context,
      'must be a positive integer or positive particleInteger range',
      value,
      RangeError,
    );
  }
}

export function normalizeEmission(
  emission: readonly CRCParticleEmission[],
  context: ParticleValidationContext,
): readonly CRCParticleEmission[] {
  if (!Array.isArray(emission) || emission.length === 0) {
    particleDefinitionError(
      { ...context, property: 'emission' },
      'must be a nonempty array',
      emission,
    );
  }
  for (let index = 0; index < emission.length; index += 1) {
    const source = emission[index]!;
    if (source === null || typeof source !== 'object') {
      particleDefinitionError(
        { ...context, module: `emission[${index}]` },
        'must be an emission record',
        source,
      );
    }
    const module = `emission[${index}] ${String((source as { type?: unknown }).type)}`;
    switch (source.type) {
      case 'rate':
        assertNonnegativeNumber(source.particlesPerSecond, {
          ...context, module, property: 'particlesPerSecond',
        });
        if (source.startMilliseconds !== undefined) {
          assertNonnegativeNumber(source.startMilliseconds, {
            ...context, module, property: 'startMilliseconds',
          });
        }
        if (source.durationMilliseconds !== undefined) {
          assertNonnegativeNumber(source.durationMilliseconds, {
            ...context, module, property: 'durationMilliseconds',
          });
        }
        validateProbability(source.probability, {
          ...context, module, property: 'probability',
        });
        validateRepeat(source.repeat, { ...context, module, property: 'repeat' });
        break;
      case 'burst':
        assertNonnegativeNumber(source.atMilliseconds, {
          ...context, module, property: 'atMilliseconds',
        });
        validateCount(source.count, { ...context, module, property: 'count' });
        validateProbability(source.probability, {
          ...context, module, property: 'probability',
        });
        validateRepeat(source.repeat, { ...context, module, property: 'repeat' });
        break;
      case 'manual':
        if (source.count !== undefined) {
          validateCount(source.count, { ...context, module, property: 'count' });
        }
        break;
      default:
        particleDefinitionError(
          { ...context, module, property: 'type' },
          'uses an unsupported emission type',
          (source as { type?: unknown }).type,
        );
    }
  }
  return cloneParticleRecord(emission);
}

export function validateAppearance(
  appearance: CRCParticleAppearance | undefined,
  context: ParticleValidationContext,
): CRCParticleAppearance | undefined {
  if (appearance === undefined) return undefined;
  if (appearance === null || typeof appearance !== 'object' || Array.isArray(appearance)) {
    particleDefinitionError(
      { ...context, property: 'appearance' }, 'must be a record', appearance,
    );
  }
  for (const [property, descriptor] of Object.entries(appearance)) {
    if (descriptor === undefined) continue;
    const record = getParticleDescriptorRecord(descriptor);
    const expected = property === 'color' ? 'gradient' : 'curve';
    if (record?.type !== expected) {
      particleDefinitionError(
        { ...context, module: 'appearance', property },
        `must use particle.${expected}`,
        descriptor,
      );
    }
  }
  return cloneParticleRecord(appearance);
}

export function normalizeBounds2D(
  bounds: CRCParticleBounds2D,
  context: ParticleValidationContext,
): CRCParticleBounds2D {
  if (bounds === null || typeof bounds !== 'object') {
    particleDefinitionError({ ...context, property: 'bounds' }, 'must be a record', bounds);
  }
  assertFiniteVector(bounds.min, 2, { ...context, property: 'bounds.min' });
  assertFiniteVector(bounds.max, 2, { ...context, property: 'bounds.max' });
  for (let index = 0; index < 2; index += 1) {
    if (bounds.min[index]! > bounds.max[index]!) {
      particleDefinitionError(
        { ...context, property: `bounds.min[${index}]` },
        `must be at most bounds.max[${index}]`,
        bounds.min[index],
        RangeError,
      );
    }
  }
  return cloneParticleRecord(bounds);
}

export function normalizeRenderer2D(
  renderer: CRCParticleRenderer2D,
  context: ParticleValidationContext,
): NativeParticleRenderer2D {
  if (renderer === null || typeof renderer !== 'object') {
    particleDefinitionError(
      { ...context, property: 'renderer' }, 'must be a record', renderer,
    );
  }
  const module = `renderer ${String((renderer as { type?: unknown }).type)}`;
  const blend = renderer.blend ?? 'source-over';
  if (blend !== 'source-over' && blend !== 'additive') {
    particleDefinitionError({ ...context, module, property: 'blend' }, 'is unsupported', blend);
  }
  switch (renderer.type) {
    case 'circle':
      return Object.freeze({ type: 'circle', blend });
    case 'rectangle':
      if (renderer.aspectRatio !== undefined) {
        assertPositiveNumber(renderer.aspectRatio, {
          ...context, module, property: 'aspectRatio',
        });
      }
      return Object.freeze({
        type: 'rectangle',
        ...(renderer.aspectRatio === undefined ? {} : { aspectRatio: renderer.aspectRatio }),
        blend,
      });
    case 'path':
      if (renderer.path instanceof PathGeometry) {
        return Object.freeze({ type: 'path', path: toPath2D(renderer.path), blend });
      }
      if (typeof Path2D === 'undefined' || !(renderer.path instanceof Path2D)) {
        particleDefinitionError({ ...context, module, property: 'path' }, 'must be a Path2D or PathGeometry', renderer.path);
      }
      return Object.freeze({ type: 'path', path: new Path2D(renderer.path), blend });
    case 'sprite':
      if (renderer.source === null ||
        (typeof renderer.source !== 'object' && typeof renderer.source !== 'function')) {
        particleDefinitionError(
          { ...context, module, property: 'source' },
          'must be a CanvasImageSource',
          renderer.source,
        );
      }
      if (renderer.anchor !== undefined) {
        assertFiniteVector(renderer.anchor, 2, { ...context, module, property: 'anchor' });
      }
      return Object.freeze({
        type: 'sprite',
        source: renderer.source,
        ...(renderer.anchor === undefined ? {} : {
          anchor: cloneParticleRecord(renderer.anchor),
        }),
        blend,
      });
    default:
      particleDefinitionError(
        { ...context, module, property: 'type' },
        'uses an unsupported Canvas renderer',
        (renderer as { type?: unknown }).type,
      );
  }
}

export function createParticleEffect2D(
  record: ParticleEffect2DRecord,
): CRCParticleEffect2D {
  const effect = Object.freeze({ dimension: 2 as const }) as CRCParticleEffect2D;
  effect2DRecords.set(effect, freezeParticleRecord(record));
  return effect;
}

/** @internal Returns the immutable normalized record for a package-created 2D effect. */
export function getParticleEffect2DRecord(effect: CRCParticleEffect2D): ParticleEffect2DRecord {
  const record = effect2DRecords.get(effect);
  if (record === undefined) {
    throw new TypeError('Expected a 2D particle effect created by defineParticleEffect2D().');
  }
  return record;
}
