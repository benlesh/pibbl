import type { PibblInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_TOUCH_EVENT_TYPES = Object.freeze([
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
] as const satisfies readonly PibblEventType[]);

export type PibblNativeTouchEventType =
  (typeof PIBBL_NATIVE_TOUCH_EVENT_TYPES)[number];

const nativeTouchEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_TOUCH_EVENT_TYPES,
);

export interface PibblAdaptedTouchContact {
  readonly touch: Touch;
  readonly x: number;
  readonly y: number;
}

export interface PibblAdaptedTouchEvent {
  readonly type: PibblNativeTouchEventType;
  readonly originalEvent: TouchEvent;
  readonly changedContacts: readonly PibblAdaptedTouchContact[];
}

export function isNativeTouchEventType(
  type: PibblEventType,
): type is PibblNativeTouchEventType {
  return nativeTouchEventTypes.has(type);
}

export function adaptTouchEvent(
  root: PibblInstance,
  type: PibblNativeTouchEventType,
  event: Event,
): PibblAdaptedTouchEvent | undefined {
  if (
    typeof TouchEvent === 'undefined' ||
    !(event instanceof TouchEvent) ||
    !root.surface.snapshot
  ) {
    return undefined;
  }
  const changedContacts = Array.from(event.changedTouches, touch => {
    const [x, y] = getMouseCoordinates(
      touch as unknown as MouseEvent,
      root,
    );
    return { touch, x, y };
  });
  return {
    type,
    originalEvent: event,
    changedContacts: Object.freeze(changedContacts),
  };
}
