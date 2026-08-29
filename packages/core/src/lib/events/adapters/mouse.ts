import type { CRCInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_MOUSE_EVENT_TYPES = Object.freeze([
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
] as const satisfies readonly CRCEventType[]);

export type CRCNativeMouseEventType =
  (typeof CRC_NATIVE_MOUSE_EVENT_TYPES)[number];

const nativeMouseEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_MOUSE_EVENT_TYPES,
);

export interface CRCAdaptedMouseEvent {
  readonly type: CRCNativeMouseEventType;
  readonly originalEvent: MouseEvent;
  readonly x: number;
  readonly y: number;
}

export function isNativeMouseEventType(
  type: CRCEventType,
): type is CRCNativeMouseEventType {
  return nativeMouseEventTypes.has(type);
}

export function adaptMouseEvent(
  root: CRCInstance,
  type: CRCNativeMouseEventType,
  event: Event,
): CRCAdaptedMouseEvent | undefined {
  if (!(event instanceof MouseEvent) || !root.surface.snapshot) return undefined;
  const [x, y] = getMouseCoordinates(event, root);
  return { type, originalEvent: event, x, y };
}
