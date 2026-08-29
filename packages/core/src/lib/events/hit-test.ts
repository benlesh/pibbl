import type {
  CRCClippingStackEntry,
  CRCEventRoot,
  CRCInstance,
} from '../types.js';
import { isHit } from '../util/is-hit.js';
import {
  getLegacyHitGeometry,
  type CRCEventTargetRegistration,
} from './registrations.js';

export interface CRCCoordinatePoint {
  readonly x: number;
  readonly y: number;
}

/** Resolves one live target in reverse global paint order. */
export function resolveCoordinateTarget(
  eventRoot: CRCEventRoot,
  point: CRCCoordinatePoint,
): CRCEventTargetRegistration | undefined {
  const instance = eventRoot.rootInstance;
  const canvas = eventRoot.canvas;
  if (!instance || !canvas || !instance.surface.snapshot) return undefined;
  return resolveInstanceTarget({
    eventRoot,
    instance,
    canvas,
    point,
    transform: new DOMMatrix(),
    clippingStack: [],
  });
}

function resolveInstanceTarget({
  eventRoot,
  instance,
  canvas,
  point,
  transform,
  clippingStack,
}: {
  eventRoot: CRCEventRoot;
  instance: CRCInstance;
  canvas: HTMLCanvasElement;
  point: CRCCoordinatePoint;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
}): CRCEventTargetRegistration | undefined {
  const entries = Array.from(instance.paintEntries);
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.kind === 'target') {
      if (!isLiveTarget(eventRoot, entry)) continue;
      const legacyGeometry = getLegacyHitGeometry(entry);
      if (legacyGeometry && !legacyGeometry.path) return entry;
      const path = legacyGeometry?.path ?? entry.path;
      if (isHit({
        canvas,
        path,
        transform: multiplyTransforms(transform, entry.transform),
        x: point.x,
        y: point.y,
        fill: entry.fill,
        lineInteractionWidth: entry.lineInteractionWidth,
        currentClippingStack: mergeClippingStacks(
          clippingStack,
          composeClippingStack(entry.clippingStack, transform),
        ),
      })) {
        return entry;
      }
      continue;
    }

    if (entry.instance.mainTeardowns.closed) continue;
    const childTransform = multiplyTransforms(transform, entry.transform);
    const target = resolveInstanceTarget({
      eventRoot,
      instance: entry.instance,
      canvas,
      point,
      transform: childTransform,
      clippingStack: [
        ...clippingStack,
        ...composeClippingStack(entry.clippingStack, transform),
        {
          path: entry.bounds,
          fillRule: 'nonzero',
          transform: childTransform,
        },
      ],
    });
    if (target) return target;
  }
  return undefined;
}

function isLiveTarget(
  eventRoot: CRCEventRoot,
  target: CRCEventTargetRegistration,
): boolean {
  return target.live &&
    !target.owner.mainTeardowns.closed &&
    target.owner.eventRoot === eventRoot &&
    eventRoot.targets.has(target);
}

function composeClippingStack(
  clippingStack: readonly CRCClippingStackEntry[],
  transform: DOMMatrix,
): readonly CRCClippingStackEntry[] {
  if (clippingStack.length === 0 || transform.isIdentity) {
    return clippingStack;
  }
  return clippingStack.map(entry => ({
    ...entry,
    transform: multiplyTransforms(transform, entry.transform),
  }));
}

function multiplyTransforms(parent: DOMMatrix, child: DOMMatrix): DOMMatrix {
  if (parent.isIdentity) return child;
  if (child.isIdentity) return parent;
  return parent.multiply(child);
}

function mergeClippingStacks(
  parent: readonly CRCClippingStackEntry[],
  child: readonly CRCClippingStackEntry[],
): readonly CRCClippingStackEntry[] {
  if (parent.length === 0) return child;
  if (child.length === 0) return parent;
  return [...parent, ...child];
}
