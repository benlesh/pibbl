import type { CRCEventTargetRegistration } from '../events/registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from '../layout/types.js';
import type { CRCInstance } from '../types.js';
import {
  CRCPaintEntryKind,
  type CRCNestedPaintEntry,
} from '../events/paint-entry.js';

/** Converts one target-local navigation rectangle to root-logical space. */
export function resolveTargetRootBounds(
  target: CRCEventTargetRegistration,
): Readonly<LayoutBox> | undefined {
  const bounds = target.keyboardNavigationBounds;
  const points = target.keyboardNavigationPoints ?? (bounds ? [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  ] : undefined);
  if (!points?.length) return undefined;

  const transform = resolveRootTransform(target);
  if (!transform) return undefined;
  const corners = points.map(point =>
    transform.transformPoint(new DOMPoint(point.x, point.y))
  );
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
  // Geometry-independent backend targets publish layer-local focus rectangles.
  // Their initial transform is identity; nested resolver bridges compose the
  // owning layer into root-logical space below.
  let transform = target.paintEntry?.transform ?? new DOMMatrix();
  const root = owner.eventRoot.rootInstance;
  if (!root) return undefined;

  while (owner !== root) {
    const parentCanvas = owner.parent;
    if (!parentCanvas) return undefined;
    const parent = GLOBAL_STATE.crcInstances.get(parentCanvas);
    if (!parent) return undefined;
    const bridge = findNestedInstanceBridge(parent, owner);
    if (!bridge) return undefined;
    transform = bridge.transform.multiply(transform);
    owner = parent;
  }
  return transform;
}

function findNestedInstanceBridge(
  parent: CRCInstance,
  child: CRCInstance,
): CRCNestedPaintEntry | undefined {
  if (
    parent.mainTeardowns.closed ||
    child.mainTeardowns.closed ||
    child.parent !== parent.canvas ||
    child.eventRoot !== parent.eventRoot
  ) return undefined;
  const focusBridge = child.focusParentBridge;
  if (focusBridge?.instance === child) return focusBridge;
  for (const entry of parent.paintEntries) {
    if (
      (entry.paintKind === CRCPaintEntryKind.NestedInstance ||
        entry.paintKind === CRCPaintEntryKind.Resolver) &&
      entry.instance === child
    ) return entry;
  }
  return undefined;
}
