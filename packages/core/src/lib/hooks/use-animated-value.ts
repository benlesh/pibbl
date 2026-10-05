import { bindAnimationTarget } from '../animation/definition.js';
import { drive } from '../animation/program.js';
import { withSignalWriteForbidden } from '../signals/graph.js';
import {
  createAnimationPlaybackController,
  type AnimationPlaybackController,
} from '../animation/playback.js';
import type {
  PibblAnimatedValueOptions,
} from '../animation/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import {
  isSignal,
  provisionSignalValueForRender,
  signal,
  untracked,
} from '../signals/graph.js';
import { resolveSignalValue } from '../signals/resolve-signal-value.js';
import type {
  Signal,
  SignalEquals,
  SignalValue,
  WritableSignal,
} from '../signals/types.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';
import { requireHookContext, useHookSlot, withHooksForbidden } from './hook-slot.js';

type AnimatedValueInputs<T> = {
  readonly [K in keyof PibblAnimatedValueOptions<T>]: SignalValue<PibblAnimatedValueOptions<T>[K]>;
};

interface PibblTransitionCandidate<T> {
  readonly options: PibblAnimatedValueOptions<T>;
  readonly equals: SignalEquals<T>;
  readonly hasInitial: boolean;
  readonly initial: T;
  readonly target: T;
}

interface PibblTransitionHookSlot<T> {
  readonly componentRefs: PibblComponentRefs<any>;
  readonly controller: AnimationPlaybackController;
  readonly pibblInstance: PibblInstance;
  readonly output: WritableSignal<T>;
  readonly readonlyOutput: Signal<T>;
  renderRevision: number;
  settled: boolean;
  target: T;
}

function normalizeCandidate<T>(
  target: T,
  options: PibblAnimatedValueOptions<T>,
): PibblTransitionCandidate<T> {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('useAnimatedValue options must be an object.');
  }
  if (options.equals !== undefined && typeof options.equals !== 'function') {
    throw new TypeError('Pibbl transition equals must be a function.');
  }
  const snapshot = Object.freeze({ ...options });
  const hasInitial = Object.prototype.hasOwnProperty.call(options, 'initial');
  return Object.freeze({
    options: snapshot,
    equals: snapshot.equals ?? Object.is,
    hasInitial,
    initial: (hasInitial ? snapshot.initial : target) as T,
    target,
  });
}

function isCurrentSlot<T>(slot: PibblTransitionHookSlot<T>): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.pibblInstance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(slot.pibblInstance.canvas) === slot.pibblInstance &&
    slot.pibblInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

/**
 * Presents a target through an immutable animation definition or a pure animation factory.
 * @param targetInput - Target value or signal. See {@link SignalValue}.
 * @param optionsInput - Animation definition, initial value, equality, and diagnostic settings;
 * fields and the options object may be signals. See {@link PibblAnimatedValueOptions}.
 * @returns One stable readonly animated signal. See {@link Signal}.
 */
export function useAnimatedValue<T>(
  targetInput: SignalValue<T>,
  optionsInput: SignalValue<AnimatedValueInputs<NoInfer<T>>>,
): Signal<T> {
  const { componentRefs, pibblInstance } = requireHookContext();
  const target = resolveSignalValue(targetInput);
  const options = resolveTransitionOptions<T>(optionsInput);
  const candidate = normalizeCandidate(target, options);
  const slot = useHookSlot<PibblTransitionHookSlot<T>>('animatedValue', teardowns => {
    const output = signal(candidate.initial);
    const program = programFor(output, candidate.initial, candidate);
    const controller = createAnimationPlaybackController(program, {
      conflict: 'replace',
      debugName: candidate.options.debugName,
    });
    controller.setDeferredStatusCommandOwner(pibblInstance.mainTeardowns);
    const value: PibblTransitionHookSlot<T> = {
      componentRefs,
      controller,
      pibblInstance,
      output,
      readonlyOutput: output.asReadonly(),
      renderRevision: 0,
      settled: false,
      target: candidate.target,
    };
    teardowns.add(() => controller.dispose());
    return value;
  }).value;

  // Prepare user-defined work while Render can still fail transactionally. No factory runs
  // in onFinish, where a late exception could otherwise adopt only part of the update.
  const program = programFor(slot.output,
    slot.settled ? untracked(() => slot.output.get()) : candidate.initial,
    candidate, slot.settled ? slot.controller.committedSpringSnapshot()?.velocity : undefined);

  const shouldEnter = !slot.settled && candidate.hasInitial &&
    !candidate.equals(candidate.initial, candidate.target);
  const shouldRetarget = slot.settled &&
    !candidate.equals(slot.target, candidate.target);
  const previousProvisionalValue = untracked(() => slot.output.get());
  const hasProvisionalValue = !slot.settled &&
    !Object.is(previousProvisionalValue, candidate.initial);
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('useAnimatedValue requires an active Pibbl render transaction.');
  }
  if (hasProvisionalValue) {
    provisionSignalValueForRender(slot.output, candidate.initial, transaction);
  }
  const revision = ++slot.renderRevision;
  transaction.onFinish(success => {
    if (!success) return;
    if (revision !== slot.renderRevision || !isCurrentSlot(slot)) return;
    slot.settled = true;
    slot.target = candidate.target;
    if (!shouldEnter && !shouldRetarget) {
      slot.controller.adopt(
        program,
        {
          conflict: 'replace',
          debugName: candidate.options.debugName,
        },
      );
      return;
    }
    slot.controller.retarget(program, {
      conflict: 'replace',
      debugName: candidate.options.debugName,
    });
  });
  return slot.readonlyOutput;
}

function resolveTransitionOptions<T>(
  input: SignalValue<AnimatedValueInputs<T>>,
): PibblAnimatedValueOptions<T> {
  const source = resolveSignalValue(input);
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    const value = source[key as keyof typeof source];
    if (!isSignal(value)) continue;
    resolved ??= { ...source };
    resolved[key] = resolveSignalValue(value as SignalValue<unknown>);
  }
  return (resolved ?? source) as PibblAnimatedValueOptions<T>;
}

function programFor<T>(
  output: WritableSignal<T>, from: T, candidate: PibblTransitionCandidate<T>, velocity?: number,
) {
  const context = Object.freeze({ from, to: candidate.target, velocity });
  const animation = candidate.options.animation;
  const definition = typeof animation === 'function'
    ? withHooksForbidden('Animation factories cannot call hooks.', () =>
      withSignalWriteForbidden('Animation factories cannot write to signals.', () => animation(context)))
    : animation;
  return drive(output, bindAnimationTarget(definition, context));
}
