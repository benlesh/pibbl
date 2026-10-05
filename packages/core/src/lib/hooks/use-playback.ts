import {
  createAnimationPlaybackController,
  normalizeAnimationPlaybackCandidate,
  type AnimationPlaybackController,
} from '../animation/playback.js';
import type {
  PibblAnimationProgram,
  PibblPlayback,
  PibblPlaybackEvent,
  PibblPlaybackOptions,
} from '../animation/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { isSignal } from '../signals/graph.js';
import { resolveSignalValue } from '../signals/resolve-signal-value.js';
import type { SignalValue } from '../signals/types.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

type PibblPlaybackOptionsInput = {
  readonly [K in keyof PibblPlaybackOptions]: SignalValue<PibblPlaybackOptions[K]>;
};

interface PibblPlaybackHookSlot {
  readonly controller: AnimationPlaybackController;
  readonly componentRefs: PibblComponentRefs<any>;
  readonly pibblInstance: PibblInstance;
  latestOptions: PibblPlaybackOptions;
  mountSettled: boolean;
  readonly onError: (error: unknown) => void;
  readonly onEvent: (event: PibblPlaybackEvent) => void;
  renderRevision: number;
}

function isCurrentSlot(slot: PibblPlaybackHookSlot): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.pibblInstance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(slot.pibblInstance.canvas) === slot.pibblInstance &&
    slot.pibblInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

function controllerOptions(
  candidate: PibblPlaybackOptions,
  onEvent: (event: PibblPlaybackEvent) => void,
  onError: (error: unknown) => void,
): PibblPlaybackOptions {
  return {
    ...candidate,
    onEvent: typeof candidate.onEvent === 'function' ?
      onEvent : candidate.onEvent,
    onError: typeof candidate.onError === 'function' ?
      onError : candidate.onError,
  };
}

/**
 * Creates one component-owned animation playback handle for a hook slot.
 *
 * @param programInput - Animation program, optionally supplied by a signal. See
 * {@link SignalValue} , {@link PibblAnimationProgram} .
 * @param optionsInput - Playback configuration, optionally supplied by a signal. See
 * {@link SignalValue} , {@link PibblPlaybackOptionsInput} .
 * @returns Stable mount-owned playback controls and reactive status/time values. See
 * {@link PibblPlayback} .
 *
 * @see {@link SignalValue}
 * @see {@link PibblAnimationProgram}
 * @see {@link PibblPlayback}
 */
export function usePlayback(
  programInput: SignalValue<PibblAnimationProgram>,
  optionsInput: SignalValue<PibblPlaybackOptionsInput> = {},
): PibblPlayback {
  const { componentRefs, pibblInstance } = requireHookContext();
  const program = resolveSignalValue(programInput);
  const options = resolvePlaybackOptions(optionsInput);
  const candidate = normalizeAnimationPlaybackCandidate(program, options);
  const candidateOptions = candidate.options;
  const slot = useHookSlot<PibblPlaybackHookSlot>('playback', teardowns => {
    let value!: PibblPlaybackHookSlot;
    const controller = createAnimationPlaybackController(
      candidate.program,
      candidateOptions,
    );
    controller.setDeferredStatusCommandOwner(pibblInstance.mainTeardowns);
    const onEvent = (event: PibblPlaybackEvent): void => {
      if (isCurrentSlot(value)) value.latestOptions.onEvent?.(event);
    };
    const onError = (error: unknown): void => {
      if (isCurrentSlot(value)) value.latestOptions.onError?.(error);
    };
    value = {
      controller,
      componentRefs,
      pibblInstance,
      latestOptions: {},
      mountSettled: false,
      onError,
      onEvent,
      renderRevision: 0,
    };
    controller.adopt(
      candidate.program,
      controllerOptions(candidateOptions, onEvent, onError),
    );
    teardowns.add(() => controller.dispose());
    return value;
  }).value;
  const revision = ++slot.renderRevision;
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('usePlayback requires an active Pibbl render transaction.');
  }
  transaction.onFinish(success => {
    if (!success || revision !== slot.renderRevision || !isCurrentSlot(slot)) return;
    slot.controller.adopt(
      candidate.program,
      controllerOptions(candidateOptions, slot.onEvent, slot.onError),
    );
    slot.latestOptions = candidateOptions;
    if (!slot.mountSettled) {
      slot.mountSettled = true;
      if (candidateOptions.autoplay === true) slot.controller.handle.play();
    }
  });
  return slot.controller.handle;
}

function resolvePlaybackOptions(
  input: SignalValue<PibblPlaybackOptionsInput>,
): PibblPlaybackOptions {
  const source = resolveSignalValue(input);
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    const value = source[key as keyof PibblPlaybackOptionsInput];
    if (!isSignal(value)) continue;
    resolved ??= { ...source };
    resolved[key] = resolveSignalValue(value as SignalValue<unknown>);
  }
  return (resolved ?? source) as PibblPlaybackOptions;
}
