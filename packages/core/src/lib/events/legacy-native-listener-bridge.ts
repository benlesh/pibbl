import type { CRCInstance, CRCRegionHandlers } from '../types.js';
import type { CRCEventType } from './types.js';

const releasesByOwner = new WeakMap<object, Map<CRCEventType, () => void>>();

/**
 * Temporary Task 2 bridge for the shipped mouse hooks. Task 5 replaces this
 * with native ownership derived from DOM-aligned target registrations.
 */
export function updateLegacyNativeListenerOwnership(
  instance: CRCInstance,
  owner: object,
  types: ReadonlySet<CRCEventType>,
): void {
  let releases = releasesByOwner.get(owner);
  if (!releases) {
    releases = new Map();
    releasesByOwner.set(owner, releases);
  }

  for (const [type, release] of releases) {
    if (!types.has(type)) {
      release();
      releases.delete(type);
    }
  }

  const hub = instance.eventRoot.nativeListeners;
  if (!hub) return;
  for (const type of types) {
    if (!releases.has(type)) {
      releases.set(type, hub.acquire(type));
    }
  }
}

export function releaseLegacyNativeListenerOwnership(owner: object): void {
  const releases = releasesByOwner.get(owner);
  if (!releases) return;
  releasesByOwner.delete(owner);
  for (const release of releases.values()) {
    release();
  }
  releases.clear();
}

export function installLegacyRegionOwnership(instance: CRCInstance): void {
  const regions = instance.regions;
  const originalAdd = regions.add;
  const originalDelete = regions.delete;
  const originalClear = regions.clear;

  regions.add = ((region) => {
    if (!regions.has(region)) {
      originalAdd.call(regions, region);
      instance.eventRoot.targets.add(region);
      updateLegacyNativeListenerOwnership(
        instance,
        region,
        requiredLegacyRegionTypes(region.handlers, Boolean(region.cursor)),
      );
    }
    return regions;
  }) as typeof regions.add;

  regions.delete = ((region) => {
    if (!regions.has(region)) return false;
    instance.eventRoot.targets.delete(region);
    releaseLegacyNativeListenerOwnership(region);
    return originalDelete.call(regions, region);
  }) as typeof regions.delete;

  regions.clear = (() => {
    for (const region of Array.from(regions)) {
      regions.delete(region);
    }
    originalClear.call(regions);
  }) as typeof regions.clear;
}

export function requiredLegacyRegionTypes(
  handlers: CRCRegionHandlers,
  hasCursor: boolean,
): ReadonlySet<CRCEventType> {
  const types = new Set<CRCEventType>();
  if (
    hasCursor ||
    handlers.mousemove ||
    handlers.mouseover ||
    handlers.mouseout
  ) {
    types.add('mousemove');
    types.add('mouseout');
  }
  if (handlers.mousedown) types.add('mousedown');
  if (handlers.mouseup) types.add('mouseup');
  if (handlers.contextmenu) types.add('contextmenu');
  if (handlers.click || handlers.dblclick) {
    types.add('mousedown');
    types.add('mouseup');
    types.add('click');
  }
  if (handlers.dblclick) types.add('dblclick');
  return types;
}
