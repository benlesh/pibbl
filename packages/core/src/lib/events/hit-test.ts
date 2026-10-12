import type { PibblClippingStackEntry, PibblEventRoot, PibblInstance } from '../types.js';
import { isHit } from '../util/is-hit.js';
import {
  PibblHitDisposition,
  PibblPaintEntryKind,
  hitTestScratchFactory,
  type PibblHitTestInput,
  type PibblHitTestOutput,
  type PibblPathPaintEntry,
} from './paint-entry.js';
import type { PibblEventTargetRegistration } from './registrations.js';

export interface PibblCoordinatePoint {
  readonly x: number;
  readonly y: number;
}

/** Resolves one paint entry in reverse global paint order without allocating. */
export function resolveCoordinateHit(
  eventRoot: PibblEventRoot,
  input: PibblHitTestInput,
  output: PibblHitTestOutput,
): PibblHitTestOutput {
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
  eventRoot: PibblEventRoot,
  point: PibblCoordinatePoint,
): PibblEventTargetRegistration | undefined {
  const output = resolveCoordinateOutput(eventRoot, point);
  return output.disposition === PibblHitDisposition.Target ?
    output.target ?? undefined :
    undefined;
}

/** Borrows the root scratch result for immediate coordinate dispatch. */
export function resolveCoordinateOutput(
  eventRoot: PibblEventRoot,
  point: PibblCoordinatePoint,
): PibblHitTestOutput {
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
  return output;
}

function resolveInstanceHit(
  eventRoot: PibblEventRoot,
  instance: PibblInstance,
  canvas: HTMLCanvasElement,
  rootX: number,
  rootY: number,
  transform: DOMMatrix,
  output: PibblHitTestOutput,
): PibblHitTestOutput {
  const entries = Array.from(instance.paintEntries);
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    reset(output);
    switch (entry.paintKind) {
      case PibblPaintEntryKind.Path:
        resolvePathHit(eventRoot, canvas, entry, rootX, rootY, transform, output);
        break;
      case PibblPaintEntryKind.NestedInstance:
      case PibblPaintEntryKind.Resolver: {
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
          if (entry.paintKind === PibblPaintEntryKind.NestedInstance) {
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
    if (output.disposition !== PibblHitDisposition.Miss) return output;
  }
  return output;
}

function resolvePathHit(
  eventRoot: PibblEventRoot,
  canvas: HTMLCanvasElement,
  entry: PibblPathPaintEntry,
  rootX: number,
  rootY: number,
  transform: DOMMatrix,
  output: PibblHitTestOutput,
): void {
  const target = entry.target;
  if (!isLiveTarget(eventRoot, target)) return;
  if (isHit({
    canvas,
    path: entry.path,
    transform: multiplyTransforms(transform, entry.transform),
    x: rootX,
    y: rootY,
    fill: entry.fill,
    lineInteractionWidth: entry.lineInteractionWidth,
    currentClippingStack: composeClippingStack(entry.clippingStack, transform),
  })) {
    output.disposition = PibblHitDisposition.Target;
    output.target = target;
  }
}

function reset(output: PibblHitTestOutput): void {
  output.disposition = PibblHitDisposition.Miss;
  output.target = null;
  delete output.winner;
  delete output.winnerState;
}

function isLiveTarget(
  eventRoot: PibblEventRoot,
  target: PibblEventTargetRegistration,
): boolean {
  return target.live &&
    !target.owner.mainTeardowns.closed &&
    target.owner.eventRoot === eventRoot &&
    eventRoot.targets.has(target);
}

function composeClippingStack(
  clippingStack: readonly PibblClippingStackEntry[],
  transform: DOMMatrix,
): readonly PibblClippingStackEntry[] {
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
