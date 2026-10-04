import { opacity } from '../../filters/native.js';
import type { CRCFilter } from '../style/filter-types.js';

declare const effectBrand: unique symbol;
/** Immutable, inert visual definition; mounted state belongs to its controller. */
export interface CRCTransitionEffect { readonly [effectBrand]: true }
export interface TransitionFrame {
  readonly active: boolean;
  readonly elapsed: number;
  readonly progressAt: (elapsed: number) => number;
}
type Sampler = (progress: number, phase: 'enter' | 'exit', frame: TransitionFrame) => readonly CRCFilter[];
const definitions = new WeakMap<CRCTransitionEffect, { sample: Sampler; tail: number }>();
/** A uniform fade of the receiving primitive and all of its descendants together. */
export function fade(): CRCTransitionEffect {
  return defineTransitionEffect(progress => progress === 1 ? [] : [opacity({ amount: progress })]);
}
export function transitionEffectSampler(definition: CRCTransitionEffect): Sampler {
  const record = definitions.get(definition);
  if (!record) throw new TypeError('Expected a CRC transition effect definition.');
  return record.sample;
}

/** @internal Shared registration for first-party definitions. */
export function defineTransitionEffect(sample: Sampler, tail = 0): CRCTransitionEffect {
  const definition = Object.freeze({}) as CRCTransitionEffect;
  definitions.set(definition, { sample, tail });
  return definition;
}

export function transitionEffectTail(definition: CRCTransitionEffect): number {
  transitionEffectSampler(definition);
  return definitions.get(definition)!.tail;
}
