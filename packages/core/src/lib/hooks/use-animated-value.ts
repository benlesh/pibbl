import {
  createAnimationPlaybackController,
  type AnimationPlaybackController,
} from '../animation/playback.js';
import { spring, tween } from '../animation/definition.js';
import { drive } from '../animation/program.js';
import type {
  PibblAnimationProgram,
  PibblSpringAnimatedValueOptions,
  PibblTweenAnimatedValueOptions,
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
import { requireHookContext, useHookSlot } from './hook-slot.js';

type PibblTransitionOptions<T> =
  | PibblTweenAnimatedValueOptions<T>
  | PibblSpringAnimatedValueOptions;

type PibblTransitionOptionsInput<T> =
  | {
      readonly [K in keyof PibblTweenAnimatedValueOptions<T>]:
        SignalValue<PibblTweenAnimatedValueOptions<T>[K]>;
    }
  | {
      readonly [K in keyof PibblSpringAnimatedValueOptions]:
        SignalValue<PibblSpringAnimatedValueOptions[K]>;
    };

interface PibblTransitionCandidate<T> {
  readonly options: PibblTransitionOptions<T>;
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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeCandidate<T>(
  target: T,
  options: PibblTransitionOptions<T>,
): PibblTransitionCandidate<T> {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('Pibbl transition options must be an object.');
  }
  if (options.type !== 'tween' && options.type !== 'spring') {
    throw new TypeError('Pibbl transition type must be "tween" or "spring".');
  }
  if (options.equals !== undefined && typeof options.equals !== 'function') {
    throw new TypeError('Pibbl transition equals must be a function.');
  }
  const snapshot = Object.freeze({ ...options }) as PibblTransitionOptions<T>;
  if (snapshot.type === 'spring') {
    spring({
      from: target as number,
      to: target as number,
      mass: snapshot.mass,
      stiffness: snapshot.stiffness,
      damping: snapshot.damping,
      initialVelocity: snapshot.initialVelocity,
      restSpeed: snapshot.restSpeed,
      restDelta: snapshot.restDelta,
      maxDuration: snapshot.maxDuration,
      debugName: snapshot.debugName,
    });
  } else {
    tween({
      from: target,
      to: target,
      duration: snapshot.duration,
      easing: snapshot.easing,
      interpolate: snapshot.interpolate,
      debugName: snapshot.debugName,
    });
  }
  const hasInitial = hasOwn(options, 'initial');
  return Object.freeze({
    options: snapshot,
    equals: (snapshot.equals ?? Object.is) as SignalEquals<T>,
    hasInitial,
    initial: (hasInitial ? snapshot.initial : target) as T,
    target,
  });
}

function programFor<T>(
  output: WritableSignal<T>,
  from: T,
  candidate: PibblTransitionCandidate<T>,
  springVelocity?: number,
): PibblAnimationProgram {
  const options = candidate.options;
  if (options.type === 'spring') {
    return drive(output as unknown as WritableSignal<number>, spring({
      from: from as number,
      to: candidate.target as number,
      mass: options.mass,
      stiffness: options.stiffness,
      damping: options.damping,
      initialVelocity: springVelocity ?? options.initialVelocity,
      restSpeed: options.restSpeed,
      restDelta: options.restDelta,
      maxDuration: options.maxDuration,
      debugName: options.debugName,
    }));
  }
  return drive(output, tween({
    from,
    to: candidate.target,
    duration: options.duration,
    easing: options.easing,
    interpolate: options.interpolate,
    debugName: options.debugName,
  }));
}

function isCurrentSlot<T>(slot: PibblTransitionHookSlot<T>): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.pibblInstance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(slot.pibblInstance.canvas) === slot.pibblInstance &&
    slot.pibblInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

/**
 * Animates a numeric target using an analytic spring. See {@link PibblSpringAnimatedValueOptions}
 * and {@link Signal}.
 * @param target - Target value or signal whose changes start transitions. See {@link SignalValue}.
 * @param options - Spring or tween configuration, including signal-backed fields. See
 * {@link SignalValue} , {@link PibblSpringAnimatedValueOptions} .
 * @returns A readonly signal containing the animated value. See {@link Signal}.
 */
export function useAnimatedValue(
  target: SignalValue<number>,
  options: SignalValue<{
    readonly [K in keyof PibblSpringAnimatedValueOptions]:
      SignalValue<PibblSpringAnimatedValueOptions[K]>;
  }>,
): Signal<number>;
/**
 * Animates a target using a tween and optional custom interpolation. See
 * {@link PibblTweenAnimatedValueOptions} and {@link Signal}.
 * @param target - Target value or signal whose changes start transitions. See {@link SignalValue}.
 * @param options - Spring or tween configuration, including signal-backed fields. See
 * {@link SignalValue} , {@link PibblTweenAnimatedValueOptions} .
 * @returns A readonly signal containing the animated value. See {@link Signal}.
 */
export function useAnimatedValue<T>(
  target: SignalValue<T>,
  options: SignalValue<{
    readonly [K in keyof PibblTweenAnimatedValueOptions<T>]:
      SignalValue<PibblTweenAnimatedValueOptions<T>[K]>;
  }>,
): Signal<T>;
/**
 * Returns a mount-owned signal that animates toward the current target using the supplied
 * transition options.
 *
 * @param targetInput - Target value or signal whose changes start transitions. See
 * {@link SignalValue} .
 * @param optionsInput - Spring or tween configuration, including signal-backed fields. See
 * {@link SignalValue} , {@link PibblTransitionOptionsInput} .
 * @returns A readonly signal containing the animated value. See {@link Signal}.
 *
 * @see {@link SignalValue}
 * @see {@link Signal}
 */
export function useAnimatedValue<T>(
  targetInput: SignalValue<T>,
  optionsInput: SignalValue<PibblTransitionOptionsInput<T>>,
): Signal<T> {
  const { componentRefs, pibblInstance } = requireHookContext();
  const target = resolveSignalValue(targetInput);
  const options = resolveTransitionOptions(optionsInput);
  const candidate = normalizeCandidate(target, options);
  const slot = useHookSlot<PibblTransitionHookSlot<T>>('transition', teardowns => {
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
        programFor(slot.output, slot.output.get(), candidate),
        {
          conflict: 'replace',
          debugName: candidate.options.debugName,
        },
      );
      return;
    }
    const springVelocity = candidate.options.type === 'spring' ?
      slot.controller.committedSpringSnapshot()?.velocity : undefined;
    const program = programFor(
      slot.output,
      slot.output.get(),
      candidate,
      springVelocity,
    );
    slot.controller.retarget(program, {
      conflict: 'replace',
      debugName: candidate.options.debugName,
    });
  });
  return slot.readonlyOutput;
}

function resolveTransitionOptions<T>(
  input: SignalValue<PibblTransitionOptionsInput<T>>,
): PibblTransitionOptions<T> {
  const source = resolveSignalValue(input);
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    const value = source[key as keyof typeof source];
    if (!isSignal(value)) continue;
    resolved ??= { ...source };
    resolved[key] = resolveSignalValue(value as SignalValue<unknown>);
  }
  return (resolved ?? source) as PibblTransitionOptions<T>;
}
