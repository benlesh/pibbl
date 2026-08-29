import type { CRCInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_TOUCH_EVENT_TYPES = Object.freeze([
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
] as const satisfies readonly CRCEventType[]);

export type CRCNativeTouchEventType =
  (typeof CRC_NATIVE_TOUCH_EVENT_TYPES)[number];

const nativeTouchEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_TOUCH_EVENT_TYPES,
);

export interface CRCAdaptedTouchContact {
  readonly touch: Touch;
  readonly x: number;
  readonly y: number;
}

export interface CRCAdaptedTouchEvent {
  readonly type: CRCNativeTouchEventType;
  readonly originalEvent: TouchEvent;
  readonly changedContacts: readonly CRCAdaptedTouchContact[];
}

export function isNativeTouchEventType(
  type: CRCEventType,
): type is CRCNativeTouchEventType {
  return nativeTouchEventTypes.has(type);
}

export function adaptTouchEvent(
  root: CRCInstance,
  type: CRCNativeTouchEventType,
  event: Event,
): CRCAdaptedTouchEvent | undefined {
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
