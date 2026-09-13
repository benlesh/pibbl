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
import type { CRCComponentRefs, CRCInstance } from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

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

/** Creates one component-owned animation playback handle for a hook slot. */
export function crcPlayback(
  program: CRCAnimationProgram,
  options: CRCPlaybackOptions = {},
): CRCPlayback {
  const { componentRefs, crcInstance } = requireHookContext();
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
    throw new Error('crcPlayback requires an active CRC render transaction.');
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
