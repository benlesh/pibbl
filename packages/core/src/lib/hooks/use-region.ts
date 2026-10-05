import type { PathGeometry } from '../geometry/path-geometry.js';
import {
  createTarget,
  updateCursorTarget,
  type PibblEventTargetRegistration,
} from '../events/registrations.js';
import { removeInteractionRegion } from '../events/dispatch.js';
import type { PibblInstance } from '../types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext } from './hook-slot.js';

export function createRegion(
  instance: PibblInstance,
  component = requireHookContext().componentRefs,
  slot = Math.max(0, GLOBAL_STATE.componentHookIndex - 1),
): PibblEventTargetRegistration {
  return createTarget(instance, component, slot);
}

export function updateRegion(
  instance: PibblInstance,
  region: PibblEventTargetRegistration,
  {
    path,
    fill = false,
    lineInteractionWidth = 0,
    cursor,
  }: {
    path?: Path2D | PathGeometry;
    fill?: boolean;
    lineInteractionWidth?: number;
    cursor?: string;
  },
): void {
  if (!cursor || !path) {
    removeInteractionRegion(instance, region);
    return;
  }

  updateCursorTarget(
    region,
    { path, fill, lineInteractionWidth, cursor },
  );
}

export function releaseRegion(
  instance: PibblInstance,
  region: PibblEventTargetRegistration,
): void {
  removeInteractionRegion(instance, region);
}
