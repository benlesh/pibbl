import type { PibblInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_POINTER_EVENT_TYPES = Object.freeze([
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
] as const satisfies readonly PibblEventType[]);

export type PibblNativePointerEventType =
  (typeof PIBBL_NATIVE_POINTER_EVENT_TYPES)[number];

const nativePointerEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_POINTER_EVENT_TYPES,
);

export interface PibblAdaptedPointerEvent {
  readonly type: PibblNativePointerEventType;
  readonly originalEvent: PointerEvent;
  readonly x: number;
  readonly y: number;
  readonly press: PibblAdaptedPointerPress | undefined;
}

export interface PibblAdaptedPointerPress {
  readonly pointerId: number;
  readonly pointerType: 'mouse' | 'pen' | 'touch';
  readonly x: number;
  readonly y: number;
}

export function isNativePointerEventType(
  type: PibblEventType,
): type is PibblNativePointerEventType {
  return nativePointerEventTypes.has(type);
}

export function adaptPointerEvent(
  root: PibblInstance,
  type: PibblNativePointerEventType,
  event: Event,
): PibblAdaptedPointerEvent | undefined {
  if (
    typeof PointerEvent === 'undefined' ||
    !(event instanceof PointerEvent) ||
    !root.surface.snapshot
  ) {
    return undefined;
  }
  const [x, y] = getMouseCoordinates(event, root);
  const pointerType = event.pointerType;
  const press: PibblAdaptedPointerPress | undefined = type === 'pointerdown' &&
      event.isPrimary &&
      event.button === 0 &&
      (pointerType === 'mouse' || pointerType === 'pen' || pointerType === 'touch') ?
    {
      pointerId: event.pointerId,
      pointerType: pointerType as PibblAdaptedPointerPress['pointerType'],
      x,
      y,
    } : undefined;
  return { type, originalEvent: event, x, y, press };
}
