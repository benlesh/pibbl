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
  readonly baseTabIndex: number;
  ownedValue: string | undefined;
  lost: boolean;
}

interface PendingTabEntry {
  readonly event: KeyboardEvent;
  readonly origin: Element | null;
}

export interface CRCMountedDOMFocusHost {
  beforeNativeDispatch(type: CRCEventType, event: Event): boolean;
  focusFromPress(): void;
  setManager(manager: CRCFocusManager | undefined): void;
  syncCandidateAvailability(hasCandidates: boolean): void;
}

export function mountDOMFocusHost(
  canvas: HTMLCanvasElement,
  eventRoot: CRCEventRoot,
  teardowns: Teardowns,
): CRCMountedDOMFocusHost {
  let tabIndexOwnership: TabIndexOwnership | undefined;
  let candidateReason = false;
  let pressReason = false;
  let pendingTabEntry: PendingTabEntry | undefined;
  let pendingTabExpiry: ReturnType<typeof setTimeout> | undefined;
  let manager: CRCFocusManager | undefined;
  let disposed = false;
  let domFocusActive = canvas.ownerDocument.activeElement === canvas;
  const keydownsWithTarget = new WeakSet<KeyboardEvent>();

  const restoreSnapshot = (ownership: TabIndexOwnership) => {
    if (ownership.snapshot.existed) {
      canvas.setAttribute('tabindex', ownership.snapshot.value ?? '');
    } else {
      canvas.removeAttribute('tabindex');
    }
  };

  const syncTabIndex = () => {
    const hasReason = candidateReason || pressReason;
    if (!tabIndexOwnership && hasReason) {
      tabIndexOwnership = {
        snapshot: {
          existed: canvas.hasAttribute('tabindex'),
          value: canvas.getAttribute('tabindex'),
        },
        baseTabIndex: canvas.tabIndex,
        ownedValue: undefined,
        lost: false,
      };
    }
    const ownership = tabIndexOwnership;
    if (!ownership) return;

    if (
      !ownership.lost &&
      ownership.ownedValue !== undefined &&
      (!canvas.hasAttribute('tabindex') ||
        canvas.getAttribute('tabindex') !== ownership.ownedValue)
    ) {
      ownership.lost = true;
      ownership.ownedValue = undefined;
    }

    if (!hasReason) {
      if (!ownership.lost && ownership.ownedValue !== undefined) {
        restoreSnapshot(ownership);
      }
      tabIndexOwnership = undefined;
      return;
    }
    if (ownership.lost) return;

    const desired = candidateReason ?
      ownership.snapshot.existed && ownership.baseTabIndex >= 0 ?
        undefined : '0' :
      ownership.snapshot.existed ? undefined : '-1';
    if (desired === ownership.ownedValue) return;
    if (desired === undefined) {
      if (ownership.ownedValue !== undefined) {
        restoreSnapshot(ownership);
        ownership.ownedValue = undefined;
      }
      return;
    }
    canvas.setAttribute('tabindex', desired);
    ownership.ownedValue = desired;
  };

  const focusFromPress = () => {
    if (disposed) return;
    pressReason = true;
    syncTabIndex();
    canvas.focus({ preventScroll: true });
    if (canvas.ownerDocument.activeElement !== canvas) {
      pressReason = false;
      syncTabIndex();
    }
  };

  const syncCandidateAvailability = (hasCandidates: boolean) => {
    if (disposed) return;
    if (candidateReason === hasCandidates) return;
    candidateReason = hasCandidates;
    syncTabIndex();
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
    if (!activeManager) return true;
    if (type === 'focus' || type === 'focusin') {
      if (canvas.ownerDocument.activeElement !== canvas) return false;
      if (domFocusActive) return false;
      domFocusActive = true;
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
      return false;
    }
    if (type === 'blur' || type === 'focusout') {
      if (canvas.ownerDocument.activeElement === canvas) return false;
      if (domFocusActive) {
        domFocusActive = false;
        clearPendingTabEntry();
        activeManager.leaveDOMFocus();
      }
      return false;
    }
    if (
      type === 'keydown' &&
      event instanceof KeyboardEvent &&
      activeManager.resolveKeyboardTarget()
    ) {
      keydownsWithTarget.add(event);
    }
    return true;
  };

  const onNativeFocus = () => undefined;
  const onNativePress = () => undefined;
  const onNativeExit = () => {
    pressReason = false;
    syncTabIndex();
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
  const focusinObservers = requireObservers(eventRoot, 'focusin');
  const blurObservers = requireObservers(eventRoot, 'blur');
  const focusoutObservers = requireObservers(eventRoot, 'focusout');
  const keydownObservers = requireObservers(eventRoot, 'keydown');
  const pointerdownObservers = requireObservers(eventRoot, 'pointerdown');
  const mousedownObservers = requireObservers(eventRoot, 'mousedown');
  const touchstartObservers = requireObservers(eventRoot, 'touchstart');
  const touchendObservers = requireObservers(eventRoot, 'touchend');
  const touchcancelObservers = requireObservers(eventRoot, 'touchcancel');
  focusObservers.add(onNativeFocus);
  focusinObservers.add(onNativeFocus);
  blurObservers.add(onNativeExit);
  focusoutObservers.add(onNativeExit);
  keydownObservers.add(onNativeKeyDown);
  pointerdownObservers.add(onNativePress);
  mousedownObservers.add(onNativePress);
  touchstartObservers.add(onNativePress);
  touchendObservers.add(onNativePress);
  touchcancelObservers.add(onNativePress);
  canvas.ownerDocument.addEventListener('keydown', onDocumentKeyDown, true);

  teardowns.add(() => {
    if (disposed) return;
    disposed = true;
    manager = undefined;
    clearPendingTabEntry();
    candidateReason = false;
    pressReason = false;
    syncTabIndex();
    focusObservers.delete(onNativeFocus);
    focusinObservers.delete(onNativeFocus);
    blurObservers.delete(onNativeExit);
    focusoutObservers.delete(onNativeExit);
    keydownObservers.delete(onNativeKeyDown);
    pointerdownObservers.delete(onNativePress);
    mousedownObservers.delete(onNativePress);
    touchstartObservers.delete(onNativePress);
    touchendObservers.delete(onNativePress);
    touchcancelObservers.delete(onNativePress);
    canvas.ownerDocument.removeEventListener('keydown', onDocumentKeyDown, true);
  });

  return {
    beforeNativeDispatch,
    focusFromPress,
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
  type: 'blur' | 'focus' | 'focusin' | 'focusout' | 'keydown' |
    'mousedown' | 'pointerdown' | 'touchcancel' | 'touchend' | 'touchstart',
): Set<(event: Event) => void> {
  const observers = eventRoot.observers.get(type);
  if (!observers) {
    throw new Error(`CRC ${type} observer registry is unavailable.`);
  }
  return observers;
}
