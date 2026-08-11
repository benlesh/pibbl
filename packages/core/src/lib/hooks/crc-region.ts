import {
  getCurrentCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import {
  refreshInteractionCursor,
  removeInteractionRegion,
} from '../interaction-dispatch.js';
import type {
  CRCInteractionRegion,
  CRCRegionHandlers,
} from '../types.js';

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
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  const instance = getCurrentCRCInstance();
  let slot = componentRefs.refs[hookIndex] as CRCRegionSlot | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    const region: CRCInteractionRegion = {
      handlers: {},
      path: undefined,
      fill: false,
      lineInteractionWidth: 0,
      transform: new DOMMatrix(),
      clippingStack: [],
      cursor: undefined,
    };
    slot = { region };
    componentRefs.refs[hookIndex] = slot;
    componentRefs.teardowns.add(() => {
      removeInteractionRegion(instance, region);
      componentRefs.refs[hookIndex] = null;
    });
  } else if (!slot) {
    throw new Error(`CRC region hook slot ${hookIndex} is unavailable`);
  }

  const region = slot.region;
  const interactive = Boolean(cursor) || Object.values(handlers).some(Boolean);
  if (!interactive) {
    removeInteractionRegion(instance, region);
    return;
  }

  if (instance.regions.has(region)) {
    instance.regions.delete(region);
  }
  region.handlers = { ...handlers };
  region.path = path;
  region.fill = fill;
  region.lineInteractionWidth = lineInteractionWidth;
  region.transform = GLOBAL_STATE.renderContext!.getTransform();
  region.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  region.cursor = cursor;

  instance.regions.add(region);
  refreshInteractionCursor(instance, region);
}
