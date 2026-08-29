import type { CRCInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_POINTER_EVENT_TYPES = Object.freeze([
  'pointerover',
  'pointerenter',
  'pointerdown',
  'pointermove',
  'pointerrawupdate',
  'pointerup',
  'pointercancel',
  'pointerout',
  'pointerleave',
  'gotpointercapture',
  'lostpointercapture',
] as const satisfies readonly CRCEventType[]);

export type CRCNativePointerEventType =
  (typeof CRC_NATIVE_POINTER_EVENT_TYPES)[number];

const nativePointerEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_POINTER_EVENT_TYPES,
);

export interface CRCAdaptedPointerEvent {
  readonly type: CRCNativePointerEventType;
  readonly originalEvent: PointerEvent;
  readonly x: number;
  readonly y: number;
}

export function isNativePointerEventType(
  type: CRCEventType,
): type is CRCNativePointerEventType {
  return nativePointerEventTypes.has(type);
}

export function adaptPointerEvent(
  root: CRCInstance,
  type: CRCNativePointerEventType,
  event: Event,
): CRCAdaptedPointerEvent | undefined {
  if (
    typeof PointerEvent === 'undefined' ||
    !(event instanceof PointerEvent) ||
    !root.surface.snapshot
  ) {
    return undefined;
  }
  const [x, y] = getMouseCoordinates(event, root);
  return { type, originalEvent: event, x, y };
}
