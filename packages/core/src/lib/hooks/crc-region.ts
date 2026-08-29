import { GLOBAL_STATE } from '../global-state.js';
import {
  requiredLegacyRegionTypes,
  updateLegacyNativeListenerOwnership,
} from '../events/legacy-native-listener-bridge.js';
import {
  refreshInteractionCursor,
  removeInteractionRegion,
} from '../interaction-dispatch.js';
import type {
  CRCInstance,
  CRCLegacyEventTargetRegistration,
  CRCRegionHandlers,
} from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';
import {
  getSurfaceSnapshot,
  toLogicalTransform,
} from '../surface/transform.js';

interface CRCRegionSlot {
  region: CRCLegacyEventTargetRegistration;
}

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
  const slot = useHookSlot<CRCRegionSlot>('region', teardowns => {
    const region = createRegion(instance, componentRefs, hookIndex);
    teardowns.add(() => releaseRegion(instance, region));
    return { region };
  });
  updateRegion(instance, slot.value.region, {
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
): CRCLegacyEventTargetRegistration {
  return {
    kind: 'region',
    owner: instance,
    handlers: {},
    path: undefined,
    fill: false,
    lineInteractionWidth: 0,
    transform: new DOMMatrix(),
    clippingStack: [],
    cursor: undefined,
    component,
    slot,
    live: false,
  };
}

export function updateRegion(
  instance: CRCInstance,
  region: CRCLegacyEventTargetRegistration,
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
    region.live = false;
    removeInteractionRegion(instance, region);
    return;
  }

  if (instance.regions.has(region)) {
    instance.paintEntries.delete(region);
    instance.eventRoot.targets.delete(region);
  }
  updateLegacyNativeListenerOwnership(
    instance,
    region,
    requiredLegacyRegionTypes(handlers, Boolean(cursor)),
  );
  region.handlers = { ...handlers };
  region.path = path;
  region.fill = fill;
  region.lineInteractionWidth = lineInteractionWidth;
  region.transform = toLogicalTransform(
    getSurfaceSnapshot(instance),
    GLOBAL_STATE.renderContext!.getTransform(),
  );
  region.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  region.cursor = cursor;
  region.live = true;

  instance.regions.add(region);
  instance.paintEntries.add(region);
  instance.eventRoot.targets.add(region);
  refreshInteractionCursor(instance, region);
}

export function releaseRegion(
  instance: CRCInstance,
  region: CRCLegacyEventTargetRegistration,
): void {
  region.live = false;
  removeInteractionRegion(instance, region);
}
