import type { CRCClippingStackEntry, CRCEventRoot, CRCInstance } from '../types.js';
import { isHit } from '../util/is-hit.js';
import {
  CRCHitDisposition,
  CRCPaintEntryKind,
  hitTestScratchFactory,
  type CRCHitTestInput,
  type CRCHitTestOutput,
  type CRCPathPaintEntry,
} from './paint-entry.js';
import {
  getLegacyHitGeometry,
  type CRCEventTargetRegistration,
} from './registrations.js';

export interface CRCCoordinatePoint {
  readonly x: number;
  readonly y: number;
}

/** Resolves one paint entry in reverse global paint order without allocating. */
export function resolveCoordinateHit(
  eventRoot: CRCEventRoot,
  input: CRCHitTestInput,
  output: CRCHitTestOutput,
): CRCHitTestOutput {
  const instance = eventRoot.rootInstance;
  const canvas = eventRoot.canvas;
  reset(output);
  if (!instance || !canvas || !instance.surface.snapshot) return output;
  return resolveInstanceHit(
    eventRoot,
    instance,
    canvas,
    input.rootX,
    input.rootY,
    new DOMMatrix(),
    output,
  );
}

/** Compatibility wrapper for coordinate event dispatch. */
export function resolveCoordinateTarget(
  eventRoot: CRCEventRoot,
  point: CRCCoordinatePoint,
): CRCEventTargetRegistration | undefined {
  let input = eventRoot.coordinateHitInput;
  let output = eventRoot.coordinateHitOutput;
  if (!input || !output) {
    const scratch = hitTestScratchFactory.create();
    input = eventRoot.coordinateHitInput = scratch.input;
    output = eventRoot.coordinateHitOutput = scratch.output;
  }
  input.rootX = point.x;
  input.rootY = point.y;
  resolveCoordinateHit(eventRoot, input, output);
  return output.disposition === CRCHitDisposition.Target ?
    output.target ?? undefined :
    undefined;
}

function resolveInstanceHit(
  eventRoot: CRCEventRoot,
  instance: CRCInstance,
  canvas: HTMLCanvasElement,
  rootX: number,
  rootY: number,
  transform: DOMMatrix,
  output: CRCHitTestOutput,
): CRCHitTestOutput {
  const entries = Array.from(instance.paintEntries);
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    reset(output);
    switch (entry.paintKind) {
      case CRCPaintEntryKind.Path:
        resolvePathHit(eventRoot, canvas, entry, rootX, rootY, transform, output);
        break;
      case CRCPaintEntryKind.NestedInstance:
      case CRCPaintEntryKind.Resolver: {
        if (entry.instance.mainTeardowns.closed) continue;
        const childTransform = multiplyTransforms(transform, entry.transform);
        const boundaryClippingStack = composeClippingStack(
          entry.clippingStack,
          transform,
        );
        if (!isHit({
          canvas,
          path: entry.bounds,
          transform: childTransform,
          x: rootX,
          y: rootY,
          fill: true,
          lineInteractionWidth: 0,
          currentClippingStack: boundaryClippingStack,
        })) break;
        try {
          if (entry.paintKind === CRCPaintEntryKind.NestedInstance) {
            resolveInstanceHit(
              eventRoot,
              entry.instance,
              canvas,
              rootX,
              rootY,
              childTransform,
              output,
            );
          } else if (entry.resolveLocal) {
            const local = childTransform.inverse().transformPoint(
              new DOMPoint(rootX, rootY),
            );
            entry.resolveLocal(local.x, local.y, output);
          }
        } finally {
          // Child clipping and local coordinates are stack-local to this call.
        }
        break;
      }
    }
    if (output.disposition !== CRCHitDisposition.Miss) return output;
  }
  return output;
}

function resolvePathHit(
  eventRoot: CRCEventRoot,
  canvas: HTMLCanvasElement,
  entry: CRCPathPaintEntry,
  rootX: number,
  rootY: number,
  transform: DOMMatrix,
  output: CRCHitTestOutput,
): void {
  const target = entry.target;
  if (!isLiveTarget(eventRoot, target)) return;
  const legacyGeometry = getLegacyHitGeometry(target);
  if (legacyGeometry && !legacyGeometry.path) {
    output.disposition = CRCHitDisposition.Target;
    output.target = target;
    return;
  }
  if (isHit({
    canvas,
    path: legacyGeometry?.path ?? entry.path,
    transform: multiplyTransforms(transform, entry.transform),
    x: rootX,
    y: rootY,
    fill: entry.fill,
    lineInteractionWidth: entry.lineInteractionWidth,
    currentClippingStack: composeClippingStack(entry.clippingStack, transform),
  })) {
    output.disposition = CRCHitDisposition.Target;
    output.target = target;
  }
}

function reset(output: CRCHitTestOutput): void {
  output.disposition = CRCHitDisposition.Miss;
  output.target = null;
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
  if (clippingStack.length === 0 || transform.isIdentity) return clippingStack;
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
