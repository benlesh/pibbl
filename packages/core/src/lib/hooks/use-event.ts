import { getInteractionRoot } from '../global-state.js';
import type {
  CRCEventHandler,
  CRCEventType as DOMCRCEventType,
} from '../events/types.js';
import type {
  CRCEventRegistry,
  CRCInteractionRegion,
  CRCMouseEventListener,
} from '../types.js';
import { getMouseCoordinates } from '../util/get-mouse-coordinates.js';
import type { PathGeometry } from '../geometry/path-geometry.js';
import { resolvePath } from '../geometry/resolve-path.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';
import { createRegion, releaseRegion, updateRegion } from './use-region.js';

interface CRCObserverSlot {
  cleanup: (() => void) | undefined;
  region: CRCInteractionRegion;
}

export function useEvent<
  K extends keyof CRCEventRegistry & DOMCRCEventType,
>(
  type: K,
  handler: CRCEventHandler<K> | undefined,
  path: Path2D | PathGeometry,
  fill?: boolean,
  lineInteractionWidth?: number,
): void;
export function useEvent<K extends keyof CRCEventRegistry>(
  type: K,
  handler?: CRCMouseEventListener,
  path?: Path2D | PathGeometry,
  fill?: boolean,
  lineInteractionWidth?: number,
): void;
export function useEvent<
  K extends keyof CRCEventRegistry & DOMCRCEventType,
>(
  type: K,
  handler?: CRCMouseEventListener | CRCEventHandler<K>,
  path?: Path2D | PathGeometry,
  fill = false,
  lineInteractionWidth = 0,
): void {
  const { crcInstance } = requireHookContext();
  const slot = useHookSlot<CRCObserverSlot>('event', teardowns => {
    const region = createRegion(crcInstance);
    const value: CRCObserverSlot = { cleanup: undefined, region };
    teardowns.add(() => {
      value.cleanup?.();
      value.cleanup = undefined;
      releaseRegion(crcInstance, region);
    });
    return value;
  });

  slot.value.cleanup?.();
  slot.value.cleanup = undefined;

  if (path) {
    updateRegion(crcInstance, slot.value.region, {
      handlers: { [type]: handler as CRCMouseEventListener | undefined },
      path: resolvePath(path),
      fill,
      lineInteractionWidth,
    });
    return;
  }

  releaseRegion(crcInstance, slot.value.region);

  if (!handler) {
    return;
  }

  const interactionRoot = getInteractionRoot(crcInstance);
  const observers = interactionRoot.eventRoot.observers.get(type)!;
  const observer = (event: Event) => {
    if (!(event instanceof MouseEvent)) return;
    if (!interactionRoot.surface.snapshot) return;
    const [x, y] = getMouseCoordinates(event, interactionRoot);
    (handler as CRCMouseEventListener)({ originalEvent: event, x, y });
  };
  observers.add(observer);
  slot.value.cleanup = () => {
    observers.delete(observer);
  };
}
