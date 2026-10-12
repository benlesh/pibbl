import { dispatchToLogicalTarget } from '../events/dispatch.js';
import type { PibblEventType } from '../events/types.js';
import { update } from '../update.js';
import type { PibblFocusManager } from './focus-manager.js';
import type { PibblFocusModality } from './types.js';
import type { PibblEventTargetRegistration } from '../events/registrations.js';

interface FocusTransitionRequest {
  readonly target: PibblEventTargetRegistration | undefined;
  readonly modality: PibblFocusModality;
}

interface ActiveFocusTransition {
  queued: FocusTransitionRequest | undefined;
}

const activeTransitions = new WeakMap<PibblFocusManager, ActiveFocusTransition>();

export function transitionLogicalFocus(
  manager: PibblFocusManager,
  requestedNext: PibblEventTargetRegistration | undefined,
  modality: PibblFocusModality,
): void {
  if (manager.isDestroyed) return;
  const active = activeTransitions.get(manager);
  if (active) {
    active.queued = { target: requestedNext, modality };
    return;
  }

  const transaction: ActiveFocusTransition = { queued: undefined };
  activeTransitions.set(manager, transaction);
  let request: FocusTransitionRequest | undefined = {
    target: requestedNext,
    modality,
  };
  let changed = false;
  try {
    while (request && !manager.isDestroyed) {
      transaction.queued = undefined;
      changed = performLogicalFocusTransition(
        manager,
        request.target,
        request.modality,
      ) || changed;
      request = transaction.queued;
    }
  } finally {
    activeTransitions.delete(manager);
    if (changed) schedule(manager);
  }
}

function performLogicalFocusTransition(
  manager: PibblFocusManager,
  requestedNext: PibblEventTargetRegistration | undefined,
  modality: PibblFocusModality,
): boolean {
  const previous = manager.logicalFocusTarget;
  const initialNext = manager.liveFocusCandidate(requestedNext);
  const nextVisible = Boolean(initialNext && modality === 'keyboard');

  if (previous === initialNext) {
    if (manager.logicalFocusVisible === nextVisible) return false;
    manager.commitLogicalFocus(initialNext, nextVisible);
    return true;
  }

  const outgoing = manager.liveFocusCandidate(previous);
  if (outgoing) {
    dispatchFocusEvent('focusout', outgoing, manager.liveFocusCandidate(initialNext));
    if (manager.liveFocusCandidate(outgoing)) {
      dispatchFocusEvent('blur', outgoing, manager.liveFocusCandidate(initialNext));
    }
  }

  if (manager.isDestroyed) return false;
  const next = manager.liveFocusCandidate(initialNext);
  manager.commitLogicalFocus(next, Boolean(next && modality === 'keyboard'));

  if (next) {
    const related = manager.liveFocusCandidate(previous);
    dispatchFocusEvent('focusin', next, related);
    if (
      manager.logicalFocusTarget === next &&
      manager.liveFocusCandidate(next)
    ) {
      dispatchFocusEvent('focus', next, manager.liveFocusCandidate(previous));
    }
  }
  return true;
}

function dispatchFocusEvent(
  type: Extract<PibblEventType, 'blur' | 'focus' | 'focusin' | 'focusout'>,
  target: PibblEventTargetRegistration,
  relatedTarget: PibblEventTargetRegistration | undefined,
): void {
  dispatchToLogicalTarget(
    type,
    target,
    new FocusEvent(type, {
      bubbles: type === 'focusin' || type === 'focusout',
      cancelable: false,
    }),
    relatedTarget ?? null,
  );
}

function schedule(manager: PibblFocusManager): void {
  if (!manager.isDestroyed) update(manager.canvas);
}
