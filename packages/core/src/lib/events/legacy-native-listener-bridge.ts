import type { CRCInstance, CRCRegionHandlers } from '../types.js';
import type { CRCEventType } from './types.js';

const releasesByOwner = new WeakMap<object, Map<CRCEventType, () => void>>();

/**
 * Temporary ownership bridge for pathless cursor defaults. Region targets now
 * use grouped registration ownership; Task 5 removes this remaining bridge.
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
