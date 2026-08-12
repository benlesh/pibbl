import { GLOBAL_STATE } from '../global-state.js';
import {
  refreshInteractionCursor,
  removeInteractionRegion,
} from '../interaction-dispatch.js';
import type {
  CRCInstance,
  CRCInteractionRegion,
  CRCRegionHandlers,
} from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

interface CRCRegionSlot {
  region: CRCInteractionRegion;
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
  const { crcInstance: instance } = requireHookContext();
  const slot = useHookSlot<CRCRegionSlot>('region', teardowns => {
    const region = createRegion(instance);
    teardowns.add(() => removeInteractionRegion(instance, region));
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

export function createRegion(instance: CRCInstance): CRCInteractionRegion {
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
  };
}

export function updateRegion(
  instance: CRCInstance,
  region: CRCInteractionRegion,
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

  if (instance.regions.has(region)) {
    instance.regions.delete(region);
    instance.paintEntries.delete(region);
  }
  region.handlers = { ...handlers };
  region.path = path;
  region.fill = fill;
  region.lineInteractionWidth = lineInteractionWidth;
  region.transform = GLOBAL_STATE.renderContext!.getTransform();
  region.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  region.cursor = cursor;

  instance.regions.add(region);
  instance.paintEntries.add(region);
  refreshInteractionCursor(instance, region);
}

export function releaseRegion(
  instance: CRCInstance,
  region: CRCInteractionRegion,
): void {
  removeInteractionRegion(instance, region);
}
