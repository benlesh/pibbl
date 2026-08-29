import { GLOBAL_STATE } from '../global-state.js';
import {
  createTarget,
  updateLegacyTarget,
  type CRCEventTargetRegistration,
} from '../events/registrations.js';
import {
  refreshInteractionCursor,
  removeInteractionRegion,
} from '../interaction-dispatch.js';
import type {
  CRCInstance,
  CRCRegionHandlers,
} from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

export function crcRegion({
  handlers,
  path,
  fill = false,
  lineInteractionWidth = 0,
  cursor,
}: {
  handlers: CRCRegionHandlers;
  path?: Path2D;
  fill?: boolean;
  lineInteractionWidth?: number;
  cursor?: string;
}): void {
  const { componentRefs, crcInstance: instance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<CRCEventTargetRegistration>('region', teardowns => {
    const target = createRegion(instance, componentRefs, hookIndex);
    teardowns.add(() => releaseRegion(instance, target));
    return target;
  });
  updateRegion(instance, slot.value, {
    handlers,
    path,
    fill,
    lineInteractionWidth,
    cursor,
  });
}

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
    handlers,
    path,
    fill = false,
    lineInteractionWidth = 0,
    cursor,
  }: {
    handlers: CRCRegionHandlers;
    path?: Path2D;
    fill?: boolean;
    lineInteractionWidth?: number;
    cursor?: string;
  },
): void {
  const interactive = Boolean(cursor) || Object.values(handlers).some(Boolean);
  if (!interactive) {
    removeInteractionRegion(instance, region);
    return;
  }

  updateLegacyTarget(
    region,
    handlers,
    { path, fill, lineInteractionWidth, cursor },
  );

  refreshInteractionCursor(instance, region);
}

export function releaseRegion(
  instance: CRCInstance,
  region: CRCEventTargetRegistration,
): void {
  removeInteractionRegion(instance, region);
}
