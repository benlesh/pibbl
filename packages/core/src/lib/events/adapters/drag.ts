import type { PibblInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_DRAG_EVENT_TYPES = Object.freeze([
  'dragstart',
  'drag',
  'dragend',
  'dragenter',
  'dragleave',
  'dragover',
  'drop',
] as const satisfies readonly PibblEventType[]);

export type PibblNativeDragEventType =
  (typeof PIBBL_NATIVE_DRAG_EVENT_TYPES)[number];

const nativeDragEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_DRAG_EVENT_TYPES,
);

export interface PibblAdaptedDragEvent {
  readonly type: PibblNativeDragEventType;
  readonly originalEvent: DragEvent;
  readonly x: number;
  readonly y: number;
}

export function isNativeDragEventType(
  type: PibblEventType,
): type is PibblNativeDragEventType {
  return nativeDragEventTypes.has(type);
}

export function adaptDragEvent(
  root: PibblInstance,
  type: PibblNativeDragEventType,
  event: Event,
): PibblAdaptedDragEvent | undefined {
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
