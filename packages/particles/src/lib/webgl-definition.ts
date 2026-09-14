import {
  assertFiniteVector,
  assertNonnegativeNumber,
  assertPositiveNumber,
  cloneParticleRecord,
  createParticleEffect3D,
  hashParticleEmitterName,
  normalizeBounds3D,
  normalizeEmission,
  normalizeParameters,
  normalizeRenderer3D,
  particleDefinitionError,
  particleScalarRange,
  referencedStatefulParameters,
  validateAppearance,
  validateScalarVector,
  type ParticleEffect3DRecord,
  type ParticleEmitter3DRecord,
  type ParticleScalarRange,
  type ParticleValidationContext,
} from './definition-records.js';
import { getParticleDescriptorRecord } from './particle.js';
import type {
  CRCParticleBounds3D,
  CRCParticleConeVelocity3D,
  CRCParticleEffect3D,
  CRCParticleEffect3DInput,
  CRCParticleEmitter3D,
  CRCParticleInitial3D,
  CRCParticleMotion3D,
  CRCParticleShape3D,
} from './webgl-types.js';
import type {
  CRCParticleAppearance,
  CRCParticleParameterDefinitions,
  CRCParticleValuesOf,
} from './types.js';

interface MutableBounds {
  min: number[];
  max: number[];
}

function maximumMagnitude(range: ParticleScalarRange): number {
  return Math.max(Math.abs(range.min), Math.abs(range.max));
}

function minimumDisplacement(range: ParticleScalarRange, scale: number): number {
  return Math.min(0, range.min * scale, range.max * scale);
}

function maximumDisplacement(range: ParticleScalarRange, scale: number): number {
  return Math.max(0, range.min * scale, range.max * scale);
}

function normalizeShape(
  shape: CRCParticleShape3D,
  context: ParticleValidationContext,
): { readonly shape: CRCParticleShape3D; readonly bounds: MutableBounds } {
  if (shape === null || typeof shape !== 'object') {
    particleDefinitionError({ ...context, property: 'shape' }, 'must be a record', shape);
  }
  const module = `shape ${String((shape as { type?: unknown }).type)}`;
  switch (shape.type) {
    case 'point': {
      const position = shape.position ?? [0, 0, 0] as const;
      assertFiniteVector(position, 3, { ...context, module, property: 'shape.position' });
      return {
        shape: Object.freeze({ type: 'point', position: cloneParticleRecord(position) }),
        bounds: { min: [...position], max: [...position] },
      };
    }
    case 'line':
      assertFiniteVector(shape.from, 3, { ...context, module, property: 'shape.from' });
      assertFiniteVector(shape.to, 3, { ...context, module, property: 'shape.to' });
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: shape.from.map((value, index) => Math.min(value, shape.to[index]!)),
          max: shape.from.map((value, index) => Math.max(value, shape.to[index]!)),
        },
      };
    case 'box':
      assertFiniteVector(shape.size, 3, { ...context, module, property: 'shape.size' });
      for (let index = 0; index < 3; index += 1) {
        if (shape.size[index]! <= 0) {
          particleDefinitionError(
            { ...context, module, property: `shape.size[${index}]` },
            'must be positive',
            shape.size[index],
            RangeError,
          );
        }
      }
      if (shape.sample !== 'volume' && shape.sample !== 'surface') {
        particleDefinitionError(
          { ...context, module, property: 'shape.sample' },
          'must be volume or surface',
          shape.sample,
        );
      }
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: shape.size.map(value => -value / 2),
          max: shape.size.map(value => value / 2),
        },
      };
    case 'sphere':
      assertNonnegativeNumber(shape.radius, {
        ...context, module, property: 'shape.radius',
      });
      if (shape.thickness !== undefined) {
        assertNonnegativeNumber(shape.thickness, {
          ...context, module, property: 'shape.thickness',
        });
        if (shape.thickness > shape.radius) {
          particleDefinitionError(
            { ...context, module, property: 'shape.thickness' },
            'must be at most shape.radius',
            shape.thickness,
            RangeError,
          );
        }
      }
      if (shape.sample !== 'volume' && shape.sample !== 'surface') {
        particleDefinitionError(
          { ...context, module, property: 'shape.sample' },
          'must be volume or surface',
          shape.sample,
        );
      }
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: [-shape.radius, -shape.radius, -shape.radius],
          max: [shape.radius, shape.radius, shape.radius],
        },
      };
    case 'ring':
      assertNonnegativeNumber(shape.innerRadius, {
        ...context, module, property: 'shape.innerRadius',
      });
      assertNonnegativeNumber(shape.outerRadius, {
        ...context, module, property: 'shape.outerRadius',
      });
      if (shape.innerRadius > shape.outerRadius) {
        particleDefinitionError(
          { ...context, module, property: 'shape.outerRadius' },
          'must be at least shape.innerRadius',
          shape.outerRadius,
          RangeError,
        );
      }
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: [-shape.outerRadius, -shape.outerRadius, 0],
          max: [shape.outerRadius, shape.outerRadius, 0],
        },
      };
    case 'cone': {
      assertFiniteVector(shape.direction, 3, {
        ...context, module, property: 'shape.direction',
      });
      if (Math.hypot(...shape.direction) === 0) {
        particleDefinitionError(
          { ...context, module, property: 'shape.direction' },
          'must be nonzero',
          shape.direction,
          RangeError,
        );
      }
      assertNonnegativeNumber(shape.spreadDegrees, {
        ...context, module, property: 'shape.spreadDegrees',
      });
      if (shape.spreadDegrees > 180) {
        particleDefinitionError(
          { ...context, module, property: 'shape.spreadDegrees' },
          'must be at most 180',
          shape.spreadDegrees,
          RangeError,
        );
      }
      assertPositiveNumber(shape.length, {
        ...context, module, property: 'shape.length',
      });
      if (shape.sample !== 'volume' && shape.sample !== 'surface') {
        particleDefinitionError(
          { ...context, module, property: 'shape.sample' },
          'must be volume or surface',
          shape.sample,
        );
      }
      const radius = shape.length;
      return {
        shape: cloneParticleRecord(shape),
        bounds: { min: [-radius, -radius, -radius], max: [radius, radius, radius] },
      };
    }
    default:
      particleDefinitionError(
        { ...context, module, property: 'shape.type' },
        'uses an unsupported 3D shape',
        (shape as { type?: unknown }).type,
      );
  }
}

function requireRange(
  value: Parameters<typeof particleScalarRange>[0],
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
  minimum?: number,
  maximum?: number,
): ParticleScalarRange {
  const range = particleScalarRange(value, parameters, context);
  if (minimum !== undefined && range.min < minimum) {
    particleDefinitionError(context, `must be at least ${minimum}`, range.min, RangeError);
  }
  if (maximum !== undefined && range.max > maximum) {
    particleDefinitionError(context, `must be at most ${maximum}`, range.max, RangeError);
  }
  return range;
}

function validateColor(
  value: CRCParticleInitial3D['color'],
  context: ParticleValidationContext,
): void {
  if (value === undefined) return;
  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      particleDefinitionError(context, 'must be a nonempty color string', value);
    }
    return;
  }
  const record = getParticleDescriptorRecord(value);
  if (record?.type !== 'choice') {
    particleDefinitionError(context, 'must use particle.choice for variable colors', value);
  }
  for (let index = 0; index < record.choices.length; index += 1) {
    const choice = record.choices[index]!.value;
    if (typeof choice !== 'string' || choice.trim().length === 0) {
      particleDefinitionError(
        { ...context, property: `${context.property}.choices[${index}].value` },
        'must be a nonempty color string',
        choice,
      );
    }
  }
}

function normalizeConeVelocity(
  velocity: CRCParticleConeVelocity3D,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): { readonly velocity: CRCParticleConeVelocity3D; readonly speed: ParticleScalarRange; readonly dynamic: boolean } {
  const direction = validateScalarVector(velocity.direction, 3, parameters, {
    ...context, property: 'initial.velocity.direction',
  });
  if (direction.every(range => range.min === 0 && range.max === 0)) {
    particleDefinitionError(
      { ...context, property: 'initial.velocity.direction' },
      'must be nonzero',
      velocity.direction,
      RangeError,
    );
  }
  const speed = requireRange(velocity.speed, parameters, {
    ...context, property: 'initial.velocity.speed',
  }, 0);
  const spread = requireRange(velocity.spreadDegrees, parameters, {
    ...context, property: 'initial.velocity.spreadDegrees',
  }, 0, 180);
  return Object.freeze({
    velocity: cloneParticleRecord(velocity),
    speed,
    dynamic: direction.some(range => range.dynamic) || speed.dynamic || spread.dynamic,
  });
}

function normalizeInitial(
  initial: CRCParticleInitial3D,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): {
  readonly initial: CRCParticleInitial3D;
  readonly lifetime: ParticleScalarRange;
  readonly velocity: readonly ParticleScalarRange[] | undefined;
  readonly coneSpeed: ParticleScalarRange | undefined;
  readonly maximumSize: number;
  readonly dynamic: boolean;
} {
  if (initial === null || typeof initial !== 'object') {
    particleDefinitionError(
      { ...context, property: 'initial' }, 'must be a record', initial,
    );
  }
  const lifetime = requireRange(initial.lifetimeMilliseconds, parameters, {
    ...context, module: 'initial', property: 'initial.lifetimeMilliseconds',
  });
  if (lifetime.min <= 0) {
    particleDefinitionError(
      { ...context, module: 'initial', property: 'initial.lifetimeMilliseconds' },
      'must be positive', lifetime.min, RangeError,
    );
  }
  let velocity: readonly ParticleScalarRange[] | undefined;
  let coneSpeed: ParticleScalarRange | undefined;
  let dynamic = lifetime.dynamic;
  if (initial.velocity !== undefined) {
    if (!Array.isArray(initial.velocity) && 'type' in initial.velocity &&
      initial.velocity.type === 'cone') {
      const cone = normalizeConeVelocity(initial.velocity, parameters, {
        ...context, module: 'initial cone velocity',
      });
      coneSpeed = cone.speed;
      dynamic ||= cone.dynamic;
    } else {
      velocity = validateScalarVector(initial.velocity, 3, parameters, {
        ...context, module: 'initial', property: 'initial.velocity',
      });
      dynamic ||= velocity.some(range => range.dynamic);
    }
  }
  let maximumSize = 1;
  if (initial.size !== undefined) {
    const ranges = Array.isArray(initial.size) ? validateScalarVector(
      initial.size,
      2,
      parameters,
      { ...context, module: 'initial', property: 'initial.size' },
    ) : [requireRange(
      initial.size as Parameters<typeof particleScalarRange>[0],
      parameters,
      { ...context, module: 'initial', property: 'initial.size' },
      0,
    )];
    for (const range of ranges) {
      if (range.min < 0) {
        particleDefinitionError(
          { ...context, module: 'initial', property: 'initial.size' },
          'must be nonnegative', range.min, RangeError,
        );
      }
      maximumSize = Math.max(maximumSize, maximumMagnitude(range));
      dynamic ||= range.dynamic;
    }
  }
  if (initial.rotationDegrees !== undefined) {
    const range = requireRange(initial.rotationDegrees, parameters, {
      ...context, module: 'initial', property: 'initial.rotationDegrees',
    });
    dynamic ||= range.dynamic;
  }
  if (initial.angularVelocityDegreesPerSecond !== undefined) {
    const range = requireRange(initial.angularVelocityDegreesPerSecond, parameters, {
      ...context, module: 'initial',
      property: 'initial.angularVelocityDegreesPerSecond',
    });
    dynamic ||= range.dynamic;
  }
  validateColor(initial.color, {
    ...context, module: 'initial', property: 'initial.color',
  });
  if (initial.opacity !== undefined) {
    const range = requireRange(initial.opacity, parameters, {
      ...context, module: 'initial', property: 'initial.opacity',
    }, 0, 1);
    dynamic ||= range.dynamic;
  }
  return Object.freeze({
    initial: cloneParticleRecord(initial), lifetime, velocity, coneSpeed,
    maximumSize, dynamic,
  });
}

function maximumAppearanceSize(
  appearance: CRCParticleAppearance | undefined,
  current: number,
): number {
  if (appearance?.size === undefined) return current;
  let maximum = current;
  for (const [, value] of appearance.size.keys) {
    maximum = typeof value === 'number' ? Math.max(maximum, Math.abs(value)) :
      Math.max(maximum, Math.abs(value[0]), Math.abs(value[1]));
  }
  return maximum;
}

interface MotionRange {
  readonly type: string;
  readonly value?: readonly ParticleScalarRange[];
  readonly amount?: ParticleScalarRange;
  readonly amplitude?: ParticleScalarRange;
  readonly center?: readonly [number, number, number];
}

function normalizeMotion(
  motion: readonly CRCParticleMotion3D[] | undefined,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): { readonly motion: readonly CRCParticleMotion3D[]; readonly ranges: readonly MotionRange[]; readonly dynamic: boolean } {
  if (motion === undefined) {
    return Object.freeze({ motion: Object.freeze([]), ranges: Object.freeze([]), dynamic: false });
  }
  if (!Array.isArray(motion)) {
    particleDefinitionError({ ...context, property: 'motion' }, 'must be an array', motion);
  }
  let orbitWriter: number | undefined;
  let additivePositionWriter: number | undefined;
  let dynamic = false;
  const ranges: MotionRange[] = [];
  for (let index = 0; index < motion.length; index += 1) {
    const value = motion[index]!;
    if (value === null || typeof value !== 'object') {
      particleDefinitionError(
        { ...context, module: `motion[${index}]`, property: 'motion' },
        'must be a record',
        value,
      );
    }
    const module = `motion[${index}] ${String((value as { type?: unknown }).type)}`;
    if (value.type === 'orbit') {
      const earlier = orbitWriter ?? additivePositionWriter;
      if (earlier !== undefined) {
        particleDefinitionError(
          { ...context, module, property: 'position' },
          `ambiguously writes position already written by motion[${earlier}]`,
          value.type,
        );
      }
      orbitWriter = index;
    } else if (value.type === 'drift' || value.type === 'sway') {
      if (orbitWriter !== undefined) {
        particleDefinitionError(
          { ...context, module, property: 'position' },
          `ambiguously writes position already written by motion[${orbitWriter}]`,
          value.type,
        );
      }
      additivePositionWriter ??= index;
    }
    switch (value.type) {
      case 'acceleration':
      case 'gravity':
      case 'drift': {
        const vector = validateScalarVector(
          value.type === 'drift' ? value.velocity : value.value,
          3,
          parameters,
          {
            ...context, module,
            property: value.type === 'drift' ? 'motion.velocity' : 'motion.value',
          },
        );
        ranges.push({ type: value.type, value: vector });
        dynamic ||= vector.some(range => range.dynamic);
        break;
      }
      case 'drag': {
        const amount = requireRange(value.amount, parameters, {
          ...context, module, property: 'motion.amount',
        }, 0);
        ranges.push({ type: 'drag', amount });
        dynamic ||= amount.dynamic;
        break;
      }
      case 'radialAcceleration': {
        assertFiniteVector(value.center, 3, {
          ...context, module, property: 'motion.center',
        });
        const amount = requireRange(value.amount, parameters, {
          ...context, module, property: 'motion.amount',
        });
        ranges.push({ type: value.type, center: value.center, amount });
        dynamic ||= amount.dynamic;
        break;
      }
      case 'orbit': {
        assertFiniteVector(value.center, 3, {
          ...context, module, property: 'motion.center',
        });
        const axis = validateScalarVector(value.axis, 3, parameters, {
          ...context, module, property: 'motion.axis',
        });
        if (axis.every(range => range.min === 0 && range.max === 0)) {
          particleDefinitionError(
            { ...context, module, property: 'motion.axis' },
            'must be nonzero', value.axis, RangeError,
          );
        }
        const speed = requireRange(value.degreesPerSecond, parameters, {
          ...context, module, property: 'motion.degreesPerSecond',
        });
        ranges.push({ type: value.type, center: value.center });
        dynamic ||= axis.some(range => range.dynamic) || speed.dynamic;
        break;
      }
      case 'sway': {
        const direction = validateScalarVector(value.direction, 3, parameters, {
          ...context, module, property: 'motion.direction',
        });
        if (direction.every(range => range.min === 0 && range.max === 0)) {
          particleDefinitionError(
            { ...context, module, property: 'motion.direction' },
            'must be nonzero', value.direction, RangeError,
          );
        }
        const amplitude = requireRange(value.amplitude, parameters, {
          ...context, module, property: 'motion.amplitude',
        }, 0);
        const frequency: readonly ParticleScalarRange[] =
          Array.isArray(value.frequency) ? value.frequency.map(
            (entry: number, entryIndex: number) => requireRange(entry, parameters, {
              ...context, module, property: `motion.frequency[${entryIndex}]`,
            }, 0),
          ) : [requireRange(value.frequency, parameters, {
            ...context, module, property: 'motion.frequency',
          }, 0)];
        ranges.push({ type: value.type, amplitude });
        dynamic ||= direction.some(range => range.dynamic) || amplitude.dynamic ||
          frequency.some(range => range.dynamic);
        break;
      }
      case 'angularVelocity': {
        const speed = validateScalarVector(value.degreesPerSecond, 3, parameters, {
          ...context, module, property: 'motion.degreesPerSecond',
        });
        dynamic ||= speed.some(range => range.dynamic);
        ranges.push({ type: value.type });
        break;
      }
      default:
        particleDefinitionError(
          { ...context, module, property: 'motion.type' },
          'uses an unsupported 3D motion module',
          (value as { type?: unknown }).type,
        );
    }
  }
  return Object.freeze({
    motion: cloneParticleRecord(motion),
    ranges: Object.freeze(ranges.map(value => cloneParticleRecord(value))),
    dynamic,
  });
}

function deriveBounds(
  shape: MutableBounds,
  lifetimeMilliseconds: number,
  velocity: readonly ParticleScalarRange[] | undefined,
  coneSpeed: ParticleScalarRange | undefined,
  motion: readonly MotionRange[],
  size: number,
): CRCParticleBounds3D {
  const seconds = lifetimeMilliseconds / 1_000;
  const bounds: MutableBounds = { min: [...shape.min], max: [...shape.max] };
  if (velocity !== undefined) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis]! += minimumDisplacement(velocity[axis]!, seconds);
      bounds.max[axis]! += maximumDisplacement(velocity[axis]!, seconds);
    }
  } else if (coneSpeed !== undefined) {
    const expansion = maximumMagnitude(coneSpeed) * seconds;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis]! -= expansion;
      bounds.max[axis]! += expansion;
    }
  }
  for (const value of motion) {
    if (value.type === 'acceleration' || value.type === 'gravity') {
      const scale = 0.5 * seconds * seconds;
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis]! += minimumDisplacement(value.value![axis]!, scale);
        bounds.max[axis]! += maximumDisplacement(value.value![axis]!, scale);
      }
    } else if (value.type === 'drift') {
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis]! += minimumDisplacement(value.value![axis]!, seconds);
        bounds.max[axis]! += maximumDisplacement(value.value![axis]!, seconds);
      }
    } else if (value.type === 'radialAcceleration') {
      const expansion = 0.5 * maximumMagnitude(value.amount!) * seconds * seconds;
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis]! -= expansion;
        bounds.max[axis]! += expansion;
      }
    } else if (value.type === 'sway') {
      const expansion = maximumMagnitude(value.amplitude!);
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis]! -= expansion;
        bounds.max[axis]! += expansion;
      }
    } else if (value.type === 'orbit') {
      const center = value.center!;
      let radius = 0;
      for (const x of [bounds.min[0]!, bounds.max[0]!]) {
        for (const y of [bounds.min[1]!, bounds.max[1]!]) {
          for (const z of [bounds.min[2]!, bounds.max[2]!]) {
            radius = Math.max(radius, Math.hypot(x - center[0], y - center[1], z - center[2]));
          }
        }
      }
      bounds.min = center.map(valueAtAxis => valueAtAxis - radius);
      bounds.max = center.map(valueAtAxis => valueAtAxis + radius);
    }
  }
  const expansion = size / 2;
  return Object.freeze({
    min: Object.freeze(bounds.min.map(value => value - expansion)) as unknown as readonly [number, number, number],
    max: Object.freeze(bounds.max.map(value => value + expansion)) as unknown as readonly [number, number, number],
  });
}

function normalizeEmitter(
  input: CRCParticleEmitter3D,
  parameters: CRCParticleParameterDefinitions,
  debugName: string | undefined,
): ParticleEmitter3DRecord {
  if (input === null || typeof input !== 'object') {
    particleDefinitionError(
      { debugName, property: 'emitter' }, 'must be a record', input,
    );
  }
  const context = { debugName, emitter: input.name };
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    particleDefinitionError(
      { debugName, emitter: String(input.name), property: 'name' },
      'must be a nonempty string', input.name,
    );
  }
  if (!Number.isSafeInteger(input.capacity) || input.capacity <= 0) {
    particleDefinitionError(
      { ...context, property: 'capacity' },
      'must be a positive finite safe integer', input.capacity, RangeError,
    );
  }
  if (input.space !== undefined && input.space !== 'local') {
    particleDefinitionError(
      { ...context, property: 'space' }, 'must be local in Project 1', input.space,
    );
  }
  if (input.overflow !== undefined &&
    input.overflow !== 'reject-newest' && input.overflow !== 'recycle-oldest') {
    particleDefinitionError(
      { ...context, property: 'overflow' }, 'is unsupported', input.overflow,
    );
  }
  const emission = normalizeEmission(input.emission, context);
  const normalizedShape = normalizeShape(input.shape, context);
  const normalizedInitial = normalizeInitial(input.initial, parameters, context);
  const normalizedMotion = normalizeMotion(input.motion, parameters, context);
  const appearance = validateAppearance(input.appearance, context);
  const renderer = normalizeRenderer3D(input.renderer, context);
  const cannotDerive = normalizedInitial.dynamic || normalizedMotion.dynamic;
  let bounds: CRCParticleBounds3D;
  let boundsSource: 'explicit' | 'derived';
  if (input.bounds !== undefined) {
    bounds = normalizeBounds3D(input.bounds, context);
    boundsSource = 'explicit';
  } else if (cannotDerive) {
    particleDefinitionError(
      { ...context, property: 'bounds' },
      'must be explicit and finite for dynamic motion',
    );
  } else {
    bounds = deriveBounds(
      normalizedShape.bounds,
      normalizedInitial.lifetime.max,
      normalizedInitial.velocity,
      normalizedInitial.coneSpeed,
      normalizedMotion.ranges,
      maximumAppearanceSize(appearance, normalizedInitial.maximumSize),
    );
    boundsSource = 'derived';
  }
  return Object.freeze({
    name: input.name,
    nameHash: hashParticleEmitterName(input.name),
    capacity: input.capacity,
    overflow: input.overflow ?? 'reject-newest',
    space: 'local',
    emission,
    shape: normalizedShape.shape,
    initial: normalizedInitial.initial,
    motion: normalizedMotion.motion,
    ...(appearance === undefined ? {} : { appearance }),
    renderer,
    bounds,
    boundsSource,
  });
}

export function defineParticleEffect3D<
  const Input extends CRCParticleEffect3DInput,
>(
  input: Input,
): CRCParticleEffect3D<
  Input['emitters'][number]['name'],
  CRCParticleValuesOf<
    Input extends { readonly parameters: infer Definitions }
      ? Extract<Definitions, CRCParticleParameterDefinitions>
      : undefined
  >
> {
  if (input === null || typeof input !== 'object') {
    particleDefinitionError({}, 'input must be a record', input);
  }
  const debugName = input.debugName;
  if (debugName !== undefined &&
    (typeof debugName !== 'string' || debugName.trim().length === 0)) {
    particleDefinitionError({ property: 'debugName' }, 'must be a nonempty string', debugName);
  }
  if (!Array.isArray(input.emitters) || input.emitters.length === 0) {
    particleDefinitionError({ debugName, property: 'emitters' }, 'must be nonempty', input.emitters);
  }
  const parameters = normalizeParameters(input.parameters, debugName, 3);
  const emitters: ParticleEmitter3DRecord[] = [];
  const names = new Set<string>();
  const requiresStateful: string[] = [];
  for (const emitter of input.emitters) {
    if (emitter === null || typeof emitter !== 'object') {
      particleDefinitionError(
        { debugName, property: 'emitter' }, 'must be a record', emitter,
      );
    }
    if (names.has(emitter.name)) {
      particleDefinitionError(
        { debugName, emitter: emitter.name, property: 'name' },
        'must be unique; duplicate emitter name', emitter.name,
      );
    }
    names.add(emitter.name);
    const normalized = normalizeEmitter(emitter, parameters, debugName);
    emitters.push(normalized);
    for (const reference of referencedStatefulParameters(
      { initial: normalized.initial, motion: normalized.motion },
      parameters,
    )) {
      requiresStateful.push(
        `emitter "${normalized.name}" uses ${reference.timing} parameter "${reference.name}"`,
      );
    }
    if (normalized.emission.some(source => source.type === 'manual')) {
      requiresStateful.push(`emitter "${normalized.name}" uses manual emission`);
    }
    if (normalized.renderer.sorting === 'distance') {
      requiresStateful.push(`emitter "${normalized.name}" uses distance sorting`);
    }
  }
  const frozenReasons = Object.freeze(requiresStateful);
  const record: ParticleEffect3DRecord = Object.freeze({
    dimension: 3,
    debugName,
    parameters,
    emitters: Object.freeze(emitters),
    emitterNames: Object.freeze(emitters.map(emitter => emitter.name)),
    capabilities: Object.freeze({
      statelessCanvas: false,
      statelessWebGL: frozenReasons.length === 0,
      requiresStateful: frozenReasons,
    }),
  });
  return createParticleEffect3D(record) as CRCParticleEffect3D<
    Input['emitters'][number]['name'],
    CRCParticleValuesOf<
      Input extends { readonly parameters: infer Definitions }
        ? Extract<Definitions, CRCParticleParameterDefinitions>
        : undefined
    >
  >;
}
