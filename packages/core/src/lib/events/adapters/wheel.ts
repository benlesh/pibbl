import type { CRCInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { CRCEventType } from '../types.js';

export interface CRCAdaptedWheelEvent {
  readonly type: 'wheel';
  readonly originalEvent: WheelEvent;
  readonly x: number;
  readonly y: number;
}

export function isNativeWheelEventType(
  type: CRCEventType,
): type is 'wheel' {
  return type === 'wheel';
}

export function adaptWheelEvent(
  root: CRCInstance,
  event: Event,
): CRCAdaptedWheelEvent | undefined {
  if (
    typeof WheelEvent === 'undefined' ||
    !(event instanceof WheelEvent) ||
    !root.surface.snapshot
  ) {
    return undefined;
  }
  const [x, y] = getMouseCoordinates(event, root);
  return { type: 'wheel', originalEvent: event, x, y };
}
