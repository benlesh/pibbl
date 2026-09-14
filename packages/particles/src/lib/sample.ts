import type {
  CompiledColor,
  CompiledEmitter2D,
  CompiledEmitter3D,
  CompiledScalar,
} from "./compiler.js";
import { sampleParticleCurve, sampleParticleGradient } from "./curve.js";
import { sampleBetween, sampleInteger, sampleUnit } from "./random.js";
import type { CRCParticleShape2D } from "./types.js";
import type { CRCParticleShape3D } from "./webgl-types.js";

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

export const enum Particle3DRegister {
  Live,
  X,
  Y,
  Z,
  VelocityX,
  VelocityY,
  VelocityZ,
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

function color(
  value: CompiledColor,
  birth: ParticleBirthView,
  emitterHash: number,
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

export function sampleSphereRadius(unit: number, radius: number): number {
  return Math.cbrt(unit) * radius;
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

function sampleOrientedDirection(
  directionX: number,
  directionY: number,
  directionZ: number,
  cosine: number,
  distance: number,
  angleUnit: number,
  output: Float64Array,
  offset: number,
): void {
  const directionLength = Math.hypot(directionX, directionY, directionZ);
  const nx = directionX / directionLength;
  const ny = directionY / directionLength;
  const nz = directionZ / directionLength;
  const referenceX = Math.abs(nz) < 0.999 ? 0 : 1;
  const referenceY = 0;
  const referenceZ = Math.abs(nz) < 0.999 ? 1 : 0;
  let tangentX = referenceY * nz - referenceZ * ny;
  let tangentY = referenceZ * nx - referenceX * nz;
  let tangentZ = referenceX * ny - referenceY * nx;
  const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
  tangentX /= tangentLength;
  tangentY /= tangentLength;
  tangentZ /= tangentLength;
  const bitangentX = ny * tangentZ - nz * tangentY;
  const bitangentY = nz * tangentX - nx * tangentZ;
  const bitangentZ = nx * tangentY - ny * tangentX;
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const angle = angleUnit * TAU;
  const radialX = Math.cos(angle) * sine;
  const radialY = Math.sin(angle) * sine;
  output[offset] =
    (nx * cosine + tangentX * radialX + bitangentX * radialY) * distance;
  output[offset + 1] =
    (ny * cosine + tangentY * radialX + bitangentY * radialY) * distance;
  output[offset + 2] =
    (nz * cosine + tangentZ * radialX + bitangentZ * radialY) * distance;
}

export function sampleShape3D(
  shape: CRCParticleShape3D,
  unit0: number,
  unit1: number,
  unit2: number,
  output: Float64Array,
  offset: number,
): void {
  switch (shape.type) {
    case "point":
      output[offset] = shape.position?.[0] ?? 0;
      output[offset + 1] = shape.position?.[1] ?? 0;
      output[offset + 2] = shape.position?.[2] ?? 0;
      return;
    case "line":
      output[offset] = shape.from[0] + (shape.to[0] - shape.from[0]) * unit0;
      output[offset + 1] =
        shape.from[1] + (shape.to[1] - shape.from[1]) * unit0;
      output[offset + 2] =
        shape.from[2] + (shape.to[2] - shape.from[2]) * unit0;
      return;
    case "box": {
      const halfX = shape.size[0] / 2;
      const halfY = shape.size[1] / 2;
      const halfZ = shape.size[2] / 2;
      if (shape.sample === "volume") {
        output[offset] = (unit0 * 2 - 1) * halfX;
        output[offset + 1] = (unit1 * 2 - 1) * halfY;
        output[offset + 2] = (unit2 * 2 - 1) * halfZ;
        return;
      }
      const yz = shape.size[1] * shape.size[2];
      const xz = shape.size[0] * shape.size[2];
      const xy = shape.size[0] * shape.size[1];
      let selection = unit0 * 2 * (yz + xz + xy);
      if (selection < yz) {
        output[offset] = -halfX;
        output[offset + 1] = ((selection / yz) * 2 - 1) * halfY;
        output[offset + 2] = (unit1 * 2 - 1) * halfZ;
        return;
      }
      selection -= yz;
      if (selection < yz) {
        output[offset] = halfX;
        output[offset + 1] = ((selection / yz) * 2 - 1) * halfY;
        output[offset + 2] = (unit1 * 2 - 1) * halfZ;
        return;
      }
      selection -= yz;
      if (selection < xz) {
        output[offset] = ((selection / xz) * 2 - 1) * halfX;
        output[offset + 1] = -halfY;
        output[offset + 2] = (unit1 * 2 - 1) * halfZ;
        return;
      }
      selection -= xz;
      if (selection < xz) {
        output[offset] = ((selection / xz) * 2 - 1) * halfX;
        output[offset + 1] = halfY;
        output[offset + 2] = (unit1 * 2 - 1) * halfZ;
        return;
      }
      selection -= xz;
      if (selection < xy) {
        output[offset] = ((selection / xy) * 2 - 1) * halfX;
        output[offset + 1] = (unit1 * 2 - 1) * halfY;
        output[offset + 2] = -halfZ;
        return;
      }
      selection -= xy;
      output[offset] = ((selection / xy) * 2 - 1) * halfX;
      output[offset + 1] = (unit1 * 2 - 1) * halfY;
      output[offset + 2] = halfZ;
      return;
    }
    case "sphere": {
      const innerRadius =
        shape.sample === "volume"
          ? Math.max(0, shape.radius - (shape.thickness ?? shape.radius))
          : shape.radius;
      const radius =
        shape.sample === "volume"
          ? Math.cbrt(
              innerRadius ** 3 + unit0 * (shape.radius ** 3 - innerRadius ** 3),
            )
          : shape.radius;
      const z = 1 - 2 * unit2;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const angle = unit1 * TAU;
      output[offset] = Math.cos(angle) * planar * radius;
      output[offset + 1] = Math.sin(angle) * planar * radius;
      output[offset + 2] = z * radius;
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
      output[offset + 2] = 0;
      return;
    }
    case "cone": {
      const distance =
        shape.length *
        (shape.sample === "volume" ? Math.cbrt(unit0) : Math.sqrt(unit0));
      const maximumRadians = (shape.spreadDegrees * Math.PI) / 180;
      const cosine =
        shape.sample === "volume"
          ? 1 - unit1 * (1 - Math.cos(maximumRadians))
          : Math.cos(maximumRadians);
      sampleOrientedDirection(
        shape.direction[0],
        shape.direction[1],
        shape.direction[2],
        cosine,
        distance,
        unit2,
        output,
        offset,
      );
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
  const initialVelocityX = scalar(
    plan.initial.velocity[0],
    birth,
    plan.emitterHash,
    parameters,
  );
  const initialVelocityY = scalar(
    plan.initial.velocity[1],
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
        accelerationX += scalar(
          module.value[0],
          birth,
          plan.emitterHash,
          parameters,
        );
        accelerationY += scalar(
          module.value[1],
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
      case "drift":
        driftX += scalar(module.value[0], birth, plan.emitterHash, parameters);
        driftY += scalar(module.value[1], birth, plan.emitterHash, parameters);
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
        swayX += amplitude * Math.sin(TAU * frequency * ageSeconds);
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
  if (hasOrbit) {
    const radians = (orbitDegrees * ageSeconds * Math.PI) / 180;
    const dx = x - orbitCenterX;
    const dy = y - orbitCenterY;
    x = orbitCenterX + dx * Math.cos(radians) - dy * Math.sin(radians);
    y = orbitCenterY + dx * Math.sin(radians) + dy * Math.cos(radians);
  }
  output[Particle2DRegister.X] = x;
  output[Particle2DRegister.Y] = y;
  output[Particle2DRegister.VelocityX] =
    initialVelocityX * dragDecay + driftX + accelerationX * ageSeconds;
  output[Particle2DRegister.VelocityY] =
    initialVelocityY * dragDecay + driftY + accelerationY * ageSeconds;

  const initialSizeX = scalar(
    plan.initial.size[0],
    birth,
    plan.emitterHash,
    parameters,
  );
  const initialSizeY = scalar(
    plan.initial.size[1],
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

function sampleConeVelocity3D(
  plan: CompiledEmitter3D,
  birth: ParticleBirthView,
  parameters: Readonly<Float64Array>,
  output: Float64Array,
): void {
  if (plan.initial.velocity.type === "vector") {
    output[Particle3DRegister.VelocityX] = scalar(
      plan.initial.velocity.value[0],
      birth,
      plan.emitterHash,
      parameters,
    );
    output[Particle3DRegister.VelocityY] = scalar(
      plan.initial.velocity.value[1],
      birth,
      plan.emitterHash,
      parameters,
    );
    output[Particle3DRegister.VelocityZ] = scalar(
      plan.initial.velocity.value[2],
      birth,
      plan.emitterHash,
      parameters,
    );
    return;
  }
  const directionX = scalar(
    plan.initial.velocity.direction[0],
    birth,
    plan.emitterHash,
    parameters,
  );
  const directionY = scalar(
    plan.initial.velocity.direction[1],
    birth,
    plan.emitterHash,
    parameters,
  );
  const directionZ = scalar(
    plan.initial.velocity.direction[2],
    birth,
    plan.emitterHash,
    parameters,
  );
  const speed = scalar(
    plan.initial.velocity.speed,
    birth,
    plan.emitterHash,
    parameters,
  );
  const spread =
    (scalar(
      plan.initial.velocity.spreadDegrees,
      birth,
      plan.emitterHash,
      parameters,
    ) *
      Math.PI) /
    180;
  const cosine =
    1 -
    sampleUnit(
      birth.seed,
      plan.emitterHash,
      birth.ordinal,
      plan.initial.velocity.spreadDegrees.channel,
    ) *
      (1 - Math.cos(spread));
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const directionLength = Math.hypot(directionX, directionY, directionZ);
  const nx = directionX / directionLength;
  const ny = directionY / directionLength;
  const nz = directionZ / directionLength;
  const referenceX = Math.abs(nz) < 0.999 ? 0 : 1;
  const referenceZ = Math.abs(nz) < 0.999 ? 1 : 0;
  let tangentX = -referenceZ * ny;
  let tangentY = referenceZ * nx - referenceX * nz;
  let tangentZ = referenceX * ny;
  const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
  tangentX /= tangentLength;
  tangentY /= tangentLength;
  tangentZ /= tangentLength;
  const bitangentX = ny * tangentZ - nz * tangentY;
  const bitangentY = nz * tangentX - nx * tangentZ;
  const bitangentZ = nx * tangentY - ny * tangentX;
  const angle =
    sampleUnit(
      birth.seed,
      plan.emitterHash,
      birth.ordinal,
      plan.initial.velocity.speed.channel,
    ) * TAU;
  const radialX = Math.cos(angle) * sine;
  const radialY = Math.sin(angle) * sine;
  output[Particle3DRegister.VelocityX] =
    (nx * cosine + tangentX * radialX + bitangentX * radialY) * speed;
  output[Particle3DRegister.VelocityY] =
    (ny * cosine + tangentY * radialX + bitangentY * radialY) * speed;
  output[Particle3DRegister.VelocityZ] =
    (nz * cosine + tangentZ * radialX + bitangentZ * radialY) * speed;
}

export function sampleParticle3D(
  plan: CompiledEmitter3D,
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
    output[Particle3DRegister.Live] = 0;
    return false;
  }
  const ageSeconds = ageMilliseconds / 1_000;
  const normalizedAge = ageMilliseconds / lifetimeMilliseconds;
  output[Particle3DRegister.Live] = 1;
  sampleShape3D(
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
    Particle3DRegister.X,
  );
  const originX = output[Particle3DRegister.X]!;
  const originY = output[Particle3DRegister.Y]!;
  const originZ = output[Particle3DRegister.Z]!;
  sampleConeVelocity3D(plan, birth, parameters, output);
  const initialVelocityX = output[Particle3DRegister.VelocityX]!;
  const initialVelocityY = output[Particle3DRegister.VelocityY]!;
  const initialVelocityZ = output[Particle3DRegister.VelocityZ]!;
  let accelerationX = 0;
  let accelerationY = 0;
  let accelerationZ = 0;
  let driftX = 0;
  let driftY = 0;
  let driftZ = 0;
  let drag = 0;
  let swayX = 0;
  let swayY = 0;
  let swayZ = 0;
  let angularVelocity = scalar(
    plan.initial.angularVelocity,
    birth,
    plan.emitterHash,
    parameters,
  );
  let hasOrbit = false;
  let orbitCenterX = 0;
  let orbitCenterY = 0;
  let orbitCenterZ = 0;
  let orbitAxisX = 0;
  let orbitAxisY = 0;
  let orbitAxisZ = 1;
  let orbitDegrees = 0;

  for (
    let moduleIndex = 0;
    moduleIndex < plan.motion.length;
    moduleIndex += 1
  ) {
    const module = plan.motion[moduleIndex]!;
    switch (module.type) {
      case "acceleration":
      case "gravity":
        accelerationX += scalar(
          module.value[0],
          birth,
          plan.emitterHash,
          parameters,
        );
        accelerationY += scalar(
          module.value[1],
          birth,
          plan.emitterHash,
          parameters,
        );
        accelerationZ += scalar(
          module.value[2],
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
      case "drift":
        driftX += scalar(module.value[0], birth, plan.emitterHash, parameters);
        driftY += scalar(module.value[1], birth, plan.emitterHash, parameters);
        driftZ += scalar(module.value[2], birth, plan.emitterHash, parameters);
        break;
      case "drag":
        drag += scalar(module.amount, birth, plan.emitterHash, parameters);
        break;
      case "radialAcceleration": {
        const dx = originX - module.center[0];
        const dy = originY - module.center[1];
        const dz = originZ - module.center[2];
        const length = Math.hypot(dx, dy, dz);
        if (length !== 0) {
          const amount = scalar(
            module.amount,
            birth,
            plan.emitterHash,
            parameters,
          );
          accelerationX += (dx / length) * amount;
          accelerationY += (dy / length) * amount;
          accelerationZ += (dz / length) * amount;
        }
        break;
      }
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
        const displacement = amplitude * Math.sin(TAU * frequency * ageSeconds);
        swayX +=
          scalar(module.direction[0], birth, plan.emitterHash, parameters) *
          displacement;
        swayY +=
          scalar(module.direction[1], birth, plan.emitterHash, parameters) *
          displacement;
        swayZ +=
          scalar(module.direction[2], birth, plan.emitterHash, parameters) *
          displacement;
        break;
      }
      case "angularVelocity":
        angularVelocity += scalar(
          module.degreesPerSecond[2],
          birth,
          plan.emitterHash,
          parameters,
        );
        break;
      case "orbit":
        hasOrbit = true;
        orbitCenterX = module.center[0];
        orbitCenterY = module.center[1];
        orbitCenterZ = module.center[2];
        orbitAxisX = scalar(
          module.axis[0],
          birth,
          plan.emitterHash,
          parameters,
        );
        orbitAxisY = scalar(
          module.axis[1],
          birth,
          plan.emitterHash,
          parameters,
        );
        orbitAxisZ = scalar(
          module.axis[2],
          birth,
          plan.emitterHash,
          parameters,
        );
        orbitDegrees = scalar(
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
    0.5 * accelerationY * ageSeconds * ageSeconds +
    swayY;
  let z =
    originZ +
    initialVelocityZ * dragIntegral +
    driftZ * ageSeconds +
    0.5 * accelerationZ * ageSeconds * ageSeconds +
    swayZ;
  if (hasOrbit) {
    const axisLength = Math.hypot(orbitAxisX, orbitAxisY, orbitAxisZ);
    const axisX = orbitAxisX / axisLength;
    const axisY = orbitAxisY / axisLength;
    const axisZ = orbitAxisZ / axisLength;
    const radians = (orbitDegrees * ageSeconds * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const dx = x - orbitCenterX;
    const dy = y - orbitCenterY;
    const dz = z - orbitCenterZ;
    const dot = axisX * dx + axisY * dy + axisZ * dz;
    const crossX = axisY * dz - axisZ * dy;
    const crossY = axisZ * dx - axisX * dz;
    const crossZ = axisX * dy - axisY * dx;
    x = orbitCenterX + dx * cosine + crossX * sine + axisX * dot * (1 - cosine);
    y = orbitCenterY + dy * cosine + crossY * sine + axisY * dot * (1 - cosine);
    z = orbitCenterZ + dz * cosine + crossZ * sine + axisZ * dot * (1 - cosine);
  }
  output[Particle3DRegister.X] = x;
  output[Particle3DRegister.Y] = y;
  output[Particle3DRegister.Z] = z;
  output[Particle3DRegister.VelocityX] =
    initialVelocityX * dragDecay + driftX + accelerationX * ageSeconds;
  output[Particle3DRegister.VelocityY] =
    initialVelocityY * dragDecay + driftY + accelerationY * ageSeconds;
  output[Particle3DRegister.VelocityZ] =
    initialVelocityZ * dragDecay + driftZ + accelerationZ * ageSeconds;
  const initialSizeX = scalar(
    plan.initial.size[0],
    birth,
    plan.emitterHash,
    parameters,
  );
  const initialSizeY = scalar(
    plan.initial.size[1],
    birth,
    plan.emitterHash,
    parameters,
  );
  output[Particle3DRegister.SizeX] =
    plan.appearance.size === null
      ? initialSizeX
      : sampleParticleCurve(plan.appearance.size, normalizedAge, 0);
  output[Particle3DRegister.SizeY] =
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
  output[Particle3DRegister.Rotation] =
    plan.appearance.rotation === null
      ? initialRotation
      : sampleParticleCurve(plan.appearance.rotation, normalizedAge, 0);
  color(
    plan.initial.color,
    birth,
    plan.emitterHash,
    output,
    Particle3DRegister.Red,
  );
  if (plan.appearance.color !== null) {
    sampleParticleGradient(
      plan.appearance.color,
      normalizedAge,
      output,
      Particle3DRegister.Red,
    );
  }
  const opacity =
    plan.appearance.opacity === null
      ? scalar(plan.initial.opacity, birth, plan.emitterHash, parameters)
      : sampleParticleCurve(plan.appearance.opacity, normalizedAge, 0);
  output[Particle3DRegister.Alpha] *= opacity;
  output[Particle3DRegister.AtlasFrame] = 0;
  return true;
}
