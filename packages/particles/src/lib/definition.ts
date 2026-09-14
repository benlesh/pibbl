import {
  assertFiniteVector,
  assertNonnegativeNumber,
  assertPositiveNumber,
  cloneParticleRecord,
  createParticleEffect2D,
  hashParticleEmitterName,
  normalizeBounds2D,
  normalizeEmission,
  normalizeParameters,
  normalizeRenderer2D,
  particleDefinitionError,
  particleScalarRange,
  validateAppearance,
  validateScalarVector,
  type ParticleEffect2DRecord,
  type ParticleEmitter2DRecord,
  type ParticleScalarRange,
  type ParticleValidationContext,
} from './definition-records.js';
import { getParticleDescriptorRecord } from './particle.js';
import { compileParticleEffect2D } from './compiler.js';
import type {
  CRCParticleAppearance,
  CRCParticleBounds2D,
  CRCParticleEffect2D,
  CRCParticleEffect2DInput,
  CRCParticleInitial2D,
  CRCParticleMotion2D,
  CRCParticleParameterDefinitions,
  CRCParticleShape2D,
  CRCParticleValuesOf,
} from './types.js';

interface MutableBounds {
  min: number[];
  max: number[];
}

function minimumDisplacement(range: ParticleScalarRange, seconds: number): number {
  return Math.min(0, range.min * seconds, range.max * seconds);
}

function maximumDisplacement(range: ParticleScalarRange, seconds: number): number {
  return Math.max(0, range.min * seconds, range.max * seconds);
}

function maximumMagnitude(range: ParticleScalarRange): number {
  return Math.max(Math.abs(range.min), Math.abs(range.max));
}

function normalizeShape(
  shape: CRCParticleShape2D,
  context: ParticleValidationContext,
): { readonly shape: CRCParticleShape2D; readonly bounds: MutableBounds } {
  if (shape === null || typeof shape !== 'object') {
    particleDefinitionError({ ...context, property: 'shape' }, 'must be a record', shape);
  }
  const module = `shape ${String((shape as { type?: unknown }).type)}`;
  switch (shape.type) {
    case 'point': {
      const position = shape.position ?? [0, 0] as const;
      assertFiniteVector(position, 2, { ...context, module, property: 'shape.position' });
      return {
        shape: Object.freeze({ type: 'point', position: cloneParticleRecord(position) }),
        bounds: { min: [...position], max: [...position] },
      };
    }
    case 'line':
      assertFiniteVector(shape.from, 2, { ...context, module, property: 'shape.from' });
      assertFiniteVector(shape.to, 2, { ...context, module, property: 'shape.to' });
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: [Math.min(shape.from[0], shape.to[0]), Math.min(shape.from[1], shape.to[1])],
          max: [Math.max(shape.from[0], shape.to[0]), Math.max(shape.from[1], shape.to[1])],
        },
      };
    case 'rectangle':
      assertPositiveNumber(shape.width, { ...context, module, property: 'shape.width' });
      assertPositiveNumber(shape.height, { ...context, module, property: 'shape.height' });
      if (shape.sample !== 'interior' && shape.sample !== 'edge') {
        particleDefinitionError(
          { ...context, module, property: 'shape.sample' },
          'must be interior or edge',
          shape.sample,
        );
      }
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: [-shape.width / 2, -shape.height / 2],
          max: [shape.width / 2, shape.height / 2],
        },
      };
    case 'circle':
      assertNonnegativeNumber(shape.radius, {
        ...context, module, property: 'shape.radius',
      });
      if (shape.sample !== 'interior' && shape.sample !== 'circumference') {
        particleDefinitionError(
          { ...context, module, property: 'shape.sample' },
          'must be interior or circumference',
          shape.sample,
        );
      }
      return {
        shape: cloneParticleRecord(shape),
        bounds: {
          min: [-shape.radius, -shape.radius],
          max: [shape.radius, shape.radius],
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
          min: [-shape.outerRadius, -shape.outerRadius],
          max: [shape.outerRadius, shape.outerRadius],
        },
      };
    default:
      particleDefinitionError(
        { ...context, module, property: 'shape.type' },
        'uses an unsupported 2D shape',
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
  value: CRCParticleInitial2D['color'],
  parameters: CRCParticleParameterDefinitions,
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
  if (record?.type === 'parameter') {
    const definition = parameters[record.name];
    if (definition === undefined) {
      particleDefinitionError(context, 'references an unknown parameter', record.name);
    }
    if (definition.type !== 'color') {
      particleDefinitionError(
        context,
        `parameter "${record.name}" must have type color; received ${definition.type}`,
      );
    }
    return;
  }
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

function normalizeInitial(
  initial: CRCParticleInitial2D,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): {
  readonly initial: CRCParticleInitial2D;
  readonly lifetime: ParticleScalarRange;
  readonly velocity: readonly ParticleScalarRange[];
  readonly maximumSize: number;
  readonly dynamic: boolean;
} {
  if (initial === null || typeof initial !== 'object') {
    particleDefinitionError(
      { ...context, property: 'initial' }, 'must be a record', initial,
    );
  }
  const lifetime = requireRange(
    initial.lifetimeMilliseconds,
    parameters,
    { ...context, module: 'initial', property: 'initial.lifetimeMilliseconds' },
  );
  if (lifetime.min <= 0) {
    particleDefinitionError(
      { ...context, module: 'initial', property: 'initial.lifetimeMilliseconds' },
      'must be positive',
      lifetime.min,
      RangeError,
    );
  }
  const velocity = initial.velocity === undefined ? Object.freeze([
    Object.freeze({ min: 0, max: 0, dynamic: false }),
    Object.freeze({ min: 0, max: 0, dynamic: false }),
  ]) : validateScalarVector(
    initial.velocity,
    2,
    parameters,
    { ...context, module: 'initial', property: 'initial.velocity' },
  );
  let maximumSize = 1;
  let sizeDynamic = false;
  if (initial.size !== undefined) {
    const sizeDescriptor = getParticleDescriptorRecord(initial.size);
    const vectorSize = sizeDescriptor?.type === 'parameter' &&
      parameters[sizeDescriptor.name]?.type === 'vector2';
    const ranges = Array.isArray(initial.size) || vectorSize ? validateScalarVector(
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
          'must be nonnegative',
          range.min,
          RangeError,
        );
      }
      maximumSize = Math.max(maximumSize, maximumMagnitude(range));
      sizeDynamic ||= range.dynamic;
    }
  }
  if (initial.rotationDegrees !== undefined) {
    requireRange(initial.rotationDegrees, parameters, {
      ...context, module: 'initial', property: 'initial.rotationDegrees',
    });
  }
  if (initial.angularVelocityDegreesPerSecond !== undefined) {
    requireRange(initial.angularVelocityDegreesPerSecond, parameters, {
      ...context, module: 'initial',
      property: 'initial.angularVelocityDegreesPerSecond',
    });
  }
  validateColor(initial.color, parameters, {
    ...context, module: 'initial', property: 'initial.color',
  });
  if (initial.opacity !== undefined) {
    requireRange(initial.opacity, parameters, {
      ...context, module: 'initial', property: 'initial.opacity',
    }, 0, 1);
  }
  return Object.freeze({
    initial: cloneParticleRecord(initial),
    lifetime,
    velocity,
    maximumSize,
    dynamic: lifetime.dynamic || velocity.some(range => range.dynamic) || sizeDynamic,
  });
}

function maximumAppearanceSize(
  appearance: CRCParticleAppearance | undefined,
  current: number,
): number {
  const curve = appearance?.size;
  if (curve === undefined) return current;
  let result = current;
  for (const [, value] of curve.keys) {
    if (typeof value === 'number') result = Math.max(result, Math.abs(value));
    else result = Math.max(result, Math.abs(value[0]), Math.abs(value[1]));
  }
  return result;
}

function normalizeMotion(
  motion: readonly CRCParticleMotion2D[] | undefined,
  parameters: CRCParticleParameterDefinitions,
  context: ParticleValidationContext,
): { readonly motion: readonly CRCParticleMotion2D[]; readonly ranges: readonly unknown[]; readonly dynamic: boolean } {
  if (motion === undefined) {
    return Object.freeze({ motion: Object.freeze([]), ranges: Object.freeze([]), dynamic: false });
  }
  if (!Array.isArray(motion)) {
    particleDefinitionError({ ...context, property: 'motion' }, 'must be an array', motion);
  }
  let orbitWriter: number | undefined;
  let additivePositionWriter: number | undefined;
  const ranges: unknown[] = [];
  let dynamic = false;
  for (let index = 0; index < motion.length; index += 1) {
    const moduleValue = motion[index]!;
    if (moduleValue === null || typeof moduleValue !== 'object') {
      particleDefinitionError(
        { ...context, module: `motion[${index}]`, property: 'motion' },
        'must be a record',
        moduleValue,
      );
    }
    const module = `motion[${index}] ${String((moduleValue as { type?: unknown }).type)}`;
    if (moduleValue.type === 'orbit') {
      const earlier = orbitWriter ?? additivePositionWriter;
      if (earlier !== undefined) {
        particleDefinitionError(
          { ...context, module, property: 'position' },
          `ambiguously writes position already written by motion[${earlier}]`,
          moduleValue.type,
        );
      }
      orbitWriter = index;
    } else if (moduleValue.type === 'drift' || moduleValue.type === 'sway') {
      if (orbitWriter !== undefined) {
        particleDefinitionError(
          { ...context, module, property: 'position' },
          `ambiguously writes position already written by motion[${orbitWriter}]`,
          moduleValue.type,
        );
      }
      additivePositionWriter ??= index;
    }
    switch (moduleValue.type) {
      case 'acceleration':
      case 'gravity':
      case 'drift': {
        const vector = moduleValue.type === 'drift' ?
          moduleValue.velocity : moduleValue.value;
        const valueRanges = validateScalarVector(vector, 2, parameters, {
          ...context, module,
          property: moduleValue.type === 'drift' ? 'motion.velocity' : 'motion.value',
        });
        ranges.push({ type: moduleValue.type, value: valueRanges });
        dynamic ||= valueRanges.some(range => range.dynamic);
        break;
      }
      case 'drag': {
        const amount = requireRange(moduleValue.amount, parameters, {
          ...context, module, property: 'motion.amount',
        }, 0);
        ranges.push({ type: 'drag', amount });
        dynamic ||= amount.dynamic;
        break;
      }
      case 'radialAcceleration': {
        assertFiniteVector(moduleValue.center, 2, {
          ...context, module, property: 'motion.center',
        });
        const amount = requireRange(moduleValue.amount, parameters, {
          ...context, module, property: 'motion.amount',
        });
        ranges.push({ type: 'radialAcceleration', center: moduleValue.center, amount });
        dynamic ||= amount.dynamic;
        break;
      }
      case 'orbit': {
        assertFiniteVector(moduleValue.center, 2, {
          ...context, module, property: 'motion.center',
        });
        const speed = requireRange(moduleValue.degreesPerSecond, parameters, {
          ...context, module, property: 'motion.degreesPerSecond',
        });
        ranges.push({ type: 'orbit', center: moduleValue.center, speed });
        dynamic ||= speed.dynamic;
        break;
      }
      case 'sway': {
        const amplitude = requireRange(moduleValue.amplitude, parameters, {
          ...context, module, property: 'motion.amplitude',
        }, 0);
        const frequency: readonly ParticleScalarRange[] =
          Array.isArray(moduleValue.frequency) ? moduleValue.frequency.map(
            (value: number, valueIndex: number) => requireRange(value, parameters, {
              ...context, module, property: `motion.frequency[${valueIndex}]`,
            }, 0),
          ) : [requireRange(moduleValue.frequency, parameters, {
            ...context, module, property: 'motion.frequency',
          }, 0)];
        ranges.push({ type: 'sway', amplitude, frequency });
        dynamic ||= amplitude.dynamic || frequency.some(range => range.dynamic);
        break;
      }
      case 'angularVelocity': {
        const speed = requireRange(moduleValue.degreesPerSecond, parameters, {
          ...context, module, property: 'motion.degreesPerSecond',
        });
        ranges.push({ type: 'angularVelocity', speed });
        dynamic ||= speed.dynamic;
        break;
      }
      default:
        particleDefinitionError(
          { ...context, module, property: 'motion.type' },
          'uses an unsupported 2D motion module',
          (moduleValue as { type?: unknown }).type,
        );
    }
  }
  return Object.freeze({
    motion: cloneParticleRecord(motion),
    ranges: Object.freeze(ranges.map(range => cloneParticleRecord(range))),
    dynamic,
  });
}

function deriveBounds(
  shape: MutableBounds,
  lifetimeMilliseconds: number,
  velocity: readonly ParticleScalarRange[],
  motionRanges: readonly unknown[],
  size: number,
): CRCParticleBounds2D {
  const seconds = lifetimeMilliseconds / 1_000;
  const bounds: MutableBounds = { min: [...shape.min], max: [...shape.max] };
  for (let axis = 0; axis < 2; axis += 1) {
    bounds.min[axis]! += minimumDisplacement(velocity[axis]!, seconds);
    bounds.max[axis]! += maximumDisplacement(velocity[axis]!, seconds);
  }
  for (const untyped of motionRanges) {
    const motion = untyped as {
      type: string;
      value?: readonly ParticleScalarRange[];
      amount?: ParticleScalarRange;
      amplitude?: ParticleScalarRange;
      center?: readonly [number, number];
    };
    if (motion.type === 'acceleration' || motion.type === 'gravity') {
      for (let axis = 0; axis < 2; axis += 1) {
        const scale = 0.5 * seconds * seconds;
        bounds.min[axis]! += minimumDisplacement(motion.value![axis]!, scale);
        bounds.max[axis]! += maximumDisplacement(motion.value![axis]!, scale);
      }
    } else if (motion.type === 'drift') {
      for (let axis = 0; axis < 2; axis += 1) {
        bounds.min[axis]! += minimumDisplacement(motion.value![axis]!, seconds);
        bounds.max[axis]! += maximumDisplacement(motion.value![axis]!, seconds);
      }
    } else if (motion.type === 'radialAcceleration') {
      const expansion = 0.5 * maximumMagnitude(motion.amount!) * seconds * seconds;
      for (let axis = 0; axis < 2; axis += 1) {
        bounds.min[axis]! -= expansion;
        bounds.max[axis]! += expansion;
      }
    } else if (motion.type === 'sway') {
      const expansion = maximumMagnitude(motion.amplitude!);
      for (let axis = 0; axis < 2; axis += 1) {
        bounds.min[axis]! -= expansion;
        bounds.max[axis]! += expansion;
      }
    } else if (motion.type === 'orbit') {
      const center = motion.center!;
      const radius = Math.max(
        Math.hypot(bounds.min[0]! - center[0], bounds.min[1]! - center[1]),
        Math.hypot(bounds.min[0]! - center[0], bounds.max[1]! - center[1]),
        Math.hypot(bounds.max[0]! - center[0], bounds.min[1]! - center[1]),
        Math.hypot(bounds.max[0]! - center[0], bounds.max[1]! - center[1]),
      );
      bounds.min = [center[0] - radius, center[1] - radius];
      bounds.max = [center[0] + radius, center[1] + radius];
    }
  }
  const rendererExpansion = size / 2;
  return Object.freeze({
    min: Object.freeze([
      bounds.min[0]! - rendererExpansion,
      bounds.min[1]! - rendererExpansion,
    ]) as readonly [number, number],
    max: Object.freeze([
      bounds.max[0]! + rendererExpansion,
      bounds.max[1]! + rendererExpansion,
    ]) as readonly [number, number],
  });
}

function normalizeEmitter(
  input: import('./types.js').CRCParticleEmitter2D,
  parameters: CRCParticleParameterDefinitions,
  debugName: string | undefined,
): ParticleEmitter2DRecord {
  if (input === null || typeof input !== 'object') {
    particleDefinitionError(
      { debugName, property: 'emitter' }, 'must be a record', input,
    );
  }
  const context = { debugName, emitter: input.name };
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    particleDefinitionError(
      { debugName, emitter: String(input.name), property: 'name' },
      'must be a nonempty string',
      input.name,
    );
  }
  if (!Number.isSafeInteger(input.capacity) || input.capacity <= 0) {
    particleDefinitionError(
      { ...context, property: 'capacity' },
      'must be a positive finite safe integer',
      input.capacity,
      RangeError,
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
  const renderer = normalizeRenderer2D(input.renderer, context);
  const cannotDerive = normalizedInitial.dynamic || normalizedMotion.dynamic ||
    renderer.type === 'path' || renderer.type === 'sprite';
  let bounds: CRCParticleBounds2D;
  let boundsSource: 'explicit' | 'derived';
  if (input.bounds !== undefined) {
    bounds = normalizeBounds2D(input.bounds, context);
    boundsSource = 'explicit';
  } else if (cannotDerive) {
    particleDefinitionError(
      { ...context, property: 'bounds' },
      'must be explicit and finite for dynamic, parameterized, or renderer-unbounded motion',
    );
  } else {
    bounds = normalizeBounds2D(
      deriveBounds(
        normalizedShape.bounds,
        normalizedInitial.lifetime.max,
        normalizedInitial.velocity,
        normalizedMotion.ranges,
        maximumAppearanceSize(appearance, normalizedInitial.maximumSize),
      ),
      context,
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

export function defineParticleEffect2D<
  const Input extends CRCParticleEffect2DInput,
>(
  input: Input,
): CRCParticleEffect2D<
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
  const parameters = normalizeParameters(input.parameters, debugName, 2);
  const seenNames = new Set<string>();
  const emitters: ParticleEmitter2DRecord[] = [];
  for (const emitter of input.emitters) {
    if (emitter === null || typeof emitter !== 'object') {
      particleDefinitionError(
        { debugName, property: 'emitter' }, 'must be a record', emitter,
      );
    }
    if (seenNames.has(emitter.name)) {
      particleDefinitionError(
        { debugName, emitter: emitter.name, property: 'name' },
        'must be unique; duplicate emitter name',
        emitter.name,
      );
    }
    seenNames.add(emitter.name);
    emitters.push(normalizeEmitter(emitter, parameters, debugName));
  }
  const record: ParticleEffect2DRecord = Object.freeze({
    dimension: 2,
    debugName,
    parameters,
    emitters: Object.freeze(emitters),
    emitterNames: Object.freeze(emitters.map(emitter => emitter.name)),
    capabilities: Object.freeze({
      statelessCanvas: true,
      statelessWebGL: false,
      requiresStateful: Object.freeze([]),
    }),
  });
  const effect = createParticleEffect2D(record) as CRCParticleEffect2D<
    Input['emitters'][number]['name'],
    CRCParticleValuesOf<
      Input extends { readonly parameters: infer Definitions }
        ? Extract<Definitions, CRCParticleParameterDefinitions>
        : undefined
    >
  >;
  compileParticleEffect2D(effect);
  return effect;
}
