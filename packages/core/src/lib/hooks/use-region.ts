import type { PathGeometry } from '../geometry/path-geometry.js';
import {
  createTarget,
  updateCursorTarget,
  type CRCEventTargetRegistration,
} from '../events/registrations.js';
import { removeInteractionRegion } from '../interaction-dispatch.js';
import type { CRCInstance } from '../types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext } from './hook-slot.js';

export function createRegion(
  instance: CRCInstance,
  component = requireHookContext().componentRefs,
  slot = Math.max(0, GLOBAL_STATE.componentHookIndex - 1),
): CRCEventTargetRegistration {
  return createTarget(instance, component, slot);
}

export function updateRegion(
  instance: CRCInstance,
  region: CRCEventTargetRegistration,
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
  instance: CRCInstance,
  region: CRCEventTargetRegistration,
): void {
  removeInteractionRegion(instance, region);
}
