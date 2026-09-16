export interface CompiledWeightedChoice<T> {
  readonly values: readonly T[];
  readonly cumulativeWeights: readonly number[];
  readonly totalWeight: number;
}

export function hashEmitterName(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

export function mix32(value: number): number {
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export function sampleHash(
  seed: number,
  emitterHash: number,
  ordinal: number,
  channel: number,
): number {
  let value = mix32((seed >>> 0) ^ emitterHash);
  value = mix32(value ^ mix32(ordinal >>> 0));
  return mix32(value ^ Math.imul(channel >>> 0, 0x9e3779b1)) >>> 0;
}

export function sampleUnit(
  seed: number,
  emitterHash: number,
  ordinal: number,
  channel: number,
): number {
  return sampleHash(seed, emitterHash, ordinal, channel) / 0x1_0000_0000;
}

export function sampleBetween(unit: number, min: number, max: number): number {
  return min + unit * (max - min);
}

export function sampleInteger(unit: number, min: number, max: number): number {
  return min + Math.floor(unit * (max - min + 1));
}

export function compileWeightedChoice<T>(
  choices: readonly Readonly<{ value: T; weight: number }>[],
): CompiledWeightedChoice<T> {
  const values: T[] = [];
  const cumulativeWeights: number[] = [];
  let totalWeight = 0;
  for (const choice of choices) {
    values.push(choice.value);
    totalWeight += choice.weight;
    cumulativeWeights.push(totalWeight);
  }
  return Object.freeze({
    values: Object.freeze(values),
    cumulativeWeights: Object.freeze(cumulativeWeights),
    totalWeight,
  });
}

export function sampleWeightedChoice<T>(
  choice: CompiledWeightedChoice<T>,
  unit: number,
): T {
  const target = unit * choice.totalWeight;
  for (let index = 0; index < choice.cumulativeWeights.length; index += 1) {
    if (target < choice.cumulativeWeights[index]!) return choice.values[index]!;
  }
  return choice.values[choice.values.length - 1]!;
}
