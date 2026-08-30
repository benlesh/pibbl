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
  readonly press: CRCAdaptedPointerPress | undefined;
}

export interface CRCAdaptedPointerPress {
  readonly pointerId: number;
  readonly pointerType: 'mouse' | 'pen' | 'touch';
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
  const pointerType = event.pointerType;
  const press: CRCAdaptedPointerPress | undefined = type === 'pointerdown' &&
      event.isPrimary &&
      event.button === 0 &&
      (pointerType === 'mouse' || pointerType === 'pen' || pointerType === 'touch') ?
    {
      pointerId: event.pointerId,
      pointerType: pointerType as CRCAdaptedPointerPress['pointerType'],
      x,
      y,
    } : undefined;
  return { type, originalEvent: event, x, y, press };
}
