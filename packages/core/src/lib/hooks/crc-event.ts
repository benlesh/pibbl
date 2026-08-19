import { getInteractionRoot } from '../global-state.js';
import type {
  CRCEventRegistry,
  CRCInteractionRegion,
  CRCMouseEventListener,
} from '../types.js';
import { getMouseCoordinates } from '../util/get-mouse-coordinates.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';
import { createRegion, releaseRegion, updateRegion } from './crc-region.js';

interface CRCObserverSlot {
  cleanup: (() => void) | undefined;
  region: CRCInteractionRegion;
}

export function crcEvent<K extends keyof CRCEventRegistry>(
  type: K,
  handler?: CRCMouseEventListener,
  path?: Path2D,
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
      handlers: { [type]: handler },
      path,
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
  const observers = interactionRoot.events[type];
  const observer = (event: MouseEvent) => {
    if (!interactionRoot.surface.snapshot) return;
    const [x, y] = getMouseCoordinates(event, interactionRoot);
    handler({ originalEvent: event, x, y });
  };
  observers.add(observer);
  slot.value.cleanup = () => {
    observers.delete(observer);
  };
}
