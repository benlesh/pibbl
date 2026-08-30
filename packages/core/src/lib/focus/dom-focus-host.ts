import type { Teardowns } from '../teardowns.js';
import type { CRCEventRoot } from '../types.js';
import type { CRCEventType } from '../events/types.js';
import type { CRCFocusManager } from './focus-manager.js';
import { moveTab } from './keyboard-defaults.js';

interface TabIndexSnapshot {
  readonly existed: boolean;
  readonly value: string | null;
}

interface TabIndexOwnership {
  readonly snapshot: TabIndexSnapshot;
  readonly ownedValue: string | undefined;
}

interface PendingTabEntry {
  readonly event: KeyboardEvent;
  readonly origin: Element | null;
}

export interface CRCMountedDOMFocusHost {
  beforeNativeDispatch(type: CRCEventType, event: Event): void;
  setManager(manager: CRCFocusManager | undefined): void;
  syncCandidateAvailability(hasCandidates: boolean): void;
}

export function mountDOMFocusHost(
  canvas: HTMLCanvasElement,
  eventRoot: CRCEventRoot,
  teardowns: Teardowns,
): CRCMountedDOMFocusHost {
  let tabIndexOwnership: TabIndexOwnership | undefined;
  let candidateCycleActive = false;
  let pendingTabEntry: PendingTabEntry | undefined;
  let pendingTabExpiry: ReturnType<typeof setTimeout> | undefined;
  let manager: CRCFocusManager | undefined;
  let disposed = false;
  const keydownsWithTarget = new WeakSet<KeyboardEvent>();

  const restoreTabIndex = () => {
    const ownership = tabIndexOwnership;
    tabIndexOwnership = undefined;
    candidateCycleActive = false;
    if (
      !ownership?.ownedValue ||
      !canvas.hasAttribute('tabindex') ||
      canvas.getAttribute('tabindex') !== ownership.ownedValue
    ) {
      return;
    }
    if (ownership.snapshot.existed) {
      canvas.setAttribute('tabindex', ownership.snapshot.value ?? '');
    } else {
      canvas.removeAttribute('tabindex');
    }
  };

  const syncCandidateAvailability = (hasCandidates: boolean) => {
    if (disposed) return;
    if (!hasCandidates) {
      restoreTabIndex();
      return;
    }
    if (candidateCycleActive) return;

    candidateCycleActive = true;
    const snapshot: TabIndexSnapshot = {
      existed: canvas.hasAttribute('tabindex'),
      value: canvas.getAttribute('tabindex'),
    };
    if (snapshot.existed && canvas.tabIndex >= 0) {
      tabIndexOwnership = { snapshot, ownedValue: undefined };
      return;
    }
    canvas.setAttribute('tabindex', '0');
    tabIndexOwnership = { snapshot, ownedValue: '0' };
  };

  const setManager = (nextManager: CRCFocusManager | undefined) => {
    if (disposed) return;
    manager = nextManager;
    syncCandidateAvailability(Boolean(nextManager?.candidates.length));
  };

  const clearPendingTabEntry = () => {
    pendingTabEntry = undefined;
    if (pendingTabExpiry !== undefined) clearTimeout(pendingTabExpiry);
    pendingTabExpiry = undefined;
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    clearPendingTabEntry();
    const entry: PendingTabEntry = {
      event,
      origin: canvas.ownerDocument.activeElement,
    };
    pendingTabEntry = entry;
    const expiry = setTimeout(() => {
      if (pendingTabEntry === entry) pendingTabEntry = undefined;
      if (pendingTabExpiry === expiry) pendingTabExpiry = undefined;
    }, 0);
    pendingTabExpiry = expiry;
  };

  const beforeNativeDispatch = (type: CRCEventType, event: Event) => {
    const activeManager = manager;
    if (!activeManager) return;
    if (type === 'focus') {
      const entry = pendingTabEntry;
      clearPendingTabEntry();
      activeManager.enterDOMFocus(Boolean(
        entry &&
        entry.event.eventPhase === Event.NONE &&
        !entry.event.defaultPrevented &&
        entry.origin?.ownerDocument === canvas.ownerDocument &&
        isFocusEventForCanvas(event, canvas) &&
        event.relatedTarget === entry.origin &&
        entry.event.shiftKey
      ));
      return;
    }
    if (
      type === 'keydown' &&
      event instanceof KeyboardEvent &&
      activeManager.resolveKeyboardTarget()
    ) {
      keydownsWithTarget.add(event);
    }
  };

  const onNativeFocus = () => undefined;
  const onNativeBlur = () => {
    clearPendingTabEntry();
    manager?.leaveDOMFocus();
  };
  const onNativeKeyDown = (event: Event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Tab') return;
    if (keydownsWithTarget.delete(event)) return;
    const activeManager = manager;
    if (
      !activeManager ||
      event.defaultPrevented ||
      activeManager.resolveKeyboardTarget()
    ) {
      return;
    }
    if (moveTab(activeManager, event.shiftKey) === 'moved') {
      event.preventDefault();
    }
  };

  const focusObservers = requireObservers(eventRoot, 'focus');
  const blurObservers = requireObservers(eventRoot, 'blur');
  const keydownObservers = requireObservers(eventRoot, 'keydown');
  focusObservers.add(onNativeFocus);
  blurObservers.add(onNativeBlur);
  keydownObservers.add(onNativeKeyDown);
  canvas.ownerDocument.addEventListener('keydown', onDocumentKeyDown, true);

  teardowns.add(() => {
    if (disposed) return;
    disposed = true;
    manager = undefined;
    clearPendingTabEntry();
    restoreTabIndex();
    focusObservers.delete(onNativeFocus);
    blurObservers.delete(onNativeBlur);
    keydownObservers.delete(onNativeKeyDown);
    canvas.ownerDocument.removeEventListener('keydown', onDocumentKeyDown, true);
  });

  return {
    beforeNativeDispatch,
    setManager,
    syncCandidateAvailability,
  };
}

function isFocusEventForCanvas(
  event: Event,
  canvas: HTMLCanvasElement,
): event is FocusEvent {
  const FocusEventClass = canvas.ownerDocument.defaultView?.FocusEvent;
  return Boolean(FocusEventClass && event instanceof FocusEventClass);
}

function requireObservers(
  eventRoot: CRCEventRoot,
  type: 'blur' | 'focus' | 'keydown',
): Set<(event: Event) => void> {
  const observers = eventRoot.observers.get(type);
  if (!observers) {
    throw new Error(`CRC ${type} observer registry is unavailable.`);
  }
  return observers;
}
