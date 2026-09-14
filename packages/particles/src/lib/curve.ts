import type { CRCEasing } from "@crc/core";
import { parseParticleColor } from "./color.js";
import { getParticleDescriptorRecord } from "./particle.js";
import type {
  CRCParticleCurve,
  CRCParticleCurveValue,
  CRCParticleGradient,
} from "./types.js";

export const PARTICLE_CURVE_POINT_COUNT = 257;
const PARTICLE_CURVE_SEGMENTS = PARTICLE_CURVE_POINT_COUNT - 1;

export interface CompiledParticleCurve {
  readonly dimension: 1 | 2;
  readonly pointCount: 257;
  readonly samples: readonly number[];
}

export interface CompiledParticleGradient {
  readonly pointCount: 257;
  readonly samples: readonly number[];
  readonly cssSamples: readonly string[];
}

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

export function compileEasingTable(easing?: CRCEasing): readonly number[] {
  const samples: number[] = [];
  for (let index = 0; index < PARTICLE_CURVE_POINT_COUNT; index += 1) {
    const progress = index / PARTICLE_CURVE_SEGMENTS;
    const value = easing === undefined ? progress : easing(progress);
    if (!Number.isFinite(value)) {
      throw new RangeError(
        `Particle curve easing must return finite samples; received ${String(value)} at ${progress}.`,
      );
    }
    samples.push(value);
  }
  return Object.freeze(samples);
}

export function sampleEasingTable(
  samples: readonly number[],
  progress: number,
): number {
  const scaled = clampProgress(progress) * PARTICLE_CURVE_SEGMENTS;
  const lower = Math.floor(scaled);
  if (lower >= PARTICLE_CURVE_SEGMENTS)
    return samples[PARTICLE_CURVE_SEGMENTS]!;
  const fraction = scaled - lower;
  const from = samples[lower]!;
  return from + (samples[lower + 1]! - from) * fraction;
}

function findSegment(
  keys: readonly (readonly [time: number, value: unknown])[],
  time: number,
): number {
  let index = 0;
  while (index + 1 < keys.length - 1 && time > keys[index + 1]![0]) index += 1;
  return index;
}

function segmentProgress(
  keys: readonly (readonly [time: number, value: unknown])[],
  segment: number,
  time: number,
): number {
  const from = keys[segment]![0];
  const to = keys[segment + 1]![0];
  return to === from ? 1 : (time - from) / (to - from);
}

function curveComponent(
  value: CRCParticleCurveValue,
  component: number,
): number {
  return typeof value === "number" ? value : value[component]!;
}

export function compileParticleCurve(
  descriptor: CRCParticleCurve<CRCParticleCurveValue>,
): CompiledParticleCurve {
  const record = getParticleDescriptorRecord(descriptor);
  if (record?.type !== "curve") {
    throw new TypeError("Expected a curve created by particle.curve().");
  }
  const dimension: 1 | 2 = typeof record.keys[0]![1] === "number" ? 1 : 2;
  const easing = compileEasingTable(record.options?.easing);
  const samples: number[] = [];
  for (let index = 0; index < PARTICLE_CURVE_POINT_COUNT; index += 1) {
    const time = index / PARTICLE_CURVE_SEGMENTS;
    const segment = findSegment(record.keys, time);
    const from = record.keys[segment]![1];
    const to = record.keys[segment + 1]![1];
    const progress = sampleEasingTable(
      easing,
      segmentProgress(record.keys, segment, time),
    );
    for (let component = 0; component < dimension; component += 1) {
      const start = curveComponent(from, component);
      samples.push(start + (curveComponent(to, component) - start) * progress);
    }
  }
  return Object.freeze({
    dimension,
    pointCount: PARTICLE_CURVE_POINT_COUNT,
    samples: Object.freeze(samples),
  });
}

export function sampleParticleCurve(
  curve: CompiledParticleCurve,
  normalizedAge: number,
  component: number,
): number {
  const scaled = clampProgress(normalizedAge) * PARTICLE_CURVE_SEGMENTS;
  const lower = Math.floor(scaled);
  const lowerValue = curve.samples[lower * curve.dimension + component]!;
  if (lower >= PARTICLE_CURVE_SEGMENTS) return lowerValue;
  const fraction = scaled - lower;
  const upperValue = curve.samples[(lower + 1) * curve.dimension + component]!;
  return lowerValue + (upperValue - lowerValue) * fraction;
}

export function compileParticleGradient(
  descriptor: CRCParticleGradient,
): CompiledParticleGradient {
  const record = getParticleDescriptorRecord(descriptor);
  if (record?.type !== "gradient") {
    throw new TypeError("Expected a gradient created by particle.gradient().");
  }
  const easing = compileEasingTable(record.options?.easing);
  const samples: number[] = [];
  const cssSamples: string[] = [];
  for (let index = 0; index < PARTICLE_CURVE_POINT_COUNT; index += 1) {
    const time = index / PARTICLE_CURVE_SEGMENTS;
    const segment = findSegment(record.keys, time);
    const from = parseParticleColor(record.keys[segment]![1]);
    const to = parseParticleColor(record.keys[segment + 1]![1]);
    const progress = sampleEasingTable(
      easing,
      segmentProgress(record.keys, segment, time),
    );
    const red = clampProgress(from[0] + (to[0] - from[0]) * progress);
    const green = clampProgress(from[1] + (to[1] - from[1]) * progress);
    const blue = clampProgress(from[2] + (to[2] - from[2]) * progress);
    const alpha = clampProgress(from[3] + (to[3] - from[3]) * progress);
    samples.push(red, green, blue, alpha);
    cssSamples.push(
      `rgba(${red * 255} ${green * 255} ${blue * 255} / ${alpha})`,
    );
  }
  return Object.freeze({
    pointCount: PARTICLE_CURVE_POINT_COUNT,
    samples: Object.freeze(samples),
    cssSamples: Object.freeze(cssSamples),
  });
}

export function sampleParticleGradient(
  gradient: CompiledParticleGradient,
  normalizedAge: number,
  output: Float64Array,
  offset: number,
): void {
  const index =
    Math.round(clampProgress(normalizedAge) * PARTICLE_CURVE_SEGMENTS) * 4;
  output[offset] = gradient.samples[index]!;
  output[offset + 1] = gradient.samples[index + 1]!;
  output[offset + 2] = gradient.samples[index + 2]!;
  output[offset + 3] = gradient.samples[index + 3]!;
}
