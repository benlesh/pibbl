import {
  createAnimationPlaybackController,
  type AnimationPlaybackController,
} from '../animation/playback.js';
import { spring, tween } from '../animation/definition.js';
import { track } from '../animation/program.js';
import type {
  CRCAnimationProgram,
  CRCSpringTransitionOptions,
  CRCTweenTransitionOptions,
} from '../animation/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { signal, untracked } from '../signals/graph.js';
import type { Signal, SignalEquals, WritableSignal } from '../signals/types.js';
import type { CRCComponentRefs, CRCInstance } from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

type CRCTransitionOptions<T> =
  | CRCTweenTransitionOptions<T>
  | CRCSpringTransitionOptions;

interface CRCTransitionCandidate<T> {
  readonly options: CRCTransitionOptions<T>;
  readonly equals: SignalEquals<T>;
  readonly hasInitial: boolean;
  readonly initial: T;
  readonly target: T;
}

interface CRCTransitionHookSlot<T> {
  readonly componentRefs: CRCComponentRefs<any>;
  readonly controller: AnimationPlaybackController;
  readonly crcInstance: CRCInstance;
  output: WritableSignal<T>;
  readonlyOutput: Signal<T>;
  renderRevision: number;
  settled: boolean;
  target: T;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeCandidate<T>(
  target: T,
  options: CRCTransitionOptions<T>,
): CRCTransitionCandidate<T> {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('CRC transition options must be an object.');
  }
  if (options.type !== 'tween' && options.type !== 'spring') {
    throw new TypeError('CRC transition type must be "tween" or "spring".');
  }
  if (options.equals !== undefined && typeof options.equals !== 'function') {
    throw new TypeError('CRC transition equals must be a function.');
  }
  const snapshot = Object.freeze({ ...options }) as CRCTransitionOptions<T>;
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
  candidate: CRCTransitionCandidate<T>,
  springVelocity?: number,
): CRCAnimationProgram {
  const options = candidate.options;
  if (options.type === 'spring') {
    return track(output as unknown as WritableSignal<number>, spring({
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
  return track(output, tween({
    from,
    to: candidate.target,
    duration: options.duration,
    easing: options.easing,
    interpolate: options.interpolate,
    debugName: options.debugName,
  }));
}

function isCurrentSlot<T>(slot: CRCTransitionHookSlot<T>): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.crcInstance.mainTeardowns.closed &&
    GLOBAL_STATE.crcInstances.get(slot.crcInstance.canvas) === slot.crcInstance &&
    slot.crcInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

export function crcTransition(
  target: number,
  options: CRCSpringTransitionOptions,
): Signal<number>;
export function crcTransition<T>(
  target: T,
  options: CRCTweenTransitionOptions<T>,
): Signal<T>;
export function crcTransition<T>(
  target: T,
  options: CRCTransitionOptions<T>,
): Signal<T> {
  const { componentRefs, crcInstance } = requireHookContext();
  const candidate = normalizeCandidate(target, options);
  const slot = useHookSlot<CRCTransitionHookSlot<T>>('transition', teardowns => {
    const output = signal(candidate.initial);
    const program = programFor(output, candidate.initial, candidate);
    const controller = createAnimationPlaybackController(program, {
      conflict: 'replace',
      debugName: candidate.options.debugName,
    });
    const value: CRCTransitionHookSlot<T> = {
      componentRefs,
      controller,
      crcInstance,
      output,
      readonlyOutput: output.asReadonly(),
      renderRevision: 0,
      settled: false,
      target: candidate.target,
    };
    teardowns.add(() => controller.dispose());
    return value;
  }).value;

  if (!slot.settled && !Object.is(
    untracked(() => slot.output.get()),
    candidate.initial,
  )) {
    slot.output = signal(candidate.initial);
    slot.readonlyOutput = slot.output.asReadonly();
  }

  const revision = ++slot.renderRevision;
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('crcTransition requires an active CRC render transaction.');
  }
  transaction.onFinish(success => {
    if (!success || revision !== slot.renderRevision || !isCurrentSlot(slot)) return;
    const previousTarget = slot.target;
    const shouldEnter = !slot.settled && candidate.hasInitial &&
      !candidate.equals(candidate.initial, candidate.target);
    const shouldRetarget = slot.settled &&
      !candidate.equals(previousTarget, candidate.target);
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
