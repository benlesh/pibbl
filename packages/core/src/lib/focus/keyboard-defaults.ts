import type { CRCKeyboardEvent } from '../events/types.js';
import type { CRCFocusManager } from './focus-manager.js';

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
    manager.setFocusState(endpoint?.target, true);
    return endpoint ? 'moved' : 'exit';
  }

  const currentIndex = candidates.findIndex(candidate =>
    candidate.target === current
  );
  const nextIndex = currentIndex + (backwards ? -1 : 1);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= candidates.length) {
    return 'exit';
  }

  manager.setFocusState(candidates[nextIndex].target, true);
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
