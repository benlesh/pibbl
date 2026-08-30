import type { CRCEventTargetRegistration } from '../events/registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from '../layout/types.js';
import type { CRCInstance, CRCInteractionLayer } from '../types.js';

/** Converts one target-local navigation rectangle to root-logical space. */
export function resolveTargetRootBounds(
  target: CRCEventTargetRegistration,
): Readonly<LayoutBox> | undefined {
  const bounds = target.keyboardNavigationBounds;
  if (!bounds) return undefined;

  const transform = resolveRootTransform(target);
  if (!transform) return undefined;
  const corners = [
    new DOMPoint(bounds.x, bounds.y),
    new DOMPoint(bounds.x + bounds.width, bounds.y),
    new DOMPoint(bounds.x, bounds.y + bounds.height),
    new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height),
  ].map(point => transform.transformPoint(point));
  if (corners.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return undefined;
  }

  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return Object.freeze({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

function resolveRootTransform(
  target: CRCEventTargetRegistration,
): DOMMatrix | undefined {
  let owner = target.owner;
  let transform = target.transform;
  const root = owner.eventRoot.rootInstance;
  if (!root) return undefined;

  while (owner !== root) {
    const parentCanvas = owner.parent;
    if (!parentCanvas) return undefined;
    const parent = GLOBAL_STATE.crcInstances.get(parentCanvas);
    if (!parent) return undefined;
    const bridge = findLayerBridge(parent, owner);
    if (!bridge) return undefined;
    transform = bridge.transform.multiply(transform);
    owner = parent;
  }
  return transform;
}

function findLayerBridge(
  parent: CRCInstance,
  child: CRCInstance,
): CRCInteractionLayer | undefined {
  for (const entry of parent.paintEntries) {
    if (entry.kind === 'layer' && entry.instance === child) return entry;
  }
  return undefined;
}
