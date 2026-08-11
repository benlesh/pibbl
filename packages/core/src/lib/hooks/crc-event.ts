import { crcRegion } from './crc-region.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { CRCEventRegistry, CRCMouseEventListener } from '../types.js';
import { getMouseCoordinates } from '../util/get-mouse-coordinates.js';

interface CRCObserverSlot {
  cleanup: (() => void) | undefined;
}

export function crcEvent<K extends keyof CRCEventRegistry>(
  type: K,
  handler?: CRCMouseEventListener,
  path?: Path2D,
  fill = false,
  lineInteractionWidth = 0,
): void {
  if (path) {
    crcRegion({
      handlers: { [type]: handler },
      path,
      fill,
      lineInteractionWidth,
    });
    return;
  }

  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  let slot = componentRefs.refs[hookIndex] as CRCObserverSlot | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    slot = { cleanup: undefined };
    componentRefs.refs[hookIndex] = slot;
    componentRefs.teardowns.add(() => {
      slot?.cleanup?.();
      if (slot) {
        slot.cleanup = undefined;
      }
      componentRefs.refs[hookIndex] = null;
    });
  } else if (!slot) {
    throw new Error(`CRC observer hook slot ${hookIndex} is unavailable`);
  }

  slot.cleanup?.();
  slot.cleanup = undefined;

  if (!handler) {
    return;
  }

  const observers = GLOBAL_STATE.currentCRCInstance!.events[type];
  const observer = (event: MouseEvent) => {
    const [x, y] = getMouseCoordinates(event);
    handler({ originalEvent: event, x, y });
  };
  observers.add(observer);
  slot.cleanup = () => {
    observers.delete(observer);
  };
}
