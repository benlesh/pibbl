import type { PibblVisibilityTransitionOptions } from '../hooks/use-visibility-transition.js';
import type { embers } from './embers.js';
import { opacity } from '../../filters/native.js';
import type { PibblFilter } from '../style/filter-types.js';

declare const effectBrand: unique symbol;
/**
 * Immutable, inert visual definition; mounted state belongs to its controller.
 *
 * @see {@link fade}
 * @see {@link PibblVisibilityTransitionOptions}
 * @see {@link embers}
 */
export interface PibblTransitionEffect { readonly [effectBrand]: true }
export interface TransitionFrame {
  readonly active: boolean;
  readonly elapsed: number;
  readonly progressAt: (elapsed: number) => number;
}
export type TransitionSampler = (progress: number, phase: 'enter' | 'exit', frame: TransitionFrame) => readonly PibblFilter[];
const definitions = new WeakMap<PibblTransitionEffect, { sample: TransitionSampler; tail: number; create?: () => TransitionRuntime }>();
/**
 * A uniform fade of the receiving primitive and all of its descendants together.
 *
 * @returns A fade effect to use with a visibility transition. See {@link PibblTransitionEffect}.
 *
 * @see {@link PibblTransitionEffect}
 */
export function fade(): PibblTransitionEffect {
  return defineTransitionEffect(progress => progress === 1 ? [] : [opacity({ amount: progress })]);
}
export function transitionEffectSampler(definition: PibblTransitionEffect): TransitionSampler {
  const record = definitions.get(definition);
  if (!record) throw new TypeError('Expected a Pibbl transition effect definition.');
  return record.sample;
}

/** @internal Shared registration for first-party definitions. */
export function defineTransitionEffect(sample: TransitionSampler, tail = 0, create?: () => TransitionRuntime): PibblTransitionEffect {
  const definition = Object.freeze({}) as PibblTransitionEffect;
  definitions.set(definition, { sample, tail, create });
  return definition;
}

export function transitionEffectTail(definition: PibblTransitionEffect): number {
  transitionEffectSampler(definition);
  return definitions.get(definition)!.tail;
}

/** Private controller-owned state for effects that simulate during Advance. */
export interface TransitionRuntime {
  readonly sample: TransitionSampler;
  advance?(elapsed: number, progressAt: (time: number) => number): void;
  reset?(): void;
  dispose?(): void;
}
export function createTransitionRuntime(effect: PibblTransitionEffect): TransitionRuntime {
  const sample = transitionEffectSampler(effect);
  return definitions.get(effect)!.create?.() ?? { sample };
}
