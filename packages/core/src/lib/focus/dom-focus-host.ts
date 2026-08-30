import type { Teardowns } from '../teardowns.js';
import type { CRCFocusManager } from './focus-manager.js';

interface TabIndexSnapshot {
  readonly existed: boolean;
  readonly value: string | null;
}

interface TabIndexOwnership {
  readonly snapshot: TabIndexSnapshot;
  readonly ownedValue: string | undefined;
}

export interface CRCMountedDOMFocusHost {
  syncCandidateAvailability(hasCandidates: boolean): void;
}

export function mountDOMFocusHost(
  manager: CRCFocusManager,
  canvas: HTMLCanvasElement,
  teardowns: Teardowns,
): CRCMountedDOMFocusHost {
  let tabIndexOwnership: TabIndexOwnership | undefined;
  let candidateCycleActive = false;
  let backwardsEntry: boolean | undefined;
  let disposed = false;

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

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && !event.defaultPrevented) {
      backwardsEntry = event.shiftKey;
    }
  };
  const onCanvasFocus = () => {
    const backwards = backwardsEntry ?? false;
    backwardsEntry = undefined;
    manager.enterDOMFocus(backwards);
  };
  const onCanvasBlur = () => {
    backwardsEntry = undefined;
  };

  canvas.ownerDocument.addEventListener('keydown', onDocumentKeyDown, true);
  canvas.addEventListener('focus', onCanvasFocus, true);
  canvas.addEventListener('blur', onCanvasBlur);

  teardowns.add(() => {
    if (disposed) return;
    disposed = true;
    restoreTabIndex();
    backwardsEntry = undefined;
    canvas.ownerDocument.removeEventListener('keydown', onDocumentKeyDown, true);
    canvas.removeEventListener('focus', onCanvasFocus, true);
    canvas.removeEventListener('blur', onCanvasBlur);
  });

  return { syncCandidateAvailability };
}
