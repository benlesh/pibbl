import { parseParticleColor, type ParticleColor } from "./color.js";
import {
  compileParticleCurve,
  compileParticleGradient,
  type CompiledParticleCurve,
  type CompiledParticleGradient,
} from "./curve.js";
import {
  getParticleEffect2DRecord,
  getParticleEffect3DRecord,
  type ParticleEffect2DRecord,
  type ParticleEffect3DRecord,
  type ParticleEmitter2DRecord,
  type ParticleEmitter3DRecord,
} from "./definition-records.js";
import {
  compileEmissionSchedule,
  type CompiledEmissionSchedule,
  type CompiledMaximumLifetime,
} from "./emission.js";
import { getParticleDescriptorRecord } from "./particle.js";
import {
  compileWeightedChoice,
  hashEmitterName,
  type CompiledWeightedChoice,
} from "./random.js";
import type {
  CRCParticleAppearance,
  CRCParticleEffect2D,
  CRCParticleInitial2D,
  CRCParticleMotion2D,
  CRCParticleParameterDefinition,
  CRCParticleParameterReference,
  CRCParticleScalar,
  CRCParticleShape2D,
  CRCParticleVector2,
  CRCParticleVector3,
} from "./types.js";
import type {
  CRCParticleConeVelocity3D,
  CRCParticleEffect3D,
  CRCParticleInitial3D,
  CRCParticleMotion3D,
  CRCParticleShape3D,
} from "./webgl-types.js";

export const ParameterTimingMask = Object.freeze({
  Spawn: 1,
  Simulation: 2,
  Render: 4,
} as const);

export type ParameterTimingMaskValue =
  (typeof ParameterTimingMask)[keyof typeof ParameterTimingMask];

export interface CompiledParameterEntry {
  readonly name: string;
  readonly type: CRCParticleParameterDefinition["type"];
  readonly timing: CRCParticleParameterDefinition["timing"];
  readonly offset: number;
  readonly length: 1 | 2 | 3 | 4;
}

export interface CompiledParameterLayout {
  readonly entries: readonly CompiledParameterEntry[];
  readonly defaults: Readonly<Float64Array>;
  readonly spawnMask: Readonly<Uint8Array>;
  readonly simulationMask: Readonly<Uint8Array>;
  readonly renderMask: Readonly<Uint8Array>;
  readonly byName: ReadonlyMap<string, CompiledParameterEntry>;
}

export interface CompiledParameterReference<
  Length extends 1 | 2 | 3 | 4 = 1 | 2 | 3 | 4,
> {
  readonly kind: "parameter";
  readonly offset: number;
  readonly length: Length;
  readonly timingMask: ParameterTimingMaskValue;
  readonly channel: number;
}

export type CompiledScalar =
  | Readonly<{ kind: "constant"; value: number; channel: number }>
  | Readonly<{ kind: "between"; min: number; max: number; channel: number }>
  | Readonly<{ kind: "integer"; min: number; max: number; channel: number }>
  | Readonly<{
      kind: "choice";
      choice: CompiledWeightedChoice<number>;
      channel: number;
    }>
  | CompiledParameterReference<1>;

export type CompiledVector2 =
  readonly [CompiledScalar, CompiledScalar] | CompiledParameterReference<2>;

export type CompiledVector3 =
  | readonly [CompiledScalar, CompiledScalar, CompiledScalar]
  | CompiledParameterReference<3>;

export type CompiledColor =
  | Readonly<{ kind: "constant"; color: ParticleColor; channel: number }>
  | Readonly<{
      kind: "choice";
      samples: readonly ParticleColor[];
      cumulativeWeights: readonly number[];
      totalWeight: number;
      channel: number;
    }>
  | CompiledParameterReference<4>;

export interface CompiledAppearance {
  readonly size: CompiledParticleCurve | null;
  readonly rotation: CompiledParticleCurve | null;
  readonly color: CompiledParticleGradient | null;
  readonly opacity: CompiledParticleCurve | null;
}

export interface CompiledInitial2D {
  readonly lifetime: CompiledScalar;
  readonly velocity: CompiledVector2;
  readonly size: CompiledVector2;
  readonly rotation: CompiledScalar;
  readonly angularVelocity: CompiledScalar;
  readonly color: CompiledColor;
  readonly opacity: CompiledScalar;
}

export type CompiledMotion2D =
  | Readonly<{
      type: "acceleration" | "gravity" | "drift";
      value: CompiledVector2;
    }>
  | Readonly<{ type: "drag"; amount: CompiledScalar }>
  | Readonly<{
      type: "radialAcceleration";
      center: readonly [number, number];
      amount: CompiledScalar;
    }>
  | Readonly<{
      type: "orbit";
      center: readonly [number, number];
      degreesPerSecond: CompiledScalar;
    }>
  | Readonly<{
      type: "sway";
      amplitude: CompiledScalar;
      frequency: CompiledScalar;
    }>
  | Readonly<{ type: "angularVelocity"; degreesPerSecond: CompiledScalar }>;

export interface CompiledInitial3D {
  readonly lifetime: CompiledScalar;
  readonly velocity:
    | Readonly<{
        type: "vector";
        value: CompiledVector3;
      }>
    | Readonly<{
        type: "cone";
        direction: CompiledVector3;
        speed: CompiledScalar;
        spreadDegrees: CompiledScalar;
        polarChannel: number;
        azimuthChannel: number;
      }>;
  readonly size: CompiledVector2;
  readonly rotation: CompiledScalar;
  readonly angularVelocity: CompiledScalar;
  readonly color: CompiledColor;
  readonly opacity: CompiledScalar;
}

export type CompiledMotion3D =
  | Readonly<{
      type: "acceleration" | "gravity" | "drift";
      value: CompiledVector3;
    }>
  | Readonly<{ type: "drag"; amount: CompiledScalar }>
  | Readonly<{
      type: "radialAcceleration";
      center: readonly [number, number, number];
      amount: CompiledScalar;
    }>
  | Readonly<{
      type: "orbit";
      center: readonly [number, number, number];
      axis: CompiledVector3;
      degreesPerSecond: CompiledScalar;
    }>
  | Readonly<{
      type: "sway";
      direction: CompiledVector3;
      amplitude: CompiledScalar;
      frequency: CompiledScalar;
    }>
  | Readonly<{
      type: "angularVelocity";
      degreesPerSecond: CompiledVector3;
    }>;

export interface CompiledEmitter2D {
  readonly dimension: 2;
  readonly name: string;
  readonly emitterHash: number;
  readonly capacity: number;
  readonly overflow: "reject-newest" | "recycle-oldest";
  readonly shape: CRCParticleShape2D;
  readonly shapeChannels: readonly [number, number, number];
  readonly initial: CompiledInitial2D;
  readonly motion: readonly CompiledMotion2D[];
  readonly appearance: CompiledAppearance;
  readonly emission: CompiledEmissionSchedule;
  readonly maximumLifetime: CompiledMaximumLifetime;
  readonly renderer: ParticleEmitter2DRecord["renderer"];
  readonly bounds: ParticleEmitter2DRecord["bounds"];
}

export interface CompiledEmitter3D {
  readonly dimension: 3;
  readonly name: string;
  readonly emitterHash: number;
  readonly capacity: number;
  readonly overflow: "reject-newest" | "recycle-oldest";
  readonly shape: CRCParticleShape3D;
  readonly shapeChannels: readonly [number, number, number];
  readonly initial: CompiledInitial3D;
  readonly motion: readonly CompiledMotion3D[];
  readonly appearance: CompiledAppearance;
  readonly emission: CompiledEmissionSchedule;
  readonly maximumLifetime: CompiledMaximumLifetime;
  readonly renderer: ParticleEmitter3DRecord["renderer"];
  readonly bounds: ParticleEmitter3DRecord["bounds"];
}

export interface CompiledExecutionCapability {
  readonly supported: boolean;
  readonly reasons: readonly string[];
}

export interface CompiledExecutionCapabilities {
  readonly "stateless-canvas": CompiledExecutionCapability;
  readonly "stateful-canvas": CompiledExecutionCapability;
  readonly "stateless-webgl": CompiledExecutionCapability;
  readonly "stateful-cpu-webgl": CompiledExecutionCapability;
  readonly "stateful-gpu-webgl": CompiledExecutionCapability;
}

export interface CompiledEffect2D {
  readonly dimension: 2;
  readonly parameterLayout: CompiledParameterLayout;
  readonly emitters: readonly CompiledEmitter2D[];
  readonly execution: CompiledExecutionCapabilities;
}

export interface CompiledEffect3D {
  readonly dimension: 3;
  readonly parameterLayout: CompiledParameterLayout;
  readonly emitters: readonly CompiledEmitter3D[];
  readonly execution: CompiledExecutionCapabilities;
}

const compiled2D = new WeakMap<CRCParticleEffect2D, CompiledEffect2D>();
const compiled3D = new WeakMap<CRCParticleEffect3D, CompiledEffect3D>();

function parameterLength(
  type: CRCParticleParameterDefinition["type"],
): 1 | 2 | 3 | 4 {
  switch (type) {
    case "number":
      return 1;
    case "vector2":
      return 2;
    case "vector3":
      return 3;
    case "color":
      return 4;
  }
}

function timingMask(
  timing: CRCParticleParameterDefinition["timing"],
): ParameterTimingMaskValue {
  switch (timing) {
    case "spawn":
      return ParameterTimingMask.Spawn;
    case "simulation":
      return ParameterTimingMask.Simulation;
    case "render":
      return ParameterTimingMask.Render;
  }
}

function writeParameterDefault(
  definition: CRCParticleParameterDefinition,
  output: number[],
): void {
  if (definition.type === "number") output.push(definition.default);
  else if (definition.type === "color")
    output.push(...parseParticleColor(definition.default));
  else output.push(...definition.default);
}

function compileParameterLayout(
  definitions: ParticleEffect2DRecord["parameters"],
): CompiledParameterLayout {
  const entries: CompiledParameterEntry[] = [];
  const defaults: number[] = [];
  const byName = new Map<string, CompiledParameterEntry>();
  for (const [name, definition] of Object.entries(definitions)) {
    const entry = Object.freeze({
      name,
      type: definition.type,
      timing: definition.timing,
      offset: defaults.length,
      length: parameterLength(definition.type),
    });
    entries.push(entry);
    byName.set(name, entry);
    writeParameterDefault(definition, defaults);
  }
  const spawnMask = new Uint8Array(defaults.length);
  const simulationMask = new Uint8Array(defaults.length);
  const renderMask = new Uint8Array(defaults.length);
  for (const entry of entries) {
    const mask =
      entry.timing === "spawn"
        ? spawnMask
        : entry.timing === "simulation"
          ? simulationMask
          : renderMask;
    mask.fill(1, entry.offset, entry.offset + entry.length);
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    defaults: new Float64Array(defaults),
    spawnMask,
    simulationMask,
    renderMask,
    byName,
  });
}

function channelFor(path: string): number {
  return hashEmitterName(path);
}

export function compileParameterReference<Length extends 1 | 2 | 3 | 4>(
  reference: CRCParticleParameterReference<string>,
  layout: CompiledParameterLayout,
  expectedDimension: Length,
  path: string,
): CompiledParameterReference<Length> {
  const descriptor = getParticleDescriptorRecord(reference);
  if (descriptor?.type !== "parameter") {
    throw new TypeError(`Particle ${path} must use particleParameter().`);
  }
  const entry = layout.byName.get(descriptor.name);
  if (entry === undefined) {
    throw new TypeError(
      `Particle ${path} references unknown parameter "${descriptor.name}".`,
    );
  }
  if (entry.length !== expectedDimension) {
    throw new TypeError(
      `Particle ${path} parameter "${descriptor.name}" has ${entry.type} dimension ${entry.length}; expected ${expectedDimension}.`,
    );
  }
  return Object.freeze({
    kind: "parameter",
    offset: entry.offset,
    length: expectedDimension,
    timingMask: timingMask(entry.timing),
    channel: channelFor(path),
  });
}

function compileScalar(
  value: CRCParticleScalar,
  layout: CompiledParameterLayout,
  path: string,
): CompiledScalar {
  const channel = channelFor(path);
  if (typeof value === "number")
    return Object.freeze({ kind: "constant", value, channel });
  const descriptor = getParticleDescriptorRecord(value);
  switch (descriptor?.type) {
    case "between":
      return Object.freeze({
        kind: "between",
        min: descriptor.min,
        max: descriptor.max,
        channel,
      });
    case "integer":
      return Object.freeze({
        kind: "integer",
        min: descriptor.min,
        max: descriptor.max,
        channel,
      });
    case "choice": {
      const choices = descriptor.choices.map(
        ({ value: choiceValue, weight }) => {
          if (typeof choiceValue !== "number") {
            throw new TypeError(
              `Particle ${path} choice values must be numbers.`,
            );
          }
          return { value: choiceValue, weight };
        },
      );
      return Object.freeze({
        kind: "choice",
        choice: compileWeightedChoice(choices),
        channel,
      });
    }
    case "parameter":
      return compileParameterReference(
        value as CRCParticleParameterReference<string>,
        layout,
        1,
        path,
      );
    default:
      throw new TypeError(`Particle ${path} must be a scalar particle value.`);
  }
}

function compileScalarVector2(
  value: CRCParticleVector2,
  layout: CompiledParameterLayout,
  path: string,
): CompiledVector2 {
  if (!Array.isArray(value)) {
    return compileParameterReference(
      value as CRCParticleParameterReference<string>,
      layout,
      2,
      path,
    );
  }
  return Object.freeze([
    compileScalar(value[0], layout, `${path}[0]`),
    compileScalar(value[1], layout, `${path}[1]`),
  ] as const);
}

function compileScalarVector3(
  value: CRCParticleVector3,
  layout: CompiledParameterLayout,
  path: string,
): CompiledVector3 {
  if (!Array.isArray(value)) {
    return compileParameterReference(
      value as CRCParticleParameterReference<string>,
      layout,
      3,
      path,
    );
  }
  return Object.freeze([
    compileScalar(value[0], layout, `${path}[0]`),
    compileScalar(value[1], layout, `${path}[1]`),
    compileScalar(value[2], layout, `${path}[2]`),
  ] as const);
}

function isScalarVector2(
  value: unknown,
): value is readonly [CRCParticleScalar, CRCParticleScalar] {
  return Array.isArray(value);
}

function isConeVelocity3D(value: unknown): value is CRCParticleConeVelocity3D {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "type" in value &&
    value.type === "cone"
  );
}

function compileColor(
  value: CRCParticleInitial2D["color"],
  layout: CompiledParameterLayout,
  path: string,
): CompiledColor {
  const channel = channelFor(path);
  if (value === undefined) {
    return Object.freeze({
      kind: "constant",
      color: parseParticleColor("white"),
      channel,
    });
  }
  if (typeof value === "string") {
    return Object.freeze({
      kind: "constant",
      color: parseParticleColor(value),
      channel,
    });
  }
  const descriptor = getParticleDescriptorRecord(value);
  if (descriptor?.type === "parameter") {
    return compileParameterReference(
      value as CRCParticleParameterReference<string>,
      layout,
      4,
      path,
    );
  }
  if (descriptor?.type !== "choice") {
    throw new TypeError(
      `Particle ${path} must be a color or particleChoice().`,
    );
  }
  const choices = compileWeightedChoice(
    descriptor.choices.map((choice) => {
      if (typeof choice.value !== "string") {
        throw new TypeError(`Particle ${path} choice values must be colors.`);
      }
      return { value: parseParticleColor(choice.value), weight: choice.weight };
    }),
  );
  return Object.freeze({
    kind: "choice",
    samples: choices.values,
    cumulativeWeights: choices.cumulativeWeights,
    totalWeight: choices.totalWeight,
    channel,
  });
}

function compileSwayFrequency(
  value: CRCParticleScalar | readonly [number, number],
  layout: CompiledParameterLayout,
  path: string,
): CompiledScalar {
  if (!Array.isArray(value)) {
    return compileScalar(value as CRCParticleScalar, layout, path);
  }
  const min = value[0]!;
  const max = value[1]!;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new RangeError(
      `Particle ${path} range must contain finite values with min at most max; received ${min} through ${max}.`,
    );
  }
  return Object.freeze({
    kind: "between",
    min,
    max,
    channel: channelFor(path),
  });
}

function compileMaximumLifetime(
  value: CompiledScalar,
): CompiledMaximumLifetime {
  switch (value.kind) {
    case "constant":
      return Object.freeze({ kind: "fixed", milliseconds: value.value });
    case "between":
    case "integer":
      return Object.freeze({ kind: "fixed", milliseconds: value.max });
    case "choice":
      return Object.freeze({
        kind: "fixed",
        milliseconds: Math.max(...value.choice.values),
      });
    case "parameter":
      return Object.freeze({ kind: "parameter", offset: value.offset });
  }
}

function compileSize(
  value: CRCParticleInitial2D["size"],
  layout: CompiledParameterLayout,
): CompiledVector2 {
  if (value === undefined) {
    return Object.freeze([
      compileScalar(1, layout, "initial.size[0]"),
      compileScalar(1, layout, "initial.size[1]"),
    ] as const);
  }
  if (isScalarVector2(value))
    return compileScalarVector2(value, layout, "initial.size");
  const descriptor = getParticleDescriptorRecord(value);
  if (descriptor?.type === "parameter") {
    const entry = layout.byName.get(descriptor.name);
    if (entry?.length === 2) {
      return compileParameterReference(
        value as CRCParticleParameterReference<string>,
        layout,
        2,
        "initial.size",
      );
    }
  }
  const scalar = compileScalar(
    value as CRCParticleScalar,
    layout,
    "initial.size",
  );
  return Object.freeze([scalar, scalar] as const);
}

function compileInitial2D(
  initial: CRCParticleInitial2D,
  layout: CompiledParameterLayout,
): CompiledInitial2D {
  return Object.freeze({
    lifetime: compileScalar(
      initial.lifetimeMilliseconds,
      layout,
      "initial.lifetimeMilliseconds",
    ),
    velocity:
      initial.velocity === undefined
        ? Object.freeze([
            compileScalar(0, layout, "initial.velocity[0]"),
            compileScalar(0, layout, "initial.velocity[1]"),
          ] as const)
        : compileScalarVector2(initial.velocity, layout, "initial.velocity"),
    size: compileSize(initial.size, layout),
    rotation: compileScalar(
      initial.rotationDegrees ?? 0,
      layout,
      "initial.rotationDegrees",
    ),
    angularVelocity: compileScalar(
      initial.angularVelocityDegreesPerSecond ?? 0,
      layout,
      "initial.angularVelocityDegreesPerSecond",
    ),
    color: compileColor(initial.color, layout, "initial.color"),
    opacity: compileScalar(initial.opacity ?? 1, layout, "initial.opacity"),
  });
}

function compileInitial3D(
  initial: CRCParticleInitial3D,
  layout: CompiledParameterLayout,
): CompiledInitial3D {
  let velocity: CompiledInitial3D["velocity"];
  if (isConeVelocity3D(initial.velocity)) {
    velocity = Object.freeze({
      type: "cone",
      direction: compileScalarVector3(
        initial.velocity.direction,
        layout,
        "initial.velocity.direction",
      ),
      speed: compileScalar(
        initial.velocity.speed,
        layout,
        "initial.velocity.speed",
      ),
      spreadDegrees: compileScalar(
        initial.velocity.spreadDegrees,
        layout,
        "initial.velocity.spreadDegrees",
      ),
      polarChannel: channelFor("initial.velocity.conePolar"),
      azimuthChannel: channelFor("initial.velocity.coneAzimuth"),
    });
  } else {
    velocity = Object.freeze({
      type: "vector",
      value:
        initial.velocity === undefined
          ? Object.freeze([
              compileScalar(0, layout, "initial.velocity[0]"),
              compileScalar(0, layout, "initial.velocity[1]"),
              compileScalar(0, layout, "initial.velocity[2]"),
            ] as const)
          : compileScalarVector3(initial.velocity, layout, "initial.velocity"),
    });
  }
  return Object.freeze({
    lifetime: compileScalar(
      initial.lifetimeMilliseconds,
      layout,
      "initial.lifetimeMilliseconds",
    ),
    velocity,
    size: compileSize(initial.size, layout),
    rotation: compileScalar(
      initial.rotationDegrees ?? 0,
      layout,
      "initial.rotationDegrees",
    ),
    angularVelocity: compileScalar(
      initial.angularVelocityDegreesPerSecond ?? 0,
      layout,
      "initial.angularVelocityDegreesPerSecond",
    ),
    color: compileColor(initial.color, layout, "initial.color"),
    opacity: compileScalar(initial.opacity ?? 1, layout, "initial.opacity"),
  });
}

function compileAppearance(
  appearance: CRCParticleAppearance | undefined,
): CompiledAppearance {
  return Object.freeze({
    size:
      appearance?.size === undefined
        ? null
        : compileParticleCurve(appearance.size),
    rotation:
      appearance?.rotationDegrees === undefined
        ? null
        : compileParticleCurve(appearance.rotationDegrees),
    color:
      appearance?.color === undefined
        ? null
        : compileParticleGradient(appearance.color),
    opacity:
      appearance?.opacity === undefined
        ? null
        : compileParticleCurve(appearance.opacity),
  });
}

function compileMotion2D(
  motion: readonly CRCParticleMotion2D[],
  layout: CompiledParameterLayout,
): readonly CompiledMotion2D[] {
  return Object.freeze(
    motion.map((module, index): CompiledMotion2D => {
      const path = `motion[${index}]`;
      switch (module.type) {
        case "acceleration":
        case "gravity":
          return Object.freeze({
            type: module.type,
            value: compileScalarVector2(module.value, layout, `${path}.value`),
          });
        case "drift":
          return Object.freeze({
            type: module.type,
            value: compileScalarVector2(
              module.velocity,
              layout,
              `${path}.velocity`,
            ),
          });
        case "drag":
          return Object.freeze({
            type: module.type,
            amount: compileScalar(module.amount, layout, `${path}.amount`),
          });
        case "radialAcceleration":
          return Object.freeze({
            type: module.type,
            center: module.center,
            amount: compileScalar(module.amount, layout, `${path}.amount`),
          });
        case "orbit":
          return Object.freeze({
            type: module.type,
            center: module.center,
            degreesPerSecond: compileScalar(
              module.degreesPerSecond,
              layout,
              `${path}.degreesPerSecond`,
            ),
          });
        case "sway": {
          return Object.freeze({
            type: module.type,
            amplitude: compileScalar(
              module.amplitude,
              layout,
              `${path}.amplitude`,
            ),
            frequency: compileSwayFrequency(
              module.frequency,
              layout,
              `${path}.frequency`,
            ),
          });
        }
        case "angularVelocity":
          return Object.freeze({
            type: module.type,
            degreesPerSecond: compileScalar(
              module.degreesPerSecond,
              layout,
              `${path}.degreesPerSecond`,
            ),
          });
      }
    }),
  );
}

function compileMotion3D(
  motion: readonly CRCParticleMotion3D[],
  layout: CompiledParameterLayout,
): readonly CompiledMotion3D[] {
  return Object.freeze(
    motion.map((module, index): CompiledMotion3D => {
      const path = `motion[${index}]`;
      switch (module.type) {
        case "acceleration":
        case "gravity":
          return Object.freeze({
            type: module.type,
            value: compileScalarVector3(module.value, layout, `${path}.value`),
          });
        case "drift":
          return Object.freeze({
            type: module.type,
            value: compileScalarVector3(
              module.velocity,
              layout,
              `${path}.velocity`,
            ),
          });
        case "drag":
          return Object.freeze({
            type: module.type,
            amount: compileScalar(module.amount, layout, `${path}.amount`),
          });
        case "radialAcceleration":
          return Object.freeze({
            type: module.type,
            center: module.center,
            amount: compileScalar(module.amount, layout, `${path}.amount`),
          });
        case "orbit":
          return Object.freeze({
            type: module.type,
            center: module.center,
            axis: compileScalarVector3(module.axis, layout, `${path}.axis`),
            degreesPerSecond: compileScalar(
              module.degreesPerSecond,
              layout,
              `${path}.degreesPerSecond`,
            ),
          });
        case "sway":
          return Object.freeze({
            type: module.type,
            direction: compileScalarVector3(
              module.direction,
              layout,
              `${path}.direction`,
            ),
            amplitude: compileScalar(
              module.amplitude,
              layout,
              `${path}.amplitude`,
            ),
            frequency: compileSwayFrequency(
              module.frequency,
              layout,
              `${path}.frequency`,
            ),
          });
        case "angularVelocity":
          return Object.freeze({
            type: module.type,
            degreesPerSecond: compileScalarVector3(
              module.degreesPerSecond,
              layout,
              `${path}.degreesPerSecond`,
            ),
          });
      }
    }),
  );
}

function executionCapability(
  supported: boolean,
  reasons: readonly string[] = [],
): CompiledExecutionCapability {
  return Object.freeze({ supported, reasons: Object.freeze([...reasons]) });
}

function execution2D(
  record: ParticleEffect2DRecord,
): CompiledExecutionCapabilities {
  return Object.freeze({
    "stateless-canvas": executionCapability(
      record.capabilities.statelessCanvas,
      record.capabilities.statelessCanvas
        ? []
        : record.capabilities.requiresStateful,
    ),
    "stateful-canvas": executionCapability(false, [
      "stateful Canvas execution is unavailable in Project 1",
    ]),
    "stateless-webgl": executionCapability(false, [
      "2D particle effects require Canvas execution",
    ]),
    "stateful-cpu-webgl": executionCapability(false, [
      "2D particle effects require Canvas execution",
    ]),
    "stateful-gpu-webgl": executionCapability(false, [
      "2D particle effects require Canvas execution",
    ]),
  });
}

function execution3D(
  record: ParticleEffect3DRecord,
): CompiledExecutionCapabilities {
  return Object.freeze({
    "stateless-canvas": executionCapability(false, [
      "3D particle effects require WebGL execution",
    ]),
    "stateful-canvas": executionCapability(false, [
      "3D particle effects require WebGL execution",
    ]),
    "stateless-webgl": executionCapability(
      record.capabilities.statelessWebGL,
      record.capabilities.statelessWebGL
        ? []
        : record.capabilities.requiresStateful,
    ),
    "stateful-cpu-webgl": executionCapability(false, [
      "stateful CPU WebGL execution is unavailable in Project 1",
    ]),
    "stateful-gpu-webgl": executionCapability(false, [
      "stateful GPU WebGL execution is unavailable in Project 1",
    ]),
  });
}

function compileEmitter2D(
  emitter: ParticleEmitter2DRecord,
  layout: CompiledParameterLayout,
): CompiledEmitter2D {
  const initial = compileInitial2D(emitter.initial, layout);
  const maximumLifetime = compileMaximumLifetime(initial.lifetime);
  return Object.freeze({
    dimension: 2,
    name: emitter.name,
    emitterHash: emitter.nameHash,
    capacity: emitter.capacity,
    overflow: emitter.overflow ?? "reject-newest",
    shape: emitter.shape,
    shapeChannels: Object.freeze([
      channelFor("shape.sample[0]"),
      channelFor("shape.sample[1]"),
      channelFor("shape.sample[2]"),
    ] as const),
    initial,
    motion: compileMotion2D(emitter.motion ?? [], layout),
    appearance: compileAppearance(emitter.appearance),
    emission: compileEmissionSchedule(emitter.emission, maximumLifetime),
    maximumLifetime,
    renderer: emitter.renderer,
    bounds: emitter.bounds,
  });
}

function compileEmitter3D(
  emitter: ParticleEmitter3DRecord,
  layout: CompiledParameterLayout,
): CompiledEmitter3D {
  const initial = compileInitial3D(emitter.initial, layout);
  const maximumLifetime = compileMaximumLifetime(initial.lifetime);
  return Object.freeze({
    dimension: 3,
    name: emitter.name,
    emitterHash: emitter.nameHash,
    capacity: emitter.capacity,
    overflow: emitter.overflow ?? "reject-newest",
    shape: emitter.shape,
    shapeChannels: Object.freeze([
      channelFor("shape.sample[0]"),
      channelFor("shape.sample[1]"),
      channelFor("shape.sample[2]"),
    ] as const),
    initial,
    motion: compileMotion3D(emitter.motion ?? [], layout),
    appearance: compileAppearance(emitter.appearance),
    emission: compileEmissionSchedule(emitter.emission, maximumLifetime),
    maximumLifetime,
    renderer: emitter.renderer,
    bounds: emitter.bounds,
  });
}

export function compileParticleEffect2D(
  effect: CRCParticleEffect2D,
): CompiledEffect2D {
  const cached = compiled2D.get(effect);
  if (cached !== undefined) return cached;
  const record = getParticleEffect2DRecord(effect);
  const parameterLayout = compileParameterLayout(record.parameters);
  const plan = Object.freeze({
    dimension: 2 as const,
    parameterLayout,
    emitters: Object.freeze(
      record.emitters.map((emitter) =>
        compileEmitter2D(emitter, parameterLayout),
      ),
    ),
    execution: execution2D(record),
  });
  compiled2D.set(effect, plan);
  return plan;
}

export function compileParticleEffect3D(
  effect: CRCParticleEffect3D,
): CompiledEffect3D {
  const cached = compiled3D.get(effect);
  if (cached !== undefined) return cached;
  const record = getParticleEffect3DRecord(effect);
  const parameterLayout = compileParameterLayout(record.parameters);
  const plan = Object.freeze({
    dimension: 3 as const,
    parameterLayout,
    emitters: Object.freeze(
      record.emitters.map((emitter) =>
        compileEmitter3D(emitter, parameterLayout),
      ),
    ),
    execution: execution3D(record),
  });
  compiled3D.set(effect, plan);
  return plan;
}
