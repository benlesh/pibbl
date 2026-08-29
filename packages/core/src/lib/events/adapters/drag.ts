import type { CRCInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_DRAG_EVENT_TYPES = Object.freeze([
  'dragstart',
  'drag',
  'dragend',
  'dragenter',
  'dragleave',
  'dragover',
  'drop',
] as const satisfies readonly CRCEventType[]);

export type CRCNativeDragEventType =
  (typeof CRC_NATIVE_DRAG_EVENT_TYPES)[number];

const nativeDragEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_DRAG_EVENT_TYPES,
);

export interface CRCAdaptedDragEvent {
  readonly type: CRCNativeDragEventType;
  readonly originalEvent: DragEvent;
  readonly x: number;
  readonly y: number;
}

export function isNativeDragEventType(
  type: CRCEventType,
): type is CRCNativeDragEventType {
  return nativeDragEventTypes.has(type);
}

export function adaptDragEvent(
  root: CRCInstance,
  type: CRCNativeDragEventType,
  event: Event,
): CRCAdaptedDragEvent | undefined {
  if (
    typeof DragEvent === 'undefined' ||
    !(event instanceof DragEvent) ||
    !root.surface.snapshot
  ) {
    return undefined;
  }
  const [x, y] = getMouseCoordinates(event, root);
  return { type, originalEvent: event, x, y };
}
