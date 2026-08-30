import { dispatchToLogicalTarget } from '../events/dispatch.js';
import type { CRCEventType } from '../events/types.js';
import { update } from '../update.js';
import type { CRCFocusManager } from './focus-manager.js';
import type { CRCFocusModality } from './types.js';
import type { CRCEventTargetRegistration } from '../events/registrations.js';

export function transitionLogicalFocus(
  manager: CRCFocusManager,
  requestedNext: CRCEventTargetRegistration | undefined,
  modality: CRCFocusModality,
): void {
  if (manager.isDestroyed) return;
  const previous = manager.logicalFocusTarget;
  const initialNext = manager.liveFocusCandidate(requestedNext);
  const nextVisible = Boolean(initialNext && modality === 'keyboard');

  if (previous === initialNext) {
    if (manager.logicalFocusVisible === nextVisible) return;
    manager.commitLogicalFocus(initialNext, nextVisible);
    schedule(manager);
    return;
  }

  const outgoing = manager.liveFocusCandidate(previous);
  if (outgoing) {
    dispatchFocusEvent('focusout', outgoing, manager.liveFocusCandidate(initialNext));
    if (manager.liveFocusCandidate(outgoing)) {
      dispatchFocusEvent('blur', outgoing, manager.liveFocusCandidate(initialNext));
    }
  }

  if (manager.isDestroyed) return;
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
  schedule(manager);
}

function dispatchFocusEvent(
  type: Extract<CRCEventType, 'blur' | 'focus' | 'focusin' | 'focusout'>,
  target: CRCEventTargetRegistration,
  relatedTarget: CRCEventTargetRegistration | undefined,
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

function schedule(manager: CRCFocusManager): void {
  if (!manager.isDestroyed) update(manager.canvas);
}
