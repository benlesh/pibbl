import type { PibblInstance } from '../../types.js';
import { getMouseCoordinates } from '../../util/get-mouse-coordinates.js';
import type { PibblEventType } from '../types.js';

export interface PibblAdaptedWheelEvent {
  readonly type: 'wheel';
  readonly originalEvent: WheelEvent;
  readonly x: number;
  readonly y: number;
}

export function isNativeWheelEventType(
  type: PibblEventType,
): type is 'wheel' {
  return type === 'wheel';
}

export function adaptWheelEvent(
  root: PibblInstance,
  event: Event,
): PibblAdaptedWheelEvent | undefined {
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
