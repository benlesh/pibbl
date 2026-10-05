import type { PibblInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_MOUSE_EVENT_TYPES = Object.freeze([
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'mouseover',
  'mouseenter',
  'mousedown',
  'mousemove',
  'mouseup',
  'mouseout',
  'mouseleave',
] as const satisfies readonly PibblEventType[]);

export type PibblNativeMouseEventType =
  (typeof PIBBL_NATIVE_MOUSE_EVENT_TYPES)[number];

const nativeMouseEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_MOUSE_EVENT_TYPES,
);

export interface PibblAdaptedMouseEvent {
  readonly type: PibblNativeMouseEventType;
  readonly originalEvent: MouseEvent;
  readonly x: number;
  readonly y: number;
  readonly press: PibblAdaptedMousePress | undefined;
}

export interface PibblAdaptedMousePress {
  readonly x: number;
  readonly y: number;
}

export function isNativeMouseEventType(
  type: PibblEventType,
): type is PibblNativeMouseEventType {
  return nativeMouseEventTypes.has(type);
}

export function adaptMouseEvent(
  root: PibblInstance,
  type: PibblNativeMouseEventType,
  event: Event,
): PibblAdaptedMouseEvent | undefined {
  if (!(event instanceof MouseEvent) || !root.surface.snapshot) return undefined;
  const [x, y] = getMouseCoordinates(event, root);
  const press = type === 'mousedown' && event.button === 0 ? { x, y } : undefined;
  return { type, originalEvent: event, x, y, press };
}
