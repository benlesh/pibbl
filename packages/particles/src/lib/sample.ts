import type {
  CompiledColor,
  CompiledEmitter2D,
  CompiledScalar,
  CompiledVector2,
} from "./compiler.js";
import { sampleParticleCurve, sampleParticleGradient } from "./curve.js";
import { sampleBetween, sampleInteger, sampleUnit } from "./random.js";
import type { CRCParticleShape2D } from "./types.js";

const TAU = Math.PI * 2;
let particleSamples = 0;
const sampleArrayAllocations = 0;
const sampleObjectAllocations = 0;

export interface ParticleSamplerPerformanceSnapshot {
  readonly samples: number;
  readonly sampleArrayAllocations: number;
  readonly sampleObjectAllocations: number;
}

/** @internal Deterministic structural counters for the particle hot loop. */
export function particleSamplerPerformanceSnapshot(): ParticleSamplerPerformanceSnapshot {
  return Object.freeze({
    samples: particleSamples,
    sampleArrayAllocations,
    sampleObjectAllocations,
  });
}

export const enum Particle2DRegister {
  Live,
  X,
  Y,
  VelocityX,
  VelocityY,
  SizeX,
  SizeY,
  Rotation,
  Red,
  Green,
  Blue,
  Alpha,
  AtlasFrame,
}

export interface ParticleBirthView {
  readonly seed: number;
  readonly ordinal: number;
  readonly birthTimeMilliseconds: number;
}

function scalar(
  value: CompiledScalar,
  birth: ParticleBirthView,
  emitterHash: number,
  parameters: Readonly<Float64Array>,
): number {
  switch (value.kind) {
    case "constant":
      return value.value;
    case "between":
      return sampleBetween(
        sampleUnit(birth.seed, emitterHash, birth.ordinal, value.channel),
        value.min,
        value.max,
      );
    case "integer":
      return sampleInteger(
        sampleUnit(birth.seed, emitterHash, birth.ordinal, value.channel),
        value.min,
        value.max,
      );
    case "choice": {
      const target =
        sampleUnit(birth.seed, emitterHash, birth.ordinal, value.channel) *
        value.choice.totalWeight;
      for (
        let index = 0;
        index < value.choice.cumulativeWeights.length;
        index += 1
      ) {
        if (target < value.choice.cumulativeWeights[index]!) {
          return value.choice.values[index]!;
        }
      }
      return value.choice.values[value.choice.values.length - 1]!;
    }
    case "parameter":
      return parameters[value.offset]!;
  }
}

function vectorComponent(
  value: CompiledVector2,
  component: number,
  birth: ParticleBirthView,
  emitterHash: number,
  parameters: Readonly<Float64Array>,
): number {
  if (Array.isArray(value)) {
    return scalar(value[component]!, birth, emitterHash, parameters);
  }
  return parameters[(value as { readonly offset: number }).offset + component]!;
}

function color(
  value: CompiledColor,
  birth: ParticleBirthView,
  emitterHash: number,
  parameters: Readonly<Float64Array>,
  output: Float64Array,
  offset: number,
): void {
  if (value.kind === "constant") {
    output[offset] = value.color[0];
    output[offset + 1] = value.color[1];
    output[offset + 2] = value.color[2];
    output[offset + 3] = value.color[3];
    return;
  }
  if (value.kind === "parameter") {
    output[offset] = parameters[value.offset]!;
    output[offset + 1] = parameters[value.offset + 1]!;
    output[offset + 2] = parameters[value.offset + 2]!;
    output[offset + 3] = parameters[value.offset + 3]!;
    return;
  }
  const target =
    sampleUnit(birth.seed, emitterHash, birth.ordinal, value.channel) *
    value.totalWeight;
  let selected = value.samples.length - 1;
  for (let index = 0; index < value.cumulativeWeights.length; index += 1) {
    if (target < value.cumulativeWeights[index]!) {
      selected = index;
      break;
    }
  }
  const selectedColor = value.samples[selected]!;
  output[offset] = selectedColor[0];
  output[offset + 1] = selectedColor[1];
  output[offset + 2] = selectedColor[2];
  output[offset + 3] = selectedColor[3];
}

export function sampleCircleRadius(unit: number, radius: number): number {
  return Math.sqrt(unit) * radius;
}

export function sampleShape2D(
  shape: CRCParticleShape2D,
  unit0: number,
  unit1: number,
  _unit2: number,
  output: Float64Array,
  offset: number,
): void {
  switch (shape.type) {
    case "point":
      output[offset] = shape.position?.[0] ?? 0;
      output[offset + 1] = shape.position?.[1] ?? 0;
      return;
    case "line":
      output[offset] = shape.from[0] + (shape.to[0] - shape.from[0]) * unit0;
      output[offset + 1] =
        shape.from[1] + (shape.to[1] - shape.from[1]) * unit0;
      return;
    case "rectangle": {
      if (shape.sample === "interior") {
        output[offset] = (unit0 - 0.5) * shape.width;
        output[offset + 1] = (unit1 - 0.5) * shape.height;
        return;
      }
      let distance = unit0 * 2 * (shape.width + shape.height);
      if (distance < shape.width) {
        output[offset] = -shape.width / 2 + distance;
        output[offset + 1] = -shape.height / 2;
        return;
      }
      distance -= shape.width;
      if (distance < shape.height) {
        output[offset] = shape.width / 2;
        output[offset + 1] = -shape.height / 2 + distance;
        return;
      }
      distance -= shape.height;
      if (distance < shape.width) {
        output[offset] = shape.width / 2 - distance;
        output[offset + 1] = shape.height / 2;
        return;
      }
      output[offset] = -shape.width / 2;
      output[offset + 1] = shape.height / 2 - (distance - shape.width);
      return;
    }
    case "circle": {
      const radius =
        shape.sample === "interior"
          ? sampleCircleRadius(unit0, shape.radius)
          : shape.radius;
      const angle = unit1 * TAU;
      output[offset] = Math.cos(angle) * radius;
      output[offset + 1] = Math.sin(angle) * radius;
      return;
    }
    case "ring": {
      const innerSquared = shape.innerRadius * shape.innerRadius;
      const radius = Math.sqrt(
        innerSquared +
          unit0 * (shape.outerRadius * shape.outerRadius - innerSquared),
      );
      const angle = unit1 * TAU;
      output[offset] = Math.cos(angle) * radius;
      output[offset + 1] = Math.sin(angle) * radius;
      return;
    }
  }
}

function sampleEmitterShape2D(
  plan: CompiledEmitter2D,
  birth: ParticleBirthView,
  output: Float64Array,
): void {
  sampleShape2D(
    plan.shape,
    sampleUnit(
      birth.seed,
      plan.emitterHash,
      birth.ordinal,
      plan.shapeChannels[0],
    ),
    sampleUnit(
      birth.seed,
      plan.emitterHash,
      birth.ordinal,
      plan.shapeChannels[1],
    ),
    sampleUnit(
      birth.seed,
      plan.emitterHash,
      birth.ordinal,
      plan.shapeChannels[2],
    ),
    output,
    Particle2DRegister.X,
  );
}

export function sampleParticle2D(
  plan: CompiledEmitter2D,
  birth: ParticleBirthView,
  effectTimeMilliseconds: number,
  parameters: Readonly<Float64Array>,
  output: Float64Array,
): boolean {
  particleSamples += 1;
  const ageMilliseconds = effectTimeMilliseconds - birth.birthTimeMilliseconds;
  const lifetimeMilliseconds = scalar(
    plan.initial.lifetime,
    birth,
    plan.emitterHash,
    parameters,
  );
  if (ageMilliseconds < 0 || ageMilliseconds >= lifetimeMilliseconds) {
    output[Particle2DRegister.Live] = 0;
    return false;
  }
  const ageSeconds = ageMilliseconds / 1_000;
  const normalizedAge = ageMilliseconds / lifetimeMilliseconds;
  output[Particle2DRegister.Live] = 1;
  sampleEmitterShape2D(plan, birth, output);

  const originX = output[Particle2DRegister.X]!;
  const originY = output[Particle2DRegister.Y]!;
  const initialVelocityX = vectorComponent(
    plan.initial.velocity,
    0,
    birth,
    plan.emitterHash,
    parameters,
  );
  const initialVelocityY = vectorComponent(
    plan.initial.velocity,
    1,
    birth,
    plan.emitterHash,
    parameters,
  );
  let accelerationX = 0;
  let accelerationY = 0;
  let driftX = 0;
  let driftY = 0;
  let drag = 0;
  let swayX = 0;
  let swayVelocityX = 0;
  let angularVelocity = scalar(
    plan.initial.angularVelocity,
    birth,
    plan.emitterHash,
    parameters,
  );
  let orbitCenterX = 0;
  let orbitCenterY = 0;
  let orbitDegrees = 0;
  let hasOrbit = false;

  for (
    let moduleIndex = 0;
    moduleIndex < plan.motion.length;
    moduleIndex += 1
  ) {
    const module = plan.motion[moduleIndex]!;
    switch (module.type) {
      case "acceleration":
      case "gravity":
        accelerationX += vectorComponent(
          module.value,
          0,
          birth,
          plan.emitterHash,
          parameters,
        );
        accelerationY += vectorComponent(
          module.value,
          1,
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
      case "drift":
        driftX += vectorComponent(
          module.value,
          0,
          birth,
          plan.emitterHash,
          parameters,
        );
        driftY += vectorComponent(
          module.value,
          1,
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
      case "drag":
        drag += scalar(module.amount, birth, plan.emitterHash, parameters);
        break;
      case "radialAcceleration": {
        const dx = originX - module.center[0];
        const dy = originY - module.center[1];
        const length = Math.hypot(dx, dy);
        if (length !== 0) {
          const amount = scalar(
            module.amount,
            birth,
            plan.emitterHash,
            parameters,
          );
          accelerationX += (dx / length) * amount;
          accelerationY += (dy / length) * amount;
        }
        break;
      }
      case "orbit":
        hasOrbit = true;
        orbitCenterX = module.center[0];
        orbitCenterY = module.center[1];
        orbitDegrees = scalar(
          module.degreesPerSecond,
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
      case "sway": {
        const amplitude = scalar(
          module.amplitude,
          birth,
          plan.emitterHash,
          parameters,
        );
        const frequency = scalar(
          module.frequency,
          birth,
          plan.emitterHash,
          parameters,
        );
        const angularFrequency = TAU * frequency;
        swayX += amplitude * Math.sin(angularFrequency * ageSeconds);
        swayVelocityX +=
          amplitude *
          angularFrequency *
          Math.cos(angularFrequency * ageSeconds);
        break;
      }
      case "angularVelocity":
        angularVelocity += scalar(
          module.degreesPerSecond,
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
    }
  }

  const dragDecay = drag === 0 ? 1 : Math.exp(-drag * ageSeconds);
  const dragIntegral = drag === 0 ? ageSeconds : (1 - dragDecay) / drag;
  let x =
    originX +
    initialVelocityX * dragIntegral +
    driftX * ageSeconds +
    0.5 * accelerationX * ageSeconds * ageSeconds +
    swayX;
  let y =
    originY +
    initialVelocityY * dragIntegral +
    driftY * ageSeconds +
    0.5 * accelerationY * ageSeconds * ageSeconds;
  let velocityX =
    initialVelocityX * dragDecay +
    driftX +
    accelerationX * ageSeconds +
    swayVelocityX;
  let velocityY =
    initialVelocityY * dragDecay + driftY + accelerationY * ageSeconds;
  if (hasOrbit) {
    const radians = (orbitDegrees * ageSeconds * Math.PI) / 180;
    const radiansPerSecond = (orbitDegrees * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const dx = x - orbitCenterX;
    const dy = y - orbitCenterY;
    const rotatedVelocityX = velocityX * cosine - velocityY * sine;
    const rotatedVelocityY = velocityX * sine + velocityY * cosine;
    x = orbitCenterX + dx * cosine - dy * sine;
    y = orbitCenterY + dx * sine + dy * cosine;
    velocityX = rotatedVelocityX - radiansPerSecond * (y - orbitCenterY);
    velocityY = rotatedVelocityY + radiansPerSecond * (x - orbitCenterX);
  }
  output[Particle2DRegister.X] = x;
  output[Particle2DRegister.Y] = y;
  output[Particle2DRegister.VelocityX] = velocityX;
  output[Particle2DRegister.VelocityY] = velocityY;

  const initialSizeX = vectorComponent(
    plan.initial.size,
    0,
    birth,
    plan.emitterHash,
    parameters,
  );
  const initialSizeY = vectorComponent(
    plan.initial.size,
    1,
    birth,
    plan.emitterHash,
    parameters,
  );
  output[Particle2DRegister.SizeX] =
    plan.appearance.size === null
      ? initialSizeX
      : sampleParticleCurve(plan.appearance.size, normalizedAge, 0);
  output[Particle2DRegister.SizeY] =
    plan.appearance.size === null
      ? initialSizeY
      : sampleParticleCurve(
          plan.appearance.size,
          normalizedAge,
          plan.appearance.size.dimension === 1 ? 0 : 1,
        );
  const initialRotation =
    scalar(plan.initial.rotation, birth, plan.emitterHash, parameters) +
    angularVelocity * ageSeconds;
  output[Particle2DRegister.Rotation] =
    plan.appearance.rotation === null
      ? initialRotation
      : sampleParticleCurve(plan.appearance.rotation, normalizedAge, 0);
  color(
    plan.initial.color,
    birth,
    plan.emitterHash,
    parameters,
    output,
    Particle2DRegister.Red,
  );
  if (plan.appearance.color !== null) {
    sampleParticleGradient(
      plan.appearance.color,
      normalizedAge,
      output,
      Particle2DRegister.Red,
    );
  }
  const opacity =
    plan.appearance.opacity === null
      ? scalar(plan.initial.opacity, birth, plan.emitterHash, parameters)
      : sampleParticleCurve(plan.appearance.opacity, normalizedAge, 0);
  output[Particle2DRegister.Alpha] *= opacity;
  output[Particle2DRegister.AtlasFrame] = 0;
  return true;
}
