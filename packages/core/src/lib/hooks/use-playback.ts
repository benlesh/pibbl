import {
  createAnimationPlaybackController,
  normalizeAnimationPlaybackCandidate,
  type AnimationPlaybackController,
} from '../animation/playback.js';
import type {
  CRCAnimationProgram,
  CRCPlayback,
  CRCPlaybackEvent,
  CRCPlaybackOptions,
} from '../animation/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { isSignal } from '../signals/graph.js';
import { resolveSignalValue } from '../signals/resolve-signal-value.js';
import type { SignalValue } from '../signals/types.js';
import type { CRCComponentRefs, CRCInstance } from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

type CRCPlaybackOptionsInput = {
  readonly [K in keyof CRCPlaybackOptions]: SignalValue<CRCPlaybackOptions[K]>;
};

interface CRCPlaybackHookSlot {
  readonly controller: AnimationPlaybackController;
  readonly componentRefs: CRCComponentRefs<any>;
  readonly crcInstance: CRCInstance;
  latestOptions: CRCPlaybackOptions;
  mountSettled: boolean;
  readonly onError: (error: unknown) => void;
  readonly onEvent: (event: CRCPlaybackEvent) => void;
  renderRevision: number;
}

function isCurrentSlot(slot: CRCPlaybackHookSlot): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.crcInstance.mainTeardowns.closed &&
    GLOBAL_STATE.crcInstances.get(slot.crcInstance.canvas) === slot.crcInstance &&
    slot.crcInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

function controllerOptions(
  candidate: CRCPlaybackOptions,
  onEvent: (event: CRCPlaybackEvent) => void,
  onError: (error: unknown) => void,
): CRCPlaybackOptions {
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
 * {@link SignalValue} , {@link CRCAnimationProgram} .
 * @param optionsInput - Playback configuration, optionally supplied by a signal. See
 * {@link SignalValue} , {@link CRCPlaybackOptionsInput} .
 * @returns Stable mount-owned playback controls and reactive status/time values. See
 * {@link CRCPlayback} .
 *
 * @see {@link SignalValue}
 * @see {@link CRCAnimationProgram}
 * @see {@link CRCPlayback}
 */
export function usePlayback(
  programInput: SignalValue<CRCAnimationProgram>,
  optionsInput: SignalValue<CRCPlaybackOptionsInput> = {},
): CRCPlayback {
  const { componentRefs, crcInstance } = requireHookContext();
  const program = resolveSignalValue(programInput);
  const options = resolvePlaybackOptions(optionsInput);
  const candidate = normalizeAnimationPlaybackCandidate(program, options);
  const candidateOptions = candidate.options;
  const slot = useHookSlot<CRCPlaybackHookSlot>('playback', teardowns => {
    let value!: CRCPlaybackHookSlot;
    const controller = createAnimationPlaybackController(
      candidate.program,
      candidateOptions,
    );
    const onEvent = (event: CRCPlaybackEvent): void => {
      if (isCurrentSlot(value)) value.latestOptions.onEvent?.(event);
    };
    const onError = (error: unknown): void => {
      if (isCurrentSlot(value)) value.latestOptions.onError?.(error);
    };
    value = {
      controller,
      componentRefs,
      crcInstance,
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
    throw new Error('usePlayback requires an active CRC render transaction.');
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
  input: SignalValue<CRCPlaybackOptionsInput>,
): CRCPlaybackOptions {
  const source = resolveSignalValue(input);
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    const value = source[key as keyof CRCPlaybackOptionsInput];
    if (!isSignal(value)) continue;
    resolved ??= { ...source };
    resolved[key] = resolveSignalValue(value as SignalValue<unknown>);
  }
  return (resolved ?? source) as CRCPlaybackOptions;
}
