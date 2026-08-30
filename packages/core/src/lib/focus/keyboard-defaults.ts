import { dispatchToLogicalTarget } from '../events/dispatch.js';
import type { CRCEventTargetRegistration } from '../events/registrations.js';
import type { CRCKeyboardEvent } from '../events/types.js';
import type { CRCFocusManager } from './focus-manager.js';
import { transitionLogicalFocus } from './focus-events.js';

export type CRCTabMoveResult = 'moved' | 'exit';

export function moveTab(
  manager: CRCFocusManager,
  backwards: boolean,
): CRCTabMoveResult {
  const candidates = manager.candidates;
  if (candidates.length === 0) return 'exit';

  const current = manager.resolveKeyboardTarget();
  if (!current) {
    const endpoint = backwards ? candidates.at(-1) : candidates[0];
    transitionLogicalFocus(manager, endpoint?.target, 'keyboard');
    return endpoint ? 'moved' : 'exit';
  }

  const currentIndex = candidates.findIndex(candidate =>
    candidate.target === current
  );
  const nextIndex = currentIndex + (backwards ? -1 : 1);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= candidates.length) {
    return 'exit';
  }

  transitionLogicalFocus(manager, candidates[nextIndex].target, 'keyboard');
  return 'moved';
}

export function applyTabDefault(
  manager: CRCFocusManager,
  event: CRCKeyboardEvent,
): void {
  if (
    event.type !== 'keydown' ||
    event.key !== 'Tab' ||
    event.defaultPrevented
  ) {
    return;
  }
  if (moveTab(manager, event.shiftKey) === 'moved') event.preventDefault();
}

export function applyKeyboardActivationDefault(
  manager: CRCFocusManager,
  event: CRCKeyboardEvent,
): void {
  if (event.key === 'Enter') {
    if (
      event.type === 'keydown' &&
      !event.repeat &&
      !event.defaultPrevented
    ) {
      activateClick(manager.resolveKeyboardTarget(), event.originalEvent);
    }
    return;
  }

  if (event.key !== ' ' && event.key !== 'Spacebar') return;
  const target = manager.resolveKeyboardTarget();
  if (event.type === 'keydown') {
    if (event.repeat) {
      if (manager.hasPendingSpaceActivation(target)) event.preventDefault();
      return;
    }
    manager.cancelSpaceActivation();
    if (event.defaultPrevented || !target?.handlers.click) return;
    manager.beginSpaceActivation(target);
    event.preventDefault();
    return;
  }

  if (event.type !== 'keyup') return;
  const pending = manager.consumeSpaceActivation();
  if (
    !pending ||
    event.defaultPrevented ||
    pending !== target
  ) {
    return;
  }
  activateClick(pending, event.originalEvent);
}

function activateClick(
  target: CRCEventTargetRegistration | undefined,
  sourceEvent: KeyboardEvent,
): void {
  if (!target?.live || !target.handlers.click) return;
  dispatchToLogicalTarget(
    'click',
    target,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      detail: 0,
    }),
    null,
    sourceEvent,
  );
}
